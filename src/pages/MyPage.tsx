/**
 * MyPage — 마이페이지 (프로필 조회 + 프로필 수정 진입점)
 * - 로그인 유저의 프로필 정보를 읽기 전용으로 표시
 * - "프로필 수정하기" 버튼으로 Profile 편집 페이지로 이동
 * - 전문가/의뢰자 모두 동일한 레이아웃
 */
import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { ROUTES } from '../constants/routes';

export default function MyPage() {
    const { session, user, loading, signOut } = useAuth();
    const navigate = useNavigate();
    const [isExpert, setIsExpert] = useState(false);
    const [name, setName] = useState('');

    useEffect(() => {
        if (!loading && !session) {
            navigate(ROUTES.LOGIN);
        }
    }, [session, loading, navigate]);

    useEffect(() => {
        if (user && supabase) {
            fetchProfile();
        }
    }, [user]);

    const fetchProfile = async () => {
        if (!supabase || !user) return;
        const { data, error } = await supabase.from('profiles').select('*').eq('id', user.id).single();
        if (data) {
            setIsExpert(data.is_expert);
            setName(data.name || '');
        } else if (error && error.code !== 'PGRST116') {
            console.error('프로필 로딩 에러:', error);
        }
    };

    if (loading) return <div className="container" style={{ padding: '4rem 0', textAlign: 'center' }}>로딩 중...</div>;
    if (!session) return null;

    return (
        <div style={{ backgroundColor: '#f8fafc', minHeight: 'calc(100vh - 60px)', padding: '4rem 0' }}>
            <main className="container">
                <h1 style={{ fontSize: '2.5rem', fontWeight: 800, marginBottom: '2rem' }}>마이페이지</h1>
                
                <div style={{ background: 'white', padding: '2.5rem', borderRadius: '1rem', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', maxWidth: '600px' }}>
                    {/* 프로필 정보 표시 (읽기 전용) */}
                    <div style={{ marginBottom: '1.5rem' }}>
                        <label style={{ display: 'block', fontWeight: 700, marginBottom: '0.5rem', color: '#64748b', fontSize: '0.85rem' }}>닉네임</label>
                        <p style={{ fontSize: '1.2rem', fontWeight: 600, color: '#1e293b', margin: 0 }}>{name || '미설정'}</p>
                    </div>

                    <div style={{ marginBottom: '1.5rem' }}>
                        <label style={{ display: 'block', fontWeight: 700, marginBottom: '0.5rem', color: '#64748b', fontSize: '0.85rem' }}>접속 계정</label>
                        <p style={{ fontSize: '1rem', color: '#475569', margin: 0 }}>{user?.email || ''}</p>
                    </div>

                    <div style={{ marginBottom: '2rem' }}>
                        <label style={{ display: 'block', fontWeight: 700, marginBottom: '0.5rem', color: '#64748b', fontSize: '0.85rem' }}>회원 유형</label>
                        <span style={{
                            display: 'inline-block',
                            padding: '0.4rem 1rem',
                            borderRadius: '20px',
                            fontSize: '0.9rem',
                            fontWeight: 700,
                            background: isExpert ? '#eff6ff' : '#f0fdf4',
                            color: isExpert ? '#1e40af' : '#166534',
                            border: `1px solid ${isExpert ? '#bfdbfe' : '#bbf7d0'}`,
                        }}>
                            {isExpert ? '🏆 전문가' : '🔍 의뢰자'}
                        </span>
                    </div>

                    {/* 액션 버튼 */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        <Link
                            to={ROUTES.PROFILE}
                            className="btn-primary"
                            style={{ display: 'block', textAlign: 'center', padding: '1rem', borderRadius: '0.5rem', fontSize: '1.05rem', fontWeight: 700, textDecoration: 'none' }}
                        >
                            프로필 수정하기
                        </Link>

                        {/* 전문가인 경우 내 공개 프로필 보기 링크 */}
                        {isExpert && (
                            <Link
                                to={`/expert/${user?.id}`}
                                style={{ display: 'block', textAlign: 'center', padding: '0.85rem', borderRadius: '0.5rem', fontSize: '1rem', fontWeight: 600, textDecoration: 'none', border: '1px solid #cbd5e1', color: '#475569', background: 'white' }}
                            >
                                내 공개 프로필 보기
                            </Link>
                        )}

                        <button
                            onClick={() => { signOut(); navigate(ROUTES.HOME); }}
                            style={{ padding: '0.85rem', borderRadius: '0.5rem', fontSize: '1rem', background: '#ffe4e6', color: '#e11d48', border: 'none', cursor: 'pointer', fontWeight: 700 }}
                        >
                            로그아웃
                        </button>
                    </div>
                </div>
            </main>
        </div>
    );
}
