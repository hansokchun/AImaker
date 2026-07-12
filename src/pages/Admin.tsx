import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '../constants/routes';
import { hasExternalContact } from '../constants/policies';
import { useAuth } from '../contexts/AuthContext';
import { defaultAdminFilters, filterAdminSnapshot, type AdminFilterState } from '../lib/adminFilters';
import { getAdminSnapshot, isAdminEmail, saveAdminAction, type AdminAction, type AdminSnapshot } from '../lib/adminStorage';
import AdminDashboardPanel from './AdminDashboardPanel';
import AdminDataPanels, { type AdminActionRequest } from './AdminDataPanels';
import AdminFilters from './AdminFilters';
import './Admin.css';

type AdminTab = 'dashboard' | 'members' | 'products' | 'trades' | 'consultations' | 'workrooms' | 'reviews' | 'reports' | 'actions' | 'settlements';

interface AdminTabItem {
    readonly id: AdminTab;
    readonly label: string;
    readonly count: number;
}

export default function Admin() {
    const { session, user, loading } = useAuth();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState<AdminTab>('dashboard');
    const [filters, setFilters] = useState<AdminFilterState>(defaultAdminFilters);
    const [snapshot, setSnapshot] = useState<AdminSnapshot | null>(null);
    const [loadError, setLoadError] = useState('');
    const [actionNotice, setActionNotice] = useState('');
    const canAccessAdmin = isAdminEmail(user?.email);

    useEffect(() => {
        if (!loading && !session) navigate(ROUTES.LOGIN);
    }, [loading, navigate, session]);

    useEffect(() => {
        if (!canAccessAdmin) return;

        let active = true;
        getAdminSnapshot()
            .then((data) => {
                if (active) setSnapshot(data);
            })
            .catch(() => {
                if (active) setLoadError('관리자 데이터를 불러오지 못했습니다.');
            });

        return () => {
            active = false;
        };
    }, [canAccessAdmin]);

    const visibleSnapshot = useMemo(
        () => snapshot ? filterAdminSnapshot(snapshot, filters) : null,
        [filters, snapshot],
    );
    const tabs = useMemo(() => buildTabs(visibleSnapshot), [visibleSnapshot]);
    const stats = useMemo(() => buildStats(visibleSnapshot), [visibleSnapshot]);

    const handleAdminAction = (input: AdminActionRequest) => {
        if (!user?.id) return;

        saveAdminAction({ ...input, adminId: user.id })
            .then((action) => {
                setSnapshot((current) => current ? applyAdminActionToSnapshot(current, action) : current);
                setActionNotice('운영 조치가 처리되었습니다.');
            })
            .catch(() => setActionNotice('운영 조치를 처리하지 못했습니다. 관리자 권한과 Supabase 정책을 확인해 주세요.'));
    };

    if (loading || (!snapshot && canAccessAdmin && !loadError)) {
        return <AdminShell>관리자 데이터를 불러오는 중입니다.</AdminShell>;
    }

    if (!canAccessAdmin) {
        return (
            <AdminShell>
                <section className="admin-denied">
                    <p className="admin-kicker">ADMIN ACCESS</p>
                    <h1>관리자 권한이 필요합니다</h1>
                    <p className="admin-description">
                        현재 로그인 계정은 관리자 목록에 없습니다. 운영 계정 이메일을
                        <code> VITE_ADMIN_EMAILS </code>
                        환경변수에 추가하면 접근할 수 있습니다.
                    </p>
                    <p className="admin-muted">현재 계정: {user?.email || '로그인 필요'}</p>
                </section>
            </AdminShell>
        );
    }

    return (
        <AdminShell>
            <AdminHeader source={snapshot?.source || 'local'} />
            {loadError && <div className="admin-alert">{loadError}</div>}
            {actionNotice && <div className="admin-success-alert">{actionNotice}</div>}
            <div className="admin-alert">
                관리자 화면은 클라이언트에서 RLS를 우회하지 않습니다. 회원 삭제, 정산 변경, 분쟁 확정 같은 고위험 조치는 서버 함수가 연결된 뒤 활성화하는 것이 안전합니다.
            </div>
            <AdminFilters value={filters} onChange={setFilters} />
            <div className="admin-layout">
                <AdminSidebar activeTab={activeTab} tabs={tabs} onSelect={setActiveTab} />
                <section className="admin-main">
                    {visibleSnapshot && activeTab === 'dashboard' && <AdminDashboardPanel stats={stats} />}
                    {visibleSnapshot && activeTab !== 'dashboard' && (
                        <AdminDataPanels activeTab={activeTab} snapshot={visibleSnapshot} onAction={handleAdminAction} />
                    )}
                </section>
            </div>
        </AdminShell>
    );
}

