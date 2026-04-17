import { Link, useLocation } from 'react-router-dom';

export default function Navbar() {
    const location = useLocation();
    
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
                    <a href="#" className="btn-text">로그인</a>
                    <a href="#" className="btn-primary">전문가 가입</a>
                </div>
            </div>
        </header>
    );
}
