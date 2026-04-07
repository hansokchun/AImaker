class ExpertCard extends HTMLElement {
    constructor() { super(); this.attachShadow({ mode: 'open' }); }
    connectedCallback() { this.render(); }
    render() {
        const name = this.getAttribute('name') || '전문가';
        const profession = this.getAttribute('profession') || '분야';
        const rating = this.getAttribute('rating') || '0';
        const price = this.getAttribute('price') || '0';
        const image = this.getAttribute('image') || '';
        this.shadowRoot.innerHTML = `
            <style>
                .card { background: white; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; transition: 0.2s; cursor: pointer; }
                .card:hover { transform: translateY(-4px); box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1); }
                .img { width: 100%; height: 180px; object-fit: cover; }
                .content { padding: 1.25rem; }
                .prof { font-size: 0.75rem; color: #64748b; font-weight: 600; }
                .name { font-size: 1.1rem; font-weight: 700; margin: 0.25rem 0; }
                .rating { color: #fbbf24; font-weight: 600; }
                .price { margin-top: 1rem; font-weight: 700; border-top: 1px solid #e2e8f0; padding-top: 0.75rem; }
            </style>
            <div class="card">
                <img src="${image}" class="img">
                <div class="content">
                    <div class="prof">${profession}</div>
                    <div class="name">${name}</div>
                    <div class="rating">★ ${rating}</div>
                    <div class="price">${Number(price).toLocaleString()}원~</div>
                </div>
            </div>
        `;
    }
}
customElements.define('expert-card', ExpertCard);

const EXPERTS = [
    { name: "김디자인", prof: "UI/UX 디자이너", rate: "4.9", price: "150000", img: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=400" },
    { name: "이코딩", prof: "웹 개발자", rate: "4.8", price: "300000", img: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=400" },
    { name: "박마켓", prof: "마케터", rate: "5.0", price: "100000", img: "https://images.unsplash.com/photo-1556910103-1c02745aae4d?w=400" }
];

document.addEventListener('DOMContentLoaded', () => {
    const grid = document.getElementById('expert-grid');
    EXPERTS.forEach(e => {
        const el = document.createElement('expert-card');
        el.setAttribute('name', e.name);
        el.setAttribute('profession', e.prof);
        el.setAttribute('rating', e.rate);
        el.setAttribute('price', e.price);
        el.setAttribute('image', e.img);
        grid.appendChild(el);
    });
});