function applyAdminActionToSnapshot(snapshot: AdminSnapshot, action: AdminAction): AdminSnapshot {
    return {
        ...snapshot,
        profiles: snapshot.profiles.map((profile) => {
            if (action.targetType !== 'user' || profile.id !== action.targetId) return profile;
            if (action.actionType === 'restrict') return { ...profile, moderationStatus: 'restricted' };
            if (action.actionType === 'release_restriction') return { ...profile, moderationStatus: 'active' };
            return profile;
        }),
        products: snapshot.products.map((product) =>
            applyProductAction(product, action),
        ).sort(compareAdminProductPlacement),
        works: snapshot.works.map((work) => applyWorkAction(work, action)),
        reviews: snapshot.reviews.map((review) => {
            if (action.targetType !== 'review' || review.id !== action.targetId) return review;
            if (action.actionType === 'hide_review') return { ...review, status: 'hidden' };
            if (action.actionType === 'restore_review') return { ...review, status: 'published' };
            return review;
        }),
        consultations: snapshot.consultations.map((consultation) =>
            action.actionType === 'close_consultation' && consultation.id === action.targetId
                ? { ...consultation, status: 'closed' }
                : consultation,
        ),
        reports: snapshot.reports.map((report) => {
            if (action.targetType !== 'report' || report.id !== action.targetId) return report;
            if (action.actionType === 'resolve_report') return { ...report, status: 'resolved', resolvedAt: action.createdAt, resolvedBy: action.adminId };
            if (action.actionType === 'dismiss_report') return { ...report, status: 'dismissed', resolvedAt: action.createdAt, resolvedBy: action.adminId };
            return report;
        }),
        adminActions: [action, ...snapshot.adminActions.filter((item) => item.id !== action.id)],
        settlementPayouts: snapshot.settlementPayouts.map((payout) =>
            action.targetType === 'work' && action.actionType === 'mark_settlement_settled' && payout.workId === action.targetId
                ? { ...payout, status: 'paid', processedAt: action.createdAt }
                : payout,
        ),
    };
}

function applyProductAction(product: AdminSnapshot['products'][number], action: AdminAction): AdminSnapshot['products'][number] {
    if (action.targetType !== 'product' || product.id !== action.targetId) return product;
    if (action.actionType === 'hide_product') return { ...product, status: 'hidden' };
    if (action.actionType === 'restore_product') return { ...product, status: 'published' };
    if (action.actionType === 'feature_product') return { ...product, isFeatured: true };
    if (action.actionType === 'unfeature_product') return { ...product, isFeatured: false };
    if (action.actionType === 'move_product_up') return { ...product, displayOrder: Math.max(1, (product.displayOrder || 1) - 1) };
    if (action.actionType === 'move_product_down') return { ...product, displayOrder: (product.displayOrder || 1) + 1 };
    return product;
}

function applyWorkAction(work: AdminSnapshot['works'][number], action: AdminAction): AdminSnapshot['works'][number] {
    if (action.targetType !== 'work' || work.id !== action.targetId) return work;
    if (action.actionType === 'cancel_trade') {
        return {
            ...work,
            status: 'cancelled',
            settlementStatus: work.settlementStatus || 'held',
            refundStatus: 'fee_excluded_refund_pending',
            cancellationReason: 'mutual_after_start',
            cancelledAt: action.createdAt,
        };
    }
    if (action.actionType === 'mark_settlement_pending') return { ...work, settlementStatus: 'pending', settlementHoldReason: undefined };
    if (action.actionType === 'mark_settlement_settled') {
        return {
            ...work,
            settlementStatus: 'settled',
            refundStatus: undefined,
            settlementHoldReason: undefined,
            settlementSettledAt: action.createdAt,
        };
    }
    if (action.actionType === 'hold_settlement') return { ...work, settlementStatus: 'pending', settlementHoldReason: action.reason };
    if (action.actionType === 'mark_refund_pending') return { ...work, settlementStatus: 'refunded', refundStatus: 'fee_excluded_refund_pending' };
    if (action.actionType === 'execute_toss_refund') {
        return { ...work, settlementStatus: 'refunded', refundStatus: 'refunded', cancelledAt: action.createdAt };
    }
    if (action.actionType === 'open_dispute') return { ...work, disputeStatus: 'open' };
    if (action.actionType === 'resolve_dispute') return { ...work, disputeStatus: 'resolved' };
    return work;
}

