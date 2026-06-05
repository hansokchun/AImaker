import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ROUTES } from '../constants/routes';
import { useAuth } from '../contexts/AuthContext';
import { getStoredProfile, getUserDisplayProfile } from '../lib/storage';

export default function Navbar() {
    const navigate = useNavigate();
    const { user, signOut } = useAuth();
    const [profileImageUrl, setProfileImageUrl] = useState('');
    const [profileMenuOpen, setProfileMenuOpen] = useState(false);

    useEffect(() => {
        let active = true;
        const metadataImage = user?.user_metadata?.avatar_url || user?.user_metadata?.picture || '';

        if (!user) {
            setProfileImageUrl('');
            setProfileMenuOpen(false);
            return;
        }

        setProfileImageUrl(metadataImage);
        Promise.all([getStoredProfile(user.id), getUserDisplayProfile(user.id)])
            .then(([profile, displayProfile]) => {
                if (active) setProfileImageUrl(profile?.imageUrl || displayProfile?.imageUrl || metadataImage);
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
            setProfileMenuOpen(false);
            navigate(ROUTES.HOME);
        } catch (error) {
            console.error('로그아웃 중 오류 발생:', error);
        }
    };

    return (
        <header className="navbar" id="navbar">
            <div className="nav-container container">
                <Link to={ROUTES.HOME} className="logo" aria-label="AIConnect">
                    <span className="material-symbols-outlined logo-icon" aria-hidden="true">handshake</span>
                    AIConnect
                </Link>

                <div className="nav-actions">
                    {user ? (
                        <div className="nav-profile-menu">
                            <button
                                type="button"
                                className="nav-profile-link"
                                aria-label="프로필 메뉴 열기"
                                aria-expanded={profileMenuOpen}
                                onClick={() => setProfileMenuOpen((open) => !open)}
                            >
                                {profileImageUrl ? (
                                    <img src={profileImageUrl} alt="마이 프로필 메뉴" className="nav-profile-image" />
                                ) : (
                                    <span className="nav-profile-fallback" aria-hidden="true">
                                        {(user.user_metadata?.display_name || user.email || '?').slice(0, 1).toUpperCase()}
                                    </span>
                                )}
                            </button>
                            {profileMenuOpen && (
                                <div className="nav-profile-dropdown" role="menu">
                                    <Link
                                        to={ROUTES.WORK_DASHBOARD}
                                        className="nav-profile-dropdown-item"
                                        role="menuitem"
                                        onClick={() => setProfileMenuOpen(false)}
                                    >
                                        내 작업
                                    </Link>
                                    <Link
                                        to={`${ROUTES.MY_PAGE}?panel=profile`}
                                        className="nav-profile-dropdown-item"
                                        role="menuitem"
                                        onClick={() => setProfileMenuOpen(false)}
                                    >
                                        마이페이지
                                    </Link>
                                    <button
                                        type="button"
                                        onClick={handleSignOut}
                                        className="nav-profile-dropdown-item"
                                        role="menuitem"
                                    >
                                        로그아웃
                                    </button>
                                </div>
                            )}
                        </div>
                    ) : (
                        <Link to={ROUTES.LOGIN} className="btn-primary">
                            로그인
                        </Link>
                    )}
                </div>
            </div>
        </header>
    );
}
