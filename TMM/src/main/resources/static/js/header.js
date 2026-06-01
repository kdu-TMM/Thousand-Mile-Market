function openLoginModal() {
    document.getElementById('loginModal').classList.add('active');
    const userIdEl = document.getElementById('loginUserId');
    const pwEl     = document.getElementById('loginPw');
    const msg      = document.getElementById('loginMsg');
    const btn      = document.getElementById('loginSubmitBtn');
    if (userIdEl) userIdEl.value = '';
    if (pwEl)     pwEl.value = '';
    if (msg)  { msg.textContent = ''; msg.className = 'verify-msg'; }
    if (btn)  { btn.disabled = false; btn.textContent = '로그인'; }
}

function closeLoginModal(e) {
    if (!e || e.target === document.getElementById('loginModal')) {
        document.getElementById('loginModal').classList.remove('active');
    }
}

async function doLogin() {
    if (!window.auth || !window.authFuncs) return;
    const userId = document.getElementById('loginUserId').value.trim();
    const pw     = document.getElementById('loginPw').value;
    const msg    = document.getElementById('loginMsg');
    const btn    = document.getElementById('loginSubmitBtn');

    function setErr(text) {
        msg.textContent = text;
        msg.className = 'verify-msg err';
        btn.disabled = false;
        btn.textContent = '로그인';
    }

    if (!userId || !pw) {
        setErr('아이디와 비밀번호를 입력해 주세요.');
        return;
    }

    btn.disabled = true;
    btn.textContent = '로그인 중...';

    try {
        const internalEmail = userId.toLowerCase() + '@tmm.app';
        const cred = await window.authFuncs.signInWithEmailAndPassword(window.auth, internalEmail, pw);

        /* 정지 여부 + 관리자 여부 확인 (getDoc 1회) */
        let isAdmin = false;
        if (window.fs && window.db) {
            const userDoc = await window.fs.getDoc(window.fs.doc(window.db, 'users', cred.user.uid));
            if (userDoc.exists()) {
                const data = userDoc.data();
                if (data.suspended) {
                    const until = data.suspendedUntil ? new Date(data.suspendedUntil) : null;
                    if (!until) {
                        /* 영구 정지 */
                        await window.authFuncs.signOut(window.auth);
                        setErr('영구 정지된 계정입니다. 고객센터에 문의해 주세요.');
                        return;
                    }
                    if (until > new Date()) {
                        const days = Math.ceil((until - Date.now()) / 86400000);
                        await window.authFuncs.signOut(window.auth);
                        setErr(`정지된 계정입니다. 해제까지 ${days}일 남았습니다.`);
                        return;
                    }
                    /* 정지 기간 만료 → 자동 해제 */
                    await window.fs.updateDoc(
                        window.fs.doc(window.db, 'users', cred.user.uid),
                        { suspended: false, suspendedUntil: null }
                    );
                }
                isAdmin = data.isAdmin === true;
            }
        }

        /* Spring 세션 동기화 (채팅 등 서버 세션 필요 기능용) */
        fetch('/api/auth/session', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({
                uid:      cred.user.uid,
                nickname: cred.user.displayName || userId
            })
        });
        closeLoginModal();

        /* 관리자 → /admin, 일반 사용자 → / */
        location.href = isAdmin ? '/admin' : '/';
    } catch (e) {
        const errorMap = {
            'auth/user-not-found':     '존재하지 않는 아이디입니다.',
            'auth/wrong-password':     '잘못된 비밀번호입니다.',
            'auth/invalid-credential': '아이디 또는 비밀번호가 올바르지 않습니다.',
            'auth/too-many-requests':  '잠시 후 다시 시도해 주세요.',
            'auth/user-disabled':      '비활성화된 계정입니다.'
        };
        setErr(errorMap[e.code] || '로그인 실패: ' + e.message);
    }
    return false;
}

async function doLogout() {
    if (!window.authFuncs) return;
    await window.authFuncs.signOut(window.auth);
    fetch('/api/auth/session', { method: 'DELETE' });
    location.href = '/';
}

function updateAuthUI(user, isAdmin = false) {
    const bar  = document.getElementById('utilityBar');
    const menu = document.getElementById('headerMenu');
    if (!bar) return;

    if (user) {
        const name = user.displayName || user.email.split('@')[0];
        if (isAdmin) {
            /* 관리자: 마이페이지 숨김, 헤더 메뉴 숨김 */
            bar.innerHTML =
                `<span style="font-size:13px;color:#555;padding:0 4px">${name}님</span>` +
                `<span class="utility-divider">|</span>` +
                `<button onclick="doLogout()">로그아웃</button>`;
            if (menu) menu.style.visibility = 'hidden';
        } else {
            /* 일반 사용자 */
            bar.innerHTML =
                `<span style="font-size:13px;color:#555;padding:0 4px">${name}님</span>` +
                `<span class="utility-divider">|</span>` +
                `<button onclick="location.href='/mypage'">마이페이지</button>` +
                `<span class="utility-divider">|</span>` +
                `<button onclick="doLogout()">로그아웃</button>`;
            if (menu) menu.style.visibility = '';
        }
    } else {
        bar.innerHTML =
            `<button onclick="openLoginModal()">로그인</button>` +
            `<span class="utility-divider">|</span>` +
            `<button onclick="location.href='/signup'">회원가입</button>`;
        if (menu) menu.style.visibility = '';
    }
}

function initAuthListener() {
    window.authFuncs.onAuthStateChanged(window.auth, async (user) => {
        if (user && window.fs && window.db) {
            try {
                const snap = await window.fs.getDoc(window.fs.doc(window.db, 'users', user.uid));
                const isAdmin = snap.exists() && snap.data().isAdmin === true;
                updateAuthUI(user, isAdmin);
            } catch (e) {
                updateAuthUI(user, false);
            }
        } else {
            updateAuthUI(user, false);
        }
    });
}

if (window.auth && window.authFuncs) initAuthListener();
else window.addEventListener('firebase-ready', initAuthListener);

function toggleHqm(id) {
    const panel = document.getElementById(id);
    const isOpen = panel.classList.contains('open');
    document.querySelectorAll('.hqm-panel').forEach(p => p.classList.remove('open'));
    if (!isOpen) panel.classList.add('open');
}

function closeHqm(id) {
    document.getElementById(id).classList.remove('open');
}

function doSearch() {
    const q = document.getElementById('searchInput').value.trim();
    if (q) location.href = '/?q=' + encodeURIComponent(q);
}

document.addEventListener('click', function (e) {
    if (!e.target.closest('.hqm-wrap')) {
        document.querySelectorAll('.hqm-panel').forEach(p => p.classList.remove('open'));
    }
});

document.addEventListener('DOMContentLoaded', function () {
    const input = document.getElementById('searchInput');
    if (input) {
        input.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') doSearch();
        });
    }

    ['loginUserId', 'loginPw'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
    });
});
