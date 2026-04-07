/**
 * AIConnect - Main Application Logic
 * Implements a Web Component for Expert Cards and handles dynamic listing.
 */

// 1. Define the Web Component
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
                .card { background: white; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; transition: 0.2s; height: 100%; display: flex; flex-direction: column; }
                .card:hover { transform: translateY(-4px); box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1); border-color: #2563eb; }
                .img { width: 100%; height: 200px; object-fit: cover; }
                .content { padding: 1.25rem; flex: 1; display: flex; flex-direction: column; }
                .prof { font-size: 0.75rem; color: #2563eb; font-weight: 700; text-transform: uppercase; margin-bottom: 0.5rem; }
                .name { font-size: 1.1rem; font-weight: 800; color: #0f172a; margin: 0 0 0.5rem 0; line-height: 1.4; }
                .rating-row { display: flex; align-items: center; gap: 0.25rem; font-size: 0.9rem; font-weight: 600; color: #0f172a; margin-bottom: 1rem; }
                .star { color: #fbbf24; }
                .price-row { margin-top: auto; padding-top: 1rem; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; }
                .price-label { font-size: 0.75rem; color: #64748b; }
                .price-value { font-size: 1.1rem; font-weight: 800; color: #0f172a; }
            </style>
            <div class="card" onclick="window.location.href='expert.html'">
                <img src="${image}" class="img" loading="lazy">
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

// 2. Mock Data
const EXPERTS = [
    { name: "김디자인 전문가", prof: "UI/UX 디자이너", rate: 4.9, price: 150000, img: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=400" },
    { name: "이코딩 전문가", prof: "프론트엔드 개발자", rate: 4.8, price: 300000, img: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=400" },
    { name: "박마켓 전문가", prof: "퍼포먼스 마케터", rate: 5.0, price: 100000, img: "https://images.unsplash.com/photo-1556910103-1c02745aae4d?w=400" },
    { name: "최편집 전문가", prof: "영상 편집자", rate: 4.7, price: 80000, img: "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=400" },
    { name: "정개발 전문가", prof: "백엔드 개발자", rate: 4.9, price: 500000, img: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400" },
    { name: "한로고 전문가", prof: "로고 디자이너", rate: 4.6, price: 50000, img: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400" }
];

// 3. Initialization
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
});
