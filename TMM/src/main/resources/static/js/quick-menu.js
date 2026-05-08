/* ===== 패널 토글 ===== */
function togglePanel(panelId) {
    const panel = document.getElementById(panelId);
    const isOpen = panel.classList.contains('open');
    document.querySelectorAll('.qm-panel').forEach(p => p.classList.remove('open'));
    if (!isOpen) panel.classList.add('open');
}

function closePanel(panelId) {
    document.getElementById(panelId).classList.remove('open');
}

document.addEventListener('click', function (e) {
    if (!e.target.closest('.quick-menu')) {
        document.querySelectorAll('.qm-panel').forEach(p => p.classList.remove('open'));
    }
});

/* ===== 헤더 바로 아래 위치 자동 설정 ===== */
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

/* ===== 최근 본 상품 (최대 5개) ===== */
const recentItems = [];

function renderRecentPanel() {
    const body = document.getElementById('recentPanelBody');
    const empty = document.getElementById('recentEmpty');
    const count = document.getElementById('recentCount');
    if (!body) return;
    count.textContent = recentItems.length;
    body.querySelectorAll('.qm-panel-item').forEach(el => el.remove());
    if (recentItems.length === 0) {
        empty.style.display = 'block';
    } else {
        empty.style.display = 'none';
        recentItems.forEach(item => {
            const el = document.createElement('div');
            el.className = 'qm-panel-item';
            el.onclick = () => location.href = '/';
            const thumb = item.imageUrl
                ? `<img src="${item.imageUrl}" alt="${item.title}">`
                : '';
            el.innerHTML = `
                <div class="qm-panel-thumb">${thumb}</div>
                <div class="qm-panel-info">
                    <p class="qm-panel-name">${item.title}</p>
                    <p class="qm-panel-price">${item.price}</p>
                </div>`;
            body.insertBefore(el, empty);
        });
    }
}

window.addRecentItem = function (title, price, imageUrl) {
    const idx = recentItems.findIndex(i => i.title === title);
    if (idx !== -1) recentItems.splice(idx, 1);
    recentItems.unshift({ title, price, imageUrl: imageUrl ?? null });
    if (recentItems.length > 5) recentItems.pop();
    renderRecentPanel();
};
