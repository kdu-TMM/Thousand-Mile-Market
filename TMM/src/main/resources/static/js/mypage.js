/* ===== 탭 전환 ===== */
function switchMypageTab(tab, btn) {
    document.querySelectorAll('.mypage-tab').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    document.querySelectorAll('.mypage-tab-panel').forEach(p => p.style.display = 'none');
    document.getElementById('mpTab' + tab).style.display = 'block';

    if (tab === 'Trade') { _buyFilter = 'ongoing'; _sellFilter = 'active'; loadBuyList('ongoing'); }
}

/* ===== 프로필 카드 ===== */
function loadProfileCard() {
    if (!window.db || !window.auth?.currentUser) return;
    const uid = window.auth.currentUser.uid;
    window.fs.getDoc(window.fs.doc(window.db, 'users', uid)).then(snap => {
        if (!snap.exists()) return;
        const d = snap.data();
        setText('mpName',   d.nickname || d.name || '사용자');
        setText('mpBio',    d.bio      || '한 줄 소개를 입력해 주세요.');
        setText('mpRegion', d.region   ? '📍 ' + d.region : '');

        const avatar = document.getElementById('mpAvatar');
        if (avatar) {
            if (d.photoURL) {
                avatar.style.backgroundImage = `url(${d.photoURL})`;
                avatar.style.backgroundSize  = 'cover';
                avatar.textContent = '';
            } else {
                avatar.textContent = (d.nickname || d.userId || '?')[0].toUpperCase();
            }
            avatar.classList.remove('mp-skeleton');
        }
        ['mpName','mpBio','mpRegion'].forEach(id =>
            document.getElementById(id)?.classList.remove('mp-skeleton')
        );

        const rating = d.rating ?? 0;
        const trades = d.totalTrades ?? 0;
        setText('mpRatingValue', rating.toFixed(1));
        setText('mpTotalTrades', String(trades));
        renderStars('mpStars', rating);
        ['mpRatingValue','mpTotalTrades'].forEach(id =>
            document.getElementById(id)?.classList.remove('mp-skeleton')
        );
    }).catch(() => {});
}

function renderStars(elId, rating) {
    const el = document.getElementById(elId);
    if (!el) return;
    let html = '';
    for (let i = 1; i <= 5; i++) {
        if (rating >= i)         html += '<i class="fa-solid fa-star"></i>';
        else if (rating >= i - 0.5) html += '<i class="fa-solid fa-star-half-stroke"></i>';
        else                     html += '<i class="fa-regular fa-star"></i>';
    }
    el.innerHTML = html;
}

/* ===== 내 정보 탭 ===== */
let _originalNickname  = '';
let _nicknameChecked   = false;
let _nicknameChangedAt = null;

function _nicknameRemainingDays() {
    if (!_nicknameChangedAt) return 0;
    const d = _nicknameChangedAt?.toDate ? _nicknameChangedAt.toDate() : new Date(_nicknameChangedAt);
    return Math.max(0, Math.ceil(30 - (Date.now() - d.getTime()) / 86400000));
}

function loadUserInfo() {
    const loading = document.getElementById('mpInfoLoading');
    const errEl   = document.getElementById('mpInfoError');

    if (!window.db || !window.auth?.currentUser) {
        if (loading) loading.style.display = 'none';
        if (errEl)   errEl.style.display = 'block';
        return;
    }
    if (loading) loading.style.display = 'block';
    if (errEl)   errEl.style.display = 'none';

    const uid = window.auth.currentUser.uid;
    window.fs.getDoc(window.fs.doc(window.db, 'users', uid))
        .then(snap => {
            if (loading) loading.style.display = 'none';
            if (!snap.exists()) { if (errEl) errEl.style.display = 'block'; return; }
            const d = snap.data();

            setVal('infoUserId',      d.userId || window.auth.currentUser.email || '-');
            setVal('settingNickname', d.nickname || '');
            setVal('settingBio',      d.bio      || '');
            setVal('settingPhone',    d.phone    || '');
            setVal('settingRegion',   d.region   || '');
            setVal('infoCreatedAt',   formatDate(d.createdAt));

            _originalNickname  = d.nickname || '';
            _nicknameChangedAt = d.nicknameChangedAt ?? null;
            _nicknameChecked   = true;

            const remaining = _nicknameRemainingDays();
            if (remaining > 0) {
                showFieldMsg('nicknameMsg', `마지막 변경 후 ${remaining}일 남았습니다. (30일 이후 변경 가능)`, 'info');
                const nickInput = document.getElementById('settingNickname');
                const checkBtn  = document.querySelector('[onclick="checkNicknameDup()"]');
                if (nickInput) nickInput.disabled = true;
                if (checkBtn)  checkBtn.disabled  = true;
            }
        })
        .catch(() => {
            if (loading) loading.style.display = 'none';
            if (errEl)   errEl.style.display = 'block';
        });
}

