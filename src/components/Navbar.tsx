import { type FormEvent, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ROUTES } from '../constants/routes';
import { useAuth } from '../contexts/AuthContext';
import { getUserNotifications, type UserNotification } from '../lib/notifications';
import { getStoredProfile, getUserDisplayProfile } from '../lib/storage';

export default function Navbar() {
    const navigate = useNavigate();
    const location = useLocation();
    const { user, signOut } = useAuth();
    const [searchTerm, setSearchTerm] = useState('');
    const [profileImageUrl, setProfileImageUrl] = useState('');
    const [profileMenuOpen, setProfileMenuOpen] = useState(false);
    const [notificationMenuOpen, setNotificationMenuOpen] = useState(false);
    const [notifications, setNotifications] = useState<UserNotification[]>([]);

    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const nextSearchTerm = location.pathname === ROUTES.CATEGORY ? params.get('q') || '' : '';
        setSearchTerm(nextSearchTerm);
    }, [location.pathname, location.search]);

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

        const refreshNotifications = () => getUserNotifications(user.id)
            .then((items) => {
                if (active) {
                    const readIds = getReadNotificationIds(user.id);
                    setNotifications(items.filter((item) => !readIds.has(item.id)).slice(0, 8));
                }
            })
            .catch(() => {
                if (active) setNotifications([]);
            });

        refreshProfileImage();
        void refreshNotifications();

        const handleProfileUpdated = (event: Event) => {
            const updatedUserId = (event as CustomEvent<{ userId?: string }>).detail?.userId;
            if (!updatedUserId || updatedUserId === user.id) {
                void refreshProfileImage();
            }
        };
        const handleNotificationsUpdated = () => {
            void refreshNotifications();
        };
        const notificationInterval = window.setInterval(refreshNotifications, 15000);

        window.addEventListener('aiconnect:profile-updated', handleProfileUpdated);
        window.addEventListener('aiconnect:notifications-updated', handleNotificationsUpdated);

        return () => {
            active = false;
            window.removeEventListener('aiconnect:profile-updated', handleProfileUpdated);
            window.removeEventListener('aiconnect:notifications-updated', handleNotificationsUpdated);
            window.clearInterval(notificationInterval);
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

    const handleSearchSubmit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const trimmedSearchTerm = searchTerm.trim();

        setProfileMenuOpen(false);
        setNotificationMenuOpen(false);

        if (!trimmedSearchTerm) {
            navigate(ROUTES.CATEGORY);
            return;
        }

        const params = new URLSearchParams({ q: trimmedSearchTerm });
        navigate(`${ROUTES.CATEGORY}?${params.toString()}`);
    };

    const handleNotificationOpen = (notification: UserNotification) => {
        if (!user) return;
        markNotificationAsRead(user.id, notification.id);
        setNotifications((current) => current.filter((item) => item.id !== notification.id));
        setNotificationMenuOpen(false);
    };

    const showSearch = location.pathname !== ROUTES.HOME;

    return (
        <header className="navbar" id="navbar">
            <div className="nav-container container">
                <Link to={ROUTES.HOME} className="logo" aria-label="AIConnect">
                    AIConnect
                </Link>

                {showSearch && (
                    <form className="nav-search" role="search" aria-label="AI 작업 검색" onSubmit={handleSearchSubmit}>
                        <input
                            type="search"
                            aria-label="AI 작업 검색어"
                            value={searchTerm}
                            onChange={(event) => setSearchTerm(event.target.value)}
                            placeholder="어떤 AI 작업을 찾으세요?"
                        />
                        <button type="submit" aria-label="검색">
                            검색
                        </button>
                    </form>
                )}

                <div className="nav-actions">
                    {user ? (
                        <>
                        <Link to={ROUTES.WORK_DASHBOARD} className="nav-work-link">
                            <span className="material-symbols-outlined" aria-hidden="true">work_history</span>
                            내 작업
                        </Link>
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
                                                onClick={() => handleNotificationOpen(notification)}
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
                                    <Link
                                        to={ROUTES.REPORT}
                                        className="nav-profile-dropdown-item"
                                        role="menuitem"
                                        onClick={() => setProfileMenuOpen(false)}
                                    >
                                        신고하기
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

const getReadNotificationStorageKey = (userId: string) => `aiconnect_read_notifications_${userId}`;

const getReadNotificationIds = (userId: string) => {
    try {
        const raw = window.localStorage.getItem(getReadNotificationStorageKey(userId));
        return new Set<string>(raw ? JSON.parse(raw) : []);
    } catch {
        return new Set<string>();
    }
};

const markNotificationAsRead = (userId: string, notificationId: string) => {
    try {
        const readIds = getReadNotificationIds(userId);
        readIds.add(notificationId);
        window.localStorage.setItem(getReadNotificationStorageKey(userId), JSON.stringify([...readIds]));
    } catch {
        // localStorage를 사용할 수 없는 환경에서는 현재 화면 상태만 갱신합니다.
    }
};
