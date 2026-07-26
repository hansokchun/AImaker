interface AdminStat {
    readonly label: string;
    readonly value: number;
}

export default function AdminDashboardPanel({ stats }: { readonly stats: readonly AdminStat[] }) {
    return (
        <>
            <div className="admin-stat-grid">
                {stats.map((stat) => (
                    <article className="admin-stat-card" key={stat.label}>
                        <span className="admin-stat-label">{stat.label}</span>
                        <span className="admin-stat-value">{stat.value}</span>
                    </article>
                ))}
            </div>
            <section className="admin-panel">
                <div className="admin-panel-header">
                    <div>
                        <h2 className="admin-panel-title">운영 우선순위</h2>
                        <p className="admin-panel-copy">
                            Shopify식 주문/상품 관리, Stripe식 결제/분쟁 추적, 마켓플레이스식 신고 대응을
                            기그온 거래 흐름에 맞춰 묶었습니다.
                        </p>
                    </div>
                </div>
                <div className="admin-table-wrap">
                    <table className="admin-table">
                        <thead>
                            <tr>
                                <th>우선순위</th>
                                <th>확인할 것</th>
                                <th>현재 조치</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td>거래 안전</td>
                                <td>취소, 수정요청, 결제 완료 후 미진행 작업</td>
                                <td><button className="admin-disabled-action" type="button" disabled>상태 확인</button></td>
                            </tr>
                            <tr>
                                <td>상품 품질</td>
                                <td>이미지 없음, 설명 부족, 숨김 처리 필요한 상품</td>
                                <td><button className="admin-disabled-action" type="button" disabled>숨김은 서버 연결 후</button></td>
                            </tr>
                            <tr>
                                <td>직거래 방지</td>
                                <td>상담채팅/작업방 메시지의 외부 연락처 의심</td>
                                <td><button className="admin-disabled-action" type="button" disabled>신고 큐 예정</button></td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </section>
        </>
    );
}