function checkNicknameDup() {
    const remaining = _nicknameRemainingDays();
    if (remaining > 0) {
        showFieldMsg('nicknameMsg', `닉네임은 마지막 변경 후 30일 이후 변경 가능합니다. (${remaining}일 남음)`, 'error');
        return;
    }
    const nickname = document.getElementById('settingNickname').value.trim();
    if (!nickname) { showFieldMsg('nicknameMsg', '닉네임을 입력해 주세요.', 'error'); return; }
    const nickRegEx = /^[가-힣a-zA-Z0-9]+$/;
    if (!nickRegEx.test(nickname)) {
        showFieldMsg('nicknameMsg', '닉네임은 한글/영문/숫자만 사용할 수 있습니다.', 'error');
        return;
    }
    if (!window.db || !window.auth?.currentUser) { showFieldMsg('nicknameMsg', '로그인이 필요합니다.', 'error'); return; }

    const uid = window.auth.currentUser.uid;
    showFieldMsg('nicknameMsg', '확인 중...', '');

    window.fs.getDocs(window.fs.query(
        window.fs.collection(window.db, 'users'),
        window.fs.where('nickname', '==', nickname)
    )).then(snap => {
        const others = snap.docs.filter(d => d.id !== uid);
        if (others.length > 0) {
            showFieldMsg('nicknameMsg', '이미 사용 중인 닉네임입니다.', 'error');
            _nicknameChecked = false;
        } else {
            showFieldMsg('nicknameMsg', '사용 가능한 닉네임입니다.', 'ok');
            _nicknameChecked = true;
        }
    }).catch(() => showFieldMsg('nicknameMsg', '확인 중 오류가 발생했습니다.', 'error'));
}

function requestPhoneVerify() {
    const phone  = document.getElementById('settingPhone').value.trim();
    if (!phone) { showFieldMsg('phoneMsg', '전화번호를 입력해 주세요.', 'error'); return; }
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 10) { showFieldMsg('phoneMsg', '올바른 전화번호를 입력해 주세요.', 'error'); return; }
    showFieldMsg('phoneMsg', '인증 기능은 준비 중입니다.', 'info');
}

async function saveMypageSettings(e) {
    const nickname = document.getElementById('settingNickname').value.trim();
    const bio      = document.getElementById('settingBio').value.trim();
    const phone    = document.getElementById('settingPhone').value.trim();
    const region   = document.getElementById('settingRegion').value.trim();
    const btn      = e.currentTarget;

    if (!nickname) { showFieldMsg('nicknameMsg', '닉네임을 입력해 주세요.', 'error'); return; }

    const nicknameChanged = nickname !== _originalNickname;
    if (nicknameChanged) {
        const remaining = _nicknameRemainingDays();
        if (remaining > 0) {
            showFieldMsg('nicknameMsg', `닉네임 변경은 ${remaining}일 후 가능합니다.`, 'error');
            return;
        }
        const nickRegEx = /^[가-힣a-zA-Z0-9]+$/;
        if (!nickRegEx.test(nickname)) {
            showFieldMsg('nicknameMsg', '닉네임은 한글/영문/숫자만 사용할 수 있습니다.', 'error');
            return;
        }
        if (!_nicknameChecked) {
            showFieldMsg('nicknameMsg', '닉네임 중복 확인을 해주세요.', 'error');
            return;
        }
    }
    if (!window.db || !window.auth?.currentUser) { alert('로그인이 필요합니다.'); return; }

    btn.disabled = true;
    btn.textContent = '저장 중...';

    try {
        const uid        = window.auth.currentUser.uid;
        const updateData = { bio, phone, region };
        if (nicknameChanged) {
            updateData.nickname          = nickname;
            updateData.nicknameChangedAt = window.fs.serverTimestamp();
            _nicknameChangedAt           = new Date();
        }

        await window.fs.updateDoc(window.fs.doc(window.db, 'users', uid), updateData);
        await window.authFuncs?.updateProfile(window.auth.currentUser, { displayName: nickname });
        fetch('/api/auth/session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ uid, nickname })
        }).catch(() => {});

        _originalNickname = nickname;
        setText('mpName',   nickname);
        setText('mpBio',    bio || '한 줄 소개를 입력해 주세요.');
        setText('mpRegion', region ? '📍 ' + region : '');
        const avatar = document.getElementById('mpAvatar');
        if (avatar && !avatar.style.backgroundImage)
            avatar.textContent = nickname[0].toUpperCase();

        if (nicknameChanged) {
            const nickInput = document.getElementById('settingNickname');
            const checkBtn  = document.querySelector('[onclick="checkNicknameDup()"]');
            showFieldMsg('nicknameMsg', '닉네임이 변경되었습니다. 다음 변경은 30일 후 가능합니다.', 'info');
            if (nickInput) nickInput.disabled = true;
            if (checkBtn)  checkBtn.disabled  = true;
        }

        btn.textContent = '저장 완료!';
        setTimeout(() => { btn.disabled = false; btn.textContent = '저장'; }, 1000);
    } catch (err) {
        alert('저장 중 오류: ' + err.message);
        btn.disabled = false;
        btn.textContent = '저장';
    }
}

