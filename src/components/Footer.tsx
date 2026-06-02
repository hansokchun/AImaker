/**
 * Footer 컴포넌트
 * - 모든 페이지 하단에 표시되는 공통 푸터
 * - 서비스 링크, 고객지원, 비즈니스 안내 제공
 */
import { Link } from 'react-router-dom';
import { ROUTES } from '../constants/routes';

export default function Footer() {
    return (
        <footer className="footer">
            <div className="container footer-content">
                <div className="footer-brand">
                    <Link to={ROUTES.HOME} className="logo" style={{ color: 'white', marginBottom: '1.5rem', display: 'block' }}>AIConnect</Link>
                    <p className="footer-desc">상상을 현실로 만드는 가장 스마트한 방법. 최고의 전문가들과 함께하세요.</p>
                </div>
                <div className="link-column">
                    <h4>서비스</h4>
                    <Link to={ROUTES.CATEGORY}>AI 작업 찾기</Link>
                    <Link to={ROUTES.WORK_DASHBOARD}>내 작업</Link>
                </div>
                <div className="link-column">
                    <h4>고객지원</h4>
                    <a href="#">자주 묻는 질문</a>
                    <a href="#">고객센터</a>
                    <a href="#">이용약관</a>
                </div>
                <div className="link-column">
                    <h4>비즈니스</h4>
                    <a href="#">전문가 등록</a>
                    <a href="#">광고 안내</a>
                    <a href="#">제휴 문의</a>
                </div>
            </div>
            <div className="container footer-bottom">
                <p>&copy; 2026 AIConnect. All rights reserved.</p>
            </div>
        </footer>
    );
}
