import type {
    NotificationChannel,
    NotificationEvent,
    NotificationEventType,
    UserNotificationPreference,
} from '../types';
import { supabase } from './supabase';

const PREFERENCE_KEY = 'ai_user_notification_preferences';
const EVENT_KEY = 'ai_notification_events';

type QueueNotificationInput = {
    userId: string;
    type: NotificationEventType;
    title: string;
    body: string;
    relatedType?: NotificationEvent['relatedType'];
    relatedId?: string;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null;

const stringAt = (record: Record<string, unknown>, ...keys: readonly string[]): string | undefined => {
    for (const key of keys) {
        const value = record[key];
        if (typeof value === 'string') return value;
    }
    return undefined;
};

const notificationTypes = [
    'payment_completed',
    'workroom_created',
    'deliverable_submitted',
    'revision_requested',
    'settlement_available',
    'settlement_requested',
    'settlement_paid',
] as const;

const notificationChannels = ['in_app', 'kakao_alimtalk', 'sms'] as const;
const notificationStatuses = ['queued', 'sent', 'failed', 'skipped'] as const;
const relatedTypes = ['proposal', 'work', 'deliverable', 'settlement'] as const;

const isOneOf = <T extends string>(value: unknown, values: readonly T[]): value is T =>
    typeof value === 'string' && values.some((candidate) => candidate === value);

const parsePreference = (value: unknown): UserNotificationPreference | null => {
    if (!isRecord(value)) return null;
    const userId = stringAt(value, 'user_id', 'userId');
    if (!userId) return null;

    return {
        userId,
        phoneNumber: stringAt(value, 'phone_number', 'phoneNumber') || '',
        kakaoAlimtalkEnabled: Boolean(value.kakao_alimtalk_enabled ?? value.kakaoAlimtalkEnabled),
        smsFallbackEnabled: Boolean(value.sms_fallback_enabled ?? value.smsFallbackEnabled),
        ...(stringAt(value, 'updated_at', 'updatedAt') ? { updatedAt: stringAt(value, 'updated_at', 'updatedAt') } : {}),
    };
};

const parseEvent = (value: unknown): NotificationEvent | null => {
    if (!isRecord(value)) return null;
    const id = stringAt(value, 'id');
    const userId = stringAt(value, 'user_id', 'userId');
    const type = value.event_type ?? value.type;
    const title = stringAt(value, 'title');
    const body = stringAt(value, 'body');
    const status = value.status ?? 'queued';
    const channels = value.channels ?? ['in_app'];
    if (!id || !userId || !title || !body || !isOneOf(type, notificationTypes) || !isOneOf(status, notificationStatuses)
        || !Array.isArray(channels) || !channels.every((channel) => isOneOf(channel, notificationChannels))) return null;

    const relatedType = value.related_type ?? value.relatedType;
    if (relatedType !== undefined && !isOneOf(relatedType, relatedTypes)) return null;

    return {
        id,
        userId,
        type,
        title,
        body,
        channels,
        status,
        ...(isOneOf(relatedType, relatedTypes) ? { relatedType } : {}),
        ...(stringAt(value, 'related_id', 'relatedId') ? { relatedId: stringAt(value, 'related_id', 'relatedId') } : {}),
        ...(stringAt(value, 'provider') ? { provider: stringAt(value, 'provider') } : {}),
        ...(stringAt(value, 'failure_reason', 'failureReason') ? { failureReason: stringAt(value, 'failure_reason', 'failureReason') } : {}),
        createdAt: stringAt(value, 'created_at', 'createdAt') || new Date().toISOString(),
        ...(stringAt(value, 'sent_at', 'sentAt') ? { sentAt: stringAt(value, 'sent_at', 'sentAt') } : {}),
    };
};

const readLocal = <T>(key: string, parse: (value: unknown) => T | null): T[] => {
    try {
        const raw = localStorage.getItem(key);
        const parsed: unknown = raw ? JSON.parse(raw) : [];
        return Array.isArray(parsed)
            ? parsed.map(parse).filter((item): item is T => item !== null)
            : [];
    } catch {
        return [];
    }
};

const writeLocal = <T>(key: string, items: readonly T[]): void => {
    localStorage.setItem(key, JSON.stringify(items));
};

const resolveChannels = (preference: UserNotificationPreference | null): NotificationChannel[] => {
    const channels: NotificationChannel[] = ['in_app'];
    const hasPhone = Boolean(preference?.phoneNumber.trim());
    if (hasPhone && preference?.kakaoAlimtalkEnabled) channels.push('kakao_alimtalk');
    if (hasPhone && preference?.smsFallbackEnabled) channels.push('sms');
    return channels;
};

export async function getNotificationPreference(userId: string): Promise<UserNotificationPreference | null> {
    const localPreference = readLocal(PREFERENCE_KEY, parsePreference).find((preference) => preference.userId === userId) || null;
    if (!supabase) return localPreference;

    try {
        const { data, error } = await supabase.from('notification_preferences').select('*').eq('user_id', userId).maybeSingle();
        if (error) return localPreference;
        return parsePreference(data) || localPreference;
    } catch (error) {
        console.error('알림 설정 로딩 실패:', error);
        return localPreference;
    }
}

export async function saveNotificationPreference(preference: UserNotificationPreference): Promise<UserNotificationPreference> {
    const nextPreference: UserNotificationPreference = {
        ...preference,
        phoneNumber: preference.phoneNumber.replace(/[^\d-]/g, '').trim(),
        updatedAt: new Date().toISOString(),
    };
    if (!nextPreference.phoneNumber) {
        nextPreference.kakaoAlimtalkEnabled = false;
        nextPreference.smsFallbackEnabled = false;
    }
    const preferences = readLocal(PREFERENCE_KEY, parsePreference);
    writeLocal(PREFERENCE_KEY, [nextPreference, ...preferences.filter((item) => item.userId !== nextPreference.userId)]);
    if (!supabase) return nextPreference;

    try {
        const { data, error } = await supabase.from('notification_preferences').upsert({
            user_id: nextPreference.userId,
            phone_number: nextPreference.phoneNumber,
            kakao_alimtalk_enabled: nextPreference.kakaoAlimtalkEnabled,
            sms_fallback_enabled: nextPreference.smsFallbackEnabled,
            updated_at: nextPreference.updatedAt,
        }, { onConflict: 'user_id' }).select().single();
        return error ? nextPreference : parsePreference(data) || nextPreference;
    } catch (error) {
        console.error('알림 설정 저장 실패:', error);
        return nextPreference;
    }
}

export async function getUserNotifications(userId: string): Promise<NotificationEvent[]> {
    const localEvents = readLocal(EVENT_KEY, parseEvent).filter((event) => event.userId === userId);
    if (!supabase) return localEvents;

    try {
        const { data, error } = await supabase.from('notification_events').select('*').eq('user_id', userId).order('created_at', { ascending: false });
        if (error || !Array.isArray(data)) return localEvents;
        const remoteEvents = data.map(parseEvent).filter((event): event is NotificationEvent => event !== null);
        const seen = new Set<string>();
        return [...remoteEvents, ...localEvents].filter((event) => {
            if (seen.has(event.id)) return false;
            seen.add(event.id);
            return true;
        });
    } catch (error) {
        console.error('알림 목록 로딩 실패:', error);
        return localEvents;
    }
}

export async function queueNotificationEvent(input: QueueNotificationInput): Promise<NotificationEvent> {
    const preference = await getNotificationPreference(input.userId);
    const event: NotificationEvent = {
        id: `notification-${input.type}-${input.relatedId || input.userId}-${Date.now()}`,
        userId: input.userId,
        type: input.type,
        title: input.title,
        body: input.body,
        channels: resolveChannels(preference),
        status: 'queued',
        ...(input.relatedType ? { relatedType: input.relatedType } : {}),
        ...(input.relatedId ? { relatedId: input.relatedId } : {}),
        createdAt: new Date().toISOString(),
    };
    writeLocal(EVENT_KEY, [event, ...readLocal(EVENT_KEY, parseEvent)]);
    if (!supabase) return event;

    try {
        const { data, error } = await supabase.functions.invoke('notification-queue', {
            body: { userId: event.userId, type: event.type, relatedType: event.relatedType, relatedId: event.relatedId },
        });
        const savedEvent = error ? null : parseEvent(data);
        if (!savedEvent) return event;
        writeLocal(EVENT_KEY, [savedEvent, ...readLocal(EVENT_KEY, parseEvent).filter((item) => item.id !== event.id)]);
        return savedEvent;
    } catch (error) {
        console.error('알림 이벤트 등록 실패:', error);
        return event;
    }
}

export type { QueueNotificationInput };
