/* ===== 위치 자동 설정 ===== */
function positionQuickMenu() {
    const header = document.querySelector('.header');
    const qm = document.querySelector('.quick-menu');
    if (header && qm) qm.style.top = (header.offsetHeight + 8) + 'px';
}
document.addEventListener('DOMContentLoaded', positionQuickMenu);
window.addEventListener('resize', positionQuickMenu);

/* ===== TOP 버튼 ===== */
window.addEventListener('scroll', () => {
    const btn = document.getElementById('btnTop');
    if (btn) btn.classList.toggle('visible', window.scrollY > 200);
});

/* ===== 최근 본 상품 (sessionStorage, 최대 5개) ===== */
const RECENT_KEY = 'tmm_recent';

function getRecentItems() {
    try { return JSON.parse(sessionStorage.getItem(RECENT_KEY)) || []; }
    catch { return []; }
}

function saveRecentItems(items) {
    sessionStorage.setItem(RECENT_KEY, JSON.stringify(items));
}

function renderRecentThumbs() {
    const list = document.getElementById('qmThumbList');
    if (!list) return;
    const items = getRecentItems();
    list.innerHTML = '';
    items.forEach(item => {
        const a = document.createElement('a');
        a.href = '/product/' + item.id;
        a.className = 'qm-thumb-item';
        a.title = item.title;
        if (item.imageUrl) {
            const img = document.createElement('img');
            img.src = item.imageUrl;
            img.alt = item.title;
            img.onload = () => img.classList.add('loaded');
            if (img.complete) img.classList.add('loaded');
            a.appendChild(img);
        } else {
            a.innerHTML = '<div class="qm-thumb-no-img">📷</div>';
        }
        list.appendChild(a);
    });
}

window.addRecentItem = function(id, title, price, imageUrl) {
    const items = getRecentItems();
    const idx = items.findIndex(i => String(i.id) === String(id));
    if (idx !== -1) items.splice(idx, 1);
    items.unshift({ id: String(id), title, price, imageUrl: imageUrl ?? null });
    if (items.length > 5) items.pop();
    saveRecentItems(items);
    renderRecentThumbs();
};

document.addEventListener('DOMContentLoaded', renderRecentThumbs);
