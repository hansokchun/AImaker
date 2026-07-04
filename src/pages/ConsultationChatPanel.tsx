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
    readonly messageSubmitting: boolean;
    readonly proposalSubmitting: boolean;
    readonly onSelectConsultation: (consultationId: string) => void;
    readonly onMessageBodyChange: (body: string) => void;
    readonly onSendMessage: () => void;
    readonly onCreateProposal: () => void;
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
    messageSubmitting,
    proposalSubmitting,
    onSelectConsultation,
    onMessageBodyChange,
    onSendMessage,
    onCreateProposal,
}: ConsultationChatPanelProps) {
    const selectedState = selectedConsultation ? getConsultationDisplayState(selectedConsultation) : 'ended';
    const selectedStateLabel = getConsultationStateLabel(selectedState);
    const selectedEnded = selectedState === 'ended';
    const canCreateProposal = Boolean(selectedConsultation && selectedConsultation.expertId === currentUserId && !selectedEnded);

    return (
        <section className="consultation-chat-panel">
            <header className="consultation-chat-page-header">
                <h2>상담 채팅</h2>
                <p>전문가 문의로 시작한 상담을 한 곳에서 확인합니다. 상담 후 제안서를 받아야 결제와 프로젝트 생성으로 이어집니다.</p>
            </header>

            {consultations.length > 0 ? (
                <div aria-label="상담 채팅 레이아웃" className="consultation-chat-layout">
                    <aside aria-label="상담 채팅 목록" className="consultation-chat-list">
                        {consultations.map((consultation) => {
                            const product = products.find((item) => item.id === consultation.productId) || null;
                            const selected = selectedConsultation?.id === consultation.id;
                            const state = getConsultationDisplayState(consultation);

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
                                        <strong>{consultation.title}</strong>
                                        <span>{product?.title || '상품 상담'}</span>
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
                                    <h3>{selectedConsultation.title}</h3>
                                    <p>{selectedProduct?.title || '상품 상담'} · {selectedStateLabel}</p>
                                    <ConsultationStatus state={selectedState} />
                                </header>

                                <div className="consultation-message-list">
                                    {messages.length > 0 ? messages.map((message) => {
                                        const mine = message.senderId === currentUserId;

                                        return (
                                            <div key={message.id} className={`consultation-message-row ${mine ? 'is-mine' : 'is-theirs'}`}>
                                                <div className="consultation-message-bubble">
                                                    <p>{message.body}</p>
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
                                            rows={4}
                                            placeholder="상담 메시지를 입력하세요."
                                            disabled={selectedEnded}
                                        />
                                        <div className="consultation-input-tools" aria-hidden="true">
                                            <AttachmentIcon />
                                            <SmileIcon />
                                        </div>
                                    </div>
                                    {messageError && <p role="alert" className="consultation-message-error">{messageError}</p>}
                                    <div className="consultation-action-row">
                                        <button
                                            type="submit"
                                            className="consultation-send-button"
                                            disabled={selectedEnded || messageSubmitting || !messageBody.trim()}
                                        >
                                            {messageSubmitting ? '전송 중' : '메시지 보내기'}
                                        </button>
                                        {canCreateProposal && (
                                            <button
                                                type="button"
                                                className="consultation-proposal-button"
                                                disabled={proposalSubmitting}
                                                onClick={onCreateProposal}
                                            >
                                                {proposalSubmitting ? '제안서 작성 중' : '제안서 작성'}
                                            </button>
                                        )}
                                    </div>
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

function AttachmentIcon() {
    return (
        <svg focusable="false" viewBox="0 0 24 24">
            <path d="m8.5 12.5 5.8-5.8a3 3 0 0 1 4.2 4.2l-7.2 7.2a4.5 4.5 0 0 1-6.4-6.4l7.1-7.1" />
        </svg>
    );
}

function SmileIcon() {
    return (
        <svg focusable="false" viewBox="0 0 24 24">
            <path d="M12 20a8 8 0 1 0 0-16 8 8 0 0 0 0 16Z" />
            <path d="M9 10h.01M15 10h.01M8.8 14.1c1.8 1.7 4.6 1.7 6.4 0" />
        </svg>
    );
}
