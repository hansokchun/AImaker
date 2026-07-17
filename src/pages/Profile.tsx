import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ROUTES } from '../constants/routes';
import { EXTERNAL_CONTACT_WARNING, hasExternalContactInFields } from '../constants/policies';
import { useAuth } from '../contexts/AuthContext';
import { PageLoading } from '../components/PageLoading';
import { createDefaultProfile, getStoredProfile, saveProfile } from '../lib/storage';
import { supabase } from '../lib/supabase';
import { AvatarUploadError, prepareAvatarUpload } from '../lib/avatarUpload';
import type { ExpertProfile } from '../types';
import './Profile.css';

type Role = 'client' | 'expert';

type ProfileDraft = {
    readonly role: Role;
    readonly clientName: string;
    readonly clientInterests: string;
    readonly clientPurposes: string;
    readonly profile: ExpertProfile;
    readonly expertTools: string;
    readonly expertSamples: string;
};

const profileDraftKey = (userId: string) => `aiconnect:profile-draft:${userId}`;

const readProfileDraft = (userId: string): ProfileDraft | null => {
    try {
        const raw = localStorage.getItem(profileDraftKey(userId));
        if (!raw) return null;
        const value: unknown = JSON.parse(raw);
        if (!value || typeof value !== 'object') return null;
        return value as ProfileDraft;
    } catch {
        return null;
    }
};

const parseCommaList = (value: string) =>
    value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);

const listToInput = (items?: string[]) => (items || []).join(', ');

