function switchMypageTab(tab, btn) {
    document.querySelectorAll('.mypage-tab').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    document.querySelectorAll('.mypage-tab-panel').forEach(p => p.style.display = 'none');
    document.getElementById('mpTab' + tab).style.display = 'block';
    if (tab === 'Order') loadOrderList('buy');
    if (tab === 'Info')  loadUserInfo();
}

/* ===== 내 정보 ===== */
function loadUserInfo() {
    const card    = document.querySelector('.info-card');
    const loading = document.getElementById('infoLoading');
    const errEl   = document.getElementById('infoError');

    if (!window.db || !window.auth?.currentUser) {
        if (card)    card.style.display = 'none';
        if (loading) loading.style.display = 'none';
        if (errEl)   errEl.style.display = 'block';
        return;
    }

    if (card)    card.style.display = 'none';
    if (loading) loading.style.display = 'block';
    if (errEl)   errEl.style.display = 'none';

    const uid = window.auth.currentUser.uid;
    window.fs.getDoc(window.fs.doc(window.db, 'users', uid))
        .then(snap => {
            if (loading) loading.style.display = 'none';
            if (!snap.exists()) {
                if (errEl) errEl.style.display = 'block';
                return;
            }
            const d = snap.data();
            if (card) card.style.display = 'block';

            setText('infoUserId',    d.userId    || '-');
            setText('infoNickname',  d.nickname  || '-');
            setText('infoName',      d.name      || '-');
            setText('infoPhone',     maskPhone(d.phone));
            setText('infoRegion',    d.region    || '-');
            setText('infoBio',       d.bio       || '-');
            setText('infoCreatedAt', formatDate(d.createdAt));

            /* 상단 프로필 카드 동기화 */
            setText('mpName',   d.nickname || d.name || '사용자');
            setText('mpBio',    d.bio      || '');
            setText('mpRegion', d.region   || '');
            setText('mpJoin',   '가입일 ' + formatDate(d.createdAt));
            const avatar = document.getElementById('mpAvatar');
            if (avatar) avatar.textContent = (d.nickname || d.userId || '?')[0].toUpperCase();

            /* 스켈레톤 제거 */
            ['mpAvatar', 'mpName', 'mpBio', 'mpRegion', 'mpJoin'].forEach(id => {
                document.getElementById(id)?.classList.remove('mp-skeleton');
            });

            /* 설정 폼 채우기 */
            const sName   = document.getElementById('settingName');
            const sBio    = document.getElementById('settingBio');
            const sRegion = document.getElementById('settingRegion');
            if (sName)   sName.value   = d.nickname || d.name  || '';
            if (sBio)    sBio.value    = d.bio      || '';
            if (sRegion) sRegion.value = d.region   || '';
        })
        .catch(() => {
            if (loading) loading.style.display = 'none';
            if (errEl)   errEl.style.display = 'block';
        });
}

function setText(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
}

function maskPhone(phone) {
    if (!phone) return '-';
    const digits = phone.replace(/\D/g, '');
    if (digits.length === 11)
        return digits.slice(0, 3) + '-****-' + digits.slice(7);
    return phone;
}

function formatDate(iso) {
    if (!iso) return '-';
    return iso.slice(0, 10).replace(/-/g, '.');
}

/* ===== 대시보드 통계 로드 ===== */
function loadDashboardStats() {
    if (!window.db || !window.auth?.currentUser) return;
    const uid = window.auth.currentUser.uid;

    Promise.all([
        window.fs.getDocs(window.fs.query(
            window.fs.collection(window.db, 'products'),
            window.fs.where('sellerUid', '==', uid)
        )),
        window.fs.getDocs(window.fs.query(
            window.fs.collection(window.db, 'products'),
            window.fs.where('wishers', 'array-contains', uid)
        )),
        window.fs.getDocs(window.fs.query(
            window.fs.collection(window.db, 'products'),
            window.fs.where('buyerUid', '==', uid)
        ))
    ]).then(([sellerSnap, wishSnap, buySnap]) => {
        const sellerItems = sellerSnap.docs.map(d => d.data());
        const activeCount = sellerItems.filter(p =>
            ['판매중','경매중','예약중'].includes(p.status)
        ).length;
        const doneCount   = sellerItems.filter(p => p.status === '판매완료').length;
        const auctionCount = sellerItems.filter(p => p.type === 'auction').length;
        const wishCount   = wishSnap.size;
        const buyCount    = buySnap.size;

        setText('mpStatSell',    activeCount);
        setText('mpStatWish',    wishCount);
        setText('mpStatBuy',     buyCount);
        setText('mpStatAuction', auctionCount);
        setText('mpRatingValue', '-');
        setText('mpTotalTrades', doneCount + buyCount);

        ['mpStatSell','mpStatWish','mpStatBuy','mpStatAuction',
         'mpRatingValue','mpTotalTrades'].forEach(id => {
            document.getElementById(id)?.classList.remove('mp-skeleton');
        });
    }).catch(() => {
        ['mpStatSell','mpStatWish','mpStatBuy','mpStatAuction',
         'mpRatingValue','mpTotalTrades'].forEach(id => {
            const el = document.getElementById(id);
            if (!el) return;
            el.textContent = '-';
            el.classList.remove('mp-skeleton');
        });
    });
}

/* 페이지 로드 시 프로필 카드 자동 채우기 */
window.addEventListener('firebase-ready', () => {
    if (window.auth?.currentUser) {
        loadUserInfo();
        loadDashboardStats();
    }
});
/* firebase-ready가 이미 발화된 경우 */
if (window.firebaseReady && window.auth?.currentUser) {
    loadUserInfo();
    loadDashboardStats();
}

