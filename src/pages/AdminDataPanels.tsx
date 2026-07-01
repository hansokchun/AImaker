import { Link } from 'react-router-dom';
import type { AdminSnapshot } from '../lib/adminStorage';
import { AdminStatus, AdminTablePanel, EmptyState, formatCurrency } from './AdminShared';

export default function AdminDataPanels({
    activeTab,
    snapshot,
}: {
    readonly activeTab: string;
    readonly snapshot: AdminSnapshot;
}) {
    if (activeTab === 'members') return <MembersPanel snapshot={snapshot} />;
    if (activeTab === 'products') return <ProductsPanel snapshot={snapshot} />;
    if (activeTab === 'trades') return <TradesPanel snapshot={snapshot} />;
    if (activeTab === 'consultations') return <ConsultationsPanel snapshot={snapshot} />;
    if (activeTab === 'workrooms') return <WorkroomsPanel snapshot={snapshot} />;
    if (activeTab === 'reviews') return <ReviewsPanel snapshot={snapshot} />;
    return null;
}

function MembersPanel({ snapshot }: { readonly snapshot: AdminSnapshot }) {
    return (
        <AdminTablePanel title="회원 관리" copy="가입자와 전문가 여부를 확인합니다.">
            {snapshot.profiles.length === 0 ? <EmptyState label="표시할 회원이 없습니다." /> : (
                <table className="admin-table">
                    <thead><tr><th>이름</th><th>이메일</th><th>유형</th><th>ID</th></tr></thead>
                    <tbody>
                        {snapshot.profiles.map((profile) => (
                            <tr key={profile.id}>
                                <td>{profile.name}</td>
                                <td>{profile.email || <span className="admin-muted">이메일 없음</span>}</td>
                                <td><AdminStatus value={profile.isExpert ? 'published' : 'pending'} /></td>
                                <td className="admin-muted">{profile.id}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </AdminTablePanel>
    );
}

function ProductsPanel({ snapshot }: { readonly snapshot: AdminSnapshot }) {
    return (
        <AdminTablePanel title="상품 관리" copy="등록된 상품의 공개 상태, 판매자, 시작가를 확인합니다.">
            <table className="admin-table">
                <thead><tr><th>상품</th><th>전문가</th><th>가격</th><th>상태</th><th>작업</th></tr></thead>
                <tbody>
                    {snapshot.products.map((product) => (
                        <tr key={product.id}>
                            <td>
                                <Link to={`/expert/${product.id}`}>{product.title}</Link>
                                <div className="admin-muted">{product.category}</div>
                            </td>
                            <td>{product.expertName}</td>
                            <td>{formatCurrency(product.startingPrice)}</td>
                            <td><AdminStatus value={product.status} /></td>
                            <td className="admin-action-row">
                                <Link className="admin-disabled-action" to={`/expert/${product.id}`}>상세 보기</Link>
                                <button className="admin-disabled-action" type="button" disabled>숨김 예정</button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </AdminTablePanel>
    );
}

function TradesPanel({ snapshot }: { readonly snapshot: AdminSnapshot }) {
    return (
        <AdminTablePanel title="거래 관리" copy="의뢰서와 제안서 흐름을 함께 확인합니다.">
            <table className="admin-table">
                <thead><tr><th>거래 항목</th><th>참여자</th><th>금액/패키지</th><th>상태</th></tr></thead>
                <tbody>
                    {snapshot.serviceRequests.map((request) => (
                        <tr key={`request-${request.id}`}>
                            <td>의뢰서 · {request.title || request.desiredResult}</td>
                            <td className="admin-muted">의뢰자 {request.clientId || '-'} / 전문가 {request.expertId || '-'}</td>
                            <td>{request.selectedPackage || 'standard'}</td>
                            <td><AdminStatus value={request.status} /></td>
                        </tr>
                    ))}
                    {snapshot.proposals.map((proposal) => (
                        <tr key={`proposal-${proposal.id}`}>
                            <td>제안서 · {proposal.title}</td>
                            <td className="admin-muted">의뢰자 {proposal.clientId} / 전문가 {proposal.expertId}</td>
                            <td>{formatCurrency(proposal.totalPrice)}</td>
                            <td><AdminStatus value={proposal.paymentStatus === 'paid' ? 'paid' : proposal.status} /></td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </AdminTablePanel>
    );
}

function ConsultationsPanel({ snapshot }: { readonly snapshot: AdminSnapshot }) {
    return (
        <AdminTablePanel title="상담채팅 관리" copy="결제 전 협의 중인 상담방을 확인합니다.">
            {snapshot.consultations.length === 0 ? <EmptyState label="상담채팅이 없습니다." /> : (
                <table className="admin-table">
                    <thead><tr><th>상담</th><th>참여자</th><th>상품</th><th>상태</th></tr></thead>
                    <tbody>
                        {snapshot.consultations.map((consultation) => (
                            <tr key={consultation.id}>
                                <td>{consultation.title}</td>
                                <td className="admin-muted">의뢰자 {consultation.clientId} / 전문가 {consultation.expertId}</td>
                                <td className="admin-muted">{consultation.productId}</td>
                                <td><AdminStatus value={consultation.status} /></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </AdminTablePanel>
    );
}

function WorkroomsPanel({ snapshot }: { readonly snapshot: AdminSnapshot }) {
    return (
        <AdminTablePanel title="작업방 관리" copy="결제 이후 생성된 작업방과 정산 상태를 확인합니다.">
            {snapshot.works.length === 0 ? <EmptyState label="작업방이 없습니다." /> : (
                <table className="admin-table">
                    <thead><tr><th>작업방</th><th>참여자</th><th>금액</th><th>상태</th><th>정산</th></tr></thead>
                    <tbody>
                        {snapshot.works.map((work) => (
                            <tr key={work.id}>
                                <td><Link to={`/workroom/${work.id}`}>{work.title}</Link></td>
                                <td className="admin-muted">의뢰자 {work.clientId} / 전문가 {work.expertId}</td>
                                <td>{formatCurrency(work.totalPrice)}</td>
                                <td><AdminStatus value={work.status} /></td>
                                <td><AdminStatus value={work.settlementStatus} /></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </AdminTablePanel>
    );
}

function ReviewsPanel({ snapshot }: { readonly snapshot: AdminSnapshot }) {
    return (
        <AdminTablePanel title="리뷰 관리" copy="완료 거래 후 작성된 리뷰를 확인합니다.">
            {snapshot.reviews.length === 0 ? <EmptyState label="리뷰가 없습니다." /> : (
                <table className="admin-table">
                    <thead><tr><th>별점</th><th>내용</th><th>작성자</th><th>전문가</th></tr></thead>
                    <tbody>
                        {snapshot.reviews.map((review) => (
                            <tr key={review.id}>
                                <td>{review.rating}.0</td>
                                <td>{review.content}</td>
                                <td className="admin-muted">{review.clientId}</td>
                                <td className="admin-muted">{review.expertId}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </AdminTablePanel>
    );
}
