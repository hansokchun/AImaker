/**
 * Profile 페이지 — 전문가 프로필 관리
 * - 로그인한 사용자만 접근 가능 (비로그인 시 로그인 안내 화면)
 * - ExpertDetail 페이지와 동일한 구조(프로필, 인사말, 경력, 도구, 패키지)를
 *   편집 가능한 폼으로 제공
 * - 저장 시 localStorage에 사용자별로 데이터를 보관
 *   (향후 Supabase expert_profiles 테이블로 마이그레이션 예정)
 */
import { useState, useEffect, type ChangeEvent, type KeyboardEvent, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getStoredProfile, saveProfile, createDefaultProfile, saveExpertProduct } from '../lib/storage';
import { ROUTES } from '../constants/routes';
import { EXTERNAL_CONTACT_WARNING, hasExternalContactInFields } from '../constants/policies';
import { supabase } from '../lib/supabase';
import { CATEGORIES } from '../data/mockData';
import { AI_CATEGORIES } from '../constants/categories';
import type { ExpertProfile, ExpertProduct, PackageInfo, ProductPackage } from '../types';
import './Profile.css';

/** 패키지 탭 종류 (PackageCard와 동일) */
type PackageTab = 'standard' | 'deluxe' | 'premium';

interface ProductDraft {
    title: string;
    description: string;
    sampleImageUrl: string;
    startingPrice: string;
    deliveryDays: string;
}

/** 패키지 탭 한글 라벨 */
const PACKAGE_LABELS: Record<PackageTab, string> = {
    standard: 'Standard',
    deluxe: 'Deluxe',
    premium: 'Premium',
};