/* ===== 거래 내역 ===== */
let currentOrderType = 'buy';

function switchOrderType(type, btn) {
    currentOrderType = type;
    document.querySelectorAll('.order-type-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    loadOrderList(type);
}

function loadOrderList(type) {
    const list = document.getElementById('orderList');
    if (!window.db || !window.auth?.currentUser) {
        list.innerHTML = '<p class="order-empty">로그인이 필요합니다.</p>';
        return;
    }
    list.innerHTML = '<p class="order-empty">불러오는 중...</p>';
    const user = window.auth.currentUser;
    const keyword = document.getElementById('orderKeyword')?.value.trim().toLowerCase() || '';

    let q;
    if (type === 'sell') {
        q = window.fs.query(
            window.fs.collection(window.db, 'products'),
            window.fs.where('sellerUid', '==', user.uid)
        );
    } else if (type === 'auction') {
        q = window.fs.query(
            window.fs.collection(window.db, 'products'),
            window.fs.where('type', '==', 'auction')
        );
    } else {
        q = window.fs.query(
            window.fs.collection(window.db, 'products'),
            window.fs.where('buyerUid', '==', user.uid)
        );
    }

    window.fs.getDocs(q).then(snap => {
        list.innerHTML = '';
        const items = snap.docs.map(d => d.data()).filter(p =>
            !keyword || p.title?.toLowerCase().includes(keyword)
        );
        if (!items.length) {
            list.innerHTML = '<p class="order-empty">내역이 없습니다.</p>';
            return;
        }
        const badgeLabel = { buy: '구매', sell: '판매', auction: '경매참여' };
        items.forEach(p => {
            const price = p.type === 'auction'
                ? '현재가 ' + (p.currentPrice ?? 0).toLocaleString() + '원'
                : (p.price ?? 0).toLocaleString() + '원';
            const li = document.createElement('div');
            li.className = 'order-item';
            li.onclick = () => location.href = '/product/' + p.id;
            li.innerHTML = `
                <div class="order-thumb">${p.imageUrls?.[0] ? `<img src="${p.imageUrls[0]}" alt="">` : ''}</div>
                <div class="order-info">
                    <p class="order-name">${p.title}</p>
                    <p class="order-price">${price}</p>
                    <p class="order-date">${(p.date ?? '').slice(0, 10)}</p>
                </div>
                <span class="order-badge ${type}">${badgeLabel[type]}</span>`;
            list.appendChild(li);
        });
    }).catch(() => {
        list.innerHTML = '<p class="order-empty">불러오기 실패. 다시 시도해 주세요.</p>';
    });
}

/* ===== 회원탈퇴 ===== */
function doSecession() {
    const pw = document.getElementById('secessionPw').value;
    const msg = document.getElementById('secessionMsg');
    const checks = document.querySelectorAll('.secession-check');
    const anyChecked = [...checks].some(c => c.checked);

    if (!anyChecked) {
        msg.textContent = '탈퇴 사유를 하나 이상 선택해 주세요.';
        msg.className = 'secession-msg';
        return;
    }
    if (!pw) {
        msg.textContent = '비밀번호를 입력해 주세요.';
        msg.className = 'secession-msg';
        return;
    }
    if (!window.auth?.currentUser || !window.authFuncs) {
        msg.textContent = '로그인이 필요합니다.';
        msg.className = 'secession-msg';
        return;
    }
    if (!confirm('정말 탈퇴하시겠습니까? 모든 데이터가 삭제됩니다.')) return;

    const user = window.auth.currentUser;
    const internalEmail = user.email;
    window.authFuncs.signInWithEmailAndPassword(window.auth, internalEmail, pw)
        .then(() => user.delete())
        .then(() => {
            alert('탈퇴가 완료되었습니다.');
            location.href = '/';
        })
        .catch(e => {
            const errMap = {
                'auth/wrong-password':     '비밀번호가 올바르지 않습니다.',
                'auth/invalid-credential': '비밀번호가 올바르지 않습니다.',
                'auth/too-many-requests':  '잠시 후 다시 시도해 주세요.'
            };
            msg.textContent = errMap[e.code] || '오류: ' + e.message;
            msg.className = 'secession-msg';
        });
}

async function saveMypageSettings(e) {
    const nickname = document.getElementById('settingName').value.trim();
    const bio      = document.getElementById('settingBio').value.trim();
    const region   = document.getElementById('settingRegion').value.trim();
    const btn      = e.currentTarget;

    if (!nickname) { alert('닉네임을 입력해 주세요.'); return; }
    if (!window.db || !window.auth?.currentUser) { alert('로그인이 필요합니다.'); return; }

    btn.disabled = true;
    btn.textContent = '저장 중...';

    try {
        const uid = window.auth.currentUser.uid;

        await window.fs.updateDoc(window.fs.doc(window.db, 'users', uid), {
            nickname, bio, region
        });

        await window.authFuncs.updateProfile(window.auth.currentUser, { displayName: nickname });

        /* Spring 세션 닉네임도 동기화 */
        fetch('/api/auth/session', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ uid, nickname })
        });

        /* 상단 프로필 카드 즉시 반영 */
        setText('mpName',   nickname);
        setText('mpBio',    bio);
        setText('mpRegion', region);
        const avatar = document.getElementById('mpAvatar');
        if (avatar) avatar.textContent = nickname[0].toUpperCase();

        btn.textContent = '저장 완료!';
        setTimeout(() => {
            btn.disabled = false;
            btn.textContent = '저장';
            switchMypageTab('Dashboard', document.querySelector('.mypage-tab'));
        }, 800);
    } catch (err) {
        alert('저장 중 오류가 발생했습니다: ' + err.message);
        btn.disabled = false;
        btn.textContent = '저장';
    }
}
