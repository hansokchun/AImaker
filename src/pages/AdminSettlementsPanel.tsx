import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { AdminSnapshot } from '../lib/adminStorage';
import { AdminStatus, AdminTablePanel, EmptyState } from './AdminShared';

export default function AdminSettlementsPanel({ snapshot, onCompleteManualSettlement }: {
    readonly snapshot: AdminSnapshot;
    readonly onCompleteManualSettlement: (input: { readonly workId: string; readonly transferReference: string }) => Promise<void>;
}) {
    const [selectedWorkId, setSelectedWorkId] = useState<string | null>(null);
    const [transferReference, setTransferReference] = useState('');
    const [submitError, setSubmitError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const settlementRows = snapshot.works
        .filter((work) => work.settlementStatus === 'pending' || work.settlementStatus === 'settled' || Boolean(work.settlementRequestedAt))
        .sort((first, second) => String(second.settlementRequestedAt || second.settlementSettledAt || '').localeCompare(String(first.settlementRequestedAt || first.settlementSettledAt || '')));

    return (
        <AdminTablePanel title="정산 관리" copy="전문가가 신청한 정산을 계좌, 금액, 거래 상태와 함께 확인하고 수동 계좌이체 후 지급 완료 처리합니다.">
            {settlementRows.length === 0 ? <EmptyState label="정산 대기 거래가 없습니다." /> : (
                <table className="admin-table admin-settlement-table">
                    <thead>
                        <tr>
                            <th>확인 상태</th>
                            <th>거래</th>
                            <th>전문가 계좌</th>
                            <th>이체 금액</th>
                            <th>거래 체크</th>
                            <th>처리</th>
                        </tr>
                    </thead>
                    <tbody>{settlementRows.map((work) => {
                        const payout = snapshot.settlementPayouts.find((item) => item.workId === work.id);
                        const account = payout?.payoutAccountId
                            ? snapshot.payoutAccounts.find((item) => item.id === payout.payoutAccountId)
                            : snapshot.payoutAccounts.find((item) => item.expertId === work.expertId);
                        const settlementCheck = getSettlementCheck(work, payout, account);
                        const clientName = getProfileLabel(snapshot, work.clientId);
                        const expertName = getProfileLabel(snapshot, work.expertId);
                        const amount = payout?.amount || work.expertPayout || 0;
                        const isPaid = work.settlementStatus === 'settled' || payout?.status === 'paid';

                        return (
                            <tr key={work.id}>
                                <td>
                                    <AdminStatus value={isPaid ? 'settled' : settlementCheck.status} />
                                    <div className="admin-muted">{payout?.requestedAt || work.settlementRequestedAt || '신청 시간 없음'}</div>
                                </td>
                                <td>
                                    <Link to={`/workroom/${work.id}`}>{work.title}</Link>
                                    <div className="admin-muted">의뢰자 {clientName}</div>
                                    <div className="admin-muted">전문가 {expertName}</div>
                                </td>
                                <td>
                                    {account ? (
                                        <div className="admin-bank-cell">
                                            <strong>{account.bankName}</strong>
                                            <span>{account.accountNumber}</span>
                                            <span>예금주 {account.accountHolder}</span>
                                            <button type="button" className="admin-copy-button" onClick={() => copySettlementText(account.accountNumber)}>
                                                계좌번호 복사
                                            </button>
                                        </div>
                                    ) : (
                                        <span className="admin-muted">등록 계좌 없음</span>
                                    )}
                                </td>
                                <td>
                                    <strong>{formatSettlementCurrency(amount)}</strong>
                                    <div className="admin-muted">결제액 {formatSettlementCurrency(work.totalPrice)}</div>
                                    <button type="button" className="admin-copy-button" onClick={() => copySettlementText(String(amount))}>
                                        금액 복사
                                    </button>
                                </td>
                                <td>
                                    <ul className="admin-check-list">
                                        {settlementCheck.messages.map((message) => <li key={message}>{message}</li>)}
                                    </ul>
                                </td>
                                <td className="admin-action-row">
                                    {isPaid ? (
                                        <span className="admin-muted">지급 완료됨</span>
                                    ) : (
                                        <button
                                            type="button"
                                            className="admin-action-button"
                                            disabled={!settlementCheck.canPay}
                                            title={settlementCheck.canPay ? undefined : '확인 필요 항목이 남아 있습니다.'}
                                            onClick={() => {
                                                setSelectedWorkId(work.id);
                                                setTransferReference('');
                                                setSubmitError('');
                                            }}
                                        >
                                            지급 완료 처리
                                        </button>
                                    )}
                                </td>
                            </tr>
                        );
                    })}</tbody>
                </table>
            )}
            {selectedWorkId && (
                <section className="admin-manual-settlement-form" aria-label="수동 정산 완료 기록">
                    <h3>수동 정산 완료 기록</h3>
                    <p>은행 송금을 먼저 완료한 뒤 이체 확인번호를 입력하세요.</p>
                    <label htmlFor="manual-settlement-transfer-reference">이체 확인번호</label>
                    <input
                        id="manual-settlement-transfer-reference"
                        value={transferReference}
                        onChange={(event) => setTransferReference(event.target.value)}
                        placeholder="예: bank-transfer-20260717-1"
                    />
                    {submitError && <p className="admin-manual-settlement-error" role="alert">{submitError}</p>}
                    <div className="admin-action-row">
                        <button
                            type="button"
                            className="admin-action-button"
                            disabled={isSubmitting || !transferReference.trim()}
                            onClick={() => {
                                const submit = async () => {
                                    setIsSubmitting(true);
                                    setSubmitError('');
                                    try {
                                        await onCompleteManualSettlement({ workId: selectedWorkId, transferReference: transferReference.trim() });
                                        setSelectedWorkId(null);
                                    } catch (error) {
                                        setSubmitError(error instanceof Error ? error.message : '수동 정산 완료를 기록하지 못했습니다.');
                                    } finally {
                                        setIsSubmitting(false);
                                    }
                                };
                                void submit();
                            }}
                        >
                            {isSubmitting ? '기록 중' : '이체 완료 기록'}
                        </button>
                        <button type="button" className="admin-copy-button" disabled={isSubmitting} onClick={() => setSelectedWorkId(null)}>
                            취소
                        </button>
                    </div>
                </section>
            )}
        </AdminTablePanel>
    );
}

function getProfileLabel(snapshot: AdminSnapshot, userId: string): string {
    const profile = snapshot.profiles.find((item) => item.id === userId);
    return profile?.name || userId;
}

function formatSettlementCurrency(value?: number): string {
    return `${Number(value || 0).toLocaleString('ko-KR')}원`;
}

function copySettlementText(value: string): void {
    void navigator.clipboard?.writeText(value);
}

function getSettlementCheck(
    work: AdminSnapshot['works'][number],
    payout: AdminSnapshot['settlementPayouts'][number] | undefined,
    account: AdminSnapshot['payoutAccounts'][number] | undefined,
) {
    const messages: string[] = [];
    if (work.status === 'completed') messages.push('작업 완료 확인');
    else messages.push(`작업 상태 확인 필요: ${work.status}`);

    if (work.settlementRequestedAt) messages.push('전문가 정산 신청 완료');
    else messages.push('전문가 정산 신청 기록 없음');

    if (account?.verifiedAt) messages.push('정산 계좌 검증 완료');
    else if (account) messages.push('정산 계좌 검증 필요');
    else messages.push('정산 계좌 등록 필요');

    if (payout) messages.push('지급 대기열 생성 완료');
    else messages.push('지급 대기열 없음: 전문가가 정산을 다시 신청해야 함');

    if (work.refundStatus) messages.push(`환불 상태 확인 필요: ${work.refundStatus}`);
    else messages.push('환불 대기 없음');

    if (work.disputeStatus === 'open') messages.push('분쟁 진행 중');
    else messages.push('진행 중 분쟁 없음');

    return {
        status: work.refundStatus || work.disputeStatus === 'open' || !payout || !account?.verifiedAt || work.status !== 'completed' ? 'pending' : 'paid',
        canPay: work.status === 'completed'
            && Boolean(payout)
            && Boolean(account?.verifiedAt)
            && work.refundStatus !== 'fee_excluded_refund_pending'
            && work.refundStatus !== 'refunded'
            && work.disputeStatus !== 'open',
        messages,
    };
}
