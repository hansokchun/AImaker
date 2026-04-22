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
                        <label style={{ display: 'block', fontWeight: 700, marginBottom: '0.5rem' }}>회원 유형 (권한 분리)</label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', padding: '1rem', background: '#eff6ff', borderRadius: '0.5rem', border: '1px solid #bfdbfe' }}>
                            <input type="checkbox" checked={isExpert} onChange={(e) => setIsExpert(e.target.checked)} style={{ width: '1.2rem', height: '1.2rem' }} />
                            <span style={{ fontSize: '1.1rem', color: '#1e3a8a', fontWeight: 600 }}>나는 전문가입니다 (작업 제안 및 수락 가능)</span>
                        </label>
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
