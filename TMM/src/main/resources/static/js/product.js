const productId = location.pathname.split('/').pop();
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
            alert('삭제되었거나 없는 상품입니다.'); history.back();
            return;
        }
        allProducts    = snapshot.docs.map(d => d.data());
        currentProduct = docSnap.data();
        if (currentProduct.status === '숨김') {
            document.getElementById('pdError').style.display = 'flex';
            return;
        }
        renderProduct(currentProduct);
        renderPopular(currentProduct);
        renderSimilar(currentProduct);
        trackView(String(productId));
        checkWishState();
        const priceStr = currentProduct.type === 'auction'
            ? currentProduct.currentPrice.toLocaleString() + '원'
            : currentProduct.price.toLocaleString() + '원';
        window.addRecentItem && window.addRecentItem(
            currentProduct.id,
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
                currentProduct = data.find(p => String(p.id) === productId);
                if (!currentProduct) { document.getElementById('pdError').style.display = 'flex'; return; }
                renderProduct(currentProduct);
                renderSimilar(currentProduct);
                const priceStr = currentProduct.type === 'auction'
                    ? currentProduct.currentPrice.toLocaleString() + '원'
                    : currentProduct.price.toLocaleString() + '원';
                window.addRecentItem && window.addRecentItem(
                    currentProduct.id, currentProduct.title, priceStr,
                    currentProduct.imageUrls?.[0] ?? null
                );
            });
    });
}

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

function checkWishState() {
    if (!currentProduct || !window.auth?.currentUser) return;
    const uid     = window.auth.currentUser.uid;
    const wishers = currentProduct.wishers || [];
    wished = wishers.includes(uid);
    const btn  = document.getElementById('pdWishBtn');
    const icon = document.getElementById('pdWishIcon');
    if (btn)  btn.classList.toggle('active', wished);
    if (icon) icon.className = wished ? 'fa-solid fa-heart' : 'fa-regular fa-heart';
}

async function toggleWish() {
    if (!window.db || !window.auth?.currentUser) {
        alert('로그인 후 찜할 수 있습니다.');
        return;
    }
    if (!currentProduct) return;

    const uid = window.auth.currentUser.uid;
    const btn  = document.getElementById('pdWishBtn');
    const icon = document.getElementById('pdWishIcon');
    btn.disabled = true;

    try {
        const ref  = window.fs.doc(window.db, 'products', String(productId));
        const snap = await window.fs.getDoc(ref);
        if (!snap.exists()) return;

        const data    = snap.data();
        let wishers   = data.wishers || [];
        const already = wishers.includes(uid);

        if (already) {
            wishers = wishers.filter(u => u !== uid);
        } else {
            wishers = [...wishers, uid];
        }

        const newCount = Math.max(0, wishers.length);
        await window.fs.updateDoc(ref, { wishers, wishes: newCount });

        currentProduct.wishers = wishers;
        wished = !already;
        document.getElementById('pdWishCount').textContent = newCount;
        document.getElementById('pdWishes').textContent    = newCount;
        btn.classList.toggle('active', wished);
        if (icon) icon.className = wished ? 'fa-solid fa-heart' : 'fa-regular fa-heart';
    } catch (e) {
        alert('오류: ' + e.message);
    } finally {
        btn.disabled = false;
    }
}

