import { Link } from 'react-router-dom';
import { hasExternalContact } from '../constants/policies';
import type { AdminAction, AdminActionType, AdminActionTargetType, AdminSnapshot } from '../lib/adminStorage';
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

interface AdminButtonAction {
    readonly label: string;
    readonly className?: string;
    readonly disabled?: boolean;
    readonly title?: string;
    readonly onClick: () => void;
}

export default function AdminDataPanels({ activeTab, snapshot, onAction }: AdminDataPanelsProps) {
    if (activeTab === 'members') return <MembersPanel snapshot={snapshot} onAction={onAction} />;
    if (activeTab === 'products') return <ProductsPanel snapshot={snapshot} onAction={onAction} />;
    if (activeTab === 'trades') return <TradesPanel snapshot={snapshot} onAction={onAction} />;
    if (activeTab === 'consultations') return <ConsultationsPanel snapshot={snapshot} onAction={onAction} />;
    if (activeTab === 'workrooms') return <WorkroomsPanel snapshot={snapshot} onAction={onAction} />;
    if (activeTab === 'reviews') return <ReviewsPanel snapshot={snapshot} onAction={onAction} />;
    if (activeTab === 'reports') return <ReportsPanel snapshot={snapshot} onAction={onAction} />;
    if (activeTab === 'actions') return <ActionsPanel actions={snapshot.adminActions} />;
    return null;
}

function MembersPanel({ snapshot, onAction }: { readonly snapshot: AdminSnapshot; readonly onAction: (input: AdminActionRequest) => void }) {
    return (
        <AdminTablePanel title="회원 관리" copy="가입자와 전문가 여부를 확인하고 경고, 활동 제한, 제한 해제 조치를 처리합니다.">
            {snapshot.profiles.length === 0 ? <EmptyState label="표시할 회원이 없습니다." /> : (
                <table className="admin-table">
                    <thead><tr><th>이름</th><th>이메일</th><th>유형</th><th>계정 상태</th><th>조치</th></tr></thead>
                    <tbody>{snapshot.profiles.map((profile) => (
                        <tr key={profile.id}>
                            <td>{profile.name}</td>
                            <td>{profile.email || <span className="admin-muted">이메일 없음</span>}</td>
                            <td><AdminStatus value={profile.isExpert ? 'published' : 'pending'} /></td>
                            <td><AdminStatus value={profile.moderationStatus || 'active'} /></td>
                            <td className="admin-action-row">
                                <button className="admin-action-button" type="button" onClick={() => onAction({
                                    targetType: 'user',
                                    targetId: profile.id,
                                    actionType: 'warn',
                                    reason: '관리자가 회원 경고를 기록했습니다.',
                                })}>경고 기록</button>
                                {profile.moderationStatus === 'restricted' ? (
                                    <button className="admin-action-button" type="button" onClick={() => onAction({
                                        targetType: 'user',
                                        targetId: profile.id,
                                        actionType: 'release_restriction',
                                        reason: '관리자가 회원 활동 제한을 해제했습니다.',
                                    })}>제한 해제</button>
                                ) : (
                                    <button className="admin-danger-action" type="button" onClick={() => onAction({
                                        targetType: 'user',
                                        targetId: profile.id,
                                        actionType: 'restrict',
                                        reason: '관리자가 회원 활동을 제한했습니다.',
                                    })}>활동 제한</button>
                                )}
                            </td>
                        </tr>
                    ))}</tbody>
                </table>
            )}
        </AdminTablePanel>
    );
}

