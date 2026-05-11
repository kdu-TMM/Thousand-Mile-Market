const productId = parseInt(location.pathname.split('/').pop());
let allProducts = [];
let currentProduct = null;
let wished = false;
let slideIndex = 0;
let slideUrls = [];

/* Firebase 연동 전 임시 로컬 이미지 (imageUrls가 있으면 자동으로 대체됨) */
const localImageMap = {
    1: ['/images/popular/popular-1.jpg'],
    2: ['/images/popular/popular-2.jpg'],
    3: ['/images/popular/popular-3.jpg'],
    4: ['/images/popular/popular-4.jpg'],
};

function loadProduct() {
    /* 단일 상품 조회 + 전체 상품(비슷한 상품용) 병렬 로드 */
    Promise.all([
        window.fs.getDoc(window.fs.doc(window.db, 'products', String(productId))),
        window.fs.getDocs(window.fs.collection(window.db, 'products'))
    ])
    .then(([docSnap, snapshot]) => {
        if (!docSnap.exists()) {
            document.getElementById('pdError').style.display = 'flex';
            return;
        }
        allProducts    = snapshot.docs.map(d => d.data());
        currentProduct = docSnap.data();
        renderProduct(currentProduct);
        renderSimilar(currentProduct);
        const priceStr = currentProduct.type === 'auction'
            ? currentProduct.currentPrice.toLocaleString() + '원'
            : currentProduct.price.toLocaleString() + '원';
        window.addRecentItem && window.addRecentItem(
            currentProduct.title,
            priceStr,
            currentProduct.imageUrls?.[0] ?? null
        );
    })
    .catch(() => {
        /* Firestore 실패 시 products.json 폴백 */
        fetch('/data/products.json')
            .then(r => r.json())
            .then(data => {
                allProducts    = data;
                currentProduct = data.find(p => p.id === productId);
                if (!currentProduct) { document.getElementById('pdError').style.display = 'flex'; return; }
                renderProduct(currentProduct);
                renderSimilar(currentProduct);
            });
    });
}

if (window.db) loadProduct();
else window.addEventListener('firebase-ready', loadProduct);

/* ===== 이미지 갤러리 ===== */
function renderGallery(imageUrls, alt) {
    const wrap = document.getElementById('pdImgMain');
    const dotsEl = document.getElementById('pdDots');
    slideUrls = imageUrls ?? [];

    if (slideUrls.length > 0) {
        wrap.innerHTML = `<img src="${slideUrls[0]}" alt="${alt}" class="pd-gallery-img">`;
        dotsEl.innerHTML = slideUrls
            .map((_, i) => `<span class="pd-dot${i === 0 ? ' active' : ''}" onclick="setSlide(${i})"></span>`)
            .join('');
    } else {
        wrap.innerHTML = `<div class="img-placeholder"><span>📷</span><p>사진 없음</p></div>`;
        dotsEl.innerHTML = '';
    }
}

function setSlide(idx) {
    if (!slideUrls[idx]) return;
    slideIndex = idx;
    document.getElementById('pdImgMain').innerHTML =
        `<img src="${slideUrls[idx]}" alt="" class="pd-gallery-img">`;
    document.querySelectorAll('.pd-dot').forEach((d, i) =>
        d.classList.toggle('active', i === idx)
    );
}

