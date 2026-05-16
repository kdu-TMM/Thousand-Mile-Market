/* ===== 이미지 로드 실패 시 플레이스홀더로 교체 ===== */
function imgError(el) {
    el.closest('.product-image').innerHTML =
        '<div class="img-placeholder"><span>📷</span><p>사진 없음</p></div>';
}

/* ===== 섹션 탭 전환 ===== */
const sectionMap = {
    popular:     'section-popular',
    category:    'section-category',
    auction:     'section-auction',
    'all-items': 'section-all-items',
};

function showSection(type, btn) {
    document.querySelectorAll('.fsection-tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    if (type === 'all') {
        Object.values(sectionMap).forEach(id => document.getElementById(id).style.display = 'block');
    } else {
        Object.values(sectionMap).forEach(id => document.getElementById(id).style.display = 'none');
        document.getElementById(sectionMap[type]).style.display = 'block';
    }
}

/* ===== 필터 ===== */
function applyFilter() {}

function resetFilter() {
    document.getElementById('filterRegion').value = '';
    document.getElementById('filterCategory').value = '';
}

/* ===== 카테고리 탭 ===== */
function switchCategory(cat, btn) {
    document.querySelectorAll('.category-tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.querySelectorAll('#categoryGrid .product-card').forEach(card => {
        card.style.display = (cat === 'all' || card.dataset.category === cat) ? 'block' : 'none';
    });
}

/* ===== 경매 타이머 ===== */
function formatAuctionRemain(sec) {
    if (sec <= 0)     return '🕐 종료';
    if (sec <= 600)   return '🕐 10분 미만';
    if (sec <= 3600)  return `🕐 ${Math.floor(sec / 60)}분 남음`;
    if (sec <= 86400) return `🕐 ${Math.floor(sec / 3600)}시간 남음`;
    return `🕐 ${Math.floor(sec / 86400)}일 남음`;
}

function initTimerEnds() {
    document.querySelectorAll('.auction-timer:not([data-end])').forEach(el => {
        const text = el.textContent.replace('🕐 ', '').trim();
        if (text === '종료') return;
        const parts = text.split(':').map(Number);
        if (parts.length === 3) {
            const totalSec = parts[0] * 3600 + parts[1] * 60 + parts[2];
            el.dataset.end = new Date(Date.now() + totalSec * 1000).toISOString();
        }
    });
}

function tickTimers() {
    document.querySelectorAll('.auction-timer[data-end]').forEach(el => {
        const sec = Math.max(0, Math.floor((new Date(el.dataset.end) - Date.now()) / 1000));
        el.textContent = formatAuctionRemain(sec);
    });
}
setInterval(tickTimers, 1000);

/* ===== 전체 중고 물품 (무한 스크롤) ===== */
const BATCH_SIZE = 8;
let allProducts = [];
let filteredProducts = [];
let renderedCount = 0;
let isLoading = false;
let scrollObserver = null;

function goProduct(id, title, price) {
    window.addRecentItem && window.addRecentItem(title, price + '원');
    location.href = '/product/' + id;
}

function relativeDate(dateStr) {
    const diff = Math.floor((Date.now() - new Date(dateStr)) / 86400000);
    if (diff === 0) return '오늘';
    if (diff === 1) return '1일 전';
    return diff + '일 전';
}

function createProductCard(product) {
    const card = document.createElement('div');
    const isAuction = product.type === 'auction';
    card.className = 'product-card' + (isAuction ? ' auction' : '');
    const price = isAuction ? product.currentPrice : product.price;
    const thumb = product.imageUrls?.[0]
        ? `<img src="${product.imageUrls[0]}" alt="${product.title}">`
        : `<div class="img-placeholder"><span>📷</span><p>사진 없음</p></div>`;
    const timerHtml = isAuction && product.auctionEnd
        ? `<div class="auction-timer" data-end="${product.auctionEnd}">🕐 --</div>`
        : '';
    card.innerHTML = `
        <div class="product-image">${thumb}${timerHtml}</div>
        <div class="product-info">
            <h3 class="product-title">${product.title}</h3>
            <div class="product-details">
                <span class="product-price">${price.toLocaleString()}</span>
                <span class="product-date">${relativeDate(product.date)}</span>
            </div>
        </div>`;
    card.addEventListener('click', () => goProduct(product.id, product.title, price.toLocaleString()));
    return card;
}

function loadMoreProducts() {
    if (isLoading || renderedCount >= filteredProducts.length) return;
    isLoading = true;

    const spinner = document.getElementById('loadingSpinner');
    if (spinner) spinner.style.display = 'flex';

    setTimeout(() => {
        const grid = document.getElementById('mainGrid');
        const batch = filteredProducts.slice(renderedCount, renderedCount + BATCH_SIZE);
        batch.forEach(p => grid.appendChild(createProductCard(p)));
        renderedCount += batch.length;

        if (spinner) spinner.style.display = 'none';
        isLoading = false;

        /* 모두 표시됐으면 옵저버 해제 */
        if (renderedCount >= filteredProducts.length && scrollObserver) {
            scrollObserver.disconnect();
            scrollObserver = null;
        }
    }, 300);
}

