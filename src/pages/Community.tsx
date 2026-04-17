/**
 * Community 페이지 — 전문가 커뮤니티
 * - 게시판 형태의 커뮤니티 UI (현재 하드코딩된 목업 데이터)
 * - 좌측: 게시글 리스트 (투표 수, 카테고리, 댓글 수)
 * - 우측: 글쓰기 버튼 + 인기 태그 사이드바
 * - 향후: Supabase 테이블 연동 예정
 */
import './Community.css';

export default function Community() {
    return (
        <>
            <div className="page-hero" style={{ padding: '4rem 0', background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', color: 'white' }}>
                <div className="container">
                    <h1 style={{ fontSize: '2.5rem', fontWeight: 800, marginBottom: '1rem' }}>전문가 커뮤니티</h1>
                    <p style={{ color: 'var(--text-secondary)' }}>노하우 공유, 질문 답변, 자유로운 소통의 장입니다.</p>
                </div>
            </div>

            <main className="container" style={{ marginTop: '2rem', paddingBottom: '4rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '2rem' }}>
                    {/* 게시글 리스트 */}
                    <div className="posts-list">
                        <div className="content-card" style={{ padding: 0 }}>
                            <div className="post-card">
                                <div className="post-votes">
                                    <span className="material-symbols-outlined">expand_less</span>
                                    <span>42</span>
                                </div>
                                <div className="post-content">
                                    <span style={{ fontSize: '0.75rem', color: 'var(--primary)', fontWeight: 700 }}>[노하우]</span>
                                    <h3>프리랜서 디자이너로 살아남는 5가지 팁</h3>
                                    <div className="post-meta">작성자: 디자인왕 • 2시간 전 • 댓글 12개</div>
                                </div>
                            </div>
                            <div className="post-card">
                                <div className="post-votes">
                                    <span className="material-symbols-outlined">expand_less</span>
                                    <span>15</span>
                                </div>
                                <div className="post-content">
                                    <span style={{ fontSize: '0.75rem', color: 'var(--primary)', fontWeight: 700 }}>[질문]</span>
                                    <h3>외주 계약서 작성할 때 주의할 점이 있나요?</h3>
                                    <div className="post-meta">작성자: 초보개발자 • 5시간 전 • 댓글 8개</div>
                                </div>
                            </div>
                            <div className="post-card">
                                <div className="post-votes">
                                    <span className="material-symbols-outlined">expand_less</span>
                                    <span>28</span>
                                </div>
                                <div className="post-content">
                                    <span style={{ fontSize: '0.75rem', color: 'var(--primary)', fontWeight: 700 }}>[자유]</span>
                                    <h3>오늘 드디어 대형 프로젝트 하나 마무리했습니다!</h3>
                                    <div className="post-meta">작성자: 코딩마스터 • 8시간 전 • 댓글 24개</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 사이드바 */}
                    <aside className="sidebar">
                        <button className="btn-primary" style={{ width: '100%', padding: '1rem', marginBottom: '1.5rem' }}>글쓰기</button>
                        <div className="content-card" style={{ padding: '1.5rem' }}>
                            <h4 style={{ marginBottom: '1rem' }}>인기 태그</h4>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                                {['#세금', '#계약서', '#포트폴리오', '#Figma'].map((tag) => (
                                    <span key={tag} className="tag" style={{ padding: '0.4rem 1rem', background: '#f1f5f9', borderRadius: '99px', fontSize: '0.85rem' }}>
                                        {tag}
                                    </span>
                                ))}
                            </div>
                        </div>
                    </aside>
                </div>
            </main>
        </>
    );
}
