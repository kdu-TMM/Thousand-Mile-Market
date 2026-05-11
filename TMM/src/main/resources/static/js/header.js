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
    if (!window.auth || !window.authFuncs) return false;
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
        return false;
    }

    btn.disabled = true;
    btn.textContent = '로그인 중...';

    try {
        /* Firestore에서 아이디로 이메일 조회 */
        const { fs, db } = window;
        const snap = await fs.getDocs(
            fs.query(fs.collection(db, 'users'), fs.where('userId', '==', userId))
        );
        if (snap.empty) {
            setErr('존재하지 않는 아이디입니다.');
            return false;
        }
        const email = snap.docs[0].data().email;

        await window.authFuncs.signInWithEmailAndPassword(window.auth, email, pw);
        closeLoginModal();
    } catch (e) {
        const errorMap = {
            'auth/wrong-password':     '잘못된 비밀번호입니다.',
            'auth/invalid-credential': '잘못된 비밀번호입니다.',
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
}

function updateAuthUI(user) {
    const bar = document.getElementById('utilityBar');
    if (!bar) return;
    if (user) {
        const name = user.displayName || user.email.split('@')[0];
        bar.innerHTML =
            `<span style="font-size:13px;color:#555;padding:0 4px">${name}님</span>` +
            `<span class="utility-divider">|</span>` +
            `<button onclick="location.href='/mypage'">마이페이지</button>` +
            `<span class="utility-divider">|</span>` +
            `<button onclick="doLogout()">로그아웃</button>`;
    } else {
        bar.innerHTML =
            `<button onclick="openLoginModal()">로그인</button>` +
            `<span class="utility-divider">|</span>` +
            `<button onclick="location.href='/verify'">회원가입</button>`;
    }
}

function initAuthListener() {
    window.authFuncs.onAuthStateChanged(window.auth, updateAuthUI);
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
});
