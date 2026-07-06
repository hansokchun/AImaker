import { useEffect, useState, type FormEvent, type KeyboardEvent } from 'react'
import { Link } from 'react-router-dom'
import { getConsultationMessages, saveConsultationMessage, subscribeToConsultationMessages } from '../lib/storage'
import type { ConsultationMessage } from '../types'

type ConsultationChatDrawerProps = {
    readonly consultationId: string;
    readonly currentUserId: string;
};

const timeFormatter = new Intl.DateTimeFormat('ko-KR', {
    hour: 'numeric',
    minute: '2-digit',
});

export function ConsultationChatDrawer({ consultationId, currentUserId }: ConsultationChatDrawerProps) {
    const [open, setOpen] = useState(false)
    const [messages, setMessages] = useState<ConsultationMessage[]>([])
    const [body, setBody] = useState('')
    const [error, setError] = useState('')
    const [submitting, setSubmitting] = useState(false)

    useEffect(() => {
        if (!consultationId) return
        let active = true

        getConsultationMessages(consultationId).then((items) => {
            if (active) setMessages(items)
        })
        const unsubscribe = subscribeToConsultationMessages(consultationId, (message) => {
            setMessages((current) =>
                current.some((item) => item.id === message.id) ? current : [...current, message],
            )
        })

        return () => {
            active = false
            unsubscribe()
        }
    }, [consultationId])

    const send = async () => {
        const nextBody = body.trim()
        if (!nextBody || submitting) return

        setSubmitting(true)
        setError('')
        try {
            const message = await saveConsultationMessage({
                consultationId,
                senderId: currentUserId,
                body: nextBody,
            })
            setMessages((current) =>
                current.some((item) => item.id === message.id) ? current : [...current, message],
            )
            setBody('')
        } catch (sendError) {
            setError(sendError instanceof Error ? sendError.message : '메시지를 보내지 못했습니다.')
        } finally {
            setSubmitting(false)
        }
    }

    const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        void send()
    }

    const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
        if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return
        event.preventDefault()
        void send()
    }

    if (!consultationId) return null

    return (
        <section className={`proposal-chat-drawer ${open ? 'is-open' : ''}`}>
            <button
                type="button"
                className="proposal-chat-drawer-toggle"
                aria-expanded={open}
                onClick={() => setOpen((current) => !current)}
            >
                {open ? '상담 채팅 닫기' : '상담 채팅 열기'}
            </button>
            {open && (
                <div className="proposal-chat-drawer-panel" aria-label="상담 채팅 패널">
                    <header>
                        <strong>상담 채팅</strong>
                        <span>이전 대화를 보면서 제안서를 확인합니다.</span>
                    </header>
                    <div className="proposal-chat-message-list">
                        {messages.length > 0 ? messages.map((message) => {
                            const mine = message.senderId === currentUserId
                            return (
                                <div key={message.id} className={`proposal-chat-message ${mine ? 'is-mine' : 'is-theirs'}`}>
                                    <p>{message.body}</p>
                                    {message.attachmentUrls.map((url) => (
                                        <Link key={url} to={url} className="proposal-chat-attachment">
                                            {url.startsWith('/proposal/') ? '제안서 보기' : '첨부 보기'}
                                        </Link>
                                    ))}
                                    <time dateTime={message.createdAt}>{formatMessageTime(message.createdAt)}</time>
                                </div>
                            )
                        }) : (
                            <p className="proposal-chat-empty">아직 상담 메시지가 없습니다.</p>
                        )}
                    </div>
                    <form className="proposal-chat-form" onSubmit={handleSubmit}>
                        <textarea
                            aria-label="상담 메시지 입력"
                            value={body}
                            onChange={(event) => setBody(event.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="상담 메시지를 입력하세요."
                            rows={3}
                        />
                        <button type="submit" disabled={submitting || !body.trim()}>
                            보내기
                        </button>
                    </form>
                    {error && <p role="alert" className="proposal-chat-error">{error}</p>}
                </div>
            )}
        </section>
    )
}

function formatMessageTime(createdAt: string): string {
    const parsed = new Date(createdAt)
    if (Number.isNaN(parsed.getTime())) return ''
    return timeFormatter.format(parsed)
}
