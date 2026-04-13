/**
 * AIConnect - Main Application Logic
 * Implements Web Components for Expert Cards and Category Selection.
 */

// 1. Expert Card Web Component
class ExpertCard extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
    }

    connectedCallback() {
        this.render();
    }

    render() {
        const name = this.getAttribute('name') || '전문가';
        const profession = this.getAttribute('profession') || '분야';
        const rating = parseFloat(this.getAttribute('rating')) || 0;
        const price = this.getAttribute('price') || '0';
        const image = this.getAttribute('image') || '';
        
        this.shadowRoot.innerHTML = `
            <style>
                :host { display: block; cursor: pointer; }
                .card { 
                    background: white; 
                    border: 1px solid #e2e8f0; 
                    border-radius: 24px; 
                    overflow: hidden; 
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); 
                    height: 100%; 
                    display: flex; 
                    flex-direction: column; 
                    box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);
                }
                .card:hover { 
                    transform: translateY(-10px); 
                    box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04); 
                    border-color: #2563eb; 
                }
                .img-container {
                    width: 100%;
                    padding-top: 65%;
                    position: relative;
                    background: #f1f5f9;
                    overflow: hidden;
                }
                .img { 
                    position: absolute;
                    top: 0;
                    left: 0;
                    width: 100%; 
                    height: 100%; 
                    object-fit: cover; 
                    transition: transform 0.5s ease;
                }
                .card:hover .img { transform: scale(1.1); }
                .content { padding: 1.75rem; flex: 1; display: flex; flex-direction: column; }
                .prof { 
                    font-size: 0.8rem; 
                    color: #2563eb; 
                    font-weight: 800; 
                    text-transform: uppercase; 
                    margin-bottom: 0.75rem; 
                    letter-spacing: 0.05em;
                }
                .name { 
                    font-size: 1.25rem; 
                    font-weight: 800; 
                    color: #0f172a; 
                    margin: 0 0 0.75rem 0; 
                    line-height: 1.3; 
                }
                .rating-row { 
                    display: flex; 
                    align-items: center; 
                    gap: 0.4rem; 
                    font-size: 1rem; 
                    font-weight: 700; 
                    color: #0f172a; 
                    margin-bottom: 1.5rem; 
                }
                .star { color: #fbbf24; font-size: 1.1rem; }
                .price-row { 
                    margin-top: auto; 
                    padding-top: 1.25rem; 
                    border-top: 1px solid #f1f5f9; 
                    display: flex; 
                    justify-content: space-between; 
                    align-items: center; 
                }
                .price-label { font-size: 0.85rem; color: #64748b; font-weight: 500; }
                .price-value { font-size: 1.25rem; font-weight: 900; color: #0f172a; }
            </style>
            <div class="card" onclick="window.location.href='expert.html'">
                <div class="img-container">
                    <img src="${image}" class="img" loading="lazy">
                </div>
                <div class="content">
                    <div class="prof">${profession}</div>
                    <div class="name">${name}</div>
                    <div class="rating-row">
                        <span class="star">★</span> ${rating.toFixed(1)}
                    </div>
                    <div class="price-row">
                        <span class="price-label">기본 금액</span>
                        <span class="price-value">${Number(price).toLocaleString()}원~</span>
                    </div>
                </div>
            </div>
        `;
    }
}
customElements.define('expert-card', ExpertCard);

// 2. Category Selector Web Component (Multi-select)
class CategorySelector extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this.categories = [
            'IT·프로그래밍', '디자인', '마케팅', '영상·미디어', 
            '번역·통역', '문서·글쓰기', '레슨·과외', '비즈니스 컨설팅'
        ];
        this.selected = new Set();
    }

    connectedCallback() {
        this.render();
    }

    toggleCategory(cat) {
        if (this.selected.has(cat)) {
            this.selected.delete(cat);
        } else {
            this.selected.add(cat);
        }
        this.render();
        // Dispatch event for form integration
        this.dispatchEvent(new CustomEvent('change', { 
            detail: { selected: Array.from(this.selected) },
            bubbles: true,
            composed: true
        }));
    }

    render() {
        this.shadowRoot.innerHTML = `
            <style>
                :host { display: block; width: 100%; }
                .container { display: flex; flex-wrap: wrap; gap: 0.75rem; }
                .chip {
                    padding: 0.6rem 1.2rem;
                    border-radius: 99px;
                    background: #f1f5f9;
                    border: 1px solid #e2e8f0;
                    color: #475569;
                    font-size: 0.9rem;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
                    user-select: none;
                }
                .chip:hover {
                    border-color: #2563eb;
                    color: #2563eb;
                    background: #eff6ff;
                }
                .chip.active {
                    background: #2563eb;
                    border-color: #2563eb;
                    color: white;
                    box-shadow: 0 4px 12px rgba(37, 99, 235, 0.2);
                }
            </style>
            <div class="container">
                ${this.categories.map(cat => `
                    <div class="chip ${this.selected.has(cat) ? 'active' : ''}" 
                         onclick="this.getRootNode().host.toggleCategory('${cat}')">
                        ${cat}
                    </div>
                `).join('')}
            </div>
        `;
    }
}
customElements.define('category-selector', CategorySelector);

