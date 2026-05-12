let salesCache = [];
let currentFilter = 'all';
let salesLoaded = false;

/* ===== 탭 전환 ===== */
function switchListTab(tab, btn) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.querySelectorAll('.tab-content').forEach(c => c.style.display = 'none');
    document.getElementById('tab-' + tab).style.display = 'block';

    if (tab === 'wish')  loadWishList();
    if (tab === 'sales') loadSalesList();
    if (tab === 'buy')   loadBuyList();
}

/* ===== 판매목록 서브 필터 ===== */
function filterSales(status, btn) {
    currentFilter = status;
    document.querySelectorAll('.sub-tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderSalesList(salesCache);
}

function renderSalesList(items) {
    const list    = document.getElementById('salesList');
    const empty   = document.getElementById('salesEmpty');
    const loading = document.getElementById('salesLoading');

    loading.style.display = 'none';
    list.innerHTML = '';

    const filtered = currentFilter === 'all'
        ? items
        : items.filter(p => p.status === currentFilter);

    if (!filtered.length) {
        empty.style.display = 'block';
        return;
    }
    empty.style.display = 'none';

    const badgeMap = { '판매중': 'on', '경매중': 'auction', '예약중': 'reserve', '판매완료': 'done' };
    filtered.forEach(p => {
        const price = p.type === 'auction'
            ? '현재가 ' + (p.currentPrice ?? 0).toLocaleString() + '원'
            : (p.price ?? 0).toLocaleString() + '원';
        const li = document.createElement('li');
        li.className = 'sales-item';
        li.style.cursor = 'pointer';
        li.onclick = () => location.href = '/product/' + p.id;
        li.innerHTML = `
            <div class="sales-thumb">${p.imageUrls?.[0] ? `<img src="${p.imageUrls[0]}" alt="">` : ''}</div>
            <div class="sales-info">
                <p class="sales-name">${p.title}</p>
                <p class="sales-price">${price}</p>
                <p class="sales-date">${(p.date ?? '').slice(0, 10)}</p>
            </div>
            <span class="badge badge-${badgeMap[p.status] || 'done'}">${p.status}</span>`;
        list.appendChild(li);
    });
}

/* ===== 판매목록 로드 ===== */
function loadSalesList() {
    if (salesLoaded) { renderSalesList(salesCache); return; }

    const list    = document.getElementById('salesList');
    const empty   = document.getElementById('salesEmpty');
    const loading = document.getElementById('salesLoading');

    if (!window.db || !window.auth?.currentUser) {
        loading.style.display = 'none';
        empty.textContent = '로그인이 필요합니다.';
        empty.style.display = 'block';
        return;
    }

    loading.style.display = 'block';
    empty.style.display = 'none';
    list.innerHTML = '';

    const uid = window.auth.currentUser.uid;
    window.fs.getDocs(
        window.fs.query(
            window.fs.collection(window.db, 'products'),
            window.fs.where('sellerUid', '==', uid),
            window.fs.orderBy('date', 'desc')
        )
    ).then(snap => {
        salesCache = snap.docs.map(d => d.data());
        salesLoaded = true;
        renderSalesList(salesCache);
    }).catch(() => {
        /* orderBy 인덱스 없을 경우 정렬 없이 재시도 */
        window.fs.getDocs(
            window.fs.query(
                window.fs.collection(window.db, 'products'),
                window.fs.where('sellerUid', '==', uid)
            )
        ).then(snap => {
            salesCache = snap.docs.map(d => d.data())
                .sort((a, b) => (b.date ?? '') > (a.date ?? '') ? 1 : -1);
            salesLoaded = true;
            renderSalesList(salesCache);
        }).catch(() => {
            loading.style.display = 'none';
            empty.textContent = '불러오기 실패. 다시 시도해 주세요.';
            empty.style.display = 'block';
        });
    });
}

/* ===== 찜 목록 로드 ===== */
function loadWishList() {
    const grid    = document.getElementById('wishList');
    const empty   = document.getElementById('wishEmpty');
    const loading = document.getElementById('wishLoading');

    if (!window.db || !window.auth?.currentUser) {
        loading.style.display = 'none';
        grid.innerHTML = '';
        empty.textContent = '로그인이 필요합니다.';
        empty.style.display = 'block';
        return;
    }

    loading.style.display = 'block';
    empty.style.display = 'none';
    grid.innerHTML = '';

    const uid = window.auth.currentUser.uid;
    window.fs.getDocs(
        window.fs.query(
            window.fs.collection(window.db, 'products'),
            window.fs.where('wishers', 'array-contains', uid)
        )
    ).then(snap => {
        loading.style.display = 'none';
        if (snap.empty) { empty.style.display = 'block'; return; }

        snap.docs.forEach(doc => {
            const p = doc.data();
            const price = p.type === 'auction'
                ? '현재가 ' + (p.currentPrice ?? 0).toLocaleString()
                : (p.price ?? 0).toLocaleString();
            const card = document.createElement('div');
            card.className = 'product-card';
            card.onclick = () => location.href = '/product/' + p.id;
            card.innerHTML = `
                <div class="product-image">
                    ${p.imageUrls?.[0] ? `<img src="${p.imageUrls[0]}" alt="">` : '<span>📷</span>'}
                </div>
                <div class="product-info">
                    <h3 class="product-title">${p.title}</h3>
                    <div class="product-details">
                        <span class="product-price">${price}</span>
                        <span class="product-date">${(p.date ?? '').slice(0, 10)}</span>
                    </div>
                </div>`;
            grid.appendChild(card);
        });
    }).catch(() => {
        loading.style.display = 'none';
        empty.textContent = '불러오기 실패. 다시 시도해 주세요.';
        empty.style.display = 'block';
    });
}

/* ===== 구매내역 로드 ===== */
function loadBuyList() {
    const list    = document.getElementById('buyList');
    const empty   = document.getElementById('buyEmpty');
    const loading = document.getElementById('buyLoading');

    if (!window.db || !window.auth?.currentUser) {
        loading.style.display = 'none';
        empty.textContent = '로그인이 필요합니다.';
        empty.style.display = 'block';
        return;
    }

    loading.style.display = 'block';
    empty.style.display = 'none';
    list.innerHTML = '';

    const uid = window.auth.currentUser.uid;
    window.fs.getDocs(
        window.fs.query(
            window.fs.collection(window.db, 'products'),
            window.fs.where('buyerUid', '==', uid)
        )
    ).then(snap => {
        loading.style.display = 'none';
        if (snap.empty) { empty.style.display = 'block'; return; }

        snap.docs.forEach(doc => {
            const p = doc.data();
            const price = ((p.price ?? p.currentPrice ?? 0)).toLocaleString() + '원';
            const li = document.createElement('li');
            li.className = 'sales-item';
            li.style.cursor = 'pointer';
            li.onclick = () => location.href = '/product/' + p.id;
            li.innerHTML = `
                <div class="sales-thumb">${p.imageUrls?.[0] ? `<img src="${p.imageUrls[0]}" alt="">` : ''}</div>
                <div class="sales-info">
                    <p class="sales-name">${p.title}</p>
                    <p class="sales-price">${price}</p>
                    <p class="sales-date">${(p.date ?? '').slice(0, 10)}</p>
                </div>
                <span class="badge badge-done">구매완료</span>`;
            list.appendChild(li);
        });
    }).catch(() => {
        loading.style.display = 'none';
        empty.textContent = '불러오기 실패. 다시 시도해 주세요.';
        empty.style.display = 'block';
    });
}

/* ===== 인증 가드 ===== */
function checkMyListAuth() {
    const user    = window.auth?.currentUser;
    const guard   = document.getElementById('mylistAuthGuard');
    const content = document.getElementById('mylistContent');
    if (!guard || !content) return;
    if (user) {
        guard.style.display   = 'none';
        content.style.display = 'block';
        loadWishList();
    } else {
        guard.style.display   = 'flex';
        content.style.display = 'none';
    }
}
window.addEventListener('firebase-ready', checkMyListAuth);
if (window.firebaseReady) checkMyListAuth();
