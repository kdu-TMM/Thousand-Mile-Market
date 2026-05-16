const productId = parseInt(location.pathname.split('/').pop());
let allProducts = [];
let currentProduct = null;
let wished = false;
let slideIndex = 0;
let slideUrls = [];

const localImageMap = {
    1: ['/images/popular/popular-1.jpg'],
    2: ['/images/popular/popular-2.jpg'],
    3: ['/images/popular/popular-3.jpg'],
    4: ['/images/popular/popular-4.jpg'],
};

function loadProduct() {
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
    const wrap   = document.getElementById('pdImgMain');
    const dotsEl = document.getElementById('pdDots');
    const leftBtn  = document.getElementById('left-btn');
    const rightBtn = document.getElementById('right-btn');
    slideUrls  = imageUrls ?? [];
    slideIndex = 0;

    if (slideUrls.length > 0) {
        wrap.innerHTML = `<img src="${slideUrls[0]}" alt="${alt}">`;
        dotsEl.innerHTML = slideUrls.length > 1
            ? slideUrls.map((_, i) =>
                `<span class="pd-dot${i === 0 ? ' active' : ''}" onclick="setSlide(${i})"></span>`
              ).join('')
            : '';
    } else {
        wrap.innerHTML = `<div class="img-placeholder"><span>📷</span><p>사진 없음</p></div>`;
        dotsEl.innerHTML = '';
    }

    const showArrows = slideUrls.length > 1;
    if (leftBtn)  leftBtn.style.display  = showArrows ? '' : 'none';
    if (rightBtn) rightBtn.style.display = showArrows ? '' : 'none';
}

function setSlide(idx) {
    if (!slideUrls[idx]) return;
    slideIndex = idx;
    document.getElementById('pdImgMain').innerHTML =
        `<img src="${slideUrls[idx]}" alt="">`;
    document.querySelectorAll('.pd-dot').forEach((d, i) =>
        d.classList.toggle('active', i === idx)
    );
}

function prevSlide() {
    setSlide((slideIndex - 1 + slideUrls.length) % slideUrls.length);
}

function nextSlide() {
    setSlide((slideIndex + 1) % slideUrls.length);
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
    badge.className   = 'pd-status-badge ' + (badgeMap[p.status] || 'done');

    const tradeEl = document.getElementById('pdTradeComplete');
    if (tradeEl) tradeEl.style.display = p.status === '판매완료' ? 'block' : 'none';

    if (p.type === 'auction') {
        document.getElementById('pdPrice').textContent = p.currentPrice.toLocaleString();
        document.getElementById('pdBidArea').style.display = 'block';
        document.getElementById('pdStartPrice').textContent   = p.startPrice.toLocaleString() + '원';
        document.getElementById('pdCurrentPrice').textContent = p.currentPrice.toLocaleString() + '원';
        document.getElementById('pdBidCount').textContent     = p.bidCount + '명';
        startAuctionTimer(p.auctionEnd);
        const buyBtn = document.getElementById('pdBuyBtn');
        buyBtn.textContent = '입찰하기';
        buyBtn.classList.add('auction');
    } else {
        document.getElementById('pdPrice').textContent = p.price.toLocaleString();
    }

    document.getElementById('pdWishes').textContent   = p.wishes;
    document.getElementById('pdWishCount').textContent = p.wishes;
    document.getElementById('pdViews').textContent    = p.views;
    document.getElementById('pdDateLabel').textContent = relativeDate(p.date);
    document.getElementById('pdCondition').textContent = p.condition || '정보 없음';
    document.getElementById('pdRegion').textContent    = p.region;
    document.getElementById('pdDescription').textContent = p.description || '';

    /* 판매자 정보 (데이터에 없으면 기본값) */
    const nickEl   = document.getElementById('pdSellerNickname');
    const regionEl = document.getElementById('pdSellerRegion');
    const ratingEl = document.getElementById('pdRating');
    if (nickEl)   nickEl.textContent   = p.sellerNickname || '판매자';
    if (regionEl) regionEl.textContent = p.sellerRegion   || p.region || '';
    if (ratingEl) ratingEl.textContent = p.sellerRating != null ? p.sellerRating.toFixed(1) : '0.0';

    const images = p.imageUrls?.length ? p.imageUrls : (localImageMap[p.id] ?? []);
    renderGallery(images, p.title);

    document.getElementById('item-detail').style.display = 'block';
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
        if (sec <= 600) {
            el.textContent = '10분 미만';
        } else if (sec <= 3600) {
            el.textContent = `${Math.floor(sec / 60)}분 남음`;
        } else if (sec <= 86400) {
            const h = Math.floor(sec / 3600);
            const m = Math.floor((sec % 3600) / 60);
            el.textContent = m > 0 ? `${h}시간 ${m}분 남음` : `${h}시간 남음`;
        } else {
            const d = Math.floor(sec / 86400);
            const h = Math.floor((sec % 86400) / 3600);
            el.textContent = h > 0 ? `${d}일 ${h}시간 남음` : `${d}일 남음`;
        }
        setTimeout(tick, 1000);
    }
    tick();
}

function toggleWish() {
    wished = !wished;
    const cnt    = parseInt(document.getElementById('pdWishCount').textContent);
    const icon   = document.getElementById('pdWishIcon');
    const btn    = document.getElementById('pdWishBtn');
    document.getElementById('pdWishCount').textContent = wished ? cnt + 1 : cnt - 1;
    btn.classList.toggle('active', wished);
    if (icon) {
        icon.className = wished ? 'fa-solid fa-heart' : 'fa-regular fa-heart';
    }
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
            ? `<img src="${s.imageUrls[0]}" alt="${s.title}">`
            : `<span>📷</span>`;
        card.innerHTML = `
            <div class="pd-sim-img">${thumb}</div>
            <p class="pd-sim-title">${s.title}</p>
            <p class="pd-sim-price">${price.toLocaleString()}원</p>`;
        card.onclick = () => location.href = '/product/' + s.id;
        grid.appendChild(card);
    });

    document.getElementById('similar-item').style.display = 'block';
}

function scrollSimilar(dir) {
    document.getElementById('pdSimilarGrid').scrollBy({ left: dir * 800, behavior: 'smooth' });
}
