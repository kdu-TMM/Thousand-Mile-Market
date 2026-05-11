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
function tickTimers() {
    document.querySelectorAll('.auction-timer').forEach(el => {
        const text = el.textContent.replace('🕐 ', '');
        const parts = text.split(':').map(Number);
        if (parts.length === 3) {
            let [h, m, s] = parts;
            s--;
            if (s < 0) { s = 59; m--; }
            if (m < 0) { m = 59; h--; }
            if (h < 0) { el.textContent = '🕐 종료'; return; }
            el.textContent = `🕐 ${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
        }
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
    card.className = 'product-card';
    const price = product.type === 'auction' ? product.currentPrice : product.price;
    const thumb = product.imageUrls?.[0]
        ? `<img src="${product.imageUrls[0]}" alt="${product.title}">`
        : `<div class="img-placeholder"><span>📷</span><p>사진 없음</p></div>`;
    card.innerHTML = `
        <div class="product-image">${thumb}</div>
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

function applyAllItemsFilter() {
    const region   = document.getElementById('filterRegion')?.value || '';
    const category = document.getElementById('filterCategory')?.value || '';

    filteredProducts = allProducts.filter(p => {
        const matchRegion   = !region   || p.region.includes(region);
        const matchCategory = !category || p.category === category;
        return matchRegion && matchCategory;
    });

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
    if (window.db) loadProducts();
    else window.addEventListener('firebase-ready', loadProducts);
});

/* 필터 변경 시 전체 물품 섹션도 다시 필터링 */
function applyFilter() { applyAllItemsFilter(); }
function resetFilter() {
    document.getElementById('filterRegion').value = '';
    document.getElementById('filterCategory').value = '';
    applyAllItemsFilter();
}
