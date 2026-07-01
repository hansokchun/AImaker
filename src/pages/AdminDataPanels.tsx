import { Link } from 'react-router-dom';
import type { AdminAction, AdminActionType, AdminSnapshot, AdminActionTargetType } from '../lib/adminStorage';
import { AdminStatus, AdminTablePanel, EmptyState, formatCurrency } from './AdminShared';

interface AdminDataPanelsProps {
    readonly activeTab: string;
    readonly snapshot: AdminSnapshot;
    readonly onAction: (input: AdminActionRequest) => void;
}

export interface AdminActionRequest {
    readonly targetType: AdminActionTargetType;
    readonly targetId: string;
    readonly actionType: AdminActionType;
    readonly reason: string;
}

export default function AdminDataPanels({ activeTab, snapshot, onAction }: AdminDataPanelsProps) {
    if (activeTab === 'members') return <MembersPanel snapshot={snapshot} onAction={onAction} />;
    if (activeTab === 'products') return <ProductsPanel snapshot={snapshot} onAction={onAction} />;
    if (activeTab === 'trades') return <TradesPanel snapshot={snapshot} onAction={onAction} />;
    if (activeTab === 'consultations') return <ConsultationsPanel snapshot={snapshot} onAction={onAction} />;
    if (activeTab === 'workrooms') return <WorkroomsPanel snapshot={snapshot} onAction={onAction} />;
    if (activeTab === 'reviews') return <ReviewsPanel snapshot={snapshot} />;
    if (activeTab === 'actions') return <ActionsPanel actions={snapshot.adminActions} />;
    return null;
}

function MembersPanel({ snapshot, onAction }: { readonly snapshot: AdminSnapshot; readonly onAction: (input: AdminActionRequest) => void }) {
    return (
        <AdminTablePanel title="회원 관리" copy="가입자와 전문가 여부를 확인하고 경고 또는 활동 제한 조치를 기록합니다.">
            {snapshot.profiles.length === 0 ? <EmptyState label="표시할 회원이 없습니다." /> : (
                <table className="admin-table">
                    <thead><tr><th>이름</th><th>이메일</th><th>유형</th><th>조치</th></tr></thead>
                    <tbody>{snapshot.profiles.map((profile) => (
                        <tr key={profile.id}>
                            <td>{profile.name}</td>
                            <td>{profile.email || <span className="admin-muted">이메일 없음</span>}</td>
                            <td><AdminStatus value={profile.isExpert ? 'published' : 'pending'} /></td>
                            <td className="admin-action-row">
                                <button className="admin-action-button" type="button" onClick={() => onAction({
                                    targetType: 'user',
                                    targetId: profile.id,
                                    actionType: 'warn',
                                    reason: '관리자가 회원 경고를 기록했습니다.',
                                })}>경고 기록</button>
                                <button className="admin-danger-action" type="button" onClick={() => onAction({
                                    targetType: 'user',
                                    targetId: profile.id,
                                    actionType: 'restrict',
                                    reason: '관리자가 회원 활동 제한 검토를 기록했습니다.',
                                })}>활동 제한 기록</button>
                            </td>
                        </tr>
                    ))}</tbody>
                </table>
            )}
        </AdminTablePanel>
    );
}

function ProductsPanel({ snapshot, onAction }: { readonly snapshot: AdminSnapshot; readonly onAction: (input: AdminActionRequest) => void }) {
    return (
        <AdminTablePanel title="상품 관리" copy="등록된 상품의 공개 상태와 상품 품질 검토 조치를 확인합니다.">
            <table className="admin-table">
                <thead><tr><th>상품</th><th>전문가</th><th>가격</th><th>상태</th><th>조치</th></tr></thead>
                <tbody>{snapshot.products.map((product) => (
                    <tr key={product.id}>
                        <td><Link to={`/expert/${product.id}`}>{product.title}</Link><div className="admin-muted">{product.category}</div></td>
                        <td>{product.expertName}</td>
                        <td>{formatCurrency(product.startingPrice)}</td>
                        <td><AdminStatus value={product.status} /></td>
                        <td className="admin-action-row">
                            <Link className="admin-disabled-action" to={`/expert/${product.id}`}>상세 보기</Link>
                            <button className="admin-action-button" type="button" onClick={() => onAction({
                                targetType: 'product',
                                targetId: product.id,
                                actionType: 'hide_product',
                                reason: '관리자가 상품 숨김 검토를 기록했습니다.',
                            })}>상품 숨김 기록</button>
                        </td>
                    </tr>
                ))}</tbody>
            </table>
        </AdminTablePanel>
    );
}