export default function Profile() {
    const { user, loading: authLoading } = useAuth();
    const navigate = useNavigate();

    const [role, setRole] = useState<Role>('expert');
    const [clientName, setClientName] = useState('');
    const [clientInterests, setClientInterests] = useState('');
    const [clientPurposes, setClientPurposes] = useState('');
    const [profile, setProfile] = useState<ExpertProfile>(createDefaultProfile());
    const [expertTools, setExpertTools] = useState('');
    const [expertSamples, setExpertSamples] = useState('');
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
    const uploadedImageUrlRef = useRef('');
    const profileDraftHydratedRef = useRef(false);

    const notifyProfileUpdated = () => {
        if (!user) return;
        window.dispatchEvent(new CustomEvent('aiconnect:profile-updated', { detail: { userId: user.id } }));
    };

    useEffect(() => {
        if (!user) return;

        const loadProfile = async () => {
            let avatarUrl = '';

            if (supabase) {
                const { data: userProfile } = await supabase
                    .from('profiles')
                    .select('is_expert, name, avatar_url, interests, request_purposes')
                    .eq('id', user.id)
                    .single();

                if (userProfile) {
                    setRole(userProfile.is_expert ? 'expert' : 'client');
                    setClientName(userProfile.name || '');
                    setClientInterests(listToInput(userProfile.interests));
                    setClientPurposes(listToInput(userProfile.request_purposes));
                    avatarUrl = userProfile.avatar_url || '';
                }
            }

            const stored = await getStoredProfile(user.id);
            const nextProfile = {
                ...createDefaultProfile(),
                ...stored,
                imageUrl: stored?.imageUrl || avatarUrl,
                activities: stored?.activities?.length ? stored.activities : [''],
                awards: stored?.awards?.length ? stored.awards : [''],
                sampleLinks: stored?.sampleLinks || [],
            };

            setProfile(nextProfile);
            setExpertTools(listToInput(nextProfile.aiTools));
            setExpertSamples(listToInput(nextProfile.sampleLinks));
            if (!clientName && nextProfile.name) setClientName(nextProfile.name);

            const draft = readProfileDraft(user.id);
            if (draft?.profile && (draft.role === 'client' || draft.role === 'expert')) {
                setRole(draft.role);
                setClientName(draft.clientName || '');
                setClientInterests(draft.clientInterests || '');
                setClientPurposes(draft.clientPurposes || '');
                setProfile({ ...nextProfile, ...draft.profile });
                setExpertTools(draft.expertTools || '');
                setExpertSamples(draft.expertSamples || '');
            }
            profileDraftHydratedRef.current = true;
        };

        loadProfile();
        // clientName is intentionally not a dependency; loading should run once per user.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user]);

    useEffect(() => {
        if (!user || !profileDraftHydratedRef.current) return;
        const draft: ProfileDraft = {
            role,
            clientName,
            clientInterests,
            clientPurposes,
            profile,
            expertTools,
            expertSamples,
        };
        localStorage.setItem(profileDraftKey(user.id), JSON.stringify(draft));
    }, [clientInterests, clientName, clientPurposes, expertSamples, expertTools, profile, role, user]);

    if (authLoading) {
        return (
            <PageLoading
                title="프로필 정보를 불러오는 중입니다"
                description="로그인 상태와 계정 정보를 확인하고 있습니다."
            />
        );
    }

    if (!user) {
        return (
            <div className="login-required">
                <span className="material-symbols-outlined">lock</span>
                <h2>로그인이 필요합니다</h2>
                <p>프로필을 관리하려면 먼저 로그인해 주세요.</p>
                <Link to={ROUTES.LOGIN} className="btn-primary">로그인하기</Link>
            </div>
        );
    }

    const updateProfile = (field: keyof ExpertProfile, value: string) => {
        setValidationErrors((prev) => ({ ...prev, [field]: '' }));
        setProfile((prev) => ({ ...prev, [field]: value }));
    };

    const handleImageUpload = async (e: ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0 || !user) return;
        if (!supabase) {
            alert('이미지 업로드를 사용하려면 Supabase 연결이 필요합니다.');
            return;
        }

        const file = e.target.files[0];
        setUploading(true);
        try {
            const upload = await prepareAvatarUpload(user.id, file);
            const { error: uploadError } = await supabase.storage
                .from('profile-images')
                .upload(upload.objectPath, file, { contentType: upload.contentType, upsert: false });

            if (uploadError) throw uploadError;

            const { data } = supabase.storage.from('profile-images').getPublicUrl(upload.objectPath);
            uploadedImageUrlRef.current = data.publicUrl;
            setProfile((prev) => ({ ...prev, imageUrl: data.publicUrl }));
        } catch (error) {
            console.error('프로필 이미지 업로드 실패:', error);
            alert(error instanceof AvatarUploadError
                ? error.message
                : '이미지 업로드에 실패했습니다. Supabase Storage 설정을 확인해 주세요.');
        } finally {
            setUploading(false);
        }
    };

    const handleListItemChange = (field: 'activities' | 'awards', index: number, value: string) => {
        setProfile((prev) => {
            const updated = [...prev[field]];
            updated[index] = value;
            return { ...prev, [field]: updated };
        });
    };

    const handleAddListItem = (field: 'activities' | 'awards') => {
        setProfile((prev) => ({ ...prev, [field]: [...prev[field], ''] }));
    };

    const handleRemoveListItem = (field: 'activities' | 'awards', index: number) => {
        setProfile((prev) => {
            if (prev[field].length <= 1) return prev;
            return { ...prev, [field]: prev[field].filter((_, itemIndex) => itemIndex !== index) };
        });
    };

    const validateClient = () => {
        const nextErrors: Record<string, string> = {};
        if (!clientName.trim()) nextErrors.clientName = '표시 이름/닉네임을 입력해 주세요.';
        if (parseCommaList(clientInterests).length === 0) nextErrors.clientInterests = '관심 작업 분야를 입력해 주세요.';
        if (parseCommaList(clientPurposes).length === 0) nextErrors.clientPurposes = '주로 맡기려는 목적을 입력해 주세요.';
        setValidationErrors(nextErrors);
        return Object.keys(nextErrors).length === 0;
    };

    const validateExpert = () => {
        const nextErrors: Record<string, string> = {};
        if (!profile.name.trim()) nextErrors.name = '이름을 입력해 주세요.';
        if (parseCommaList(expertTools).length === 0) nextErrors.aiTools = '사용 도구를 하나 이상 입력해 주세요.';
        setValidationErrors(nextErrors);
        return Object.keys(nextErrors).length === 0;
    };

    const handleSave = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();

        if (role === 'client') {
            if (!validateClient()) return;
            setSaving(true);
            try {
                const updatePayload = {
                    name: clientName.trim(),
                    avatar_url: uploadedImageUrlRef.current || profile.imageUrl,
                    interests: parseCommaList(clientInterests),
                    request_purposes: parseCommaList(clientPurposes),
                    is_expert: false,
                };
                if (supabase) {
                    const { error } = await supabase.from('profiles').update(updatePayload).eq('id', user.id);
                    if (error) throw new Error(`기본 프로필 저장 실패 (${error.message})`);
                }
                notifyProfileUpdated();
                localStorage.removeItem(profileDraftKey(user.id));
                alert('프로필이 저장되었습니다.');
                navigate(ROUTES.MY_PAGE);
            } catch (error) {
                alert(error instanceof Error ? error.message : '저장에 실패했습니다.');
            } finally {
                setSaving(false);
            }
            return;
        }

        if (!validateExpert()) return;

        const cleanedProfile: ExpertProfile = {
            ...profile,
            imageUrl: uploadedImageUrlRef.current || profile.imageUrl,
            name: profile.name.trim(),
            aiTools: parseCommaList(expertTools),
            sampleLinks: parseCommaList(expertSamples),
            contactAvailableTime: profile.contactAvailableTime?.trim() || '',
            averageResponseTime: profile.averageResponseTime?.trim() || '',
            activities: profile.activities.filter((item) => item.trim()),
            awards: profile.awards.filter((item) => item.trim()),
        };

        const policyFields = [
            cleanedProfile.name,
            cleanedProfile.greeting,
            ...(cleanedProfile.sampleLinks ?? []),
            ...cleanedProfile.activities,
            ...cleanedProfile.awards,
        ];
        if (hasExternalContactInFields(policyFields)) {
            alert(EXTERNAL_CONTACT_WARNING);
            return;
        }

        setSaving(true);
        try {
            await saveProfile(user.id, cleanedProfile);
            notifyProfileUpdated();
            localStorage.removeItem(profileDraftKey(user.id));
            alert('프로필이 성공적으로 저장되었습니다.');
            navigate(`/expert/${user.id}`);
        } catch (error) {
            alert(error instanceof Error ? error.message : '저장에 실패했습니다.');
        } finally {
            setSaving(false);
        }
    };

    const renderAvatarUpload = () => (
        <div className="avatar-upload-area">
            {profile.imageUrl ? (
                <img src={profile.imageUrl} alt="프로필 미리보기" className="avatar-preview" />
            ) : (
                <div className="avatar-placeholder">
                    <span className="material-symbols-outlined">add_photo_alternate</span>
                    이미지 없음
                </div>
            )}
            <div className="avatar-url-input">
                <div className="profile-form-group">
                    <label>프로필 이미지 업로드 <span className="label-hint">(선택)</span></label>
                    <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        disabled={uploading}
                        className="profile-input"
                    />
                    {uploading && <p className="profile-help-text">업로드 중...</p>}
                </div>
            </div>
        </div>
    );

    const renderDynamicList = (
        field: 'activities' | 'awards',
        placeholder: string,
        addLabel: string,
    ) => (
        <div className="dynamic-list">
            {profile[field].map((item, index) => (
                <div key={index} className="dynamic-list-item">
                    <input
                        type="text"
                        className="profile-input"
                        value={item}
                        onChange={(event) => handleListItemChange(field, index, event.target.value)}
                        placeholder={placeholder}
                    />
                    <button
                        type="button"
                        className="btn-remove-item"
                        onClick={() => handleRemoveListItem(field, index)}
                        title="삭제"
                    >
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>
            ))}
            <button type="button" className="btn-add-item" onClick={() => handleAddListItem(field)}>
                <span className="material-symbols-outlined">add</span>
                {addLabel}
            </button>
        </div>
    );

    return (
        <>
            <div className="profile-hero">
                <div className="container">
                    <h1 className="profile-title">프로필 수정</h1>
                    <p className="profile-subtitle">
                        {role === 'expert'
                            ? '전문가로 보여줄 정보를 관리합니다.'
                            : '의뢰자로 사용할 기본 정보를 관리합니다.'}
                    </p>
                </div>
            </div>

            <main className="container">
                <form className="profile-layout" onSubmit={handleSave} noValidate>
                    {role === 'client' && (
                        <div className="profile-section">
                            <h2>
                                <span className="material-symbols-outlined">person</span>
                                의뢰자 프로필
                            </h2>
                            {renderAvatarUpload()}
                            <div className="profile-form-group">
                                <label htmlFor="client-name">표시 이름/닉네임 <span className="label-hint">(필수)</span></label>
                                <input
                                    id="client-name"
                                    type="text"
                                    className={`profile-input ${validationErrors.clientName ? 'profile-input-error' : ''}`}
                                    value={clientName}
                                    onChange={(event) => {
                                        setClientName(event.target.value);
                                        setValidationErrors((prev) => ({ ...prev, clientName: '' }));
                                    }}
                                    placeholder="예: 홍길동"
                                />
                                {validationErrors.clientName && <p className="profile-field-error">{validationErrors.clientName}</p>}
                            </div>
                            <div className="profile-form-group">
                                <label htmlFor="client-interests">관심 작업 분야 <span className="label-hint">(필수)</span></label>
                                <input
                                    id="client-interests"
                                    type="text"
                                    className={`profile-input ${validationErrors.clientInterests ? 'profile-input-error' : ''}`}
                                    value={clientInterests}
                                    onChange={(event) => {
                                        setClientInterests(event.target.value);
                                        setValidationErrors((prev) => ({ ...prev, clientInterests: '' }));
                                    }}
                                    placeholder="예: 영상, 이미지, 자동화, 글쓰기"
                                />
                                {validationErrors.clientInterests && <p className="profile-field-error">{validationErrors.clientInterests}</p>}
                            </div>
                            <div className="profile-form-group">
                                <label htmlFor="client-purposes">주로 맡기려는 목적 <span className="label-hint">(필수)</span></label>
                                <input
                                    id="client-purposes"
                                    type="text"
                                    className={`profile-input ${validationErrors.clientPurposes ? 'profile-input-error' : ''}`}
                                    value={clientPurposes}
                                    onChange={(event) => {
                                        setClientPurposes(event.target.value);
                                        setValidationErrors((prev) => ({ ...prev, clientPurposes: '' }));
                                    }}
                                    placeholder="예: 홍보, 쇼핑몰, 유튜브, 업무 자동화"
                                />
                                {validationErrors.clientPurposes && <p className="profile-field-error">{validationErrors.clientPurposes}</p>}
                            </div>
                        </div>
                    )}

                    {role === 'expert' && (
                        <>
                            <div className="profile-section">
                                <h2>
                                    <span className="material-symbols-outlined">person</span>
                                    전문가 프로필
                                </h2>
                                {renderAvatarUpload()}
                                <div className="profile-form-group">
                                    <label htmlFor="expert-name">전문가 이름/닉네임 <span className="label-hint">(필수)</span></label>
                                    <input
                                        id="expert-name"
                                        type="text"
                                        className={`profile-input ${validationErrors.name ? 'profile-input-error' : ''}`}
                                        value={profile.name}
                                        onChange={(event) => updateProfile('name', event.target.value)}
                                        placeholder="예: AI 영상 스튜디오"
                                    />
                                    {validationErrors.name && <p className="profile-field-error">{validationErrors.name}</p>}
                                </div>
                                <div className="profile-form-group">
                                    <label htmlFor="expert-tools">사용 도구 <span className="label-hint">(필수)</span></label>
                                    <input
                                        id="expert-tools"
                                        type="text"
                                        className={`profile-input ${validationErrors.aiTools ? 'profile-input-error' : ''}`}
                                        value={expertTools}
                                        onChange={(event) => {
                                            setExpertTools(event.target.value);
                                            setValidationErrors((prev) => ({ ...prev, aiTools: '' }));
                                        }}
                                        placeholder="예: ChatGPT, Midjourney, Runway"
                                    />
                                    {validationErrors.aiTools && <p className="profile-field-error">{validationErrors.aiTools}</p>}
                                </div>
                                <div className="profile-form-group">
                                    <label htmlFor="expert-profession">전문 분야 <span className="label-hint">(선택)</span></label>
                                    <input
                                        id="expert-profession"
                                        type="text"
                                        className="profile-input"
                                        value={profile.profession}
                                        onChange={(event) => updateProfile('profession', event.target.value)}
                                        placeholder="예: AI 이미지 제작 전문가"
                                    />
                                </div>
                                <div className="profile-form-group">
                                    <label htmlFor="expert-one-liner">한 줄 소개 <span className="label-hint">(선택)</span></label>
                                    <input
                                        id="expert-one-liner"
                                        type="text"
                                        className="profile-input"
                                        value={profile.oneLiner}
                                        onChange={(event) => updateProfile('oneLiner', event.target.value)}
                                        placeholder="예: 빠른 이미지 시안과 실무형 보정을 제공합니다."
                                    />
                                </div>
                                <div className="profile-form-group">
                                    <label htmlFor="expert-intro">소개 <span className="label-hint">(선택)</span></label>
                                    <textarea
                                        id="expert-intro"
                                        className="profile-input"
                                        rows={5}
                                        value={profile.greeting}
                                        onChange={(event) => updateProfile('greeting', event.target.value)}
                                        placeholder="작업 방식, 강점, 잘 맞는 의뢰 상황을 적어 주세요."
                                    />
                                </div>
                                <div className="profile-form-group">
                                    <label htmlFor="expert-samples">대표 포트폴리오/샘플 <span className="label-hint">(선택)</span></label>
                                    <input
                                        id="expert-samples"
                                        type="text"
                                        className="profile-input"
                                        value={expertSamples}
                                        onChange={(event) => setExpertSamples(event.target.value)}
                                        placeholder="예: https://example.com/sample-a, https://example.com/sample-b"
                                    />
                                </div>
                                <div className="profile-form-group">
                                    <label htmlFor="expert-contact-time">연락 가능 시간 <span className="label-hint">(선택)</span></label>
                                    <input
                                        id="expert-contact-time"
                                        type="text"
                                        className="profile-input"
                                        value={profile.contactAvailableTime || ''}
                                        onChange={(event) => updateProfile('contactAvailableTime', event.target.value)}
                                        placeholder="예: 평일 10:00-18:00"
                                    />
                                </div>
                                <div className="profile-form-group">
                                    <label htmlFor="expert-response-time">평균 응답 시간 <span className="label-hint">(선택)</span></label>
                                    <input
                                        id="expert-response-time"
                                        type="text"
                                        className="profile-input"
                                        value={profile.averageResponseTime || ''}
                                        onChange={(event) => updateProfile('averageResponseTime', event.target.value)}
                                        placeholder="예: 평균 2시간 이내"
                                    />
                                </div>
                            </div>

                            <div className="profile-section">
                                <h2>
                                    <span className="material-symbols-outlined">history_edu</span>
                                    수상/경력/활동
                                </h2>
                                <div className="profile-form-group">
                                    <label>경력/활동 <span className="label-hint">(선택)</span></label>
                                    {renderDynamicList('activities', '예: AI 숏폼 브랜드 캠페인 20건 제작', '활동 추가')}
                                </div>
                                <div className="profile-form-group">
                                    <label>수상/인증 <span className="label-hint">(선택)</span></label>
                                    {renderDynamicList('awards', '예: 2025 AI 콘텐츠 공모전 수상', '수상/인증 추가')}
                                </div>
                            </div>
                        </>
                    )}

                    <div className="profile-actions">
                        <button type="submit" className="btn-primary btn-save-profile" disabled={saving}>
                            {saving ? '저장 중...' : '프로필 저장하기'}
                        </button>
                    </div>
                </form>
            </main>
        </>
    );
}
