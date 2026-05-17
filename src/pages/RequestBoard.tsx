/**
 * RequestBoard 페이지 — 서비스 요청 게시판
 * - localStorage에 저장된 요청 목록을 카테고리별로 필터링하여 표시
 * - 저장 유틸(storage.ts)을 사용하여 데이터 로딩 에러를 안전하게 처리
 */
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { CATEGORIES } from '../data/mockData';
import { getStoredRequests, saveProposal } from '../lib/storage';
import { EXTERNAL_CONTACT_WARNING, hasExternalContactInFields } from '../constants/policies';
import { ROUTES } from '../constants/routes';
import type { Proposal, ServiceRequestData } from '../types';
import './RequestBoard.css';

export default function RequestBoard() {
    const { user } = useAuth();
    const [requests, setRequests] = useState<ServiceRequestData[]>([]);
    const [currentFilter, setCurrentFilter] = useState<string>('전체');
    const [selectedRequest, setSelectedRequest] = useState<ServiceRequestData | null>(null);
    const [proposalDraft, setProposalDraft] = useState({
        title: '',
        scope: '',
        totalPrice: '',
        deliveryDays: '',
    });
    const [proposalMessage, setProposalMessage] = useState('');

    const filters: string[] = ['전체', ...CATEGORIES];

    // 컴포넌트 마운트 시 저장된 요청 목록을 비동기로 렌더링
    useEffect(() => {
        getStoredRequests().then(data => setRequests(data));
    }, []);

    // 필터링된 요청 목록 — '전체'이면 모든 요청, 아니면 해당 카테고리만
    const filteredRequests = currentFilter === '전체'
        ? requests
        : requests.filter((request) => request.categories?.includes(currentFilter));

    const handleSelectRequest = (request: ServiceRequestData) => {
        setSelectedRequest(request);
        setProposalDraft({
            title: request.title ? `${request.title} 제안` : '',
            scope: '',
            totalPrice: request.budget || '',
            deliveryDays: '',
        });
        setProposalMessage('');
    };

    const handleProposalChange = (field: keyof typeof proposalDraft, value: string) => {
        setProposalDraft((draft) => ({ ...draft, [field]: value }));
        setProposalMessage('');
    };

    const handleSubmitProposal = async () => {
        if (!selectedRequest || !user) {
            setProposalMessage('로그인 후 제안서를 보낼 수 있습니다.');
            return;
        }

        const totalPrice = Number(proposalDraft.totalPrice);
        const deliveryDays = Number(proposalDraft.deliveryDays);
        if (!proposalDraft.title.trim() || !proposalDraft.scope.trim() || !totalPrice || !deliveryDays) {
            setProposalMessage('제안 내용을 모두 입력해 주세요.');
            return;
        }
        if (hasExternalContactInFields([proposalDraft.title, proposalDraft.scope])) {
            setProposalMessage(EXTERNAL_CONTACT_WARNING);
            return;
        }

        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 3);

        const proposal: Proposal = {
            id: `proposal-${Date.now()}`,
            requestId: String(selectedRequest.id),
            clientId: selectedRequest.clientId || '',
            expertId: user.id,
            title: proposalDraft.title.trim(),
            scope: proposalDraft.scope.trim(),
            deliverables: [selectedRequest.title],
            totalPrice,
            deliveryDays,
            revisionCount: 1,
            progressType: selectedRequest.progressType || 'single',
            milestones: [],
            commercialUseAllowed: false,
            sourceFileIncluded: false,
            status: 'sent',
            expiresAt: expiresAt.toISOString(),
        };

        await saveProposal(proposal);
        setProposalMessage('제안서를 보냈습니다.');
    };

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
                                    <button className="btn-text" style={{ fontSize: '0.9rem', padding: '0.5rem' }} onClick={() => handleSelectRequest(request)}>상세보기</button>
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

                {/* ===== 상세보기 모달 ===== */}
                {selectedRequest && (
                    <div className="modal-overlay" onClick={() => setSelectedRequest(null)}>
                        <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                            <div className="modal-header">
                                <h2>{selectedRequest.title}</h2>
                                <button className="close-btn" onClick={() => setSelectedRequest(null)}>
                                    <span className="material-symbols-outlined">close</span>
                                </button>
                            </div>
                            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                                <div>
                                    <h4 style={{ color: 'var(--text-muted)', marginBottom: '0.5rem' }}>상세 내용</h4>
                                    <p style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{selectedRequest.description}</p>
                                </div>
                                
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', backgroundColor: 'var(--background)', padding: '1rem', borderRadius: 'var(--radius-lg)' }}>
                                    <div>
                                        <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>희망 예산</span>
                                        <div style={{ fontWeight: 700, marginTop: '0.25rem' }}>{Number(selectedRequest.budget).toLocaleString()}원</div>
                                    </div>
                                    <div>
                                        <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>마감 기한</span>
                                        <div style={{ fontWeight: 700, marginTop: '0.25rem' }}>{selectedRequest.deadline}</div>
                                    </div>
                                    <div style={{ gridColumn: '1 / -1' }}>
                                        <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>카테고리</span>
                                        <div style={{ fontWeight: 500, marginTop: '0.25rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                            {selectedRequest.categories.map((cat, i) => (
                                                <span key={i} className="request-tag">{cat}</span>
                                            ))}
                                        </div>
                                    </div>
                                    <div style={{ gridColumn: '1 / -1' }}>
                                        <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>주문자 연락처</span>
                                        <div style={{ fontWeight: 500, marginTop: '0.25rem' }}>{selectedRequest.ordererEmail || '이메일 미기재'}</div>
                                    </div>
                                </div>
                            </div>
                            <div className="modal-footer" style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1.25rem', marginTop: '1.25rem' }}>
                                <div style={{ display: 'grid', gap: '1rem', marginBottom: '1rem' }}>
                                    <label style={{ display: 'grid', gap: '0.5rem', fontWeight: 700 }}>
                                        제안 제목
                                        <input
                                            className="form-input"
                                            value={proposalDraft.title}
                                            onChange={(event) => handleProposalChange('title', event.target.value)}
                                        />
                                    </label>
                                    <label style={{ display: 'grid', gap: '0.5rem', fontWeight: 700 }}>
                                        작업 범위
                                        <textarea
                                            className="form-input"
                                            rows={4}
                                            value={proposalDraft.scope}
                                            onChange={(event) => handleProposalChange('scope', event.target.value)}
                                        />
                                    </label>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                        <label style={{ display: 'grid', gap: '0.5rem', fontWeight: 700 }}>
                                            제안 금액
                                            <input
                                                className="form-input"
                                                type="number"
                                                min="0"
                                                value={proposalDraft.totalPrice}
                                                onChange={(event) => handleProposalChange('totalPrice', event.target.value)}
                                            />
                                        </label>
                                        <label style={{ display: 'grid', gap: '0.5rem', fontWeight: 700 }}>
                                            작업 기간
                                            <input
                                                className="form-input"
                                                type="number"
                                                min="1"
                                                value={proposalDraft.deliveryDays}
                                                onChange={(event) => handleProposalChange('deliveryDays', event.target.value)}
                                            />
                                        </label>
                                    </div>
                                    {proposalMessage && <p style={{ margin: 0, color: 'var(--primary-color)', fontWeight: 700 }}>{proposalMessage}</p>}
                                </div>
                                <button
                                    className="btn-primary"
                                    style={{ width: '100%', padding: '1rem', fontSize: '1.1rem', borderRadius: 'var(--radius-lg)' }}
                                    onClick={handleSubmitProposal}
                                >
                                    제안서 보내기
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </>
    );
}