function TradesPanel({ snapshot, onAction }: { readonly snapshot: AdminSnapshot; readonly onAction: (input: AdminActionRequest) => void }) {
    return (
        <AdminTablePanel title="거래 관리" copy="의뢰서, 제안서, 결제 상태를 한 표에서 확인하고 거래 조치를 기록합니다.">
            <table className="admin-table">
                <thead><tr><th>거래 항목</th><th>참여자</th><th>금액/패키지</th><th>상태</th><th>조치</th></tr></thead>
                <tbody>
                    {snapshot.serviceRequests.map((request) => (
                        <tr key={`request-${request.id}`}>
                            <td>의뢰서 · {request.title || request.desiredResult}</td>
                            <td className="admin-muted">의뢰자 {request.clientId || '-'} / 전문가 {request.expertId || '-'}</td>
                            <td>{request.selectedPackage || 'standard'}</td>
                            <td><AdminStatus value={request.status} /></td>
                            <td className="admin-muted">제안서 단계에서 조치</td>
                        </tr>
                    ))}
                    {snapshot.proposals.map((proposal) => (
                        <tr key={`proposal-${proposal.id}`}>
                            <td>제안서 · {proposal.title}</td>
                            <td className="admin-muted">의뢰자 {proposal.clientId} / 전문가 {proposal.expertId}</td>
                            <td>{formatCurrency(proposal.totalPrice)}</td>
                            <td><AdminStatus value={proposal.paymentStatus === 'paid' ? 'paid' : proposal.status} /></td>
                            <td><button className="admin-action-button" type="button" onClick={() => onAction({
                                targetType: 'trade',
                                targetId: proposal.id,
                                actionType: 'note',
                                reason: '관리자가 거래 검토 메모를 기록했습니다.',
                            })}>거래 메모</button></td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </AdminTablePanel>
    );
}

function ConsultationsPanel({ snapshot, onAction }: { readonly snapshot: AdminSnapshot; readonly onAction: (input: AdminActionRequest) => void }) {
    return (
        <AdminTablePanel title="상담채팅 관리" copy="결제 전 협의 중인 상담방과 메시지 원문을 확인합니다.">
            {snapshot.consultations.length === 0 ? <EmptyState label="상담채팅이 없습니다." /> : snapshot.consultations.map((consultation) => (
                <MessageCard
                    key={consultation.id}
                    title={consultation.title}
                    meta={`의뢰자 ${consultation.clientId} / 전문가 ${consultation.expertId} / 상품 ${consultation.productId}`}
                    status={consultation.status}
                    messages={snapshot.consultationMessages.filter((message) => message.consultationId === consultation.id)}
                    actionLabel="상담 종료 기록"
                    onAction={() => onAction({
                        targetType: 'consultation',
                        targetId: consultation.id,
                        actionType: 'close_consultation',
                        reason: '관리자가 상담 종료 검토를 기록했습니다.',
                    })}
                />
            ))}
        </AdminTablePanel>
    );
}

function WorkroomsPanel({ snapshot, onAction }: { readonly snapshot: AdminSnapshot; readonly onAction: (input: AdminActionRequest) => void }) {
    return (
        <AdminTablePanel title="작업방 관리" copy="결제 이후 생성된 작업방, 정산 상태, 작업방 메시지를 확인합니다.">
            {snapshot.works.length === 0 ? <EmptyState label="작업방이 없습니다." /> : snapshot.works.map((work) => (
                <MessageCard
                    key={work.id}
                    title={work.title}
                    meta={`의뢰자 ${work.clientId} / 전문가 ${work.expertId} / ${formatCurrency(work.totalPrice)}`}
                    status={work.status}
                    messages={snapshot.workMessages.filter((message) => message.workId === work.id)}
                    actionLabel="거래 중단 기록"
                    linkTo={`/workroom/${work.id}`}
                    onAction={() => onAction({
                        targetType: 'work',
                        targetId: work.id,
                        actionType: 'cancel_trade',
                        reason: '관리자가 작업방 거래 중단 검토를 기록했습니다.',
                    })}
                />
            ))}
        </AdminTablePanel>
    );
}

function MessageCard({
    title,
    meta,
    status,
    messages,
    actionLabel,
    linkTo,
    onAction,
}: {
    readonly title: string;
    readonly meta: string;
    readonly status: string;
    readonly messages: readonly { readonly id: string; readonly senderId: string; readonly body: string; readonly createdAt: string }[];
    readonly actionLabel: string;
    readonly linkTo?: string;
    readonly onAction: () => void;
}) {
    return (
        <article className="admin-message-card">
            <div className="admin-message-heading">
                <div>
                    <h3>{linkTo ? <Link to={linkTo}>{title}</Link> : title}</h3>
                    <p>{meta}</p>
                </div>
                <AdminStatus value={status} />
            </div>
            <div className="admin-message-list">
                {messages.length === 0 ? <EmptyState label="표시할 메시지가 없습니다." /> : messages.map((message) => (
                    <div className="admin-message-item" key={message.id}>
                        <div className="admin-message-meta">{message.senderId} · {message.createdAt}</div>
                        <p>{message.body}</p>
                    </div>
                ))}
            </div>
            <button className="admin-danger-action" type="button" onClick={onAction}>{actionLabel}</button>
        </article>
    );
}

function ReviewsPanel({ snapshot }: { readonly snapshot: AdminSnapshot }) {
    return (
        <AdminTablePanel title="리뷰 관리" copy="완료 거래 후 작성된 리뷰와 작성자를 확인합니다.">
            {snapshot.reviews.length === 0 ? <EmptyState label="리뷰가 없습니다." /> : (
                <table className="admin-table">
                    <thead><tr><th>별점</th><th>내용</th><th>작성자</th><th>전문가</th></tr></thead>
                    <tbody>{snapshot.reviews.map((review) => (
                        <tr key={review.id}>
                            <td>{review.rating}.0</td>
                            <td>{review.content}</td>
                            <td className="admin-muted">{review.clientId}</td>
                            <td className="admin-muted">{review.expertId}</td>
                        </tr>
                    ))}</tbody>
                </table>
            )}
        </AdminTablePanel>
    );
}

function ActionsPanel({ actions }: { readonly actions: readonly AdminAction[] }) {
    return (
        <AdminTablePanel title="최근 운영 조치" copy="관리자가 남긴 경고, 제한, 숨김, 거래 검토 기록을 시간순으로 확인합니다.">
            {actions.length === 0 ? <EmptyState label="기록된 운영 조치가 없습니다." /> : (
                <table className="admin-table">
                    <thead><tr><th>조치</th><th>대상</th><th>사유</th><th>관리자</th><th>시각</th></tr></thead>
                    <tbody>{actions.map((action) => (
                        <tr key={action.id}>
                            <td><AdminStatus value={action.actionType} /></td>
                            <td>{action.targetType} · <span className="admin-muted">{action.targetId}</span></td>
                            <td>{action.reason}</td>
                            <td className="admin-muted">{action.adminId}</td>
                            <td className="admin-muted">{action.createdAt}</td>
                        </tr>
                    ))}</tbody>
                </table>
            )}
        </AdminTablePanel>
    );
}
