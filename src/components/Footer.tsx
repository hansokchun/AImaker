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
                <details className="footer-business-details">
                    <summary>
                        <span>기그온</span>
                        <span aria-hidden="true">|</span>
                        <span>원코리아</span>
                        <span aria-hidden="true">|</span>
                        <span>책임운영자 한석준</span>
                        <span aria-hidden="true">|</span>
                        <span className="footer-business-trigger">사업자정보 확인</span>
                    </summary>
                    <dl className="footer-business-info" aria-label="법정 사업자 정보">
                        <div>
                            <dt>상호</dt>
                            <dd>원코리아</dd>
                        </div>
                        <div>
                            <dt>대표자</dt>
                            <dd>태영호</dd>
                        </div>
                        <div>
                            <dt>사업자등록번호</dt>
                            <dd>107-39-44459</dd>
                        </div>
                        <div>
                            <dt>통신판매업 신고번호</dt>
                            <dd>신고 전</dd>
                        </div>
                        <div className="footer-business-wide">
                            <dt>사업장 주소</dt>
                            <dd>서울특별시 영등포구 영중로 61, 7층 2호(영등포동6가, 극동빌딩)</dd>
                        </div>
                        <div>
                            <dt>고객센터</dt>
                            <dd>
                                <a href="mailto:gigon.help@gmail.com">gigon.help@gmail.com</a>
                                <span aria-hidden="true"> · </span>
                                <a href="tel:+821098189827">010-9818-9827</a>
                            </dd>
                        </div>
                        <div>
                            <dt>운영시간</dt>
                            <dd>평일 10:00~17:00 (주말·공휴일 제외)</dd>
                        </div>
                    </dl>
                </details>
                <p>&copy; 2026 Gig On. All rights reserved.</p>
            </div>
        </footer>
    );
}