/* ===== 상품 렌더링 ===== */
function renderProduct(p) {
    document.title = p.title + ' - 천리마켓';
    document.getElementById('pdCatLabel').textContent = p.category;
    document.getElementById('pdTitleShort').textContent =
        p.title.length > 20 ? p.title.slice(0, 20) + '…' : p.title;
    document.getElementById('pdTitle').textContent = p.title;

    const badge = document.getElementById('pdStatusBadge');
    const badgeMap = { '판매중': 'on', '예약중': 'reserved', '경매중': 'auction', '판매완료': 'done' };
    badge.textContent = p.status;
    badge.className = 'pd-status-badge ' + (badgeMap[p.status] || 'done');

    if (p.type === 'auction') {
        document.getElementById('pdPrice').textContent = p.currentPrice.toLocaleString();
        document.getElementById('pdBidArea').style.display = 'block';
        document.getElementById('pdStartPrice').textContent = p.startPrice.toLocaleString() + '원';
        document.getElementById('pdCurrentPrice').textContent = p.currentPrice.toLocaleString() + '원';
        document.getElementById('pdBidCount').textContent = p.bidCount + '명';
        startAuctionTimer(p.auctionEnd);
        const buyBtn = document.getElementById('pdBuyBtn');
        buyBtn.textContent = '입찰하기';
        buyBtn.className = 'pd-btn-bid';
    } else {
        document.getElementById('pdPrice').textContent = p.price.toLocaleString();
    }

    document.getElementById('pdWishes').textContent = p.wishes;
    document.getElementById('pdWishCount').textContent = p.wishes;
    document.getElementById('pdViews').textContent = p.views;
    document.getElementById('pdDateLabel').textContent = relativeDate(p.date);
    document.getElementById('pdCondition').textContent = p.condition || '정보 없음';
    document.getElementById('pdRegion').textContent = p.region;
    document.getElementById('pdDescription').textContent = p.description || '';

    const images = p.imageUrls?.length ? p.imageUrls : (localImageMap[p.id] ?? []);
    renderGallery(images, p.title);
    document.getElementById('pdLayout').style.display = 'grid';
}

function relativeDate(dateStr) {
    const diff = Math.floor((Date.now() - new Date(dateStr)) / 86400000);
    if (diff === 0) return '오늘';
    if (diff === 1) return '1일 전';
    return diff + '일 전';
}

function startAuctionTimer(endStr) {
    const el = document.getElementById('pdAuctionTimer');
    function tick() {
        const sec = Math.max(0, Math.floor((new Date(endStr) - Date.now()) / 1000));
        if (sec === 0) { el.textContent = '경매 종료'; return; }
        const h = Math.floor(sec / 3600);
        const m = Math.floor((sec % 3600) / 60);
        const s = sec % 60;
        el.textContent =
            `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
        setTimeout(tick, 1000);
    }
    tick();
}

function toggleWish() {
    wished = !wished;
    const btn = document.getElementById('pdWishBtn');
    const cnt = parseInt(document.getElementById('pdWishCount').textContent);
    document.getElementById('pdWishCount').textContent = wished ? cnt + 1 : cnt - 1;
    btn.classList.toggle('active', wished);
}

/* ===== 비슷한 상품 ===== */
function renderSimilar(p) {
    const similar = allProducts.filter(x => x.id !== p.id && x.category === p.category);
    if (similar.length === 0) return;

    const grid = document.getElementById('pdSimilarGrid');
    document.getElementById('pdSimilarPage').textContent = `1/${Math.ceil(similar.length / 5)}`;

    similar.forEach(s => {
        const card = document.createElement('div');
        card.className = 'pd-sim-card';
        const price = s.type === 'auction' ? s.currentPrice : s.price;
        const thumb = s.imageUrls?.[0]
            ? `<img src="${s.imageUrls[0]}" alt="${s.title}" class="pd-sim-img-el">`
            : `<div class="img-placeholder sm"><span>📷</span></div>`;
        card.innerHTML = `
            <div class="pd-sim-img">${thumb}</div>
            <p class="pd-sim-title">${s.title}</p>
            <p class="pd-sim-price">${price.toLocaleString()}원</p>`;
        card.onclick = () => location.href = '/product/' + s.id;
        grid.appendChild(card);
    });

    document.getElementById('pdSimilar').style.display = 'block';
}

function scrollSimilar(dir) {
    document.getElementById('pdSimilarGrid').scrollBy({ left: dir * 800, behavior: 'smooth' });
}