export default function Profile() {
    const { user, loading: authLoading } = useAuth();
    const navigate = useNavigate();

    // 권한(전문가 여부) — profiles.is_expert에서 읽어옴
    const [isExpert, setIsExpert] = useState<boolean>(true);
    // 의뢰자용 간단 프로필 상태
    const [clientName, setClientName] = useState<string>('');

    // 프로필 폼 상태 — createDefaultProfile()로 초기화하여 빈 폼 제공
    const [profile, setProfile] = useState<ExpertProfile>(createDefaultProfile());
    const [activePackageTab, setActivePackageTab] = useState<PackageTab>('standard');
    const [saving, setSaving] = useState<boolean>(false);
    const [uploading, setUploading] = useState<boolean>(false);

    // 태그 입력 필드 상태 (AI 도구, 편집 도구 각각)
    const [aiToolInput, setAiToolInput] = useState<string>('');
    const [editToolInput, setEditToolInput] = useState<string>('');
    const [productDraft, setProductDraft] = useState<ProductDraft>({
        title: '',
        description: '',
        sampleImageUrl: '',
        startingPrice: '',
        deliveryDays: '',
    });

    // 전문분야 '기타' 상태 관리
    const [showCustomProfession, setShowCustomProfession] = useState<boolean>(false);
    const [customProfessionInput, setCustomProfessionInput] = useState<string>('');

    // 로그인된 사용자의 권한 확인 + 프로필 로드
    useEffect(() => {
        if (!user) return;

        const loadProfile = async () => {
            // 1. profiles 테이블에서 권한 확인
            if (supabase) {
                const { data: userProfile } = await supabase
                    .from('profiles')
                    .select('is_expert, name')
                    .eq('id', user.id)
                    .single();

                if (userProfile) {
                    setIsExpert(userProfile.is_expert);
                    setClientName(userProfile.name || '');
                }
            }

            // 2. 전문가 프로필 상세 로드 (전문가든 의뢰자든 일단 시도)
            const stored = await getStoredProfile(user.id);
            if (stored) {
                setProfile({
                    ...createDefaultProfile(),
                    ...stored,
                    activities: stored.activities?.length ? stored.activities : [''],
                    awards: stored.awards?.length ? stored.awards : [''],
                    packages: {
                        standard: { ...createDefaultProfile().packages.standard, ...stored.packages?.standard },
                        deluxe: { ...createDefaultProfile().packages.deluxe, ...stored.packages?.deluxe },
                        premium: { ...createDefaultProfile().packages.premium, ...stored.packages?.premium },
                    },
                });
            }
        };
        
        loadProfile();
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

    const handleProductDraftChange = (field: keyof ProductDraft, value: string) => {
        setProductDraft((prev) => ({ ...prev, [field]: value }));
    };

    /** 전문분야 다중 선택 토글 핸들러 */
    const handleProfessionToggle = (cat: string) => {
        const currentSelected = profile.profession.split(',').map(s => s.trim()).filter(s => s);
        let newSelected;
        if (currentSelected.includes(cat)) {
            newSelected = currentSelected.filter(c => c !== cat);
        } else {
            newSelected = [...currentSelected, cat];
        }
        handleChange('profession', newSelected.join(', '));
    };

    /** 전문분야 커스텀 텍스트 추가 핸들러 */
    const handleAddCustomProfession = () => {
        const trimmed = customProfessionInput.trim();
        if (!trimmed) return;
        
        const currentSelected = profile.profession.split(',').map(s => s.trim()).filter(s => s);
        if (!currentSelected.includes(trimmed)) {
            handleChange('profession', [...currentSelected, trimmed].join(', '));
        }
        setCustomProfessionInput('');
    };

    /** 로컬 이미지 업로드 (Supabase Storage) */
    const handleImageUpload = async (e: ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0 || !user) return;
        const file = e.target.files[0];
        
        if (!supabase) {
            alert('Supabase 연동이 필요합니다. 외부 이미지 URL을 직접 입력해 주세요.');
            return;
        }

        setUploading(true);
        try {
            const fileExt = file.name.split('.').pop();
            // 고유한 파일명 생성 (캐싱 문제 방지 위해 시간값 추가)
            const fileName = `${user.id}_${Date.now()}.${fileExt}`;
            
            const { error: uploadError } = await supabase.storage
                .from('profile-images')
                .upload(fileName, file, { upsert: true });

            if (uploadError) throw uploadError;

            const { data } = supabase.storage
                .from('profile-images')
                .getPublicUrl(fileName);

            setProfile((prev) => ({ ...prev, imageUrl: data.publicUrl }));
        } catch (error) {
            alert('이미지 업로드에 실패했습니다. (Supabase Storage에 profile-images 버킷이 있는지 확인해 주세요)');
            console.error('업로드 에러:', error);
        } finally {
            setUploading(false);
        }
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
    const toProductPackage = (name: ProductPackage['name'], packageInfo: PackageInfo): ProductPackage | null => {
        const included = packageInfo.features.map((feature) => feature.trim()).filter(Boolean);
        if (!packageInfo.price.trim() && !packageInfo.workDays.trim() && included.length === 0) {
            return null;
        }

        return {
            name,
            price: Number(packageInfo.price.replace(/[^\d]/g, '')) || 0,
            deliveryDays: Number(packageInfo.workDays.replace(/[^\d]/g, '')) || 0,
            revisionCount: Number(packageInfo.revisions.replace(/[^\d]/g, '')) || 0,
            included,
        };
    };

    const buildExpertProduct = (userId: string, profileData: ExpertProfile): ExpertProduct => {
        const category =
            AI_CATEGORIES.find((item) => profileData.profession.includes(item.name))?.id ?? AI_CATEGORIES[0].id;
        const standardPackage = toProductPackage('Standard', profileData.packages.standard);

        return {
            id: userId,
            expertId: userId,
            expertName: profileData.name,
            title: productDraft.title.trim(),
            category,
            summary: productDraft.description.trim(),
            description: productDraft.description.trim(),
            aiTools: profileData.aiTools,
            sampleLinks: [productDraft.sampleImageUrl.trim()],
            sampleImageUrl: productDraft.sampleImageUrl.trim(),
            startingPrice: Number(productDraft.startingPrice) || 0,
            deliveryDays: Number(productDraft.deliveryDays) || 0,
            revisionCount: standardPackage?.revisionCount ?? 0,
            packages: {
                standard: standardPackage as ProductPackage,
                deluxe: toProductPackage('Deluxe', profileData.packages.deluxe),
                premium: toProductPackage('Premium', profileData.packages.premium),
            },
            status: 'published',
        };
    };

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

    const handleSave = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();

        // 의뢰자 모드: 이름만 저장
        if (!isExpert) {
            const trimmedName = clientName.trim();
            if (!trimmedName) { alert('이름을 입력해 주세요.'); return; }

            setSaving(true);
            try {
                if (supabase) {
                    await supabase.from('profiles').update({ name: trimmedName }).eq('id', user.id);
                }
                alert('프로필이 저장되었습니다!');
                navigate(ROUTES.MY_PAGE);
            } catch { alert('저장에 실패했습니다.'); }
            finally { setSaving(false); }
            return;
        }

        // 전문가 모드: 전체 프로필 저장
        if (!profile.name.trim()) { alert('이름을 입력해 주세요.'); return; }
        if (!profile.profession.trim()) { alert('전문 분야를 입력해 주세요.'); return; }
        if (!productDraft.title.trim()) { alert('상품명을 입력해 주세요.'); return; }
        if (!productDraft.description.trim()) { alert('상품 설명을 입력해 주세요.'); return; }
        if (!productDraft.sampleImageUrl.trim()) { alert('샘플 결과물을 입력해 주세요.'); return; }
        if (!productDraft.startingPrice.trim()) { alert('시작 가격을 입력해 주세요.'); return; }
        if (!productDraft.deliveryDays.trim()) { alert('작업 기간을 입력해 주세요.'); return; }
        if (profile.aiTools.length === 0) { alert('사용 AI 도구를 하나 이상 입력해 주세요.'); return; }

        const standardPackage = profile.packages.standard;
        const hasStandardFeature = standardPackage.features.some((feature) => feature.trim());
        if (!standardPackage.price.trim() || !standardPackage.workDays.trim() || !hasStandardFeature) {
            alert('Standard 패키지는 가격, 작업 기간, 포함 항목이 필요합니다.');
            return;
        }
        const policyFields = [
            profile.name,
            profile.oneLiner,
            profile.greeting,
            productDraft.title,
            productDraft.description,
            ...profile.activities,
            ...profile.awards,
            ...Object.values(profile.packages).flatMap((pkg) => [
                pkg.description,
                ...pkg.features,
            ]),
        ];
        if (hasExternalContactInFields(policyFields)) {
            alert(EXTERNAL_CONTACT_WARNING);
            return;
        }

        setSaving(true);
        try {
            const cleanedProfile: ExpertProfile = {
                ...profile,
                activities: profile.activities.filter((a) => a.trim()),
                awards: profile.awards.filter((a) => a.trim()),
            };

            await saveProfile(user.id, cleanedProfile);
            await saveExpertProduct(buildExpertProduct(user.id, cleanedProfile));
            
            // profiles 테이블 이름도 동기화
            if (supabase) {
                await supabase.from('profiles').update({ name: profile.name }).eq('id', user.id);
            }

            alert('프로필이 성공적으로 저장되었습니다!');
            navigate(`/expert/${user.id}`);
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

    // 회원 유형 변경 핸들러 — DB 즉시 반영
    const handleRoleChange = async (newRole: boolean) => {
        if (!supabase || !user) return;
        const { error } = await supabase.from('profiles').update({ is_expert: newRole }).eq('id', user.id);
        if (!error) {
            setIsExpert(newRole);
            // 전문가로 전환 시 expert_profiles 빈 레코드 생성
            if (newRole) {
                await supabase.from('expert_profiles').upsert({
                    user_id: user.id,
                    name: clientName || profile.name,
                    profession: '',
                });
            }
        }
    };

    return (
        <>
            <div className="profile-hero">
                <div className="container">
                    <h1 style={{ fontSize: '2.5rem', fontWeight: 800, marginBottom: '0.75rem', letterSpacing: '-0.02em' }}>
                        프로필 수정
                    </h1>
                    <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: '1.1rem' }}>
                        {isExpert ? '전문가 프로필을 작성하여 고객에게 나를 어필하세요.' : '기본 프로필 정보를 관리합니다.'}
                    </p>
                </div>
            </div>

            <main className="container">
                <form className="profile-layout" onSubmit={handleSave}>

                    {/* ===== 0. 회원 유형 선택 (공통) ===== */}
                    <div className="profile-section">
                        <h2>
                            <span className="material-symbols-outlined">badge</span>
                            회원 유형
                        </h2>
                        <div style={{ display: 'flex', gap: '1rem' }}>
                            <button
                                type="button"
                                onClick={() => handleRoleChange(false)}
                                style={{
                                    flex: 1, padding: '1.2rem', borderRadius: '12px', cursor: 'pointer',
                                    border: `2px solid ${!isExpert ? 'var(--primary)' : 'var(--border)'}`,
                                    background: !isExpert ? 'rgba(59,130,246,0.08)' : 'transparent',
                                    textAlign: 'center', transition: 'all 0.2s',
                                }}
                            >
                                <span style={{ fontSize: '1.5rem', display: 'block', marginBottom: '0.3rem' }}>🔍</span>
                                <strong style={{ color: 'var(--text)' }}>의뢰자</strong>
                                <p style={{ margin: '0.25rem 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>전문가를 찾고 싶어요</p>
                            </button>
                            <button
                                type="button"
                                onClick={() => handleRoleChange(true)}
                                style={{
                                    flex: 1, padding: '1.2rem', borderRadius: '12px', cursor: 'pointer',
                                    border: `2px solid ${isExpert ? 'var(--primary)' : 'var(--border)'}`,
                                    background: isExpert ? 'rgba(59,130,246,0.08)' : 'transparent',
                                    textAlign: 'center', transition: 'all 0.2s',
                                }}
                            >
                                <span style={{ fontSize: '1.5rem', display: 'block', marginBottom: '0.3rem' }}>🏆</span>
                                <strong style={{ color: 'var(--text)' }}>전문가</strong>
                                <p style={{ margin: '0.25rem 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>내 기술로 수익을 내고 싶어요</p>
                            </button>
                        </div>
                    </div>

                    {/* ===== 의뢰자 모드: 이름만 ===== */}
                    {!isExpert && (
                        <div className="profile-section">
                            <h2><span className="material-symbols-outlined">person</span>기본 정보</h2>
                            <div className="profile-form-group">
                                <label>이름 <span className="label-hint">(필수)</span></label>
                                <input type="text" className="profile-input" value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="닉네임을 입력하세요" required />
                            </div>
                        </div>
                    )}

                    {/* ===== 전문가 모드: 전체 상세 폼 ===== */}
                    {isExpert && (
                        <>
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
                                        프로필 이미지 업로드
                                    </label>
                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={handleImageUpload}
                                        disabled={uploading}
                                        className="profile-input"
                                        style={{ padding: '0.6rem 1rem' }}
                                    />
                                    {uploading && <div style={{ fontSize: '0.85rem', color: 'var(--primary)', marginTop: '0.5rem' }}>업로드 중...</div>}
                                </div>
                                <div className="profile-form-group">
                                    <label>
                                        <span className="label-hint" style={{ marginLeft: 0 }}>또는 외부 이미지 링크 입력:</span>
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
                            <label>전문 분야 <span className="label-hint">(필수, 다중 선택 가능)</span></label>
                            
                            <div className="tag-group" style={{ flexWrap: 'wrap', marginBottom: '1rem' }}>
                                {CATEGORIES.map((cat) => {
                                    const isSelected = profile.profession.split(',').map(s => s.trim()).includes(cat);
                                    return (
                                        <button
                                            key={cat}
                                            type="button"
                                            onClick={() => handleProfessionToggle(cat)}
                                            style={{
                                                padding: '0.5rem 1rem',
                                                borderRadius: '20px',
                                                border: `1px solid ${isSelected ? 'var(--primary)' : 'var(--border)'}`,
                                                background: isSelected ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
                                                color: isSelected ? 'var(--primary)' : 'var(--text-secondary)',
                                                cursor: 'pointer',
                                                transition: 'all 0.2s',
                                                fontWeight: isSelected ? 600 : 400
                                            }}
                                        >
                                            {cat}
                                        </button>
                                    );
                                })}
                                <button
                                    type="button"
                                    onClick={() => setShowCustomProfession(!showCustomProfession)}
                                    style={{
                                        padding: '0.5rem 1rem',
                                        borderRadius: '20px',
                                        border: `1px solid ${showCustomProfession ? 'var(--primary)' : 'var(--border)'}`,
                                        background: showCustomProfession ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
                                        color: showCustomProfession ? 'var(--primary)' : 'var(--text-secondary)',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    + 기타 직접 입력
                                </button>
                            </div>

                            {showCustomProfession && (
                                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                                    <input
                                        type="text"
                                        className="profile-input"
                                        value={customProfessionInput}
                                        onChange={(e) => setCustomProfessionInput(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                handleAddCustomProfession();
                                            }
                                        }}
                                        placeholder="직접 입력 후 Enter키 또는 추가 버튼 클릭"
                                    />
                                    <button 
                                        type="button" 
                                        className="btn-primary"
                                        onClick={handleAddCustomProfession}
                                    >
                                        추가
                                    </button>
                                </div>
                            )}

                            {/* 선택된 커스텀/기타 직업 노출 (카테고리에 없는 항목들) */}
                            {profile.profession && (
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.5rem' }}>
                                    {profile.profession.split(',').map(s => s.trim()).filter(s => s && !CATEGORIES.includes(s)).map((customCat, idx) => (
                                        <div key={idx} className="tag" style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                            {customCat}
                                            <span 
                                                className="material-symbols-outlined" 
                                                style={{ fontSize: '1rem', cursor: 'pointer' }}
                                                onClick={() => handleProfessionToggle(customCat)}
                                            >
                                                close
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                            {/* 숨겨진 실제 input (HTML5 required validation을 위해 유지) */}
                            <input
                                type="text"
                                style={{ opacity: 0, position: 'absolute', height: 0, width: 0 }}
                                value={profile.profession}
                                onChange={() => {}}
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

                    {/* ===== 5. 상품 등록 ===== */}
                    <div className="profile-section product-register-section">
                        <h2>
                            <span className="material-symbols-outlined">inventory_2</span>
                            상품 등록
                        </h2>
                        <p className="product-register-help">
                            공개할 AI 작업 상품의 최소 정보를 입력하세요. Standard 패키지와 샘플 결과물은 필수입니다.
                        </p>

                        <div className="profile-form-group">
                            <label htmlFor="product-title">상품명</label>
                            <input
                                id="product-title"
                                aria-label="상품명"
                                type="text"
                                className="profile-input"
                                value={productDraft.title}
                                onChange={(e: ChangeEvent<HTMLInputElement>) =>
                                    handleProductDraftChange('title', e.target.value)
                                }
                                placeholder="예: AI 숏폼 영상 콘셉트와 1차 시안을 제작해드립니다"
                            />
                        </div>

                        <div className="profile-form-group">
                            <label htmlFor="product-description">상품 설명</label>
                            <textarea
                                id="product-description"
                                aria-label="상품 설명"
                                className="profile-input"
                                rows={4}
                                value={productDraft.description}
                                onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
                                    handleProductDraftChange('description', e.target.value)
                                }
                                placeholder="상품에 포함되는 작업 범위와 적합한 의뢰 상황을 설명해 주세요."
                            />
                        </div>

                        <div className="profile-form-group">
                            <label htmlFor="sample-image-url">샘플 결과물</label>
                            <input
                                id="sample-image-url"
                                aria-label="샘플 결과물"
                                type="url"
                                className="profile-input"
                                value={productDraft.sampleImageUrl}
                                onChange={(e: ChangeEvent<HTMLInputElement>) =>
                                    handleProductDraftChange('sampleImageUrl', e.target.value)
                                }
                                placeholder="https://example.com/sample"
                            />
                        </div>

                        <div className="package-row">
                            <div className="profile-form-group">
                                <label htmlFor="starting-price">시작 가격</label>
                                <input
                                    id="starting-price"
                                    aria-label="시작 가격"
                                    type="text"
                                    className="profile-input"
                                    value={productDraft.startingPrice}
                                    onChange={(e: ChangeEvent<HTMLInputElement>) =>
                                        handleProductDraftChange('startingPrice', e.target.value.replace(/[^\d]/g, ''))
                                    }
                                    placeholder="예: 30000"
                                />
                            </div>
                            <div className="profile-form-group">
                                <label htmlFor="delivery-days">작업 기간</label>
                                <input
                                    id="delivery-days"
                                    aria-label="작업 기간"
                                    type="text"
                                    className="profile-input"
                                    value={productDraft.deliveryDays}
                                    onChange={(e: ChangeEvent<HTMLInputElement>) =>
                                        handleProductDraftChange('deliveryDays', e.target.value.replace(/[^\d]/g, ''))
                                    }
                                    placeholder="예: 2"
                                />
                            </div>
                        </div>
                    </div>

                    {/* ===== 6. 요금 패키지 ===== */}
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
                        </>
                    )}

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