/* ===== 카테고리 인기 상품 ===== */
function renderPopular(p) {
    const popular = allProducts
        .filter(x => x.id !== p.id && x.category === p.category && x.status !== '판매완료')
        .sort((a, b) => (b.views || 0) - (a.views || 0))
        .slice(0, 5);
    if (popular.length === 0) return;

    const grid = document.getElementById('pdPopularGrid');
    popular.forEach(s => {
        const card = document.createElement('div');
        card.className = 'pd-pop-card';
        const price = s.type === 'auction' ? s.currentPrice : s.price;
        const thumb = s.imageUrls?.[0]
            ? `<img src="${s.imageUrls[0]}" alt="${s.title}">`
            : `<span>📷</span>`;
        card.innerHTML = `
            <div class="pd-pop-img">${thumb}</div>
            <p class="pd-pop-title">${s.title}</p>
            <p class="pd-pop-price">${price.toLocaleString()}원</p>
            <p class="pd-pop-views"><i class="fa-regular fa-eye"></i> ${s.views || 0}</p>`;
        card.onclick = () => location.href = '/product/' + s.id;
        grid.appendChild(card);
    });
    document.getElementById('popular-item').style.display = 'block';
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

/* ===== 신고 ===== */
function openReportModal() {
    document.querySelectorAll('input[name="reportReason"]').forEach(r => r.checked = false);
    document.getElementById('reportDetail').style.display = 'none';
    document.getElementById('reportDetail').value = '';
    document.getElementById('reportMsg').textContent = '';
    document.getElementById('reportMsg').className = 'report-msg';
    document.getElementById('reportModal').style.display = 'flex';
}

function closeReportModal(e) {
    if (e && e.target !== document.getElementById('reportModal')) return;
    document.getElementById('reportModal').style.display = 'none';
}

function toggleReportDetail(show) {
    document.getElementById('reportDetail').style.display = show ? 'block' : 'none';
}

document.addEventListener('change', e => {
    if (e.target.name === 'reportReason') {
        toggleReportDetail(e.target.value === '기타');
    }
});

/* ===== 조회수 ===== */
function trackView(pid) {
    const user = window.auth?.currentUser;
    if (!user) return;

    const key = `tmm_viewed_${pid}_${new Date().toDateString()}`;
    if (localStorage.getItem(key)) return;
    localStorage.setItem(key, '1');

    const viewsEl = document.getElementById('pdViews');
    if (viewsEl) viewsEl.textContent = (parseInt(viewsEl.textContent) || 0) + 1;

    window.fs.updateDoc(
        window.fs.doc(window.db, 'products', pid),
        { views: window.fs.increment(1) }
    ).catch(() => {});
}

async function submitReport() {
    const reason = document.querySelector('input[name="reportReason"]:checked')?.value;
    const detail = document.getElementById('reportDetail').value.trim();
    const msg    = document.getElementById('reportMsg');

    msg.className = 'report-msg';
    if (!reason) { msg.textContent = '신고 사유를 선택해 주세요.'; return; }
    if (reason === '기타' && !detail) { msg.textContent = '신고 내용을 입력해 주세요.'; return; }
    if (!window.db || !window.auth?.currentUser) { msg.textContent = '로그인 후 신고할 수 있습니다.'; return; }
    if (!currentProduct) return;

    const user = window.auth.currentUser;
    const btn  = document.querySelector('.report-submit-btn');
    btn.disabled = true;
    btn.textContent = '신고 중...';

    try {
        const dupSnap = await window.fs.getDocs(
            window.fs.query(
                window.fs.collection(window.db, 'reports'),
                window.fs.where('reporterUid', '==', user.uid),
                window.fs.where('targetType',  '==', 'product'),
                window.fs.where('targetId',    '==', currentProduct.id),
                window.fs.limit(1)
            )
        );
        if (!dupSnap.empty) {
            msg.textContent = '이미 신고한 상품입니다.';
            btn.disabled = false;
            btn.textContent = '신고하기';
            return;
        }

        await window.fs.addDoc(window.fs.collection(window.db, 'reports'), {
            targetType:       'product',
            targetId:         currentProduct.id,
            targetTitle:      currentProduct.title,
            reason,
            detail:           reason === '기타' ? detail : '',
            reporterUid:      user.uid,
            reporterNickname: user.displayName || user.email,
            status:           '검토중',
            createdAt:        window.fs.serverTimestamp()
        });
        msg.textContent = '신고가 접수되었습니다.';
        msg.className = 'report-msg ok';
        setTimeout(() => { document.getElementById('reportModal').style.display = 'none'; }, 1200);
    } catch (e) {
        msg.textContent = '오류가 발생했습니다: ' + e.message;
    } finally {
        btn.disabled = false;
        btn.textContent = '신고하기';
    }
}

/* ===== 초기화 ===== */
window.addEventListener('firebase-ready', loadProduct);
if (window.firebaseReady) loadProduct();
