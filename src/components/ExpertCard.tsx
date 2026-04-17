import { useNavigate } from 'react-router-dom';
import type { Expert } from '../types';
import './ExpertCard.css';

interface ExpertCardProps {
    expert: Expert;
}

export default function ExpertCard({ expert }: ExpertCardProps) {
    const navigate = useNavigate();

    return (
        <div className="expert-card" onClick={() => navigate('/expert')}>
            <div className="img-container">
                <img src={expert.img} className="img" loading="lazy" alt={expert.name} />
            </div>
            <div className="expert-content">
                <div className="prof">{expert.prof}</div>
                <div className="name">{expert.name}</div>
                <div className="rating-row">
                    <span className="star">★</span> {expert.rate.toFixed(1)}
                </div>
                <div className="price-row">
                    <span className="price-label">기본 금액</span>
                    <span className="price-value">{Number(expert.price).toLocaleString()}원~</span>
                </div>
            </div>
        </div>
    );
}