// 3. Mock Data
const EXPERTS = [
    { name: "김디자인 전문가", prof: "UI/UX 디자이너", rate: 4.9, price: 150000, img: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=600" },
    { name: "이코딩 전문가", prof: "프론트엔드 개발자", rate: 4.8, price: 300000, img: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=600" },
    { name: "박마켓 전문가", prof: "퍼포먼스 마케터", rate: 5.0, price: 100000, img: "https://images.unsplash.com/photo-1556910103-1c02745aae4d?w=600" },
    { name: "최편집 전문가", prof: "영상 편집자", rate: 4.7, price: 80000, img: "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=600" },
    { name: "정개발 전문가", prof: "백엔드 개발자", rate: 4.9, price: 500000, img: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=600" },
    { name: "한로고 전문가", prof: "로고 디자이너", rate: 4.6, price: 50000, img: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=600" }
];

// 4. Initialization
document.addEventListener('DOMContentLoaded', () => {
    // Populate Main Page Grid
    const mainGrid = document.getElementById('expert-grid');
    if (mainGrid) {
        EXPERTS.slice(0, 3).forEach(e => {
            const el = document.createElement('expert-card');
            el.setAttribute('name', e.name);
            el.setAttribute('profession', e.prof);
            el.setAttribute('rating', e.rate);
            el.setAttribute('price', e.price);
            el.setAttribute('image', e.img);
            mainGrid.appendChild(el);
        });
    }

    // Populate Category Page Grid
    const categoryGrid = document.getElementById('category-expert-grid');
    if (categoryGrid) {
        EXPERTS.forEach(e => {
            const el = document.createElement('expert-card');
            el.setAttribute('name', e.name);
            el.setAttribute('profession', e.prof);
            el.setAttribute('rating', e.rate);
            el.setAttribute('price', e.price);
            el.setAttribute('image', e.img);
            categoryGrid.appendChild(el);
        });
    }

    // Handle Category Card Clicks in index.html
    const categoryCards = document.querySelectorAll('.category-card');
    categoryCards.forEach(card => {
        card.addEventListener('click', () => {
            window.location.href = 'category.html';
        });
    });

    // --- Chat System Implementation ---
    const chatWindow = document.getElementById('chat-window');
    const btnInquiry = document.getElementById('btn-inquiry');
    const btnChatClose = document.getElementById('btn-chat-close');
    const btnChatSend = document.getElementById('btn-chat-send');
    const chatInput = document.getElementById('chat-input');
    const chatMessages = document.getElementById('chat-messages');

    if (btnInquiry && chatWindow) {
        // Open Chat
        btnInquiry.addEventListener('click', () => {
            chatWindow.classList.remove('hidden');
            chatInput.focus();

            // Initial Expert Message if empty
            if (chatMessages.children.length === 1) {
                setTimeout(() => {
                    addMessage('expert', '안녕하세요! 무엇을 도와드릴까요? 원하시는 프로젝트에 대해 말씀해 주시면 자세히 안내해 드리겠습니다.');
                }, 800);
            }
        });

        // Close Chat
        btnChatClose.addEventListener('click', () => {
            chatWindow.classList.add('hidden');
        });

        // Send Message
        const sendMessage = () => {
            const text = chatInput.value.trim();
            if (text) {
                addMessage('user', text);
                chatInput.value = '';

                // Simulate Expert Reply
                simulateReply(text);
            }
        };

        btnChatSend.addEventListener('click', sendMessage);
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') sendMessage();
        });

        // Add Message to UI
        function addMessage(type, text) {
            const msgDiv = document.createElement('div');
            msgDiv.className = `message ${type}`;
            msgDiv.textContent = text;
            chatMessages.appendChild(msgDiv);

            // Scroll to bottom
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }

        // Simulate Expert Reply Logic
        function simulateReply(userText) {
            setTimeout(() => {
                let reply = '상세한 내용을 확인했습니다. 잠시만 기다려 주시면 검토 후 답변 드리겠습니다.';

                if (userText.includes('가격') || userText.includes('얼마')) {
                    reply = '가격은 프로젝트의 규모와 복잡도에 따라 달라질 수 있습니다. Standard 패키지 외에도 맞춤 견적 가능하니 참고해 주세요!';
                } else if (userText.includes('기간') || userText.includes('언제')) {
                    reply = '보통 Standard 기준 3일 정도 소요되지만, 급하신 건이라면 일정을 최대한 맞춰드릴 수 있습니다.';
                } else if (userText.includes('포트폴리오')) {
                    reply = '현재 페이지에 게시된 포트폴리오 외에도 유사한 성격의 다양한 작업물이 있습니다. 원하시면 링크를 보내드릴게요!';
                }

                addMessage('expert', reply);
            }, 1000 + Math.random() * 1000);
        }
    }
});
