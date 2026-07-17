import type { ExpertPayoutAccount, SettlementPayout } from '../types';
import { supabase } from './supabase';

const ACCOUNT_KEY = 'ai_expert_payout_accounts';
const PAYOUT_KEY = 'ai_settlement_payouts';
const payoutStatuses = ['queued', 'processing', 'paid', 'failed'] as const;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;
const stringAt = (record: Record<string, unknown>, ...keys: readonly string[]): string | undefined => {
    for (const key of keys) {
        const value = record[key];
        if (typeof value === 'string') return value;
    }
    return undefined;
};

const isPayoutStatus = (value: unknown): value is SettlementPayout['status'] =>
    typeof value === 'string' && payoutStatuses.some((status) => status === value);

const parseAccount = (value: unknown): ExpertPayoutAccount | null => {
    if (!isRecord(value)) return null;
    const expertId = stringAt(value, 'expert_id', 'expertId');
    const bankName = stringAt(value, 'bank_name', 'bankName');
    const accountNumber = stringAt(value, 'account_number', 'accountNumber');
    const accountHolder = stringAt(value, 'account_holder', 'accountHolder');
    if (!expertId || !bankName || !accountNumber || !accountHolder) return null;
    return {
        ...(stringAt(value, 'id') ? { id: stringAt(value, 'id') } : {}),
        expertId,
        bankName,
        accountNumber,
        accountHolder,
        ...(stringAt(value, 'verified_at', 'verifiedAt') ? { verifiedAt: stringAt(value, 'verified_at', 'verifiedAt') } : {}),
        ...(stringAt(value, 'updated_at', 'updatedAt') ? { updatedAt: stringAt(value, 'updated_at', 'updatedAt') } : {}),
    };
};

const parsePayout = (value: unknown): SettlementPayout | null => {
    if (!isRecord(value)) return null;
    const id = stringAt(value, 'id');
    const workId = stringAt(value, 'work_id', 'workId');
    const expertId = stringAt(value, 'expert_id', 'expertId');
    const amount = value.amount;
    const status = value.status ?? 'queued';
    if (!id || !workId || !expertId || typeof amount !== 'number' || !Number.isFinite(amount) || !isPayoutStatus(status)) return null;
    return {
        id,
        workId,
        expertId,
        ...(stringAt(value, 'payout_account_id', 'payoutAccountId') ? { payoutAccountId: stringAt(value, 'payout_account_id', 'payoutAccountId') } : {}),
        amount,
        status,
        ...(stringAt(value, 'failure_reason', 'failureReason') ? { failureReason: stringAt(value, 'failure_reason', 'failureReason') } : {}),
        requestedAt: stringAt(value, 'requested_at', 'requestedAt') || new Date().toISOString(),
        ...(stringAt(value, 'processed_at', 'processedAt') ? { processedAt: stringAt(value, 'processed_at', 'processedAt') } : {}),
    };
};

const readLocal = <T>(key: string, parse: (value: unknown) => T | null): T[] => {
    try {
        const raw = localStorage.getItem(key);
        const parsed: unknown = raw ? JSON.parse(raw) : [];
        return Array.isArray(parsed) ? parsed.map(parse).filter((item): item is T => item !== null) : [];
    } catch {
        return [];
    }
};

const writeLocal = <T>(key: string, items: readonly T[]): void => localStorage.setItem(key, JSON.stringify(items));

export async function getExpertPayoutAccount(expertId: string): Promise<ExpertPayoutAccount | null> {
    const localAccount = readLocal(ACCOUNT_KEY, parseAccount).find((account) => account.expertId === expertId) || null;
    if (!supabase) return localAccount;
    const { data, error } = await supabase.from('expert_payout_accounts').select('*').eq('expert_id', expertId).maybeSingle();
    return error ? localAccount : parseAccount(data) || localAccount;
}

export async function saveExpertPayoutAccount(account: ExpertPayoutAccount): Promise<ExpertPayoutAccount> {
    const normalizedAccount: ExpertPayoutAccount = {
        ...account,
        bankName: account.bankName.trim(),
        accountNumber: account.accountNumber.replace(/[^\d-]/g, '').trim(),
        accountHolder: account.accountHolder.trim(),
        updatedAt: new Date().toISOString(),
    };
    if (!normalizedAccount.bankName || !normalizedAccount.accountNumber || !normalizedAccount.accountHolder) {
        throw new Error('은행명, 계좌번호, 예금주를 모두 입력해주세요.');
    }
    if (!supabase) {
        const nextAccount: ExpertPayoutAccount = { ...normalizedAccount, id: normalizedAccount.id || `payout-account-${normalizedAccount.expertId}` };
        writeLocal(ACCOUNT_KEY, [nextAccount, ...readLocal(ACCOUNT_KEY, parseAccount).filter((item) => item.expertId !== normalizedAccount.expertId)]);
        return nextAccount;
    }
    const { data, error } = await supabase.from('expert_payout_accounts').upsert({
        expert_id: normalizedAccount.expertId,
        bank_name: normalizedAccount.bankName,
        account_number: normalizedAccount.accountNumber,
        account_holder: normalizedAccount.accountHolder,
        updated_at: normalizedAccount.updatedAt,
    }, { onConflict: 'expert_id' }).select().single();
    const savedAccount = parseAccount(data);
    if (error || !savedAccount) throw new Error('데이터베이스 통신 오류: 정산 계좌 저장 실패');
    return savedAccount;
}

export async function getExpertSettlementPayouts(expertId: string): Promise<SettlementPayout[]> {
    const localPayouts = readLocal(PAYOUT_KEY, parsePayout).filter((payout) => payout.expertId === expertId);
    if (!supabase) return localPayouts;
    const { data, error } = await supabase.from('settlement_payouts').select('*').eq('expert_id', expertId).order('requested_at', { ascending: false });
    if (error || !Array.isArray(data)) return localPayouts;
    const seen = new Set<string>();
    return [...data.map(parsePayout).filter((item): item is SettlementPayout => item !== null), ...localPayouts]
        .filter((payout) => {
            if (seen.has(payout.id)) return false;
            seen.add(payout.id);
            return true;
        });
}
