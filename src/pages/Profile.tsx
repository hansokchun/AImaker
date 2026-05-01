/**
 * Profile 페이지 — 전문가 프로필 관리
 * - 로그인한 사용자만 접근 가능 (비로그인 시 로그인 안내 화면)
 * - ExpertDetail 페이지와 동일한 구조(프로필, 인사말, 경력, 도구, 패키지)를
 *   편집 가능한 폼으로 제공
 * - 저장 시 localStorage에 사용자별로 데이터를 보관
 *   (향후 Supabase expert_profiles 테이블로 마이그레이션 예정)
 */
import { useState, useEffect, type ChangeEvent, type KeyboardEvent, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getStoredProfile, saveProfile, createDefaultProfile } from '../lib/storage';
import { ROUTES } from '../constants/routes';
import type { ExpertProfile, PackageInfo } from '../types';
import './Profile.css';

/** 패키지 탭 종류 (PackageCard와 동일) */
type PackageTab = 'standard' | 'deluxe' | 'premium';

/** 패키지 탭 한글 라벨 */
const PACKAGE_LABELS: Record<PackageTab, string> = {
    standard: 'Standard',
    deluxe: 'Deluxe',
    premium: 'Premium',
};

export default function Profile() {
    const { user, loading: authLoading } = useAuth();

    // 프로필 폼 상태 — createDefaultProfile()로 초기화하여 빈 폼 제공
    const [profile, setProfile] = useState<ExpertProfile>(createDefaultProfile());
    const [activePackageTab, setActivePackageTab] = useState<PackageTab>('standard');
    const [saving, setSaving] = useState<boolean>(false);
    const [showSuccess, setShowSuccess] = useState<boolean>(false);

    // 태그 입력 필드 상태 (AI 도구, 편집 도구 각각)
    const [aiToolInput, setAiToolInput] = useState<string>('');
    const [editToolInput, setEditToolInput] = useState<string>('');

    // 로그인된 사용자의 저장된 프로필을 불러온다
    useEffect(() => {
        if (!user) return;

        const stored = getStoredProfile(user.id);
        if (stored) {
            // 저장된 프로필에 빈 배열이 있을 수 있으므로 기본값과 병합
            setProfile({
                ...createDefaultProfile(),
                ...stored,
                // 배열 필드가 비어있으면 편집 UI를 위해 빈 항목 하나 유지
                activities: stored.activities?.length ? stored.activities : [''],
                awards: stored.awards?.length ? stored.awards : [''],
                packages: {
                    standard: { ...createDefaultProfile().packages.standard, ...stored.packages?.standard },
                    deluxe: { ...createDefaultProfile().packages.deluxe, ...stored.packages?.deluxe },
                    premium: { ...createDefaultProfile().packages.premium, ...stored.packages?.premium },
                },
            });
        }
    }, [user]);

    // ===== 인증 상태 체크 =====

    // 인증 로딩 중이면 대기
    if (authLoading) {
        return (
            <div className="login-required">
                <span className="material-symbols-outlined">hourglass_top</span>
                <h2>로딩 중...</h2>
            </div>
        );
    }

    // 비로그인 상태 → 로그인 안내
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

    // ===== 필드 변경 핸들러 =====

    /** 단순 텍스트 필드 변경 */
    const handleChange = (field: keyof ExpertProfile, value: string) => {
        setProfile((prev) => ({ ...prev, [field]: value }));
    };

    // ===== 동적 리스트 핸들러 (경력, 수상 이력) =====

    /** 리스트 항목 값 변경 */
    const handleListItemChange = (field: 'activities' | 'awards', index: number, value: string) => {
        setProfile((prev) => {
            const updated = [...prev[field]];
            updated[index] = value;
            return { ...prev, [field]: updated };
        });
    };

    /** 리스트 항목 추가 (최대 10개 제한 — 무한 증식 방지) */
    const handleAddListItem = (field: 'activities' | 'awards') => {
        setProfile((prev) => {
            if (prev[field].length >= 10) return prev;
            return { ...prev, [field]: [...prev[field], ''] };
        });
    };

    /** 리스트 항목 삭제 (최소 1개 유지 — 빈 입력 필드가 사라지지 않도록) */
    const handleRemoveListItem = (field: 'activities' | 'awards', index: number) => {
        setProfile((prev) => {
            if (prev[field].length <= 1) return prev;
            const updated = prev[field].filter((_, i) => i !== index);
            return { ...prev, [field]: updated };
        });
    };

    // ===== 태그 입력 핸들러 (AI 도구, 편집 도구) =====

    /** Enter 키로 태그 추가 */
    const handleTagKeyDown = (
        field: 'aiTools' | 'editTools',
        inputValue: string,
        setInputValue: (v: string) => void,
        e: KeyboardEvent<HTMLInputElement>,
    ) => {
        if (e.key !== 'Enter') return;
        e.preventDefault();

        const trimmed = inputValue.trim();
        if (!trimmed) return;

        // 중복 태그 방지
        if (profile[field].includes(trimmed)) {
            setInputValue('');
            return;
        }

        setProfile((prev) => ({ ...prev, [field]: [...prev[field], trimmed] }));
        setInputValue('');
    };

    /** 태그 삭제 */
    const handleRemoveTag = (field: 'aiTools' | 'editTools', index: number) => {
        setProfile((prev) => ({
            ...prev,
            [field]: prev[field].filter((_, i) => i !== index),
        }));
    };

    // ===== 패키지 변경 핸들러 =====

    /** 패키지 단순 필드 변경 (price, description 등) */
    const handlePackageChange = (tab: PackageTab, field: keyof PackageInfo, value: string) => {
        setProfile((prev) => ({
            ...prev,
            packages: {
                ...prev.packages,
                [tab]: { ...prev.packages[tab], [field]: value },
            },
        }));
    };

    /** 패키지 features 리스트 항목 변경 */
    const handlePackageFeatureChange = (tab: PackageTab, index: number, value: string) => {
        setProfile((prev) => {
            const features = [...prev.packages[tab].features];
            features[index] = value;
            return {
                ...prev,
                packages: {
                    ...prev.packages,
                    [tab]: { ...prev.packages[tab], features },
                },
            };
        });
    };

    /** 패키지 feature 추가 */
    const handleAddPackageFeature = (tab: PackageTab) => {
        setProfile((prev) => {
            const features = prev.packages[tab].features;
            if (features.length >= 8) return prev;
            return {
                ...prev,
                packages: {
                    ...prev.packages,
                    [tab]: { ...prev.packages[tab], features: [...features, ''] },
                },
            };
        });
    };

    /** 패키지 feature 삭제 */
    const handleRemovePackageFeature = (tab: PackageTab, index: number) => {
        setProfile((prev) => {
            const features = prev.packages[tab].features;
            if (features.length <= 1) return prev;
            return {
                ...prev,
                packages: {
                    ...prev.packages,
                    [tab]: { ...prev.packages[tab], features: features.filter((_, i) => i !== index) },
                },
            };
        });
    };

    // ===== 저장 =====

    const handleSave = (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();

        // 필수 필드 검증
        if (!profile.name.trim()) {
            alert('이름을 입력해 주세요.');
            return;
        }
        if (!profile.profession.trim()) {
            alert('전문 분야를 입력해 주세요.');
            return;
        }

        setSaving(true);
        try {
            // 빈 문자열 항목 제거 후 저장 (경력, 수상 이력에서 빈 줄 정리)
            const cleanedProfile: ExpertProfile = {
                ...profile,
                activities: profile.activities.filter((a) => a.trim()),
                awards: profile.awards.filter((a) => a.trim()),
            };

            saveProfile(user.id, cleanedProfile);
            setShowSuccess(true);
            // 3초 후 성공 메시지 자동 숨김
            setTimeout(() => setShowSuccess(false), 3000);
        } catch (error) {
            alert(error instanceof Error ? error.message : '저장에 실패했습니다.');
        } finally {
            setSaving(false);
        }
    };

    // ===== 렌더링 =====

    /** 태그 입력 UI를 렌더링하는 헬퍼 */
    const renderTagInput = (
        field: 'aiTools' | 'editTools',
        inputValue: string,
        setInputValue: (v: string) => void,
        placeholder: string,
    ) => (
        <div className="tag-input-container" onClick={() => {
            // 컨테이너 클릭 시 내부 input에 포커스
            const input = document.getElementById(`tag-input-${field}`);
            input?.focus();
        }}>
            {profile[field].map((tag, idx) => (
                <span key={idx} className="tool-tag">
                    {tag}
                    <button type="button" onClick={() => handleRemoveTag(field, idx)}>
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </span>
            ))}
            <input
                id={`tag-input-${field}`}
                type="text"
                className="tag-text-input"
                value={inputValue}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setInputValue(e.target.value)}
                onKeyDown={(e) => handleTagKeyDown(field, inputValue, setInputValue, e)}
                placeholder={profile[field].length === 0 ? placeholder : '추가 입력 후 Enter'}
            />
        </div>
    );

    /** 동적 리스트 UI를 렌더링하는 헬퍼 */
    const renderDynamicList = (
        field: 'activities' | 'awards',
        placeholder: string,
        addLabel: string,
    ) => (
        <div className="dynamic-list">
            {profile[field].map((item, idx) => (
                <div key={idx} className="dynamic-list-item">
                    <input
                        type="text"
                        className="profile-input"
                        value={item}
                        onChange={(e: ChangeEvent<HTMLInputElement>) =>
                            handleListItemChange(field, idx, e.target.value)
                        }
                        placeholder={placeholder}
                    />
                    <button
                        type="button"
                        className="btn-remove-item"
                        onClick={() => handleRemoveListItem(field, idx)}
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

    const currentPkg = profile.packages[activePackageTab];

    return (
        <>
            {/* 페이지 헤더 */}
            <div className="profile-hero">
                <div className="container">
                    <h1 style={{ fontSize: '2.5rem', fontWeight: 800, marginBottom: '0.75rem', letterSpacing: '-0.02em' }}>
                        프로필 관리
                    </h1>
                    <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: '1.1rem' }}>
                        전문가 프로필을 작성하여 고객에게 나를 어필하세요.
                    </p>
                </div>
            </div>

            <main className="container">
                <form className="profile-layout" onSubmit={handleSave}>

                    {/* 저장 성공 메시지 */}
                    {showSuccess && (
                        <div className="save-success">
                            <span className="material-symbols-outlined">check_circle</span>
                            프로필이 성공적으로 저장되었습니다!
                        </div>
                    )}

                    {/* ===== 1. 프로필 기본 정보 ===== */}
                    <div className="profile-section">
                        <h2>
                            <span className="material-symbols-outlined">person</span>
                            기본 정보
                        </h2>

                        {/* 프로필 이미지 */}
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
                                    <label>
                                        프로필 이미지 URL
                                        <span className="label-hint">(외부 이미지 링크를 붙여넣으세요)</span>
                                    </label>
                                    <input
                                        type="url"
                                        className="profile-input"
                                        value={profile.imageUrl}
                                        onChange={(e: ChangeEvent<HTMLInputElement>) => handleChange('imageUrl', e.target.value)}
                                        placeholder="https://example.com/my-photo.jpg"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* 이름, 전문 분야 */}
                        <div className="profile-form-group">
                            <label>이름 <span className="label-hint">(필수)</span></label>
                            <input
                                type="text"
                                className="profile-input"
                                value={profile.name}
                                onChange={(e: ChangeEvent<HTMLInputElement>) => handleChange('name', e.target.value)}
                                placeholder="예: 김디자인 전문가"
                                required
                            />
                        </div>
                        <div className="profile-form-group">
                            <label>전문 분야 <span className="label-hint">(필수)</span></label>
                            <input
                                type="text"
                                className="profile-input"
                                value={profile.profession}
                                onChange={(e: ChangeEvent<HTMLInputElement>) => handleChange('profession', e.target.value)}
                                placeholder="예: AI 영상 및 이미지 생성 전문가"
                                required
                            />
                        </div>
                    </div>

                    {/* ===== 2. 인사말 ===== */}
                    <div className="profile-section">
                        <h2>
                            <span className="material-symbols-outlined">waving_hand</span>
                            전문가 인사말
                        </h2>
                        <div className="profile-form-group">
                            <label>한 줄 소개</label>
                            <input
                                type="text"
                                className="profile-input"
                                value={profile.oneLiner}
                                onChange={(e: ChangeEvent<HTMLInputElement>) => handleChange('oneLiner', e.target.value)}
                                placeholder='예: "AI 기술과 예술의 경계를 허무는 창의적인 작업을 지향합니다."'
                            />
                        </div>
                        <div className="profile-form-group">
                            <label>상세 인사말</label>
                            <textarea
                                className="profile-input"
                                rows={5}
                                value={profile.greeting}
                                onChange={(e: ChangeEvent<HTMLTextAreaElement>) => handleChange('greeting', e.target.value)}
                                placeholder="자신을 소개하는 상세한 인사말을 작성해 주세요. 고객의 첫인상을 결정하는 중요한 영역입니다."
                            />
                        </div>
                    </div>

                    {/* ===== 3. 경력 ===== */}
                    <div className="profile-section">
                        <h2>
                            <span className="material-symbols-outlined">history_edu</span>
                            전문가 경력
                        </h2>
                        <div className="profile-form-group">
                            <label>주요 활동</label>
                            {renderDynamicList('activities', '예: 현) AI 크리에이티브 스튜디오 대표', '활동 추가')}
                        </div>
                        <div className="profile-form-group" style={{ marginTop: '2rem' }}>
                            <label>수상 이력</label>
                            {renderDynamicList('awards', '예: 2025 디지털 아트 이노베이션 대상', '수상 이력 추가')}
                        </div>
                    </div>

                    {/* ===== 4. 사용 툴 ===== */}
                    <div className="profile-section">
                        <h2>
                            <span className="material-symbols-outlined">construction</span>
                            사용 툴 정보
                        </h2>
                        <div className="profile-form-group">
                            <label>
                                AI 도구
                                <span className="label-hint">(입력 후 Enter로 추가)</span>
                            </label>
                            {renderTagInput('aiTools', aiToolInput, setAiToolInput, '예: Midjourney, Stable Diffusion...')}
                        </div>
                        <div className="profile-form-group" style={{ marginTop: '1.5rem' }}>
                            <label>
                                편집 및 후반 작업 도구
                                <span className="label-hint">(입력 후 Enter로 추가)</span>
                            </label>
                            {renderTagInput('editTools', editToolInput, setEditToolInput, '예: Premiere Pro, After Effects...')}
                        </div>
                    </div>

                    {/* ===== 5. 요금 패키지 ===== */}
                    <div className="profile-section">
                        <h2>
                            <span className="material-symbols-outlined">payments</span>
                            요금 패키지
                        </h2>

                        {/* 패키지 탭 */}
                        <div className="package-edit-tabs">
                            {(Object.keys(PACKAGE_LABELS) as PackageTab[]).map((tab) => (
                                <button
                                    key={tab}
                                    type="button"
                                    className={`package-edit-tab ${activePackageTab === tab ? 'active' : ''}`}
                                    onClick={() => setActivePackageTab(tab)}
                                >
                                    {PACKAGE_LABELS[tab]}
                                </button>
                            ))}
                        </div>

                        {/* 선택된 패키지 편집 폼 */}
                        <div className="package-edit-form">
                            <div className="package-row">
                                <div className="profile-form-group">
                                    <label>가격</label>
                                    <input
                                        type="text"
                                        className="profile-input"
                                        value={currentPkg.price}
                                        onChange={(e: ChangeEvent<HTMLInputElement>) =>
                                            handlePackageChange(activePackageTab, 'price', e.target.value)
                                        }
                                        placeholder="예: ₩50,000"
                                    />
                                </div>
                                <div className="profile-form-group">
                                    <label>작업일</label>
                                    <input
                                        type="text"
                                        className="profile-input"
                                        value={currentPkg.workDays}
                                        onChange={(e: ChangeEvent<HTMLInputElement>) =>
                                            handlePackageChange(activePackageTab, 'workDays', e.target.value)
                                        }
                                        placeholder="예: ⏲️ 작업일 2일"
                                    />
                                </div>
                            </div>

                            <div className="package-row">
                                <div className="profile-form-group">
                                    <label>수정 횟수</label>
                                    <input
                                        type="text"
                                        className="profile-input"
                                        value={currentPkg.revisions}
                                        onChange={(e: ChangeEvent<HTMLInputElement>) =>
                                            handlePackageChange(activePackageTab, 'revisions', e.target.value)
                                        }
                                        placeholder="예: 🔄 수정 1회"
                                    />
                                </div>
                                <div className="profile-form-group">
                                    {/* 빈 칸 — 레이아웃 정렬용 */}
                                </div>
                            </div>

                            <div className="profile-form-group">
                                <label>패키지 설명</label>
                                <textarea
                                    className="profile-input"
                                    rows={3}
                                    value={currentPkg.description}
                                    onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
                                        handlePackageChange(activePackageTab, 'description', e.target.value)
                                    }
                                    placeholder="이 패키지에 포함된 서비스를 설명해 주세요."
                                />
                            </div>

                            <div className="profile-form-group">
                                <label>포함 항목</label>
                                <div className="dynamic-list">
                                    {currentPkg.features.map((feature, idx) => (
                                        <div key={idx} className="dynamic-list-item">
                                            <input
                                                type="text"
                                                className="profile-input"
                                                value={feature}
                                                onChange={(e: ChangeEvent<HTMLInputElement>) =>
                                                    handlePackageFeatureChange(activePackageTab, idx, e.target.value)
                                                }
                                                placeholder="예: ✔️ 고해상도 이미지 (PNG)"
                                            />
                                            <button
                                                type="button"
                                                className="btn-remove-item"
                                                onClick={() => handleRemovePackageFeature(activePackageTab, idx)}
                                                title="삭제"
                                            >
                                                <span className="material-symbols-outlined">close</span>
                                            </button>
                                        </div>
                                    ))}
                                    <button
                                        type="button"
                                        className="btn-add-item"
                                        onClick={() => handleAddPackageFeature(activePackageTab)}
                                    >
                                        <span className="material-symbols-outlined">add</span>
                                        항목 추가
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ===== 저장 버튼 ===== */}
                    <div className="profile-actions">
                        <button
                            type="submit"
                            className="btn-primary btn-save-profile"
                            disabled={saving}
                        >
                            {saving ? '저장 중...' : '프로필 저장하기'}
                        </button>
                    </div>
                </form>
            </main>
        </>
    );
}
