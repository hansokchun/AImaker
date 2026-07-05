import type { ReactNode } from 'react';

export const formatCurrency = (value?: number): string =>
    `${Number(value || 0).toLocaleString('ko-KR')}원`;

const statusClass = (status?: string): string => {
    if (status === 'published' || status === 'paid' || status === 'completed' || status === 'accepted' || status === 'active' || status === 'featured' || status === 'resolved') return 'is-live';
    if (status === 'open' || status === 'submitted' || status === 'sent' || status === 'in_progress') return 'is-open';
    if (status === 'cancelled' || status === 'hidden' || status === 'refunded' || status === 'restricted' || status === 'dismissed') return 'is-danger';
    return '';
};

const statusLabel = (status?: string): string => {
    const labels: Record<string, string> = {
        accepted: '승인됨',
        active: '정상',
        cancel_trade: '거래 중단',
        cancelled: '취소됨',
        close_consultation: '상담 종료',
        closed: '종료',
        completed: '완료',
        draft: '임시저장',
        dismiss_report: '신고 기각',
        dismissed: '기각됨',
        hidden: '숨김',
        hide_product: '상품 숨김',
        featured: '상단 추천',
        feature_product: '상단 추천 지정',
        held: '보관 중',
        in_progress: '진행 중',
        note: '메모',
        normal: '일반 노출',
        open: '상담 중',
        paid: '결제 완료',
        pending: '대기',
        proposal_sent: '제안서 발송',
        published: '공개',
        refunded: '환불',
        resolve_report: '신고 처리',
        resolved: '처리 완료',
        restrict: '활동 제한',
        release_restriction: '제한 해제',
        restore_product: '상품 공개 복구',
        revision_requested: '수정 요청',
        sent: '발송됨',
        submitted: '제출됨',
        unpaid: '미결제',
        unfeature_product: '상단 추천 해제',
        move_product_up: '배치 올림',
        move_product_down: '배치 내림',
        warn: '경고',
        restricted: '활동 제한됨',
    };
    return status ? labels[status] || status : '상태 없음';
};

export const AdminStatus = ({ value }: { readonly value?: string }) => (
    <span className={`admin-status ${statusClass(value)}`}>{statusLabel(value)}</span>
);

export const EmptyState = ({ label }: { readonly label: string }) => (
    <div className="admin-empty">{label}</div>
);

export function AdminTablePanel({
    title,
    copy,
    children,
}: {
    readonly title: string;
    readonly copy: string;
    readonly children: ReactNode;
}) {
    return (
        <section className="admin-panel">
            <div className="admin-panel-header">
                <div>
                    <h2 className="admin-panel-title">{title}</h2>
                    <p className="admin-panel-copy">{copy}</p>
                </div>
            </div>
            <div className="admin-table-wrap">{children}</div>
        </section>
    );
}
