import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ROUTES } from '../constants/routes';
import { useAuth } from '../contexts/AuthContext';
import { getUserNotifications, type UserNotification } from '../lib/notifications';
import { getStoredProfile, getUserDisplayProfile } from '../lib/storage';

export default function Navbar() {
    const navigate = useNavigate();
    const { user, signOut } = useAuth();
    const [profileImageUrl, setProfileImageUrl] = useState('');
    const [profileMenuOpen, setProfileMenuOpen] = useState(false);
    const [notificationMenuOpen, setNotificationMenuOpen] = useState(false);
    const [notifications, setNotifications] = useState<UserNotification[]>([]);

    useEffect(() => {
        let active = true;
        const metadataImage = user?.user_metadata?.avatar_url || user?.user_metadata?.picture || '';

        if (!user) {
            setProfileImageUrl('');
            setProfileMenuOpen(false);
            setNotificationMenuOpen(false);
            setNotifications([]);
            return;
        }

        const refreshProfileImage = () => {
            setProfileImageUrl(metadataImage);
            return Promise.all([getStoredProfile(user.id), getUserDisplayProfile(user.id)])
            .then(([profile, displayProfile]) => {
                if (active) setProfileImageUrl(displayProfile?.imageUrl || profile?.imageUrl || metadataImage);
            })
            .catch(() => {
                if (active) setProfileImageUrl(metadataImage);
            });
        };

        refreshProfileImage();
        getUserNotifications(user.id)
            .then((items) => {
                if (active) setNotifications(items.slice(0, 8));
            })
            .catch(() => {
                if (active) setNotifications([]);
            });

        const handleProfileUpdated = (event: Event) => {
            const updatedUserId = (event as CustomEvent<{ userId?: string }>).detail?.userId;
            if (!updatedUserId || updatedUserId === user.id) {
                void refreshProfileImage();
            }
        };

        window.addEventListener('aiconnect:profile-updated', handleProfileUpdated);

        return () => {
            active = false;
            window.removeEventListener('aiconnect:profile-updated', handleProfileUpdated);
        };
    }, [user]);

    const handleSignOut = async () => {
        try {
            await signOut();
            setProfileMenuOpen(false);
            setNotificationMenuOpen(false);
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
                        <>
                        <div className="nav-notification-menu">
                            <button
                                type="button"
                                className="nav-notification-button"
                                aria-label={`알림 ${notifications.length}개 열기`}
                                aria-expanded={notificationMenuOpen}
                                onClick={() => {
                                    setNotificationMenuOpen((open) => !open);
                                    setProfileMenuOpen(false);
                                }}
                            >
                                <span className="material-symbols-outlined" aria-hidden="true">notifications</span>
                                {notifications.length > 0 && <span className="nav-notification-badge">{notifications.length}</span>}
                            </button>
                            {notificationMenuOpen && (
                                <div className="nav-notification-dropdown" role="menu" aria-label="알림 목록">
                                    <strong className="nav-notification-title">알림</strong>
                                    {notifications.length > 0 ? (
                                        notifications.map((notification) => (
                                            <Link
                                                key={notification.id}
                                                to={notification.to}
                                                className="nav-notification-item"
                                                role="menuitem"
                                                onClick={() => setNotificationMenuOpen(false)}
                                            >
                                                <span>{notification.title}</span>
                                                <small>{notification.body}</small>
                                            </Link>
                                        ))
                                    ) : (
                                        <p className="nav-notification-empty">새 알림이 없습니다.</p>
                                    )}
                                </div>
                            )}
                        </div>
                        <div className="nav-profile-menu">
                            <button
                                type="button"
                                className="nav-profile-link"
                                aria-label="프로필 메뉴 열기"
                                aria-expanded={profileMenuOpen}
                                onClick={() => {
                                    setProfileMenuOpen((open) => !open);
                                    setNotificationMenuOpen(false);
                                }}
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
                        </>
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