function compareAdminProductPlacement(first: AdminSnapshot['products'][number], second: AdminSnapshot['products'][number]): number {
    if (Boolean(first.isFeatured) !== Boolean(second.isFeatured)) return first.isFeatured ? -1 : 1;
    const firstOrder = first.displayOrder ?? Number.MAX_SAFE_INTEGER;
    const secondOrder = second.displayOrder ?? Number.MAX_SAFE_INTEGER;
    if (firstOrder !== secondOrder) return firstOrder - secondOrder;
    return first.title.localeCompare(second.title, 'ko-KR');
}

function AdminShell({ children }: { readonly children: ReactNode }) {
    return (
        <main className="admin-page">
            <div className="admin-container">{children}</div>
        </main>
    );
}

function AdminHeader({ source }: { readonly source: AdminSnapshot['source'] }) {
    return (
        <header className="admin-header">
            <div>
                <p className="admin-kicker">AIConnect Admin</p>
                <h1 className="admin-title">운영 관리자</h1>
                <p className="admin-description">
                    회원, 상품, 거래, 상담채팅, 작업방, 리뷰를 한 곳에서 확인합니다. 운영 조치는 기록과 실제 상태 변경을 함께 남깁니다.
                </p>
            </div>
            <span className="admin-source-badge">데이터: {source === 'supabase' ? 'Supabase' : '로컬/데모'}</span>
        </header>
    );
}

function AdminSidebar({ activeTab, tabs, onSelect }: {
    readonly activeTab: AdminTab;
    readonly tabs: readonly AdminTabItem[];
    readonly onSelect: (tab: AdminTab) => void;
}) {
    return (
        <nav className="admin-sidebar" aria-label="관리자 메뉴">
            {tabs.map((tab) => (
                <button
                    key={tab.id}
                    type="button"
                    className={`admin-tab-button ${activeTab === tab.id ? 'is-active' : ''}`}
                    onClick={() => onSelect(tab.id)}
                >
                    <span>{tab.label}</span>
                    {tab.count > 0 && <span className="admin-tab-count">{tab.count}</span>}
                </button>
            ))}
        </nav>
    );
}

function buildTabs(snapshot: AdminSnapshot | null): AdminTabItem[] {
    return [
        { id: 'dashboard', label: '대시보드', count: 0 },
        { id: 'members', label: '회원', count: snapshot?.profiles.length || 0 },
        { id: 'products', label: '상품', count: snapshot?.products.length || 0 },
        { id: 'trades', label: '거래', count: (snapshot?.serviceRequests.length || 0) + (snapshot?.proposals.length || 0) },
        { id: 'consultations', label: '상담채팅', count: snapshot?.consultations.length || 0 },
        { id: 'workrooms', label: '작업방', count: snapshot?.works.length || 0 },
        { id: 'reviews', label: '리뷰', count: snapshot?.reviews.length || 0 },
        { id: 'reports', label: '검수 큐', count: countPendingModerationItems(snapshot) },
        { id: 'actions', label: '운영 조치', count: snapshot?.adminActions.length || 0 },
        { id: 'settlements', label: '정산', count: countPendingSettlements(snapshot) },
    ];
}

function buildStats(snapshot: AdminSnapshot | null) {
    if (!snapshot) return [];

    const activeWorks = snapshot.works.filter((work) => work.status !== 'completed' && work.status !== 'cancelled');
    const paidProposals = snapshot.proposals.filter((proposal) => proposal.paymentStatus === 'paid');
    const reportedWorks = snapshot.works.filter((work) => work.status === 'revision_requested' || work.status === 'cancelled');
    const pendingReports = snapshot.reports.filter((report) => report.status === 'pending');
    const policyViolations = countPolicyViolations(snapshot);

    return [
        { label: '전체 회원', value: snapshot.profiles.length },
        { label: '공개 상품', value: snapshot.products.filter((product) => product.status === 'published').length },
        { label: '진행 중 작업', value: activeWorks.length },
        { label: '검토 필요', value: reportedWorks.length + pendingReports.length + policyViolations + paidProposals.filter((proposal) => proposal.status !== 'accepted').length },
    ];
}

function countPendingModerationItems(snapshot: AdminSnapshot | null): number {
    if (!snapshot) return 0;
    return snapshot.reports.filter((report) => report.status === 'pending').length + countPolicyViolations(snapshot);
}

function countPolicyViolations(snapshot: AdminSnapshot): number {
    return snapshot.consultationMessages.filter((message) => hasExternalContact(message.body)).length
        + snapshot.workMessages.filter((message) => hasExternalContact(message.body)).length;
}

function countPendingSettlements(snapshot: AdminSnapshot | null): number {
    if (!snapshot) return 0;
    return snapshot.works.filter((work) =>
        work.settlementStatus === 'pending'
        && work.refundStatus !== 'fee_excluded_refund_pending'
        && work.refundStatus !== 'refunded'
        && work.disputeStatus !== 'open',
    ).length;
}