/* ===== 정렬 ===== */
function getProductPrice(p) {
    return p.type === 'auction' ? (p.currentPrice ?? p.startPrice ?? 0) : (p.price ?? 0);
}

function regionMatchScore(productRegion, ref) {
    if (!ref || !productRegion) return 0;
    if (productRegion.includes(ref)) return 0;
    if (productRegion.includes(ref.slice(0, 2))) return 1;
    return 2;
}

function getSortedProducts(products) {
    const sort = document.getElementById('sortSelect')?.value || 'latest';
    const arr  = [...products];

    switch (sort) {
        case 'price-asc':
            return arr.sort((a, b) => getProductPrice(a) - getProductPrice(b));

        case 'price-desc':
            return arr.sort((a, b) => getProductPrice(b) - getProductPrice(a));

        case 'time-asc': {
            const FAR = new Date(8640000000000000);
            return arr.sort((a, b) => {
                const tA = a.auctionEnd ? new Date(a.auctionEnd) : FAR;
                const tB = b.auctionEnd ? new Date(b.auctionEnd) : FAR;
                return tA - tB;
            });
        }

        case 'distance': {
            const ref = document.getElementById('filterRegion')?.value || '';
            return arr.sort((a, b) => {
                const diff = regionMatchScore(a.region || '', ref) - regionMatchScore(b.region || '', ref);
                return diff !== 0 ? diff : new Date(b.date) - new Date(a.date);
            });
        }

        default: // 'latest'
            return arr.sort((a, b) => new Date(b.date) - new Date(a.date));
    }
}

function applyAllItemsFilter() {
    const region   = document.getElementById('filterRegion')?.value || '';
    const category = document.getElementById('filterCategory')?.value || '';
    const q        = new URLSearchParams(location.search).get('q')?.trim().toLowerCase() || '';

    const filtered = allProducts.filter(p => {
        const matchRegion   = !region   || p.region.includes(region);
        const matchCategory = !category || p.category === category;
        const matchSearch   = !q || p.title.toLowerCase().includes(q)
                                 || (p.description?.toLowerCase().includes(q));
        return matchRegion && matchCategory && matchSearch;
    });

    filteredProducts = getSortedProducts(filtered);

    /* 거리순 힌트 */
    const sort = document.getElementById('sortSelect')?.value || 'latest';
    const hint = document.getElementById('distanceHint');
    if (hint) hint.style.display = (sort === 'distance' && !region) ? 'block' : 'none';

    /* 그리드 초기화 */
    const grid = document.getElementById('mainGrid');
    grid.innerHTML = '';
    renderedCount = 0;

    /* 8개 초과일 때만 무한 스크롤 활성화 */
    const sentinel = document.getElementById('scrollSentinel');
    if (scrollObserver) { scrollObserver.disconnect(); scrollObserver = null; }

    loadMoreProducts();

    if (filteredProducts.length > BATCH_SIZE) {
        scrollObserver = new IntersectionObserver(entries => {
            if (entries[0].isIntersecting) loadMoreProducts();
        }, { rootMargin: '300px' });
        scrollObserver.observe(sentinel);
    }
}

function loadProducts() {
    window.fs.getDocs(window.fs.collection(window.db, 'products'))
        .then(snapshot => {
            allProducts = snapshot.docs.map(d => d.data());
            applyAllItemsFilter();
        })
        .catch(() => {
            /* Firestore 실패 시 products.json 폴백 */
            fetch('/data/products.json')
                .then(r => r.json())
                .then(data => { allProducts = data; applyAllItemsFilter(); });
        });
}

document.addEventListener('DOMContentLoaded', function () {
    initTimerEnds();

    const q = new URLSearchParams(location.search).get('q')?.trim();
    if (q) {
        const input = document.getElementById('searchInput');
        if (input) input.value = q;
        /* 검색 시 전체 물품 섹션만 표시 */
        const allTab = document.querySelector('.fsection-tab[onclick*="all-items"]');
        if (allTab) showSection('all-items', allTab);
    }

    if (window.db) loadProducts();
    else window.addEventListener('firebase-ready', loadProducts);
});

/* 필터 변경 시 전체 물품 섹션도 다시 필터링 */
function applyFilter() { applyAllItemsFilter(); }
function resetFilter() {
    document.getElementById('filterRegion').value = '';
    document.getElementById('filterCategory').value = '';
    document.getElementById('sortSelect').value = 'latest';
    applyAllItemsFilter();
}
