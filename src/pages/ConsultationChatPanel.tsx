import { useState, type KeyboardEvent } from 'react';
import { Link } from 'react-router-dom';
import type { Consultation, ConsultationMessage, ExpertProduct } from '../types';

type ConsultationDisplayState = 'active' | 'ended';

type ConsultationChatPanelProps = {
    readonly consultations: readonly Consultation[];
    readonly products: readonly ExpertProduct[];
    readonly selectedConsultation: Consultation | null;
    readonly selectedProduct: ExpertProduct | null;
    readonly messages: readonly ConsultationMessage[];
    readonly currentUserId: string;
    readonly messageBody: string;
    readonly messageError: string;
    readonly actionMessage: string;
    readonly actionError: string;
    readonly messageSubmitting: boolean;
    readonly proposalSubmitting: boolean;
    readonly transactionUrl?: string;
    readonly onSelectConsultation: (consultationId: string) => void;
    readonly onMessageBodyChange: (body: string) => void;
    readonly onSendMessage: () => void;
    readonly onCreateProposal: () => void;
    readonly onEndConsultation: () => void;
    readonly onReportConsultation: () => void;
};

const timeFormatter = new Intl.DateTimeFormat('ko-KR', {
    hour: 'numeric',
    minute: '2-digit',
});

export function ConsultationChatPanel({
    consultations,
    products,
    selectedConsultation,
    selectedProduct,
    messages,
    currentUserId,
    messageBody,
    messageError,
    actionMessage,
    actionError,
    messageSubmitting,
    proposalSubmitting,
    transactionUrl,
    onSelectConsultation,
    onMessageBodyChange,
    onSendMessage,
    onCreateProposal,
    onEndConsultation,
    onReportConsultation,
}: ConsultationChatPanelProps) {
    const [actionMenuOpen, setActionMenuOpen] = useState(false);
    const selectedState = selectedConsultation ? getConsultationDisplayState(selectedConsultation) : 'ended';
    const selectedEnded = selectedState === 'ended';
    const sendDisabled = selectedEnded || messageSubmitting || !messageBody.trim();
    const canCreateProposal = Boolean(selectedConsultation && selectedConsultation.expertId === currentUserId && !selectedEnded);
    const selectedPeerId = selectedConsultation
        ? selectedConsultation.clientId === currentUserId
            ? selectedConsultation.expertId
            : selectedConsultation.clientId
        : '';

    const handleMessageKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
        if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing || sendDisabled) return;
        event.preventDefault();
        onSendMessage();
    };

    return (
        <section className="consultation-chat-panel">
            <header className="consultation-chat-page-header">
                <h2>상담 채팅</h2>
            </header>

            {consultations.length > 0 ? (
                <div aria-label="상담 채팅 레이아웃" className="consultation-chat-layout">
                    <aside aria-label="상담 채팅 목록" className="consultation-chat-list">
                        {consultations.map((consultation) => {
                            const product = products.find((item) => item.id === consultation.productId) || null;
                            const selected = selectedConsultation?.id === consultation.id;
                            const state = getConsultationDisplayState(consultation);
                            const peerId = consultation.clientId === currentUserId ? consultation.expertId : consultation.clientId;

                            return (
                                <button
                                    key={consultation.id}
                                    type="button"
                                    aria-pressed={selected}
                                    className={`consultation-list-card ${selected ? 'is-selected' : ''}`}
                                    onClick={() => onSelectConsultation(consultation.id)}
                                >
                                    <span className="consultation-list-icon" aria-hidden="true">
                                        <ChatBubbleIcon />
                                    </span>
                                    <span className="consultation-list-copy">
                                        <strong>{product?.title || consultation.title}</strong>
                                        <span className="consultation-peer-id">{'\uC0C1\uB300\uBC29 ID'}: {peerId}</span>
                                        <ConsultationStatus state={state} />
                                    </span>
                                </button>
                            );
                        })}
                    </aside>

                    <article className="consultation-chat-detail">
                        {selectedConsultation ? (
                            <>
                                <header className="consultation-chat-detail-header">
                                    <div className="consultation-chat-detail-heading">
                                        <h3 className="consultation-detail-product-title">{selectedProduct?.title || selectedConsultation.title}</h3>
                                        {selectedPeerId && <p className="consultation-peer-id">{'\uC0C1\uB300\uBC29 ID'}: {selectedPeerId}</p>}
                                    </div>
                                    <div className="consultation-chat-detail-tools">
                                        {transactionUrl && (
                                            <Link to={transactionUrl} className="consultation-transaction-link">
                                                거래정보 보기
                                            </Link>
                                        )}
                                        <ConsultationStatus state={selectedState} />
                                        <div className="consultation-more-menu">
                                            <button
                                                type="button"
                                                className="consultation-more-button"
                                                aria-label="상담 옵션 열기"
                                                aria-expanded={actionMenuOpen}
                                                onClick={() => setActionMenuOpen((open) => !open)}
                                            >
                                                <MoreIcon />
                                            </button>
                                            {actionMenuOpen && (
                                                <div className="consultation-action-menu" role="menu">
                                                    <button
                                                        type="button"
                                                        role="menuitem"
                                                        disabled={selectedEnded}
                                                        onClick={() => {
                                                            setActionMenuOpen(false);
                                                            onEndConsultation();
                                                        }}
                                                    >
                                                        상담 종료
                                                    </button>
                                                    <button
                                                        type="button"
                                                        role="menuitem"
                                                        onClick={() => {
                                                            setActionMenuOpen(false);
                                                            onReportConsultation();
                                                        }}
                                                    >
                                                        신고하기
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </header>
                                {(actionMessage || actionError) && (
                                    <p className={`consultation-action-feedback ${actionError ? 'is-error' : 'is-success'}`}>
                                        {actionError || actionMessage}
                                    </p>
                                )}

                                <div className="consultation-message-list">
                                    {messages.length > 0 ? messages.map((message) => {
                                        const mine = message.senderId === currentUserId;

                                        return (
                                            <div key={message.id} className={`consultation-message-row ${mine ? 'is-mine' : 'is-theirs'}`}>
                                                <div className="consultation-message-bubble">
                                                    <p>{message.body}</p>
                                                    {message.attachmentUrls.map((url) => (
                                                        <Link key={url} to={url} className="consultation-message-link">
                                                            {url.startsWith('/proposal/') ? '제안서 보기' : '첨부 보기'}
                                                        </Link>
                                                    ))}
                                                    <time dateTime={message.createdAt}>{formatMessageTime(message.createdAt)}</time>
                                                </div>
                                            </div>
                                        );
                                    }) : (
                                        <p className="consultation-empty-message">아직 상담 메시지가 없습니다.</p>
                                    )}
                                </div>

                                <form className="consultation-message-form" onSubmit={(event) => {
                                    event.preventDefault();
                                    onSendMessage();
                                }}>
                                    {selectedEnded && (
                                        <p className="consultation-closed-notice">이 상담은 종료되었습니다. 더 이상 메시지를 보낼 수 없습니다.</p>
                                    )}
                                    <label htmlFor="consultation-message-input">메시지</label>
                                    <div className="consultation-textarea-wrap">
                                        <textarea
                                            id="consultation-message-input"
                                            aria-label="상담 메시지 입력"
                                            value={messageBody}
                                            onChange={(event) => onMessageBodyChange(event.target.value)}
                                            onKeyDown={handleMessageKeyDown}
                                            rows={4}
                                            placeholder="상담 메시지를 입력하세요."
                                            disabled={selectedEnded}
                                        />
                                        <button
                                            type="submit"
                                            className="consultation-send-button"
                                            aria-label="메시지 보내기"
                                            title={messageSubmitting ? '전송 중' : '메시지 보내기'}
                                            disabled={sendDisabled}
                                        >
                                            <SendIcon />
                                        </button>
                                    </div>
                                    {messageError && <p role="alert" className="consultation-message-error">{messageError}</p>}
                                    {canCreateProposal && (
                                        <div className="consultation-action-row">
                                            <button
                                                type="button"
                                                className="consultation-proposal-button"
                                                disabled={proposalSubmitting}
                                                onClick={onCreateProposal}
                                            >
                                                {proposalSubmitting ? '제안서 작성 중' : '제안서 작성'}
                                            </button>
                                        </div>
                                    )}
                                </form>
                            </>
                        ) : (
                            <p className="consultation-empty-message">상담을 선택해주세요.</p>
                        )}
                    </article>
                </div>
            ) : (
                <p className="consultation-empty-message">아직 상담 채팅이 없습니다.</p>
            )}
        </section>
    );
}

function ConsultationStatus({ state }: { readonly state: ConsultationDisplayState }) {
    return (
        <span className={`consultation-status is-${state}`}>
            <span aria-hidden="true" />
            {getConsultationStateLabel(state)}
        </span>
    );
}

function getConsultationDisplayState(consultation: Consultation): ConsultationDisplayState {
    switch (consultation.status) {
        case 'open':
        case 'proposal_sent':
            return 'active';
        case 'closed':
            return 'ended';
    }
}

function getConsultationStateLabel(state: ConsultationDisplayState): '상담 중' | '종료됨' {
    return state === 'active' ? '상담 중' : '종료됨';
}

function formatMessageTime(createdAt: string): string {
    const parsed = new Date(createdAt);
    if (Number.isNaN(parsed.getTime())) return '';
    return timeFormatter.format(parsed);
}

function ChatBubbleIcon() {
    return (
        <svg focusable="false" viewBox="0 0 24 24">
            <path d="M5 7.5A3.5 3.5 0 0 1 8.5 4h7A3.5 3.5 0 0 1 19 7.5v4.2a3.5 3.5 0 0 1-3.5 3.5h-4.3L7 18.5v-3.3A3.5 3.5 0 0 1 5 12V7.5Z" />
            <path d="M9 9.5h.01M12 9.5h.01M15 9.5h.01" />
        </svg>
    );
}

function SendIcon() {
    return (
        <svg focusable="false" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M5 12 19 5l-4 14-3-6-7-1Z" />
            <path d="m12 13 7-8" />
        </svg>
    );
}

function MoreIcon() {
    return (
        <svg focusable="false" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 6.8h.01M12 12h.01M12 17.2h.01" />
        </svg>
    );
}