function ProductsPanel({ snapshot, onAction }: { readonly snapshot: AdminSnapshot; readonly onAction: (input: AdminActionRequest) => void }) {
    const products = [...snapshot.products].sort((first, second) => {
        if (Boolean(first.isFeatured) !== Boolean(second.isFeatured)) return first.isFeatured ? -1 : 1;
        return (first.displayOrder ?? Number.MAX_SAFE_INTEGER) - (second.displayOrder ?? Number.MAX_SAFE_INTEGER);
    });

    return (
        <AdminTablePanel title="상품 관리" copy="등록 상품의 공개 상태, 추천 여부, 배치 순서를 관리합니다.">
            {products.length === 0 ? <EmptyState label="등록된 상품이 없습니다." /> : (
                <table className="admin-table">
                    <thead><tr><th>상품</th><th>전문가</th><th>가격</th><th>상태</th><th>추천/순서</th><th>조치</th></tr></thead>
                    <tbody>{products.map((product) => (
                        <tr key={product.id}>
                            <td>{product.title}<div className="admin-muted">{product.category}</div></td>
                            <td>{product.expertName}</td>
                            <td>{formatCurrency(product.startingPrice)}</td>
                            <td><AdminStatus value={product.status || 'published'} /></td>
                            <td>{product.isFeatured ? '추천됨' : '일반'} · {product.displayOrder ?? '-'}</td>
                            <td className="admin-action-row">
                                {(product.status || 'published') === 'hidden' ? (
                                    <button className="admin-action-button" type="button" onClick={() => onAction({
                                        targetType: 'product',
                                        targetId: product.id,
                                        actionType: 'restore_product',
                                        reason: '관리자가 숨김 상품을 다시 공개했습니다.',
                                    })}>상품 공개 복구</button>
                                ) : (
                                    <button className="admin-danger-action" type="button" onClick={() => onAction({
                                        targetType: 'product',
                                        targetId: product.id,
                                        actionType: 'hide_product',
                                        reason: '관리자가 상품 숨김 처리를 실행했습니다.',
                                    })}>상품 숨김 처리</button>
                                )}
                                <button className="admin-action-button" type="button" onClick={() => onAction({
                                    targetType: 'product',
                                    targetId: product.id,
                                    actionType: product.isFeatured ? 'unfeature_product' : 'feature_product',
                                    reason: product.isFeatured
                                        ? '관리자가 상품 상단 추천을 해제했습니다.'
                                        : '관리자가 상품을 상단 추천으로 지정했습니다.',
                                })}>{product.isFeatured ? '추천 해제' : '상단 추천 지정'}</button>
                                <button className="admin-action-button" type="button" onClick={() => onAction({
                                    targetType: 'product',
                                    targetId: product.id,
                                    actionType: 'move_product_up',
                                    reason: '관리자가 상품 배치를 올렸습니다.',
                                })}>배치 올리기</button>
                                <button className="admin-action-button" type="button" onClick={() => onAction({
                                    targetType: 'product',
                                    targetId: product.id,
                                    actionType: 'move_product_down',
                                    reason: '관리자가 상품 배치를 내렸습니다.',
                                })}>배치 내리기</button>
                            </td>
                        </tr>
                    ))}</tbody>
                </table>
            )}
        </AdminTablePanel>
    );
}

