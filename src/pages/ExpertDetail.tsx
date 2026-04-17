import { useState, useRef, useEffect, type KeyboardEvent, type ChangeEvent } from 'react';
import type { ChatMessage } from '../types';
import './ExpertDetail.css';

type PackageTab = 'standard' | 'deluxe' | 'premium';

export default function ExpertDetail() {
    const [activeTab, setActiveTab] = useState<PackageTab>('standard');
    const [chatOpen, setChatOpen] = useState<boolean>(false);
    const [messages, setMessages] = useState<ChatMessage[]>([
        { type: 'system', text: '김디자인 전문가님께 문의를 시작합니다.' }
    ]);
    const [inputText, setInputText] = useState<string>('');
    const chatMessagesRef = useRef<HTMLDivElement>(null);

    // Initial message from expert when chat opens
    useEffect(() => {
        if (chatOpen && messages.length === 1) {
            const timer = setTimeout(() => {
                setMessages(prev => [...prev, { type: 'expert', text: '안녕하세요! 무엇을 도와드릴까요? 원하시는 프로젝트에 대해 말씀해 주시면 자세히 안내해 드리겠습니다.' }]);
            }, 800);
            return () => clearTimeout(timer);
        }
    }, [chatOpen]);

    // Scroll to bottom when messages update
    useEffect(() => {
        if (chatMessagesRef.current) {
            chatMessagesRef.current.scrollTop = chatMessagesRef.current.scrollHeight;
        }
    }, [messages]);

    const sendMessage = () => {
        if (!inputText.trim()) return;
        
        const userText = inputText.trim();
        setMessages(prev => [...prev, { type: 'user', text: userText }]);
        setInputText('');

        setTimeout(() => {
            let reply = '상세한 내용을 확인했습니다. 잠시만 기다려 주시면 검토 후 답변 드리겠습니다.';
            if (userText.includes('가격') || userText.includes('얼마')) {
                reply = '가격은 프로젝트의 규모와 복잡도에 따라 달라질 수 있습니다. Standard 패키지 외에도 맞춤 견적 가능하니 참고해 주세요!';
            } else if (userText.includes('기간') || userText.includes('언제')) {
                reply = '보통 Standard 기준 3일 정도 소요되지만, 급하신 건이라면 일정을 최대한 맞춰드릴 수 있습니다.';
            } else if (userText.includes('포트폴리오')) {
                reply = '현재 페이지에 게시된 포트폴리오 외에도 유사한 성격의 다양한 작업물이 있습니다. 원하시면 링크를 보내드릴게요!';
            }
            setMessages(prev => [...prev, { type: 'expert', text: reply }]);
        }, 1000 + Math.random() * 1000);
    };

    return (
        <main className="container">
            <div className="detail-layout">
                <div className="content-left">
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

                    <div className="detail-section">
                        <h2><span className="material-symbols-outlined">construction</span>사용 툴 정보</h2>
                        <div className="section-content">
                            <div style={{ marginBottom: '2rem' }}>
                                <h4 style={{ marginBottom: '1rem', color: 'var(--text-primary)', fontWeight: 700 }}>AI 도구</h4>
                                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                                    {['Midjourney', 'Stable Diffusion', 'Runway Gen-2'].map(tool => (
                                        <span key={tool} className="tool-chip">{tool}</span>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <h4 style={{ marginBottom: '1rem', color: 'var(--text-primary)', fontWeight: 700 }}>편집 및 후반 작업</h4>
                                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                                    {['Premiere Pro', 'After Effects', 'Photoshop'].map(tool => (
                                        <span key={tool} className="tool-chip">{tool}</span>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="content-right">
                    <div className="package-card">
                        <div className="package-tabs">
                            <div className={`package-tab ${activeTab === 'standard' ? 'active' : ''}`} onClick={() => setActiveTab('standard')}>Standard</div>
                            <div className={`package-tab ${activeTab === 'deluxe' ? 'active' : ''}`} onClick={() => setActiveTab('deluxe')}>Deluxe</div>
                            <div className={`package-tab ${activeTab === 'premium' ? 'active' : ''}`} onClick={() => setActiveTab('premium')}>Premium</div>
                        </div>
                        <div className="package-content">
                            {activeTab === 'standard' && (
                                <div>
                                    <div style={{ fontSize: '1.75rem', fontWeight: 800, marginBottom: '1rem' }}>₩50,000</div>
                                    <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>간단한 AI 이미지 생성 및 기본 보정. (최대 3장 제공)</p>
                                    <div className="package-features">
                                        <span>⏲️ 작업일 2일</span>
                                        <span>🔄 수정 1회</span>
                                    </div>
                                    <ul className="package-list">
                                        <li>✔️ 고해상도 이미지 (PNG)</li>
                                        <li>✔️ 개인적 용도 라이선스</li>
                                    </ul>
                                </div>
                            )}
                            {activeTab === 'deluxe' && (
                                <div>
                                    <div style={{ fontSize: '1.75rem', fontWeight: 800, marginBottom: '1rem' }}>₩150,000</div>
                                    <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>상업적 용도의 고품질 AI 이미지 및 간단한 애니메이션 효과.</p>
                                    <div className="package-features">
                                        <span>⏲️ 작업일 4일</span>
                                        <span>🔄 수정 3회</span>
                                    </div>
                                    <ul className="package-list">
                                        <li>✔️ 초고해상도 업스케일링</li>
                                        <li>✔️ 상업적 용도 라이선스</li>
                                        <li>✔️ 원본 파일 제공</li>
                                    </ul>
                                </div>
                            )}
                            {activeTab === 'premium' && (
                                <div>
                                    <div style={{ fontSize: '1.75rem', fontWeight: 800, marginBottom: '1rem' }}>₩450,000</div>
                                    <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>풀 패키지 AI 영상 제작. 시나리오부터 편집, 배경음악 포함 전문 영상</p>
                                    <div className="package-features">
                                        <span>⏲️ 작업일 10일</span>
                                        <span>🔄 수정 5회</span>
                                    </div>
                                    <ul className="package-list">
                                        <li>✔️ 4K 시네마틱 퀄리티</li>
                                        <li>✔️ 전문 성우 AI 음성 더빙</li>
                                        <li>✔️ 독점 상업적 사용권</li>
                                    </ul>
                                </div>
                            )}

                            <button className="btn-primary" style={{ width: '100%', padding: '1.25rem', fontSize: '1.1rem', borderRadius: '12px', marginBottom: '1rem' }}>주문하기</button>
                            <button onClick={() => setChatOpen(true)} className="btn-text" style={{ width: '100%', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '1rem', fontWeight: 700 }}>전문가에게 문의하기</button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Chat Modal UI */}
            {chatOpen && (
                <div className="chat-window">
                    <div className="chat-header">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <img src="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=100" style={{ width: '32px', height: '32px', borderRadius: '8px' }} alt="expert" />
                            <span style={{ fontWeight: 700 }}>김디자인 전문가</span>
                        </div>
                        <button onClick={() => setChatOpen(false)} className="material-symbols-outlined" style={{ background: 'transparent', border: 'none', color: 'white', cursor: 'pointer' }}>close</button>
                    </div>
                    <div className="chat-messages" ref={chatMessagesRef}>
                        {messages.map((msg, idx) => (
                            <div key={idx} className={`message ${msg.type}`}>{msg.text}</div>
                        ))}
                    </div>
                    <div className="chat-input-area">
                        <input 
                            type="text" 
                            value={inputText}
                            onChange={(e: ChangeEvent<HTMLInputElement>) => setInputText(e.target.value)}
                            onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => e.key === 'Enter' && sendMessage()}
                            placeholder="메시지를 입력하세요..." 
                        />
                        <button onClick={sendMessage}>전송</button>
                    </div>
                </div>
            )}
        </main>
    );
}
