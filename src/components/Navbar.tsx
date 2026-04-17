import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function Navbar() {
    const location = useLocation();
    const navigate = useNavigate();
    const { user, signOut } = useAuth();

    const handleSignOut = async () => {
        await signOut();
        navigate('/');
    };

    return (
        <header className="navbar" id="navbar">
            <div className="nav-container container">
                <Link to="/" className="logo">
                    <span className="material-symbols-outlined logo-icon">handshake</span>
                    AIConnect
                </Link>
                <nav className="nav-links">
                    <Link to="/category" style={{ color: location.pathname === '/category' ? 'var(--primary)' : undefined }}>전문가 찾기</Link>
                    <Link to="/request" style={{ color: location.pathname === '/request' ? 'var(--primary)' : undefined }}>서비스 요청</Link>
                    <Link to="/requests" style={{ color: location.pathname === '/requests' ? 'var(--primary)' : undefined }}>요청 게시판</Link>
                    <Link to="/community" style={{ color: location.pathname === '/community' ? 'var(--primary)' : undefined }}>커뮤니티</Link>
                </nav>
                <div className="nav-actions">
                    {user ? (
                        <>
                            <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                                {user.user_metadata?.display_name || user.email}
                            </span>
                            <button onClick={handleSignOut} className="btn-text" style={{ cursor: 'pointer', border: 'none', background: 'none', fontFamily: 'inherit' }}>로그아웃</button>
                        </>
                    ) : (
                        <>
                            <Link to="/login" className="btn-text">로그인</Link>
                            <Link to="/login" className="btn-primary" onClick={() => {}}>전문가 가입</Link>
                        </>
                    )}
                </div>
            </div>
        </header>
    );
}
