/**
 * ChatModal 컴포넌트
 * - 전문가 상세 페이지의 실시간 채팅 UI
 * - 현재는 키워드 기반 자동 응답 (목업) → 향후 Supabase Realtime으로 교체 예정
 * - 왜 분리: 채팅 로직(메시지 상태, 자동 스크롤, 키워드 매칭)이
 *   전문가 프로필 UI와 아무 관련이 없는 독립된 관심사이므로
 */
import { useState, useRef, useEffect, type KeyboardEvent, type ChangeEvent } from 'react';
import type { ChatMessage } from '../types';

interface ChatModalProps {
    /** 모달 닫기 콜백 */
    onClose: () => void;
}

/**
 * 사용자 메시지에 대한 자동 응답 생성
 * - 특정 키워드가 포함되면 맞춤 답변, 아니면 기본 답변
 * - 왜 함수로 분리: 향후 AI 기반 응답이나 서버 요청으로 교체가 쉽도록
 */
function generateAutoReply(userText: string): string {
    if (userText.includes('가격') || userText.includes('얼마')) {
        return '가격은 프로젝트의 규모와 복잡도에 따라 달라질 수 있습니다. Standard 패키지 외에도 맞춤 견적 가능하니 참고해 주세요!';
    }
    if (userText.includes('기간') || userText.includes('언제')) {
        return '보통 Standard 기준 3일 정도 소요되지만, 급하신 건이라면 일정을 최대한 맞춰드릴 수 있습니다.';
    }
    if (userText.includes('포트폴리오')) {
        return '현재 페이지에 게시된 포트폴리오 외에도 유사한 성격의 다양한 작업물이 있습니다. 원하시면 링크를 보내드릴게요!';
    }
    return '상세한 내용을 확인했습니다. 잠시만 기다려 주시면 검토 후 답변 드리겠습니다.';
}

export default function ChatModal({ onClose }: ChatModalProps) {
    const [messages, setMessages] = useState<ChatMessage[]>([
        { type: 'system', text: '김디자인 전문가님께 문의를 시작합니다.' },
    ]);
    const [inputText, setInputText] = useState<string>('');
    const chatMessagesRef = useRef<HTMLDivElement>(null);

    // 모달이 열릴 때 전문가의 첫 인사 메시지를 자연스럽게 지연 전송
    useEffect(() => {
        const timer = setTimeout(() => {
            setMessages((prev) => [
                ...prev,
                { type: 'expert', text: '안녕하세요! 무엇을 도와드릴까요? 원하시는 프로젝트에 대해 말씀해 주시면 자세히 안내해 드리겠습니다.' },
            ]);
        }, 800);
        return () => clearTimeout(timer);
    }, []);

    // 새 메시지가 추가될 때마다 스크롤을 하단으로 이동 — UX 개선
    useEffect(() => {
        if (chatMessagesRef.current) {
            chatMessagesRef.current.scrollTop = chatMessagesRef.current.scrollHeight;
        }
    }, [messages]);

    const sendMessage = () => {
        if (!inputText.trim()) return;

        const userText = inputText.trim();
        setMessages((prev) => [...prev, { type: 'user', text: userText }]);
        setInputText('');

        // 실제 사람처럼 답변 시간에 랜덤 지연을 줌
        const replyDelay = 1000 + Math.random() * 1000;
        setTimeout(() => {
            const reply = generateAutoReply(userText);
            setMessages((prev) => [...prev, { type: 'expert', text: reply }]);
        }, replyDelay);
    };

    return (
        <div className="chat-window">
            {/* 헤더 — 전문가 정보 + 닫기 버튼 */}
            <div className="chat-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <img
                        src="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=100"
                        style={{ width: '32px', height: '32px', borderRadius: '8px' }}
                        alt="전문가 프로필"
                    />
                    <span style={{ fontWeight: 700 }}>김디자인 전문가</span>
                </div>
                <button
                    onClick={onClose}
                    className="material-symbols-outlined"
                    style={{ background: 'transparent', border: 'none', color: 'white', cursor: 'pointer' }}
                >
                    close
                </button>
            </div>

            {/* 메시지 목록 */}
            <div className="chat-messages" ref={chatMessagesRef}>
                {messages.map((msg, idx) => (
                    <div key={idx} className={`message ${msg.type}`}>
                        {msg.text}
                    </div>
                ))}
            </div>

            {/* 입력 영역 */}
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
    );
}
