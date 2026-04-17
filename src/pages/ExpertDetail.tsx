/**
 * ExpertDetail 페이지
 * - 전문가의 상세 프로필, 경력, 포트폴리오, 사용 툴을 보여주는 페이지
 * - 요금 패키지(PackageCard)와 채팅(ChatModal)은 독립 컴포넌트로 분리
 * - 왜 이렇게 구성: 프로필 정보(읽기 전용)와 인터랙션(주문/채팅)의 관심사를 분리하여
 *   각각 독립적으로 수정/테스트할 수 있게 하기 위함
 */
import { useState } from 'react';
import PackageCard from '../components/PackageCard';
import ChatModal from '../components/ChatModal';
import './ExpertDetail.css';

export default function ExpertDetail() {
    const [chatOpen, setChatOpen] = useState<boolean>(false);

    return (
        <main className="container">
            <div className="detail-layout">
                {/* ===== 좌측: 전문가 프로필 정보 ===== */}
                <div className="content-left">
                    {/* 프로필 헤더 */}
                    <div className="expert-header">
                        <img src="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=300" alt="Expert" className="expert-avatar-large" />
                        <div className="expert-info-main">
                            <div style={{ color: 'var(--primary)', fontWeight: 700, marginBottom: '0.5rem', fontSize: '0.95rem' }}>AI 영상 및 이미지 생성 전문가</div>
                            <h1 style={{ fontSize: '2.25rem', fontWeight: 800, marginBottom: '1rem' }}>김디자인 전문가</h1>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, fontSize: '1.1rem' }}>
                                <span style={{ color: 'var(--star)' }} className="material-symbols-outlined">star</span>
                                <span>4.8</span>
                                <span style={{ color: 'var(--text-muted)', fontWeight: 400, fontSize: '0.95rem' }}>(120개)</span>
                                <span style={{ marginLeft: '1rem', paddingLeft: '1rem', borderLeft: '1px solid var(--border-color)', color: 'var(--text-secondary)', fontWeight: 500, fontSize: '0.95rem' }}>총 의뢰 완료 245건</span>
                            </div>
                        </div>
                    </div>

                    {/* 인사말 섹션 */}
                    <div className="detail-section">
                        <h2><span className="material-symbols-outlined">waving_hand</span>전문가 인사말</h2>
                        <div className="section-content">
                            <p style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '1.25rem', fontSize: '1.1rem' }}>"AI 기술과 예술의 경계를 허무는 창의적인 작업을 지향합니다."</p>
                            <p>
                                안녕하세요! 최신 AI 도구를 활용하여 상상을 현실로 만드는 비주얼 아티스트 김디자인입니다. 
                                단순히 이미지를 생성하는 것을 넘어, 고객의 브랜드 가치와 메시지를 가장 효과적으로 전달할 수 있는 
                                고유한 미학적 결과물을 만들어내는 것이 저의 작업 철학입니다.
                            </p>
                        </div>
                    </div>

                    {/* 경력 섹션 */}
                    <div className="detail-section">
                        <h2><span className="material-symbols-outlined">history_edu</span>전문가 경력</h2>
                        <div className="section-content">
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                                <div>
                                    <h4 style={{ marginBottom: '1rem', color: 'var(--text-primary)' }}>주요 활동</h4>
                                    <ul style={{ listStyle: 'none' }}>
                                        <li style={{ marginBottom: '0.5rem' }}>• 현) AI 크리에이티브 스튜디오 '비전' 대표</li>
                                        <li style={{ marginBottom: '0.5rem' }}>• 전) 글로벌 IT 기업 아트 디렉터 (5년)</li>
                                        <li style={{ marginBottom: '0.5rem' }}>• 국내 주요 광고 캠페인 AI 영상 제작 참여</li>
                                    </ul>
                                </div>
                                <div>
                                    <h4 style={{ marginBottom: '1rem', color: 'var(--text-primary)' }}>수상 이력</h4>
                                    <ul style={{ listStyle: 'none' }}>
                                        <li style={{ marginBottom: '0.5rem' }}>• 2025 디지털 아트 이노베이션 대상</li>
                                        <li style={{ marginBottom: '0.5rem' }}>• 제3회 미래 비주얼 어워드 금상</li>
                                        <li style={{ marginBottom: '0.5rem' }}>• Adobe Creative Cloud 우수 파트너</li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 영상 포트폴리오 */}
                    <div className="detail-section">
                        <h2><span className="material-symbols-outlined">movie</span>영상 포트폴리오</h2>
                        <div className="portfolio-videos">
                            <div className="video-placeholder">
                                <span className="material-symbols-outlined" style={{ fontSize: '3rem', opacity: 0.5, marginBottom: '1rem' }}>play_circle</span>
                                <span style={{ fontWeight: 600 }}>메인 홍보 영상 (85MB)</span>
                            </div>
                            <div className="video-placeholder">
                                <span className="material-symbols-outlined" style={{ fontSize: '3rem', opacity: 0.5, marginBottom: '1rem' }}>play_circle</span>
                                <span style={{ fontWeight: 600 }}>작업 비하인드 영상 (92MB)</span>
                            </div>
                        </div>
                    </div>

                    {/* 사용 툴 */}
                    <div className="detail-section">
                        <h2><span className="material-symbols-outlined">construction</span>사용 툴 정보</h2>
                        <div className="section-content">
                            <div style={{ marginBottom: '2rem' }}>
                                <h4 style={{ marginBottom: '1rem', color: 'var(--text-primary)', fontWeight: 700 }}>AI 도구</h4>
                                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                                    {['Midjourney', 'Stable Diffusion', 'Runway Gen-2'].map((tool) => (
                                        <span key={tool} className="tool-chip">{tool}</span>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <h4 style={{ marginBottom: '1rem', color: 'var(--text-primary)', fontWeight: 700 }}>편집 및 후반 작업</h4>
                                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                                    {['Premiere Pro', 'After Effects', 'Photoshop'].map((tool) => (
                                        <span key={tool} className="tool-chip">{tool}</span>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ===== 우측: 요금 패키지 ===== */}
                <div className="content-right">
                    <PackageCard onOpenChat={() => setChatOpen(true)} />
                </div>
            </div>

            {/* 채팅 모달 — chatOpen이 true일 때만 렌더링 */}
            {chatOpen && <ChatModal onClose={() => setChatOpen(false)} />}
        </main>
    );
}
