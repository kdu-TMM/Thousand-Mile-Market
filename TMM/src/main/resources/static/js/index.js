/* ===== 이미지 로드 실패 시 플레이스홀더로 교체 ===== */
function imgError(el) {
    el.closest('.product-image').innerHTML =
        '<div class="img-placeholder"><span>📷</span><p>사진 없음</p></div>';
}


/* ===== 섹션 탭 전환 ===== */
const sectionMap = {
    popular:     'section-popular',
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
function getFilterRegion() {
    const dong    = document.getElementById('filterDong')?.value    || '';
    const sigungu = document.getElementById('filterSigungu')?.value || '';
    const sido    = document.getElementById('filterSido')?.value    || '';
    return dong || sigungu || sido;
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

/* ===== 경매 진행 중 섹션 ===== */
function createAuctionCard(p) {
    const card    = document.createElement('div');
    const hasBids = (p.bidCount || 0) > 0;
    card.className = 'product-card auction ' + (hasBids ? 'bidding' : 'no-bid');

    const thumb = p.imageUrls?.[0]
        ? `<img src="${p.imageUrls[0]}" alt="${p.title}" loading="eager" fetchpriority="high" onload="this.classList.add('loaded')" onerror="imgError(this)">`
        : `<div class="img-placeholder"><span>📷</span><p>사진 없음</p></div>`;

    const bidLabel  = hasBids ? `${p.bidCount}명 입찰 중` : '0명 입찰';
    const badgeText = '경매 중';
    const price     = p.currentPrice ?? p.startPrice ?? 0;
    const priceClass = hasBids ? 'bid-price' : 'start-price';

    card.innerHTML = `
        <div class="product-image">
            ${thumb}
            <div class="auction-timer" data-end="${p.auctionEnd}">🕐 --</div>
            <div class="bid-count-banner">${bidLabel}</div>
        </div>
        <div class="product-info">
            <div class="auction-badge-label ${hasBids ? 'bidding' : ''}">${badgeText}</div>
            <h3 class="product-title">${p.title}</h3>
            <div class="product-details">
                <span class="product-price ${priceClass}">${price.toLocaleString()}</span>
            </div>
        </div>`;

    card.addEventListener('click', () => {
        window.addRecentItem && window.addRecentItem(p.id, p.title, price.toLocaleString() + '원', p.imageUrls?.[0] ?? null);
        location.href = '/product/' + p.id;
    });
    return card;
}

function loadPopular() {
    const grid = document.getElementById('popularGrid');
    if (!grid) return;

    window.fs.getDocs(
        window.fs.query(
            window.fs.collection(window.db, 'products'),
            window.fs.orderBy('views', 'desc'),
            window.fs.limit(20)
        )
    ).then(snapshot => {
        grid.innerHTML = '';
        const docs = snapshot.docs
            .filter(doc => ['판매중', '경매중'].includes(doc.data().status))
            .slice(0, 5);
        if (docs.length === 0) {
            grid.innerHTML = '<p style="color:#999; padding:16px; grid-column: 1 / -1;">인기 상품이 없습니다.</p>';
            return;
        }
        docs.forEach(doc => {
            const p = doc.data();
            const price = p.type === 'auction'
                ? (p.currentPrice ?? p.startPrice ?? 0).toLocaleString()
                : (p.price ?? 0).toLocaleString();
            const thumb = p.imageUrls?.[0]
                ? `<img src="${p.imageUrls[0]}" alt="${p.title}" loading="eager" fetchpriority="high" onload="this.classList.add('loaded')" onerror="imgError(this)">`
                : `<div class="img-placeholder"><span>📷</span><p>사진 없음</p></div>`;
            const card = document.createElement('div');
            card.className = 'product-card';
            card.innerHTML = `
                <div class="product-image">${thumb}</div>
                <div class="product-info">
                    <h3 class="product-title">${p.title}</h3>
                    <div class="product-details">
                        <span class="product-price">${price}</span>
                        <span class="product-date">조회 ${(p.views ?? 0).toLocaleString()}</span>
                    </div>
                </div>`;
            card.addEventListener('click', () => location.href = '/product/' + doc.id);
            grid.appendChild(card);
        });
    }).catch(() => {
        grid.innerHTML = '<p style="color:#999; padding:16px; grid-column: 1 / -1;">인기 상품을 불러올 수 없습니다.</p>';
    });
}

function loadAuctions() {
    const grid     = document.getElementById('auctionGrid');
    const emptyMsg = document.getElementById('auctionEmpty');
    if (!grid) return;

    const now = new Date();

    window.fs.getDocs(
        window.fs.query(
            window.fs.collection(window.db, 'products'),
            window.fs.where('type',   '==', 'auction'),
            window.fs.where('status', '==', '경매중')
        )
    ).then(snapshot => {
        // 더미 외 기존 카드 제거 (emptyMsg 제외)
        [...grid.children].forEach(el => { if (el.id !== 'auctionEmpty') el.remove(); });

        // auctionEnd 가 현재 시각 이후인 것만 표시
        const active = snapshot.docs
            .map(d => d.data())
            .filter(p => p.auctionEnd && new Date(p.auctionEnd) > now)
            .sort((a, b) => new Date(a.auctionEnd) - new Date(b.auctionEnd)); // 마감 임박순

        if (active.length === 0) {
            emptyMsg.style.display = 'block';
            return;
        }

        emptyMsg.style.display = 'none';
        active.forEach(p => grid.appendChild(createAuctionCard(p)));
    }).catch(err => {
        console.warn('경매 목록 로드 실패:', err);
        emptyMsg.style.display = 'block';
    });
}

/* ===== 전체 중고 물품 (무한 스크롤) ===== */
const BATCH_SIZE = 8;
let allProducts = [];
let filteredProducts = [];
let renderedCount = 0;
let isLoading = false;
let scrollObserver = null;

function goProduct(id, title, price) {
    window.addRecentItem && window.addRecentItem(id, title, price + '원', null);
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

    if (isAuction) {
        const hasBids = (product.bidCount || 0) > 0;
        card.className = 'product-card auction ' + (hasBids ? 'bidding' : 'no-bid');
        const price = product.currentPrice ?? product.startPrice ?? 0;
        const priceClass = hasBids ? 'bid-price' : 'start-price';
        const bidLabel = hasBids ? `${product.bidCount}명 입찰 중` : '0명 입찰';
        const thumb = product.imageUrls?.[0]
            ? `<img src="${product.imageUrls[0]}" alt="${product.title}" loading="lazy" onload="this.classList.add('loaded')" onerror="imgError(this)">`
            : `<div class="img-placeholder"><span>📷</span><p>사진 없음</p></div>`;
        const timerHtml = product.auctionEnd
            ? `<div class="auction-timer" data-end="${product.auctionEnd}">🕐 --</div>`
            : '';
        card.innerHTML = `
            <div class="product-image">
                ${thumb}${timerHtml}
                <div class="bid-count-banner">${bidLabel}</div>
            </div>
            <div class="product-info">
                <div class="auction-badge-label ${hasBids ? 'bidding' : ''}">경매 중</div>
                <h3 class="product-title">${product.title}</h3>
                <div class="product-details">
                    <span class="product-price ${priceClass}">${price.toLocaleString()}</span>
                </div>
            </div>`;
        card.addEventListener('click', () => {
            window.addRecentItem && window.addRecentItem(product.id, product.title, price.toLocaleString() + '원', product.imageUrls?.[0] ?? null);
            location.href = '/product/' + product.id;
        });
    } else {
        card.className = 'product-card';
        const price = product.price ?? 0;
        const thumb = product.imageUrls?.[0]
            ? `<img src="${product.imageUrls[0]}" alt="${product.title}" loading="lazy" onload="this.classList.add('loaded')" onerror="imgError(this)">`
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
        card.addEventListener('click', () => {
            window.addRecentItem && window.addRecentItem(product.id, product.title, price.toLocaleString() + '원', product.imageUrls?.[0] ?? null);
            location.href = '/product/' + product.id;
        });
    }
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
            const ref = getFilterRegion();
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
    isLoading = false;   /* 이전 렌더 중단 후 재시작 보장 */

    const now      = new Date();
    const region   = getFilterRegion();
    const category = document.getElementById('filterCategory')?.value || '';
    const q        = new URLSearchParams(location.search).get('q')?.trim().toLowerCase() || '';

    const filtered = allProducts.filter(p => {
        if (p.status === '숨김' || p.status === '삭제') return false;
        if (p.type === 'auction' && p.status === '경매중' && p.auctionEnd && new Date(p.auctionEnd) <= now) return false;
        const matchRegion   = !region   || (p.region   || '').includes(region);
        const matchCategory = !category || (p.category || '') === category;
        const matchSearch   = !q || (p.title || '').toLowerCase().includes(q)
                                 || (p.description || '').toLowerCase().includes(q);
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

const CACHE_KEY = 'tmm_products';
const CACHE_TTL = 3 * 60 * 1000; // 3분

function loadProducts() {
    // 캐시 확인 → 있으면 즉시 렌더링
    try {
        const cached = sessionStorage.getItem(CACHE_KEY);
        if (cached) {
            const { data, ts } = JSON.parse(cached);
            if (Date.now() - ts < CACHE_TTL) {
                allProducts = data;
                applyAllItemsFilter();
            }
        }
    } catch (_) {}

    // 백그라운드에서 최신 데이터 갱신
    window.fs.getDocs(window.fs.collection(window.db, 'products'))
        .then(snapshot => {
            allProducts = snapshot.docs.map(d => d.data());
            try {
                sessionStorage.setItem(CACHE_KEY, JSON.stringify({ data: allProducts, ts: Date.now() }));
            } catch (_) {}
            applyAllItemsFilter();
        })
        .catch(() => {
            if (allProducts.length > 0) return; // 캐시로 이미 렌더됐으면 스킵
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
        /* 검색 시 전체 탭으로 전환 */
        const allTab = document.querySelector('.fsection-tab[onclick*="\'all\'"]');
        if (allTab) showSection('all', allTab);
    }

    if (window.db) {
        loadProducts();
        loadAuctions();
        loadPopular();
    } else {
        window.addEventListener('firebase-ready', () => {
            loadProducts();
            loadAuctions();
            loadPopular();
        });
    }
});

/* 필터 변경 시 전체 탭으로 전환 후 재필터링 */
function applyFilter() {
    const allTab = document.querySelector('.fsection-tab[onclick*="\'all\'"]');
    if (allTab && !allTab.classList.contains('active')) showSection('all', allTab);

    const category = document.getElementById('filterCategory')?.value || '';
    const sido     = document.getElementById('filterSido')?.value     || '';
    const isFiltered = category || sido;

    document.getElementById('section-popular').style.display = isFiltered ? 'none' : '';
    document.getElementById('section-auction').style.display = isFiltered ? 'none' : '';

    applyAllItemsFilter();
}
function resetFilter() {
    document.getElementById('filterSido').value = '';
    const sigunguEl = document.getElementById('filterSigungu');
    sigunguEl.innerHTML = '<option value="">시/군/구</option>';
    sigunguEl.style.display = 'none';
    const dongEl = document.getElementById('filterDong');
    dongEl.innerHTML = '<option value="">읍/면/동</option>';
    dongEl.style.display = 'none';
    document.getElementById('filterCategory').value = '';
    document.getElementById('sortSelect').value = 'latest';

    document.getElementById('section-popular').style.display = '';
    document.getElementById('section-auction').style.display = '';

    applyAllItemsFilter();
}

/* ===== 지역 필터 연동 ===== */
function updateFilterSigungu() {
    const sido      = document.getElementById('filterSido').value;
    const sigunguEl = document.getElementById('filterSigungu');
    const dongEl    = document.getElementById('filterDong');

    dongEl.innerHTML     = '<option value="">읍/면/동</option>';
    dongEl.style.display = 'none';
    sigunguEl.innerHTML  = '<option value="">시/군/구</option>';

    if (sido && filterRegionData[sido] && Object.keys(filterRegionData[sido]).length) {
        Object.keys(filterRegionData[sido]).forEach(sg => {
            sigunguEl.innerHTML += `<option value="${sg}">${sg}</option>`;
        });
        sigunguEl.style.display = '';
    } else {
        sigunguEl.style.display = 'none';
    }
    applyFilter();
}

function updateFilterDong() {
    const sido    = document.getElementById('filterSido').value;
    const sigungu = document.getElementById('filterSigungu').value;
    const dongEl  = document.getElementById('filterDong');

    dongEl.innerHTML = '<option value="">읍/면/동</option>';
    if (sido && sigungu && filterRegionData[sido]?.[sigungu]?.length) {
        filterRegionData[sido][sigungu].forEach(d => {
            dongEl.innerHTML += `<option value="${d}">${d}</option>`;
        });
        dongEl.style.display = '';
    } else {
        dongEl.style.display = 'none';
    }
    applyFilter();
}

const filterRegionData = {
    '서울특별시': {
        '강남구': [], '강서구': [], '관악구': [], '광진구': [], '구로구': [],
        '금천구': [], '노원구': [], '도봉구': [], '동대문구': [], '동작구': [],
        '마포구': [], '서대문구': [], '서초구': [], '성동구': [], '성북구': [],
        '송파구': [], '양천구': [], '영등포구': [], '용산구': [], '은평구': [],
        '종로구': [], '중구': [], '중랑구': []
    },
    '경기도': {
        '의정부시': ['신곡1동','신곡2동','의정부1동','의정부2동','의정부3동','호원1동','호원2동','장암동','녹양동','가능동','흥선동','효자동','민락동','낙양동'],
        '수원시':   ['장안구','권선구','팔달구','영통구'],
        '성남시':   ['수정구','중원구','분당구'],
        '고양시':   ['덕양구','일산동구','일산서구'],
        '용인시':   ['처인구','기흥구','수지구'],
        '부천시':   ['원미구','소사구','오정구'],
        '안산시':   ['단원구','상록구'],
        '남양주시': ['화도읍','오남읍','진건읍','별내면','퇴계원면'],
        '화성시':   ['봉담읍','향남읍','남양읍','우정읍','장안면'],
        '평택시':   ['평택동','비전1동','비전2동','통복동','중앙동'],
        '안양시': [], '시흥시': [], '파주시': [], '김포시': [], '광주시': [],
        '광명시': [], '하남시': [], '오산시': [], '안성시': [], '이천시': [],
        '포천시': [], '양주시': [], '구리시': [], '여주시': [], '동두천시': [],
        '과천시': [], '의왕시': [], '군포시': [],
        '가평군': [], '양평군': [], '연천군': []
    },
    '인천광역시': {
        '남동구': ['구월1동','구월2동','구월3동','구월4동','간석1동','간석2동','간석3동','간석4동','만수1동','만수2동','만수3동','만수4동','논현1동','논현고잔동','논현2동'],
        '연수구': ['옥련1동','옥련2동','선학동','연수1동','연수2동','연수3동','청학동','동춘1동','동춘2동','동춘3동','송도1동','송도2동','송도3동','송도4동'],
        '부평구': ['부평1동','부평2동','부평3동','부평4동','부평5동','부평6동','십정1동','십정2동','산곡1동','산곡2동','산곡3동','산곡4동','갈산1동','갈산2동','삼산1동','삼산2동'],
        '계양구': [], '미추홀구': [], '서구': [], '동구': [], '중구': [],
        '강화군': [], '옹진군': []
    },
    '부산광역시': {
        '해운대구': ['우동','중동','좌동','송정동','반여1동','반여2동','반여3동','반여4동','반송1동','반송2동','석대동','재송1동','재송2동'],
        '수영구':   ['남천1동','남천2동','수영동','망미1동','망미2동','광안1동','광안2동','광안3동','광안4동'],
        '사상구':   ['삼락동','모라1동','모라3동','덕포1동','덕포2동','괘법동','감전동','주례1동','주례2동','주례3동','학장동','엄궁동'],
        '강서구': [], '금정구': [], '남구': [], '동구': [], '동래구': [],
        '부산진구': [], '북구': [], '사하구': [], '서구': [], '연제구': [],
        '영도구': [], '중구': [], '기장군': []
    },
    '대구광역시': {
        '달서구': [], '달성군': [], '동구': [], '북구': [], '서구': [],
        '남구': [], '중구': [], '수성구': []
    },
    '광주광역시': {
        '광산구': [], '남구': [], '동구': [], '북구': [], '서구': []
    },
    '대전광역시': {
        '대덕구': [], '동구': [], '서구': [], '유성구': [], '중구': []
    },
    '울산광역시': {
        '남구': [], '동구': [], '북구': [], '중구': [], '울주군': []
    },
    '세종특별자치시': {},
    '강원도': {
        '춘천시': [], '원주시': [], '강릉시': [], '동해시': [], '태백시': [],
        '속초시': [], '삼척시': [], '홍천군': [], '횡성군': [], '영월군': [],
        '평창군': [], '정선군': [], '철원군': [], '화천군': [], '양구군': [],
        '인제군': [], '고성군': [], '양양군': []
    },
    '충청북도': {
        '청주시': [], '충주시': [], '제천시': [], '보은군': [], '옥천군': [],
        '영동군': [], '증평군': [], '진천군': [], '괴산군': [], '음성군': [], '단양군': []
    },
    '충청남도': {
        '천안시': [], '공주시': [], '보령시': [], '아산시': [], '서산시': [],
        '논산시': [], '계룡시': [], '당진시': [], '금산군': [], '부여군': [],
        '서천군': [], '청양군': [], '홍성군': [], '예산군': [], '태안군': []
    },
    '전라북도': {
        '전주시': [], '군산시': [], '익산시': [], '정읍시': [], '남원시': [],
        '김제시': [], '완주군': [], '진안군': [], '무주군': [], '장수군': [],
        '임실군': [], '순창군': [], '고창군': [], '부안군': []
    },
    '전라남도': {
        '목포시': [], '여수시': [], '순천시': [], '나주시': [], '광양시': [],
        '담양군': [], '곡성군': [], '구례군': [], '고흥군': [], '보성군': [],
        '화순군': [], '장흥군': [], '강진군': [], '해남군': [], '영암군': [],
        '무안군': [], '함평군': [], '영광군': [], '장성군': [], '완도군': [],
        '진도군': [], '신안군': []
    },
    '경상북도': {
        '포항시': [], '경주시': [], '김천시': [], '안동시': [], '구미시': [],
        '영주시': [], '영천시': [], '상주시': [], '문경시': [], '경산시': [],
        '의성군': [], '청송군': [], '영양군': [], '영덕군': [], '청도군': [],
        '고령군': [], '성주군': [], '칠곡군': [], '예천군': [], '봉화군': [],
        '울진군': [], '울릉군': []
    },
    '경상남도': {
        '창원시': [], '진주시': [], '통영시': [], '사천시': [], '김해시': [],
        '밀양시': [], '거제시': [], '양산시': [], '의령군': [], '함안군': [],
        '창녕군': [], '고성군': [], '남해군': [], '하동군': [], '산청군': [],
        '함양군': [], '거창군': [], '합천군': []
    },
    '제주특별자치도': {
        '제주시': [], '서귀포시': []
    }
};