function TradesPanel({ snapshot, onAction }: { readonly snapshot: AdminSnapshot; readonly onAction: (input: AdminActionRequest) => void }) {
    return (
        <AdminTablePanel title="거래 관리" copy="의뢰서와 제안서 상태를 함께 확인합니다.">
            {snapshot.serviceRequests.length === 0 && snapshot.proposals.length === 0 ? <EmptyState label="거래 데이터가 없습니다." /> : (
                <table className="admin-table">
                    <thead><tr><th>유형</th><th>제목</th><th>참여자</th><th>상태</th><th>조치</th></tr></thead>
                    <tbody>
                        {snapshot.serviceRequests.map((request) => (
                            <tr key={`request-${request.id}`}>
                                <td>의뢰서</td>
                                <td>{request.title || request.desiredResult || request.description}</td>
                                <td className="admin-muted">{request.clientId} / {request.expertId || '전문가 미지정'}</td>
                                <td><AdminStatus value={request.status} /></td>
                                <td><button className="admin-action-button" type="button" onClick={() => onAction({
                                    targetType: 'trade',
                                    targetId: String(request.id),
                                    actionType: 'note',
                                    reason: '관리자가 의뢰 거래 메모를 기록했습니다.',
                                })}>거래 메모</button></td>
                            </tr>
                        ))}
                        {snapshot.proposals.map((proposal) => (
                            <tr key={`proposal-${proposal.id}`}>
                                <td>제안서</td>
                                <td>{proposal.title}</td>
                                <td className="admin-muted">{proposal.clientId} / {proposal.expertId}</td>
                                <td><AdminStatus value={proposal.paymentStatus || proposal.status} /></td>
                                <td><button className="admin-action-button" type="button" onClick={() => onAction({
                                    targetType: 'trade',
                                    targetId: proposal.id,
                                    actionType: 'note',
                                    reason: '관리자가 제안 거래 메모를 기록했습니다.',
                                })}>거래 메모</button></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </AdminTablePanel>
    );
}

function ConsultationsPanel({ snapshot, onAction }: { readonly snapshot: AdminSnapshot; readonly onAction: (input: AdminActionRequest) => void }) {
    return (
        <AdminTablePanel title="상담채팅 관리" copy="결제 전 협의 중인 상담방과 메시지 전문을 확인합니다.">
            {snapshot.consultations.length === 0 ? <EmptyState label="상담채팅이 없습니다." /> : snapshot.consultations.map((consultation) => (
                <MessageCard
                    key={consultation.id}
                    title={consultation.title}
                    meta={`의뢰자 ${consultation.clientId} / 전문가 ${consultation.expertId} / 상품 ${consultation.productId}`}
                    status={consultation.status}
                    messages={snapshot.consultationMessages.filter((message) => message.consultationId === consultation.id)}
                    actions={[{
                        label: '상담 종료 처리',
                        onClick: () => onAction({
                            targetType: 'consultation',
                            targetId: consultation.id,
                            actionType: 'close_consultation',
                            reason: '관리자가 상담 종료 처리를 실행했습니다.',
                        }),
                    }]}
                />
            ))}
        </AdminTablePanel>
    );
}

const buildWorkroomMeta = (work: AdminSnapshot['works'][number]) => {
    const details = [
        `의뢰자 ${work.clientId}`,
        `전문가 ${work.expertId}`,
        formatCurrency(work.totalPrice),
        `정산 ${work.settlementStatus || 'held'}`,
    ];

    if (work.settlementRequestedAt) details.push('출금 신청됨');
    if (work.settlementHoldReason) details.push(`정산 보류: ${work.settlementHoldReason}`);
    if (work.refundStatus) details.push(`환불 ${work.refundStatus}`);
    if (work.disputeStatus) details.push(`분쟁 ${work.disputeStatus}`);
    if (work.cancellationReason) details.push(`취소 사유 ${work.cancellationReason}`);
    if (work.cancelledAt) details.push(`취소일 ${work.cancelledAt}`);

    return details.join(' / ');
};

function WorkroomsPanel({ snapshot, onAction }: { readonly snapshot: AdminSnapshot; readonly onAction: (input: AdminActionRequest) => void }) {
    return (
        <AdminTablePanel title="작업방 관리" copy="결제 이후 생성된 작업방, 정산 상태, 환불/분쟁 상태, 작업방 메시지를 확인합니다.">
            {snapshot.works.length === 0 ? <EmptyState label="작업방이 없습니다." /> : snapshot.works.map((work) => {
                const canExecuteTossRefund = work.refundStatus === 'fee_excluded_refund_pending' && work.settlementStatus !== 'settled';

                return (
                    <MessageCard
                        key={work.id}
                        title={work.title}
                        meta={buildWorkroomMeta(work)}
                        status={work.status}
                        messages={snapshot.workMessages.filter((message) => message.workId === work.id)}
                        linkTo={`/workroom/${work.id}`}
                        actions={[
                            {
                                label: '정산 대기 처리',
                                onClick: () => onAction({
                                    targetType: 'work',
                                    targetId: work.id,
                                    actionType: 'mark_settlement_pending',
                                    reason: '관리자가 작업방을 정산 대기 상태로 변경했습니다.',
                                }),
                            },
                            {
                                label: '정산 완료 처리',
                                onClick: () => onAction({
                                    targetType: 'work',
                                    targetId: work.id,
                                    actionType: 'mark_settlement_settled',
                                    reason: '관리자가 작업방을 정산 완료 상태로 변경했습니다.',
                                }),
                            },
                            {
                                label: '정산 보류',
                                onClick: () => onAction({
                                    targetType: 'work',
                                    targetId: work.id,
                                    actionType: 'hold_settlement',
                                    reason: '관리자가 이상 거래 확인을 위해 정산을 보류했습니다.',
                                }),
                            },
                            {
                                label: '환불 대기 처리',
                                onClick: () => onAction({
                                    targetType: 'work',
                                    targetId: work.id,
                                    actionType: 'mark_refund_pending',
                                    reason: '관리자가 수수료 제외 환불 대기 상태로 변경했습니다.',
                                }),
                            },
                            {
                                label: '토스 환불 실행',
                                className: 'admin-danger-action',
                                disabled: !canExecuteTossRefund,
                                title: canExecuteTossRefund ? undefined : '환불 대기 처리된 작업만 토스 환불을 실행할 수 있습니다.',
                                onClick: () => {
                                    const confirmed = window.confirm('실제 토스 결제 취소를 실행합니다. 테스트 결제 건인지 확인했나요?');
                                    if (!confirmed) return;
                                    onAction({
                                        targetType: 'work',
                                        targetId: work.id,
                                        actionType: 'execute_toss_refund',
                                        reason: '관리자가 토스페이먼츠 결제 취소를 실행했습니다.',
                                    });
                                },
                            },
                            {
                                label: work.disputeStatus === 'open' ? '분쟁 해결' : '분쟁 열기',
                                onClick: () => onAction({
                                    targetType: 'work',
                                    targetId: work.id,
                                    actionType: work.disputeStatus === 'open' ? 'resolve_dispute' : 'open_dispute',
                                    reason: work.disputeStatus === 'open'
                                        ? '관리자가 작업방 분쟁을 해결 처리했습니다.'
                                        : '관리자가 작업방 분쟁 관리를 시작했습니다.',
                                }),
                            },
                            {
                                label: '거래 중단 처리',
                                className: 'admin-danger-action',
                                onClick: () => onAction({
                                    targetType: 'work',
                                    targetId: work.id,
                                    actionType: 'cancel_trade',
                                    reason: '관리자가 작업방 거래 중단 처리를 실행했습니다.',
                                }),
                            },
                        ]}
                    />
                );
            })}
        </AdminTablePanel>
    );
}

function MessageCard(props: {
    readonly title: string;
    readonly meta: string;
    readonly status: string;
    readonly messages: readonly { readonly id: string; readonly senderId: string; readonly body: string; readonly createdAt: string }[];
    readonly linkTo?: string;
    readonly actions: readonly AdminButtonAction[];
}) {
    return (
        <article className="admin-message-card">
            <div className="admin-message-heading">
                <div>
                    <h3>{props.linkTo ? <Link to={props.linkTo}>{props.title}</Link> : props.title}</h3>
                    <p>{props.meta}</p>
                </div>
                <AdminStatus value={props.status} />
            </div>
            <div className="admin-message-list">
                {props.messages.length === 0 ? <EmptyState label="표시할 메시지가 없습니다." /> : props.messages.map((message) => (
                    <div className="admin-message-item" key={message.id}>
                        <div className="admin-message-meta">{message.senderId} · {message.createdAt}</div>
                        <p>{message.body}</p>
                    </div>
                ))}
            </div>
            <div className="admin-action-row">
                {props.actions.map((action) => (
                    <button
                        className={action.className || 'admin-action-button'}
                        disabled={action.disabled}
                        title={action.title}
                        type="button"
                        key={action.label}
                        onClick={action.onClick}
                    >
                        {action.label}
                    </button>
                ))}
            </div>
        </article>
    );
}

function ReviewsPanel({ snapshot, onAction }: { readonly snapshot: AdminSnapshot; readonly onAction: (input: AdminActionRequest) => void }) {
    return (
        <AdminTablePanel title="리뷰 관리" copy="완료 거래 후 작성된 리뷰와 작성자를 확인합니다.">
            {snapshot.reviews.length === 0 ? <EmptyState label="리뷰가 없습니다." /> : (
                <table className="admin-table">
                    <thead><tr><th>별점</th><th>내용</th><th>작성자</th><th>전문가</th><th>상태</th><th>조치</th></tr></thead>
                    <tbody>{snapshot.reviews.map((review) => (
                        <tr key={review.id}>
                            <td>{review.rating}.0</td>
                            <td>{review.content}</td>
                            <td className="admin-muted">{review.clientId}</td>
                            <td className="admin-muted">{review.expertId}</td>
                            <td><AdminStatus value={review.status || 'published'} /></td>
                            <td className="admin-action-row">
                                {(review.status || 'published') === 'hidden' ? (
                                    <button className="admin-action-button" type="button" onClick={() => onAction({
                                        targetType: 'review',
                                        targetId: review.id,
                                        actionType: 'restore_review',
                                        reason: '관리자가 숨김 리뷰를 공개 복구했습니다.',
                                    })}>리뷰 공개 복구</button>
                                ) : (
                                    <button className="admin-action-button" type="button" onClick={() => onAction({
                                        targetType: 'review',
                                        targetId: review.id,
                                        actionType: 'hide_review',
                                        reason: '관리자가 리뷰를 숨김 처리했습니다.',
                                    })}>리뷰 숨김 처리</button>
                                )}
                            </td>
                        </tr>
                    ))}</tbody>
                </table>
            )}
        </AdminTablePanel>
    );
}

const reportSeverityLabel = (severity: string): string => {
    if (severity === 'high') return '높음';
    if (severity === 'low') return '낮음';
    return '보통';
};

function ReportsPanel({ snapshot, onAction }: { readonly snapshot: AdminSnapshot; readonly onAction: (input: AdminActionRequest) => void }) {
    const policyViolations = getPolicyViolations(snapshot);

    return (
        <AdminTablePanel title="신고/검수 큐" copy="사용자 신고와 운영 검수 항목을 확인하고 처리 완료 또는 기각으로 정리합니다.">
            {snapshot.reports.length === 0 && policyViolations.length === 0 ? <EmptyState label="검토할 항목이 없습니다." /> : (
                <>
                    {snapshot.reports.length > 0 && (
                        <table className="admin-table">
                            <thead><tr><th>신고 사유</th><th>대상</th><th>신고자</th><th>위험도</th><th>상태</th><th>조치</th></tr></thead>
                            <tbody>{snapshot.reports.map((report) => (
                                <tr key={report.id}>
                                    <td>{report.reason}<div className="admin-muted">{report.createdAt}</div></td>
                                    <td>{report.targetType} · <span className="admin-muted">{report.targetId}</span></td>
                                    <td className="admin-muted">{report.reporterId}</td>
                                    <td>{reportSeverityLabel(report.severity)}</td>
                                    <td><AdminStatus value={report.status} /></td>
                                    <td className="admin-action-row">
                                        {report.status === 'pending' ? (
                                            <>
                                                <button className="admin-action-button" type="button" onClick={() => onAction({
                                                    targetType: 'report',
                                                    targetId: report.id,
                                                    actionType: 'resolve_report',
                                                    reason: '관리자가 신고 항목을 검토 완료 처리했습니다.',
                                                })}>검토 완료</button>
                                                <button className="admin-action-button" type="button" onClick={() => onAction({
                                                    targetType: 'report',
                                                    targetId: report.id,
                                                    actionType: 'dismiss_report',
                                                    reason: '관리자가 신고 항목을 기각 처리했습니다.',
                                                })}>기각</button>
                                            </>
                                        ) : (
                                            <span className="admin-muted">처리된 신고</span>
                                        )}
                                    </td>
                                </tr>
                            ))}</tbody>
                        </table>
                    )}
                    {policyViolations.length > 0 && (
                        <div className="admin-subsection">
                            <h3>정책 위반 메시지 모니터링</h3>
                            <table className="admin-table">
                                <thead><tr><th>메시지</th><th>위치</th><th>작성자</th><th>조치</th></tr></thead>
                                <tbody>{policyViolations.map((violation) => (
                                    <tr key={violation.id}>
                                        <td>{violation.body}</td>
                                        <td>{violation.locationLabel} · <span className="admin-muted">{violation.roomId}</span></td>
                                        <td className="admin-muted">{violation.senderId}</td>
                                        <td className="admin-action-row">
                                            <button className="admin-action-button" type="button" onClick={() => onAction({
                                                targetType: 'user',
                                                targetId: violation.senderId,
                                                actionType: 'warn',
                                                reason: '관리자가 외부 연락처 공유 의심 메시지에 대해 작성자 경고를 기록했습니다.',
                                            })}>작성자 경고</button>
                                            {violation.targetType === 'consultation' ? (
                                                <button className="admin-action-button" type="button" onClick={() => onAction({
                                                    targetType: 'consultation',
                                                    targetId: violation.roomId,
                                                    actionType: 'close_consultation',
                                                    reason: '관리자가 정책 위반 의심 상담을 종료 처리했습니다.',
                                                })}>상담 종료 처리</button>
                                            ) : (
                                                <button className="admin-danger-action" type="button" onClick={() => onAction({
                                                    targetType: 'work',
                                                    targetId: violation.roomId,
                                                    actionType: 'cancel_trade',
                                                    reason: '관리자가 정책 위반 의심 작업방 거래를 중단 처리했습니다.',
                                                })}>거래 중단 처리</button>
                                            )}
                                        </td>
                                    </tr>
                                ))}</tbody>
                            </table>
                        </div>
                    )}
                </>
            )}
        </AdminTablePanel>
    );
}

function getPolicyViolations(snapshot: AdminSnapshot) {
    const consultationViolations = snapshot.consultationMessages
        .filter((message) => hasExternalContact(message.body))
        .map((message) => ({
            id: `consultation-${message.id}`,
            targetType: 'consultation' as const,
            roomId: message.consultationId,
            senderId: message.senderId,
            body: message.body,
            locationLabel: '상담채팅',
        }));
    const workViolations = snapshot.workMessages
        .filter((message) => hasExternalContact(message.body))
        .map((message) => ({
            id: `work-${message.id}`,
            targetType: 'work' as const,
            roomId: message.workId,
            senderId: message.senderId,
            body: message.body,
            locationLabel: '작업방',
        }));

    return [...consultationViolations, ...workViolations];
}

function ActionsPanel({ actions }: { readonly actions: readonly AdminAction[] }) {
    return (
        <AdminTablePanel title="최근 운영 조치" copy="관리자가 남긴 경고, 제한, 숨김, 거래 검수 기록을 시간순으로 확인합니다.">
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
