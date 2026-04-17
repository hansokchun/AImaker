import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { CATEGORIES } from '../data/mockData';
import './RequestBoard.css';

export default function RequestBoard() {
    const [requests, setRequests] = useState([]);
    const [currentFilter, setCurrentFilter] = useState('전체');

    const filters = ['전체', ...CATEGORIES];

    useEffect(() => {
        const stored = JSON.parse(localStorage.getItem('ai_requests') || '[]');
        setRequests(stored);
    }, []);

    const filteredRequests = currentFilter === '전체' 
        ? requests 
        : requests.filter(req => req.categories && req.categories.includes(currentFilter));

    return (
        <>
            <div className="page-hero">
                <div className="container">
                    <h1 className="page-title">서비스 요청 게시판</h1>
                    <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: '1.1rem' }}>등록된 모든 서비스 요청 내역을 확인하고 전문가들의 제안을 기다리세요.</p>
                </div>
            </div>

            <main className="container" style={{ marginTop: '-3rem', paddingBottom: '8rem', position: 'relative', zIndex: 10 }}>
                {requests.length > 0 && (
                    <div className="filter-container">
                        {filters.map(cat => (
                            <div 
                                key={cat}
                                className={`filter-chip ${currentFilter === cat ? 'active' : ''}`}
                                onClick={() => setCurrentFilter(cat)}
                            >
                                {cat}
                            </div>
                        ))}
                    </div>
                )}

                <div className="content-card" style={{ padding: 0, overflow: 'hidden' }}>
                    {filteredRequests.length > 0 ? (
                        [...filteredRequests].reverse().map((req, idx) => (
                            <div className="request-item" key={idx}>
                                <div className="request-info">
                                    <div className="request-tags">
                                        {req.categories.map((cat, i) => (
                                            <span key={i} className="request-tag">{cat}</span>
                                        ))}
                                    </div>
                                    <h3>{req.title}</h3>
                                    <div className="request-meta">
                                        <span><span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>payments</span> {Number(req.budget).toLocaleString()}원</span>
                                        <span><span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>calendar_month</span> 마감: {req.deadline}</span>
                                        <span><span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>schedule</span> {req.createdAt}</span>
                                    </div>
                                </div>
                                <div className="request-status">
                                    <span className="status-badge">제안 대기 중</span>
                                    <button className="btn-text" style={{ fontSize: '0.9rem', padding: '0.5rem' }}>상세보기</button>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="empty-state">
                            <span className="material-symbols-outlined">description</span>
                            <p>선택하신 카테고리의 요청서가 없습니다.<br/>첫 번째 요청서를 작성해보세요!</p>
                            <Link to="/request" className="btn-primary" style={{ display: 'inline-block', marginTop: '1.5rem' }}>요청서 작성하기</Link>
                        </div>
                    )}
                </div>
            </main>
        </>
    );
}
