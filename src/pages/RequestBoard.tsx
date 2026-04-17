/**
 * RequestBoard 페이지 — 서비스 요청 게시판
 * - localStorage에 저장된 요청 목록을 카테고리별로 필터링하여 표시
 * - 저장 유틸(storage.ts)을 사용하여 데이터 로딩 에러를 안전하게 처리
 */
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { CATEGORIES } from '../data/mockData';
import { getStoredRequests } from '../lib/storage';
import { ROUTES } from '../constants/routes';
import type { ServiceRequestData } from '../types';
import './RequestBoard.css';

export default function RequestBoard() {
    const [requests, setRequests] = useState<ServiceRequestData[]>([]);
    const [currentFilter, setCurrentFilter] = useState<string>('전체');

    const filters: string[] = ['전체', ...CATEGORIES];

    // 컴포넌트 마운트 시 저장된 요청 목록을 안전하게 로딩
    useEffect(() => {
        setRequests(getStoredRequests());
    }, []);

    // 필터링된 요청 목록 — '전체'이면 모든 요청, 아니면 해당 카테고리만
    const filteredRequests = currentFilter === '전체'
        ? requests
        : requests.filter((request) => request.categories?.includes(currentFilter));

    return (
        <>
            <div className="page-hero">
                <div className="container">
                    <h1 className="page-title">서비스 요청 게시판</h1>
                    <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: '1.1rem' }}>등록된 모든 서비스 요청 내역을 확인하고 전문가들의 제안을 기다리세요.</p>
                </div>
            </div>

            <main className="container" style={{ marginTop: '-3rem', paddingBottom: '8rem', position: 'relative', zIndex: 10 }}>
                {/* 카테고리 필터 칩 — 요청이 있을 때만 표시 */}
                {requests.length > 0 && (
                    <div className="filter-container">
                        {filters.map((category) => (
                            <div
                                key={category}
                                className={`filter-chip ${currentFilter === category ? 'active' : ''}`}
                                onClick={() => setCurrentFilter(category)}
                            >
                                {category}
                            </div>
                        ))}
                    </div>
                )}

                <div className="content-card" style={{ padding: 0, overflow: 'hidden' }}>
                    {filteredRequests.length > 0 ? (
                        /* 최신순 정렬을 위해 reverse — 원본 배열 보호를 위해 스프레드 사용 */
                        [...filteredRequests].reverse().map((request) => (
                            <div className="request-item" key={request.id}>
                                <div className="request-info">
                                    <div className="request-tags">
                                        {request.categories.map((category, index) => (
                                            <span key={index} className="request-tag">{category}</span>
                                        ))}
                                    </div>
                                    <h3>{request.title}</h3>
                                    <div className="request-meta">
                                        <span><span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>payments</span> {Number(request.budget).toLocaleString()}원</span>
                                        <span><span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>calendar_month</span> 마감: {request.deadline}</span>
                                        <span><span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>schedule</span> {request.createdAt}</span>
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
                            <Link to={ROUTES.SERVICE_REQUEST} className="btn-primary" style={{ display: 'inline-block', marginTop: '1.5rem' }}>요청서 작성하기</Link>
                        </div>
                    )}
                </div>
            </main>
        </>
    );
}
