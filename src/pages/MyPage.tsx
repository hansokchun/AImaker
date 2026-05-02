import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { ROUTES } from '../constants/routes';

export default function MyPage() {
    const { session, user, loading, signOut } = useAuth();
    const navigate = useNavigate();
    const [isExpert, setIsExpert] = useState(false);
    const [name, setName] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (!loading && !session) {
            navigate(ROUTES.LOGIN); // 비로그인 접근 통제
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
            // PGRST116: no rows returned (초기 가입 시 프로필 없을 수 있음)
            console.error('프로필 로딩 에러:', error);
        }
    };

    const handleSave = async () => {
        if (!supabase || !user) {
            alert('Supabase 환경 설정이 완료되지 않아 로컬 모드 혹은 접속 불가 상태입니다.');
            return;
        }
        setIsSaving(true);
        const { error } = await supabase
            .from('profiles')
            .upsert({ id: user.id, email: user.email, name, is_expert: isExpert });
        setIsSaving(false);
        
        if (error) {
            alert('저장 실패: ' + error.message);
        } else {
            alert('프로필이 성공적으로 업데이트 되었습니다!');
        }
    };

    if (loading) return <div className="container" style={{ padding: '4rem 0', textAlign: 'center' }}>로딩 중...</div>;
    if (!session) return null;

    return (
        <div style={{ backgroundColor: '#f8fafc', minHeight: 'calc(100vh - 60px)', padding: '4rem 0' }}>
            <main className="container">
                <h1 style={{ fontSize: '2.5rem', fontWeight: 800, marginBottom: '2rem' }}>마이페이지</h1>
                
                <div style={{ background: 'white', padding: '2.5rem', borderRadius: '1rem', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', maxWidth: '600px' }}>
                    <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                        <label style={{ display: 'block', fontWeight: 700, marginBottom: '0.5rem' }}>접속 계정 (이메일)</label>
                        <input type="text" className="form-control" value={user?.email || ''} readOnly style={{ backgroundColor: '#f1f5f9', cursor: 'not-allowed', width: '100%', padding: '0.8rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1' }} />
                    </div>

                    <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                        <label style={{ display: 'block', fontWeight: 700, marginBottom: '0.5rem' }}>닉네임 / 활동명</label>
                        <input type="text" className="form-control" value={name} onChange={(e) => setName(e.target.value)} placeholder="실명 또는 브랜드명을 입력하세요" style={{ width: '100%', padding: '0.8rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1' }} />
                    </div>

                    <div className="form-group" style={{ marginBottom: '2rem' }}>
                        <label style={{ display: 'block', fontWeight: 700, marginBottom: '0.5rem' }}>회원 유형</label>
                        <div style={{ padding: '1rem', background: isExpert ? '#eff6ff' : '#f0fdf4', borderRadius: '0.5rem', border: `1px solid ${isExpert ? '#bfdbfe' : '#bbf7d0'}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span style={{ fontSize: '1.1rem', color: isExpert ? '#1e3a8a' : '#166534', fontWeight: 600 }}>
                                {isExpert ? '🏆 전문가' : '🔍 의뢰자'}
                            </span>
                            <button
                                type="button"
                                onClick={async () => {
                                    if (!supabase || !user) return;
                                    const newValue = !isExpert;
                                    const { error } = await supabase.from('profiles').update({ is_expert: newValue }).eq('id', user.id);
                                    if (!error) {
                                        setIsExpert(newValue);
                                        alert(newValue ? '전문가로 전환되었습니다! 프로필을 작성해주세요.' : '의뢰자로 전환되었습니다.');
                                        if (newValue) navigate(ROUTES.PROFILE);
                                    }
                                }}
                                style={{ padding: '0.5rem 1rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1', background: 'white', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' }}
                            >
                                {isExpert ? '의뢰자로 전환' : '전문가로 전환'}
                            </button>
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '1rem' }}>
                        <button className="btn-primary" onClick={handleSave} disabled={isSaving} style={{ flex: 1, padding: '1rem', borderRadius: '0.5rem', fontSize: '1.1rem' }}>
                            {isSaving ? '저장 중...' : '프로필 저장하기'}
                        </button>
                        <button onClick={() => { signOut(); navigate(ROUTES.HOME); }} style={{ padding: '1rem', borderRadius: '0.5rem', fontSize: '1.1rem', background: '#ffe4e6', color: '#e11d48', border: 'none', cursor: 'pointer', fontWeight: 700 }}>
                            로그아웃
                        </button>
                    </div>
                </div>
            </main>
        </div>
    );
}
