/**
 * ExpertCard 컴포넌트
 * - 전문가 리스트에서 각 전문가를 카드 형태로 보여주는 재사용 컴포넌트
 * - 클릭 시 전문가 상세 페이지로 이동
 * - Home, Category 페이지에서 공통으로 사용
 */
import { useNavigate } from 'react-router-dom';
import type { Expert } from '../types';
import { ROUTES } from '../constants/routes';
import './ExpertCard.css';

interface ExpertCardProps {
    /** 표시할 전문가 데이터 */
    expert: Expert;
}

export default function ExpertCard({ expert }: ExpertCardProps) {
    const navigate = useNavigate();

    return (
        // expert.id를 경로에 직접 삽입 — ROUTES.EXPERT_DETAIL은 ':id' 플레이스홀더라 사용 불가
        <div className="expert-card" onClick={() => navigate(`/expert/${expert.id}`)}>
            <div className="img-container">
                <img src={expert.imageUrl} className="img" loading="lazy" alt={expert.name} />
            </div>
            <div className="expert-content">
                <div className="prof">{expert.profession}</div>
                <div className="name">{expert.name}</div>
                <div className="rating-row">
                    <span className="star">★</span> {expert.rating.toFixed(1)}
                </div>
                <div className="price-row">
                    <span className="price-label">기본 금액</span>
                    <span className="price-value">{Number(expert.price).toLocaleString()}원~</span>
                </div>
            </div>
        </div>
    );
}