/* 닉네임 변경 시 중복확인 초기화 */
document.getElementById('settingNickname')?.addEventListener('input', () => {
    _nicknameChecked = false;
    showFieldMsg('nicknameMsg', '', '');
});

/* ===== 아바타 업로드 ===== */
function triggerAvatarUpload() {
    document.getElementById('mpAvatarInput')?.click();
}

async function uploadAvatar(input) {
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    if (!window.auth?.currentUser || !window.storage || !window.storageUtils) {
        alert('이미지 업로드를 사용할 수 없습니다.');
        return;
    }
    const uid    = window.auth.currentUser.uid;
    const avatar = document.getElementById('mpAvatar');

    /* 즉시 미리보기 */
    const reader = new FileReader();
    reader.onload = (ev) => {
        if (avatar) {
            avatar.style.backgroundImage = `url(${ev.target.result})`;
            avatar.style.backgroundSize  = 'cover';
            avatar.textContent = '';
        }
    };
    reader.readAsDataURL(file);

    try {
        const { ref, uploadBytes, getDownloadURL } = window.storageUtils;
        const sRef = ref(window.storage, `avatars/${uid}`);
        await uploadBytes(sRef, file);
        const url = await getDownloadURL(sRef);

        await window.fs.updateDoc(window.fs.doc(window.db, 'users', uid), { photoURL: url });
        await window.authFuncs?.updateProfile(window.auth.currentUser, { photoURL: url });

        if (avatar) {
            avatar.style.backgroundImage = `url(${url})`;
            avatar.style.backgroundSize  = 'cover';
            avatar.textContent = '';
        }
    } catch (err) {
        alert('업로드 오류: ' + err.message);
        if (avatar) {
            avatar.style.backgroundImage = '';
            avatar.textContent = (window.auth?.currentUser?.displayName || '?')[0].toUpperCase();
        }
    }
}

/* ===== 비밀번호 변경 ===== */
function togglePwSection() {
    const form  = document.getElementById('mpPwForm');
    const arrow = document.getElementById('mpPwArrow');
    const isOpen = form.style.display !== 'none';
    form.style.display = isOpen ? 'none' : 'block';
    arrow.style.transform = isOpen ? '' : 'rotate(180deg)';
    if (!isOpen) {
        document.getElementById('currentPw').value    = '';
        document.getElementById('newPw').value        = '';
        document.getElementById('newPwConfirm').value = '';
        showFieldMsg('pwChangeMsg', '', '');
        document.getElementById('currentPw').focus();
    }
}

