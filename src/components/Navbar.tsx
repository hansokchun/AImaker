/**
 * Navbar 컴포넌트
 * - 최상단 네비게이션 바 — 로고, 페이지 링크, 로그인/로그아웃 표시
 * - sticky 포지션으로 스크롤 시에도 항상 화면 상단에 고정
 * - 현재 경로에 따라 활성 링크 색상을 변경하여 사용자의 위치를 시각적으로 안내
 */
import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ROUTES } from '../constants/routes';
import { getStoredProfile } from '../lib/storage';

/** 네비게이션 링크 정의 — 추가/변경 시 여기만 수정하면 됨 */
const NAV_LINKS = [
    { path: ROUTES.CATEGORY, label: 'AI 작업 찾기' },
    { path: ROUTES.REQUEST_BOARD, label: '요청 게시판' },
    { path: ROUTES.COMMUNITY, label: '커뮤니티' },
] as const;

export default function Navbar() {
    const location = useLocation();
    const navigate = useNavigate();
    const { user, signOut } = useAuth();
    const [profileImageUrl, setProfileImageUrl] = useState('');

    useEffect(() => {
        let active = true;
        const metadataImage = user?.user_metadata?.avatar_url || user?.user_metadata?.picture || '';

        if (!user) {
            setProfileImageUrl('');
            return;
        }

        setProfileImageUrl(metadataImage);
        getStoredProfile(user.id)
            .then((profile) => {
                if (active) setProfileImageUrl(profile?.imageUrl || metadataImage);
            })
            .catch(() => {
                if (active) setProfileImageUrl(metadataImage);
            });

        return () => {
            active = false;
        };
    }, [user]);

    const handleSignOut = async () => {
        try {
            await signOut();
            navigate(ROUTES.HOME);
        } catch (error) {
            // 로그아웃 실패 시에도 사용자에게 불편을 주지 않기 위해 콘솔에만 기록
            console.error('로그아웃 중 오류 발생:', error);
        }
    };

    return (
        <header className="navbar" id="navbar">
            <div className="nav-container container">
                <Link to={ROUTES.HOME} className="logo">
                    <span className="material-symbols-outlined logo-icon">handshake</span>
                    AIConnect
                </Link>

                <nav className="nav-links">
                    {NAV_LINKS.map(({ path, label }) => (
                        <Link
                            key={path}
                            to={path}
                            style={{ color: location.pathname === path ? 'var(--primary)' : undefined }}
                        >
                            {label}
                        </Link>
                    ))}
                </nav>

                <div className="nav-actions">
                    {user ? (
                        <>
                            <Link
                                to={`${ROUTES.MY_PAGE}?panel=profile`}
                                className="nav-profile-link"
                                aria-label="마이 프로필"
                                style={{ color: location.pathname === ROUTES.MY_PAGE ? 'var(--primary)' : undefined }}
                            >
                                {profileImageUrl ? (
                                    <img src={profileImageUrl} alt="마이 프로필" className="nav-profile-image" />
                                ) : (
                                    <span className="nav-profile-fallback" aria-hidden="true">
                                        {(user.user_metadata?.display_name || user.email || '?').slice(0, 1).toUpperCase()}
                                    </span>
                                )}
                            </Link>
                            <Link
                                to={ROUTES.MY_PAGE}
                                className="btn-text"
                                style={{ color: location.pathname === ROUTES.MY_PAGE ? 'var(--primary)' : undefined }}
                            >
                                마이페이지
                            </Link>
                            <button
                                onClick={handleSignOut}
                                className="btn-text"
                                style={{ cursor: 'pointer', border: 'none', background: 'none', fontFamily: 'inherit' }}
                            >
                                로그아웃
                            </button>
                        </>
                    ) : (
                        <>
                            <Link to={ROUTES.LOGIN} className="btn-primary">로그인</Link>
                        </>
                    )}
                </div>
            </div>
        </header>
    );
}
