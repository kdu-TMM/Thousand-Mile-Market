function loadWishList() {
    const loading = document.getElementById('wlLoading');
    const guard   = document.getElementById('wlAuthGuard');
    const content = document.getElementById('wlContent');
    const grid    = document.getElementById('wlGrid');
    const empty   = document.getElementById('wlEmpty');

    if (!window.db || !window.auth?.currentUser) {
        loading.style.display = 'none';
        guard.style.display   = 'flex';
        return;
    }

    const uid = window.auth.currentUser.uid;
    loading.style.display = 'block';
    guard.style.display   = 'none';
    content.style.display = 'none';

    window.fs.getDocs(window.fs.query(
        window.fs.collection(window.db, 'products'),
        window.fs.where('wishers', 'array-contains', uid)
    )).then(snap => {
        loading.style.display = 'none';
        content.style.display = 'block';
        grid.innerHTML = '';

        if (!snap.size) {
            empty.style.display = 'block';
            return;
        }
        empty.style.display = 'none';

        snap.docs.forEach(d => {
            const p = d.data();
            if (p.status === '숨김' || p.status === '삭제') return;
            renderWishCard(grid, p, uid);
        });
    }).catch(() => {
        loading.style.display = 'none';
        guard.innerHTML = '<p style="color:#e53935;text-align:center;padding:60px 0;">불러오기에 실패했습니다.</p>';
        guard.style.display = 'block';
    });
}

function renderWishCard(grid, p, uid) {
    const price = p.type === 'auction'
        ? (p.currentPrice ?? 0).toLocaleString() + '원'
        : (p.price ?? 0).toLocaleString() + '원';
    const priceLabel = p.type === 'auction' ? '현재가 ' : '';

    const thumb = p.imageUrls?.[0]
        ? `<img src="${p.imageUrls[0]}" alt="${p.title}" loading="lazy">`
        : `<div class="wl-no-img">📷</div>`;

    const statusMap = { '판매중': 'on', '예약중': 'reserved', '경매중': 'auction', '판매완료': 'done' };
    const statusBadge = p.status
        ? `<span class="wl-status ${statusMap[p.status] || ''}">${p.status}</span>` : '';

    const card = document.createElement('div');
    card.className = 'product-card wl-card';
    card.innerHTML = `
        <div class="wl-thumb">${thumb}${statusBadge}</div>
        <div class="wl-info">
            <p class="wl-title">${p.title}</p>
            <p class="wl-price">${priceLabel}${price}</p>
            <p class="wl-region">${p.region || ''}</p>
        </div>
        <button class="wl-unwish-btn" title="찜 해제" onclick="event.stopPropagation();unwish('${p.id}', this)">♥</button>`;
    card.onclick = () => location.href = '/product/' + p.id;
    grid.appendChild(card);
}

async function unwish(productId, btn) {
    if (!window.db || !window.auth?.currentUser) return;
    const uid = window.auth.currentUser.uid;
    btn.disabled = true;

    try {
        const ref  = window.fs.doc(window.db, 'products', String(productId));
        const snap = await window.fs.getDoc(ref);
        if (!snap.exists()) { btn.closest('.product-card')?.remove(); return; }

        const data    = snap.data();
        const wishers = (data.wishers || []).filter(u => u !== uid);
        await window.fs.updateDoc(ref, { wishers, wishes: Math.max(0, wishers.length) });

        const card = btn.closest('.product-card');
        card?.classList.add('wl-removing');
        setTimeout(() => {
            card?.remove();
            const grid = document.getElementById('wlGrid');
            if (grid && !grid.children.length) {
                document.getElementById('wlEmpty').style.display = 'block';
            }
        }, 250);
    } catch (e) {
        btn.disabled = false;
        alert('오류: ' + e.message);
    }
}

let _wlInitDone = false;
function initWishList(e) {
    const user = e?.detail?.user ?? window.auth?.currentUser;
    if (!user || _wlInitDone) return;
    _wlInitDone = true;
    loadWishList();
}

window.addEventListener('firebase-ready', initWishList);
window.addEventListener('auth-changed', (e) => {
    if (!window.auth?.currentUser) { loadWishList(); return; }
    initWishList(e);
});
if (window.firebaseReady) initWishList();
