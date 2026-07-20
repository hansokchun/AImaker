/**
 * Footer 컴포넌트
 * - 모든 페이지 하단에 표시되는 공통 푸터
 * - 서비스 링크, 고객지원, 비즈니스 안내 제공
 */
import { Link } from 'react-router-dom';
import { ROUTES } from '../constants/routes';
import BrandLogo from './BrandLogo';

export default function Footer() {
    return (
        <footer className="footer">
            <div className="container footer-content">
                <div className="footer-brand">
                    <Link to={ROUTES.HOME} className="logo footer-logo">
                        <BrandLogo tone="inverse" />
                    </Link>
                    <p className="footer-desc">상상을 현실로 만드는 가장 스마트한 방법. 최고의 전문가들과 함께하세요.</p>
                </div>
                <div className="link-column">
                    <h4>서비스</h4>
                    <Link to={ROUTES.CATEGORY}>전문가 찾기</Link>
                    <Link to={ROUTES.WORK_DASHBOARD}>내 작업</Link>
                </div>
                <div className="link-column">
                    <h4>고객지원</h4>
                    <Link to={ROUTES.REPORT}>신고하기</Link>
                    <Link to={ROUTES.TERMS}>이용약관</Link>
                    <Link to={ROUTES.PRIVACY}>개인정보 처리방침</Link>
                </div>
                <div className="link-column">
                    <h4>비즈니스</h4>
                    <Link to={ROUTES.PROFILE}>전문가 등록</Link>
                    <Link to={ROUTES.REPORT}>광고 안내</Link>
                    <Link to={ROUTES.REPORT}>제휴 문의</Link>
                </div>
            </div>
            <div className="container footer-bottom">
                <div className="footer-business-info" aria-label="사업자 정보">
                    <span>상호: 원코리아</span>
                    <span>대표자: 태영호</span>
                    <span>사업자등록번호: 107-39-44459</span>
                    <span>통신판매업 신고번호: 신고 전</span>
                    <span>사업장 주소: 서울특별시 영등포구 영중로 61, 7층 2호(영등포동6가, 극동빌딩)</span>
                    <span>고객센터 이메일: 미정</span>
                    <span>고객센터 전화번호: 미정</span>
                </div>
                <p>&copy; 2026 ilpick. All rights reserved.</p>
            </div>
        </footer>
    );
}
