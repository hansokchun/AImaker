/**
 * ExpertDetail 페이지
 * - 전문가의 상세 프로필, 경력, 포트폴리오, 사용 툴을 보여주는 페이지
 * - 요금 패키지(PackageCard)와 채팅(ChatModal)은 독립 컴포넌트로 분리
 * - DB에서 id를 기반으로 실제 프로필 정보를 로드하여 표시
 */
import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import PackageCard from '../components/PackageCard';
import ChatModal from '../components/ChatModal';
import { useAuth } from '../contexts/AuthContext';
import { getStoredProfile, createDefaultProfile } from '../lib/storage';
import { EXPERTS } from '../data/mockData';
import { ROUTES } from '../constants/routes';
import type { ExpertProfile } from '../types';
import './ExpertDetail.css';

export default function ExpertDetail() {
    const { id } = useParams<{ id: string }>();
    const { user } = useAuth();
    const [profile, setProfile] = useState<ExpertProfile | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [chatOpen, setChatOpen] = useState<boolean>(false);

    useEffect(() => {
        if (!id) {
            setLoading(false);
            return;
        }

        const loadProfile = async () => {
            setLoading(true);
            try {
                // 1차: Supabase(또는 localStorage)에서 프로필 조회
                const data = await getStoredProfile(id);

                if (data) {
                    setProfile(data);
                } else {
                    // 2차 폴백: mockData에서 숫자 id로 매칭되는 전문가 검색
                    // ExpertCard가 mockData의 숫자 id(1~6)로 이동하므로 이 경로가 필요
                    const mockExpert = EXPERTS.find(e => e.id === Number(id));
                    if (mockExpert) {
                        const fallback: ExpertProfile = {
                            ...createDefaultProfile(),
                            name: mockExpert.name,
                            profession: mockExpert.profession,
                            imageUrl: mockExpert.imageUrl,
                            oneLiner: `${mockExpert.profession} 분야의 검증된 전문가입니다.`,
                            greeting: `안녕하세요, ${mockExpert.name}입니다.\n평점 ${mockExpert.rating}점, ${mockExpert.reviews}건의 리뷰를 보유한 전문가로서 최선의 결과물을 약속드립니다.`,
                        };
                        setProfile(fallback);
                    }
                }
            } catch (error) {
                console.error('프로필 로딩 에러:', error);
            } finally {
                setLoading(false);
            }
        };

        loadProfile();
    }, [id]);

    if (loading) {
        return (
            <main className="container" style={{ display: 'flex', justifyContent: 'center', padding: '5rem 0' }}>
                <h2>로딩 중...</h2>
            </main>
        );
    }

    if (!profile) {
        return (
            <main className="container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '5rem 0', gap: '1rem' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '4rem', color: 'var(--text-muted)' }}>person_off</span>
                <h2>전문가를 찾을 수 없습니다</h2>
                <p style={{ color: 'var(--text-secondary)' }}>존재하지 않거나 삭제된 프로필입니다.</p>
                <Link to={ROUTES.HOME} className="btn-primary" style={{ marginTop: '1rem' }}>홈으로 돌아가기</Link>
            </main>
        );
    }

    return (
        <main className="container">
            {/* 내 프로필일 경우 수정 버튼 표시 */}
            {user?.id === id && (
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
                    <Link to={ROUTES.PROFILE} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span className="material-symbols-outlined">edit</span>
                        프로필 수정하기
                    </Link>
                </div>
            )}
            
            <div className="detail-layout">
                {/* ===== 좌측: 전문가 프로필 정보 ===== */}
                <div className="content-left">
                    {/* 프로필 헤더 */}
                    <div className="expert-header">
                        {profile.imageUrl ? (
                            <img src={profile.imageUrl} alt={profile.name} className="expert-avatar-large" />
                        ) : (
                            <div className="expert-avatar-large" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--background)', color: 'var(--text-muted)' }}>
                                <span className="material-symbols-outlined" style={{ fontSize: '3rem' }}>person</span>
                            </div>
                        )}
                        <div className="expert-info-main">
                            <div style={{ color: 'var(--primary)', fontWeight: 700, marginBottom: '0.5rem', fontSize: '0.95rem' }}>
                                {profile.profession}
                            </div>
                            <h1 style={{ fontSize: '2.25rem', fontWeight: 800, marginBottom: '1rem' }}>
                                {profile.name}
                            </h1>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, fontSize: '1.1rem' }}>
                                <span style={{ color: 'var(--star)' }} className="material-symbols-outlined">star</span>
                                <span>4.8</span>
                                <span style={{ color: 'var(--text-muted)', fontWeight: 400, fontSize: '0.95rem' }}>(120개)</span>
                                <span style={{ marginLeft: '1rem', paddingLeft: '1rem', borderLeft: '1px solid var(--border-color)', color: 'var(--text-secondary)', fontWeight: 500, fontSize: '0.95rem' }}>
                                    총 의뢰 완료 245건
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* 인사말 섹션 */}
                    <div className="detail-section">
                        <h2><span className="material-symbols-outlined">waving_hand</span>전문가 인사말</h2>
                        <div className="section-content">
                            {profile.oneLiner && (
                                <p style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '1.25rem', fontSize: '1.1rem' }}>
                                    "{profile.oneLiner}"
                                </p>
                            )}
                            <p style={{ whiteSpace: 'pre-wrap' }}>
                                {profile.greeting || '등록된 인사말이 없습니다.'}
                            </p>
                        </div>
                    </div>

                    {/* 경력 섹션 */}
                    <div className="detail-section">
                        <h2><span className="material-symbols-outlined">history_edu</span>전문가 경력</h2>
                        <div className="section-content">
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                                <div>
                                    <h4 style={{ marginBottom: '1rem', color: 'var(--text-primary)' }}>주요 활동</h4>
                                    <ul style={{ listStyle: 'none' }}>
                                        {profile.activities.filter(a => a).length > 0 ? (
                                            profile.activities.filter(a => a).map((activity, i) => (
                                                <li key={i} style={{ marginBottom: '0.5rem' }}>• {activity}</li>
                                            ))
                                        ) : (
                                            <li style={{ color: 'var(--text-muted)' }}>등록된 활동이 없습니다.</li>
                                        )}
                                    </ul>
                                </div>
                                <div>
                                    <h4 style={{ marginBottom: '1rem', color: 'var(--text-primary)' }}>수상 이력</h4>
                                    <ul style={{ listStyle: 'none' }}>
                                        {profile.awards.filter(a => a).length > 0 ? (
                                            profile.awards.filter(a => a).map((award, i) => (
                                                <li key={i} style={{ marginBottom: '0.5rem' }}>• {award}</li>
                                            ))
                                        ) : (
                                            <li style={{ color: 'var(--text-muted)' }}>등록된 수상 이력이 없습니다.</li>
                                        )}
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 사용 툴 */}
                    <div className="detail-section">
                        <h2><span className="material-symbols-outlined">construction</span>사용 툴 정보</h2>
                        <div className="section-content">
                            <div style={{ marginBottom: '2rem' }}>
                                <h4 style={{ marginBottom: '1rem', color: 'var(--text-primary)', fontWeight: 700 }}>AI 도구</h4>
                                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                                    {profile.aiTools && profile.aiTools.length > 0 ? (
                                        profile.aiTools.map((tool) => (
                                            <span key={tool} className="tool-chip">{tool}</span>
                                        ))
                                    ) : (
                                        <span style={{ color: 'var(--text-muted)' }}>등록된 도구가 없습니다.</span>
                                    )}
                                </div>
                            </div>
                            <div>
                                <h4 style={{ marginBottom: '1rem', color: 'var(--text-primary)', fontWeight: 700 }}>편집 및 후반 작업</h4>
                                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                                    {profile.editTools && profile.editTools.length > 0 ? (
                                        profile.editTools.map((tool) => (
                                            <span key={tool} className="tool-chip">{tool}</span>
                                        ))
                                    ) : (
                                        <span style={{ color: 'var(--text-muted)' }}>등록된 도구가 없습니다.</span>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ===== 우측: 요금 패키지 ===== */}
                <div className="content-right">
                    <PackageCard packages={profile.packages} onOpenChat={() => setChatOpen(true)} />
                </div>
            </div>

            {/* 채팅 모달 */}
            {chatOpen && <ChatModal onClose={() => setChatOpen(false)} />}
        </main>
    );
}
