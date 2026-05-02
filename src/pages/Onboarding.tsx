/**
 * Onboarding 페이지
 * - 최초 가입자(이메일/소셜 모두)가 필수 정보를 입력하는 화면
 * - 역할 선택(전문가/의뢰자) + 닉네임 + 프로필 이미지(선택)
 * - profiles 테이블에 저장 후, 전문가는 프로필 편집으로 / 의뢰자는 홈으로 이동
 */
import { useState, type FormEvent, type ChangeEvent } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { ROUTES } from '../constants/routes';
import './Onboarding.css';

export default function Onboarding() {
    const { user } = useAuth();
    
    // 역할 선택 상태
    const [role, setRole] = useState<'client' | 'expert'>('client');
    const [name, setName] = useState<string>('');
    const [imageUrl, setImageUrl] = useState<string>('');
    const [loading, setLoading] = useState<boolean>(false);
    const [uploading, setUploading] = useState<boolean>(false);
    const [error, setError] = useState<string>('');

    /** 프로필 이미지 업로드 (Supabase Storage) */
    const handleImageUpload = async (e: ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || !e.target.files[0] || !user || !supabase) return;
        const file = e.target.files[0];

        setUploading(true);
        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `${user.id}_${Date.now()}.${fileExt}`;
            
            const { error: uploadError } = await supabase.storage
                .from('profiles')
                .upload(fileName, file, { upsert: true });

            if (uploadError) throw uploadError;

            const { data } = supabase.storage.from('profiles').getPublicUrl(fileName);
            setImageUrl(data.publicUrl);
        } catch (err) {
            console.error('이미지 업로드 에러:', err);
            // 실패해도 온보딩 진행에는 지장 없음 (이미지는 선택사항)
        } finally {
            setUploading(false);
        }
    };

    /** 온보딩 완료 — profiles 테이블에 저장 */
    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        if (!user || !supabase) return;

        if (!name.trim()) {
            setError('닉네임을 입력해주세요.');
            return;
        }

        setLoading(true);
        setError('');

        try {
            // 1. profiles 테이블에 기본 정보 저장
            const { error: profileError } = await supabase
                .from('profiles')
                .upsert({
                    id: user.id,
                    name: name.trim(),
                    email: user.email,
                    is_expert: role === 'expert',
                });

            if (profileError) throw profileError;

            // 2. 전문가 선택 시 expert_profiles 빈 레코드 생성 (나중에 상세 입력할 수 있게)
            if (role === 'expert') {
                await supabase
                    .from('expert_profiles')
                    .upsert({
                        user_id: user.id,
                        name: name.trim(),
                        image_url: imageUrl,
                        profession: '',
                    });
            }

            // 3. 완료 후 분기 이동
            // 전문가 → 전문가 프로필 편집으로 안내
            // 의뢰자 → 홈으로 이동
            if (role === 'expert') {
                window.location.href = ROUTES.PROFILE;
            } else {
                window.location.href = ROUTES.HOME;
            }
        } catch (err: any) {
            console.error('온보딩 저장 에러:', err);
            setError(err.message || '저장 중 오류가 발생했습니다.');
            setLoading(false);
        }
    };

    return (
        <div className="onboarding-page">
            <div className="onboarding-card">
                {/* 헤더 */}
                <div className="onboarding-header">
                    <div className="onboarding-logo">
                        <span className="material-symbols-outlined">handshake</span>
                        AIConnect
                    </div>
                    <h1>환영합니다! 🎉</h1>
                    <p>AIConnect 시작을 위해 몇 가지 정보를 알려주세요.</p>
                </div>

                {error && (
                    <div className="onboarding-error">
                        <span className="material-symbols-outlined">error</span>
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit}>
                    {/* 역할 선택 */}
                    <div className="onboarding-section">
                        <label className="section-label">어떤 목적으로 가입하시나요?</label>
                        <div className="role-buttons">
                            <button
                                type="button"
                                className={`role-btn ${role === 'client' ? 'active' : ''}`}
                                onClick={() => setRole('client')}
                            >
                                <span className="material-symbols-outlined role-icon">person_search</span>
                                <div className="role-text">
                                    <strong>프로젝트 의뢰하기</strong>
                                    <p>AI 전문가를 찾고 싶어요</p>
                                </div>
                            </button>
                            <button
                                type="button"
                                className={`role-btn ${role === 'expert' ? 'active' : ''}`}
                                onClick={() => setRole('expert')}
                            >
                                <span className="material-symbols-outlined role-icon">workspace_premium</span>
                                <div className="role-text">
                                    <strong>전문가로 활동하기</strong>
                                    <p>내 AI 기술로 수익을 내고 싶어요</p>
                                </div>
                            </button>
                        </div>
                    </div>

                    {/* 닉네임 입력 */}
                    <div className="onboarding-section">
                        <label className="section-label" htmlFor="nickname">닉네임(활동명)</label>
                        <input
                            id="nickname"
                            type="text"
                            className="onboarding-input"
                            placeholder="예: 홍길동, 디자인깎는노인"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            required
                        />
                    </div>

                    {/* 프로필 이미지 (선택) */}
                    <div className="onboarding-section">
                        <label className="section-label">
                            프로필 이미지
                            <span className="optional-badge">선택</span>
                        </label>
                        <div className="image-upload-area">
                            {imageUrl ? (
                                <img src={imageUrl} alt="프로필 미리보기" className="image-preview" />
                            ) : (
                                <div className="image-placeholder">
                                    <span className="material-symbols-outlined">add_photo_alternate</span>
                                </div>
                            )}
                            <div className="image-upload-controls">
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={handleImageUpload}
                                    disabled={uploading}
                                    className="file-input"
                                    id="profile-image"
                                />
                                <label htmlFor="profile-image" className="file-label">
                                    {uploading ? '업로드 중...' : '이미지 선택'}
                                </label>
                                <span className="image-hint">나중에 변경할 수 있어요</span>
                            </div>
                        </div>
                    </div>

                    {/* 완료 버튼 */}
                    <button type="submit" className="btn-primary onboarding-submit" disabled={loading}>
                        {loading ? '시작 준비 중...' : 'AIConnect 시작하기 →'}
                    </button>
                </form>
            </div>
        </div>
    );
}