async function changePassword(e) {
    const currentPw    = document.getElementById('currentPw').value;
    const newPw        = document.getElementById('newPw').value;
    const newPwConfirm = document.getElementById('newPwConfirm').value;
    const btn          = e.currentTarget;

    showFieldMsg('pwChangeMsg', '', '');

    if (!currentPw) { showFieldMsg('pwChangeMsg', '현재 비밀번호를 입력해 주세요.', 'error'); return; }

    const pwRegEx = /^[\w!#@\-]{8,16}$/;
    if (!pwRegEx.test(newPw)) {
        showFieldMsg('pwChangeMsg', '새 비밀번호는 8~16자, 영문·숫자·특수문자(!@#-)만 가능합니다.', 'error');
        return;
    }
    if (newPw !== newPwConfirm) {
        showFieldMsg('pwChangeMsg', '새 비밀번호가 일치하지 않습니다.', 'error');
        return;
    }
    if (!window.auth?.currentUser || !window.authFuncs) {
        showFieldMsg('pwChangeMsg', '로그인이 필요합니다.', 'error');
        return;
    }

    btn.disabled = true;
    btn.textContent = '변경 중...';

    try {
        const user = window.auth.currentUser;
        const cred = window.authFuncs.EmailAuthProvider.credential(user.email, currentPw);
        await window.authFuncs.reauthenticateWithCredential(user, cred);
        await window.authFuncs.updatePassword(user, newPw);

        showFieldMsg('pwChangeMsg', '비밀번호가 변경되었습니다.', 'ok');
        document.getElementById('currentPw').value    = '';
        document.getElementById('newPw').value        = '';
        document.getElementById('newPwConfirm').value = '';
        setTimeout(() => {
            togglePwSection();
        }, 1500);
    } catch (err) {
        const errMap = {
            'auth/wrong-password':     '현재 비밀번호가 올바르지 않습니다.',
            'auth/invalid-credential': '현재 비밀번호가 올바르지 않습니다.',
            'auth/too-many-requests':  '잠시 후 다시 시도해 주세요.',
            'auth/weak-password':      '새 비밀번호가 너무 약합니다. 더 강력한 비밀번호를 사용해 주세요.'
        };
        showFieldMsg('pwChangeMsg', errMap[err.code] || '오류: ' + err.message, 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = '비밀번호 변경';
    }
}

/* ===== 거래 탭 ===== */
let _tradeTab   = 'buy';
let _buyFilter  = 'ongoing';
let _sellFilter = 'active';

function switchTradeTab(tab, btn) {
    _tradeTab = tab;
    document.querySelectorAll('.mp-sub-tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('tradeBuyPanel').style.display  = tab === 'buy'  ? 'block' : 'none';
    document.getElementById('tradeSellPanel').style.display = tab === 'sell' ? 'block' : 'none';
    if (tab === 'buy')  loadBuyList(_buyFilter);
    if (tab === 'sell') loadSellList(_sellFilter);
}

function switchBuyFilter(filter, btn) {
    _buyFilter = filter;
    document.querySelectorAll('#buyFilterTabs .mp-filter-tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    loadBuyList(filter);
}

function switchSellFilter(filter, btn) {
    _sellFilter = filter;
    document.querySelectorAll('#sellFilterTabs .mp-filter-tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    loadSellList(filter);
}

function loadBuyList(filter) {
    const list = document.getElementById('buyList');
    if (!window.db || !window.auth?.currentUser) {
        list.innerHTML = '<p class="order-empty">로그인이 필요합니다.</p>';
        return;
    }
    list.innerHTML = '<p class="order-empty">불러오는 중...</p>';
    const uid = window.auth.currentUser.uid;

    let q;
    if (filter === 'auction') {
        q = window.fs.query(
            window.fs.collection(window.db, 'products'),
            window.fs.where('type', '==', 'auction'),
            window.fs.where('bidderUids', 'array-contains', uid)
        );
    } else {
        q = window.fs.query(
            window.fs.collection(window.db, 'products'),
            window.fs.where('buyerUid', '==', uid)
        );
    }

    window.fs.getDocs(q).then(async snap => {
        list.innerHTML = '';
        let items = snap.docs.map(d => ({ id: d.id, ...d.data() }));

        if (filter === 'ongoing') items = items.filter(p => p.status !== '판매완료');
        if (filter === 'done')    items = items.filter(p => p.status === '판매완료');

        if (!items.length) { list.innerHTML = '<p class="order-empty">내역이 없습니다.</p>'; return; }

        let myRatings = {};
        if (filter === 'done') {
            try {
                const rSnap = await window.fs.getDocs(window.fs.query(
                    window.fs.collection(window.db, 'reviews'),
                    window.fs.where('reviewerUid', '==', uid)
                ));
                rSnap.docs.forEach(d => { myRatings[d.data().productId] = true; });
            } catch {}
        }

        items.forEach(p => {
            const price = p.type === 'auction'
                ? '현재가 ' + (p.currentPrice ?? 0).toLocaleString() + '원'
                : (p.price ?? 0).toLocaleString() + '원';

            let actionBtn = '';
            if (filter === 'done') {
                actionBtn = myRatings[p.id]
                    ? '<span class="mp-rated-badge">별점 완료</span>'
                    : `<button class="mp-rate-btn" onclick="event.stopPropagation();openRatingModal('${p.id}','${p.sellerUid || ''}')">별점 주기</button>`;
            } else if (filter === 'ongoing') {
                actionBtn = `<button class="mp-chat-btn" onclick="event.stopPropagation();location.href='/chat'">채팅하기</button>`;
            }

            const thumb = p.imageUrls?.[0] ? `<img src="${p.imageUrls[0]}" alt="">` : '';
            const div = document.createElement('div');
            div.className = 'mp-trade-item';
            div.onclick = () => location.href = '/product/' + p.id;
            div.innerHTML = `
                <div class="mp-trade-thumb">${thumb}</div>
                <div class="mp-trade-info">
                    <p class="mp-trade-name">${p.title}</p>
                    <p class="mp-trade-price">${price}</p>
                    <p class="mp-trade-date">${(p.date ?? '').slice(0, 10)}</p>
                </div>
                <div class="mp-trade-action">${actionBtn}</div>`;
            list.appendChild(div);
        });
    }).catch(() => { list.innerHTML = '<p class="order-empty">불러오기 실패. 다시 시도해 주세요.</p>'; });
}

function loadSellList(filter) {
    const list = document.getElementById('sellList');
    if (!window.db || !window.auth?.currentUser) {
        list.innerHTML = '<p class="order-empty">로그인이 필요합니다.</p>';
        return;
    }
    list.innerHTML = '<p class="order-empty">불러오는 중...</p>';
    const uid = window.auth.currentUser.uid;

    window.fs.getDocs(window.fs.query(
        window.fs.collection(window.db, 'products'),
        window.fs.where('sellerUid', '==', uid)
    )).then(snap => {
        list.innerHTML = '';
        let items = snap.docs.map(d => ({ id: d.id, ...d.data() }));

        if (filter === 'active')  items = items.filter(p => ['판매중','경매중','예약중'].includes(p.status));
        if (filter === 'done')    items = items.filter(p => p.status === '판매완료');
        if (filter === 'expired') items = items.filter(p => p.status === '만료');

        if (!items.length) { list.innerHTML = '<p class="order-empty">내역이 없습니다.</p>'; return; }

        const badgeMap = {
            '판매중':  '<span class="mp-badge active">판매중</span>',
            '경매중':  '<span class="mp-badge auction">경매중</span>',
            '예약중':  '<span class="mp-badge reserved">예약중</span>',
            '판매완료': '<span class="mp-badge done">판매완료 <span class="mp-hidden-rating">별점 미공개</span></span>',
            '만료':    '<span class="mp-badge expired">만료</span>'
        };

        items.forEach(p => {
            const price = p.type === 'auction'
                ? '현재가 ' + (p.currentPrice ?? 0).toLocaleString() + '원'
                : (p.price ?? 0).toLocaleString() + '원';
            const thumb = p.imageUrls?.[0] ? `<img src="${p.imageUrls[0]}" alt="">` : '';
            const div = document.createElement('div');
            div.className = 'mp-trade-item';
            div.onclick = () => location.href = '/product/' + p.id;
            div.innerHTML = `
                <div class="mp-trade-thumb">${thumb}</div>
                <div class="mp-trade-info">
                    <p class="mp-trade-name">${p.title}</p>
                    <p class="mp-trade-price">${price}</p>
                    <p class="mp-trade-date">${(p.date ?? '').slice(0, 10)}</p>
                </div>
                <div class="mp-trade-action">${badgeMap[p.status] || ''}</div>`;
            list.appendChild(div);
        });
    }).catch(() => { list.innerHTML = '<p class="order-empty">불러오기 실패. 다시 시도해 주세요.</p>'; });
}

/* ===== 별점 리뷰 모달 ===== */
let _ratingProductId = null;
let _ratingSellerUid = null;
let _selectedRating  = 0;

function openRatingModal(productId, sellerUid) {
    _ratingProductId = productId;
    _ratingSellerUid = sellerUid;
    _selectedRating  = 0;
    document.querySelectorAll('.rating-star').forEach(s => {
        s.className = 'rating-star fa-regular fa-star';
    });
    document.getElementById('ratingComment').value = '';
    document.getElementById('ratingMsg').textContent = '';
    document.getElementById('ratingMsg').className = 'rating-msg';
    document.getElementById('ratingModal').style.display = 'flex';
}

function closeRatingModal(e) {
    if (e && e.target !== document.getElementById('ratingModal')) return;
    document.getElementById('ratingModal').style.display = 'none';
}

function selectStar(rating) {
    _selectedRating = rating;
    document.querySelectorAll('.rating-star').forEach((s, i) => {
        s.className = i < rating ? 'rating-star fa-solid fa-star' : 'rating-star fa-regular fa-star';
    });
}

async function submitRating() {
    if (!_selectedRating) { document.getElementById('ratingMsg').textContent = '별점을 선택해 주세요.'; return; }
    if (!window.db || !window.auth?.currentUser) { document.getElementById('ratingMsg').textContent = '로그인이 필요합니다.'; return; }

    const uid     = window.auth.currentUser.uid;
    const comment = document.getElementById('ratingComment').value.trim();
    const btn     = document.querySelector('.rating-submit-btn');
    btn.disabled  = true;

    try {
        await window.fs.addDoc(window.fs.collection(window.db, 'reviews'), {
            productId:   _ratingProductId,
            reviewerUid: uid,
            targetUid:   _ratingSellerUid,
            rating:      _selectedRating,
            comment,
            createdAt:   window.fs.serverTimestamp()
        });

        if (_ratingSellerUid) {
            const rSnap = await window.fs.getDocs(window.fs.query(
                window.fs.collection(window.db, 'reviews'),
                window.fs.where('targetUid', '==', _ratingSellerUid)
            ));
            const ratings = rSnap.docs.map(d => d.data().rating);
            const avg = ratings.reduce((a, b) => a + b, 0) / ratings.length;
            await window.fs.updateDoc(window.fs.doc(window.db, 'users', _ratingSellerUid), {
                rating:      Math.round(avg * 10) / 10,
                totalTrades: ratings.length
            });
        }

        const msg = document.getElementById('ratingMsg');
        msg.textContent = '리뷰가 등록되었습니다.';
        msg.className   = 'rating-msg ok';
        setTimeout(() => {
            document.getElementById('ratingModal').style.display = 'none';
            loadBuyList('done');
        }, 1000);
    } catch (err) {
        document.getElementById('ratingMsg').textContent = '오류: ' + err.message;
    } finally {
        btn.disabled = false;
    }
}

/* ===== 회원탈퇴 ===== */
function doSecession() {
    const pw      = document.getElementById('secessionPw').value;
    const msg     = document.getElementById('secessionMsg');
    const checks  = document.querySelectorAll('.secession-check');
    const anyChecked = [...checks].some(c => c.checked);

    if (!anyChecked) { msg.textContent = '탈퇴 사유를 하나 이상 선택해 주세요.'; msg.className = 'secession-msg'; return; }
    if (!pw)         { msg.textContent = '비밀번호를 입력해 주세요.';            msg.className = 'secession-msg'; return; }
    if (!window.auth?.currentUser || !window.authFuncs) { msg.textContent = '로그인이 필요합니다.'; msg.className = 'secession-msg'; return; }
    if (!confirm('정말 탈퇴하시겠습니까? 모든 데이터가 삭제됩니다.')) return;

    const user = window.auth.currentUser;
    window.authFuncs.signInWithEmailAndPassword(window.auth, user.email, pw)
        .then(() => user.delete())
        .then(() => { alert('탈퇴가 완료되었습니다.'); location.href = '/'; })
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

/* ===== 헬퍼 ===== */
function setText(id, val) { const el = document.getElementById(id); if (el) el.textContent = val; }
function setVal(id, val)  { const el = document.getElementById(id); if (el) el.value = val; }

function showFieldMsg(id, text, type) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = text;
    el.className   = 'mp-field-msg' + (type ? ' ' + type : '');
}

function formatDate(iso) {
    if (!iso) return '-';
    if (iso?.toDate) iso = iso.toDate().toISOString();
    return String(iso).slice(0, 10).replace(/-/g, '.');
}

/* ===== 초기화 ===== */
let _mypageInitDone = false;

function initMypage(e) {
    const user = e?.detail?.user ?? window.auth?.currentUser;
    if (!user || _mypageInitDone) return;
    _mypageInitDone = true;
    loadProfileCard();
    loadUserInfo();
}

window.addEventListener('firebase-ready', initMypage);
window.addEventListener('auth-changed',   initMypage);
if (window.firebaseReady) initMypage();
