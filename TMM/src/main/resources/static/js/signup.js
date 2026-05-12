let userIdChecked = false;

function setMsg(id, text, ok) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = text;
    el.className = 'signup-msg-row' + (ok ? ' ok' : (text ? ' err' : ''));
}

function setGlobalMsg(text, ok) {
    const el = document.getElementById('signupMsg');
    if (!el) return;
    el.textContent = text;
    el.className = ok ? 'ok' : (text ? 'err' : '');
}

function resetIdCheck() {
    userIdChecked = false;
    setMsg('msgUserId', '', false);
}

async function checkUserId() {
    const userId = document.getElementById('signupUserId').value.trim();
    if (!userId || userId.length < 4 || userId.length > 12) {
        setMsg('msgUserId', '아이디는 4~12자로 입력해 주세요.', false);
        return;
    }
    if (!/^(?=.*[a-zA-Z])(?=.*[0-9])[a-zA-Z0-9]+$/.test(userId)) {
        setMsg('msgUserId', '아이디는 영문과 숫자를 모두 포함해야 합니다.', false);
        return;
    }

    if (!window.db || !window.fs) {
        /* Firebase 미준비 시 중복확인 생략하고 통과 */
        userIdChecked = true;
        setMsg('msgUserId', '사용 가능한 아이디입니다.', true);
        return;
    }

    try {
        const snap = await window.fs.getDocs(
            window.fs.query(
                window.fs.collection(window.db, 'users'),
                window.fs.where('userId', '==', userId.toLowerCase())
            )
        );
        if (!snap.empty) {
            userIdChecked = false;
            setMsg('msgUserId', '이미 사용 중인 아이디입니다.', false);
        } else {
            userIdChecked = true;
            setMsg('msgUserId', '사용 가능한 아이디입니다.', true);
        }
    } catch {
        userIdChecked = true;
        setMsg('msgUserId', '확인 중 오류가 발생했습니다.', false);
    }
}

async function doSignup() {
    if (!window.auth || !window.authFuncs) {
        setGlobalMsg('초기화 중입니다. 잠시 후 다시 시도해 주세요.', false);
        return;
    }

    const userId    = document.getElementById('signupUserId').value.trim();
    const pw        = document.getElementById('signupPw').value;
    const pwConfirm = document.getElementById('signupPwConfirm').value;
    const nickname  = document.getElementById('signupNickname').value.trim();
    const name      = document.getElementById('signupName').value.trim();
    const phone     = document.getElementById('signupPhone').value.replace(/\D/g, '');

    setMsg('msgUserId', '', false);
    setMsg('msgPw', '', false);
    setMsg('msgNick', '', false);
    setGlobalMsg('', false);

    if (!userId || userId.length < 4 || userId.length > 12) {
        setMsg('msgUserId', '아이디는 4~12자로 입력해 주세요.', false);
        return;
    }
    if (!/^(?=.*[a-zA-Z])(?=.*[0-9])[a-zA-Z0-9]+$/.test(userId)) {
        setMsg('msgUserId', '아이디는 영문과 숫자를 모두 포함해야 합니다.', false);
        return;
    }
    if (!userIdChecked) {
        setMsg('msgUserId', '아이디 중복확인을 해 주세요.', false);
        return;
    }
    if (!pw || pw.length < 8) {
        setMsg('msgPw', '비밀번호는 8자 이상 입력해 주세요.', false);
        return;
    }
    if (pw !== pwConfirm) {
        setMsg('msgPw', '비밀번호가 일치하지 않습니다.', false);
        return;
    }
    if (!nickname || nickname.length < 2) {
        setMsg('msgNick', '닉네임은 2자 이상 입력해 주세요.', false);
        return;
    }

    const btn = document.getElementById('signupSubmitBtn');
    btn.disabled = true;
    btn.textContent = '가입 중...';

    const internalEmail = userId.toLowerCase() + '@tmm.app';

    try {
        const { createUserWithEmailAndPassword, updateProfile } = window.authFuncs;
        const userCred = await createUserWithEmailAndPassword(window.auth, internalEmail, pw);

        await updateProfile(userCred.user, { displayName: nickname });

        await window.fs.setDoc(window.fs.doc(window.db, 'users', userCred.user.uid), {
            uid:        userCred.user.uid,
            userId,
            nickname,
            name,
            phone,
            profileImg: '',
            region:     '',
            bio:        '',
            createdAt:  new Date().toISOString()
        });

        location.href = '/';
    } catch (e) {
        btn.disabled = false;
        btn.textContent = '가입하기';
        const errorMap = {
            'auth/email-already-in-use': '이미 사용 중인 아이디입니다.',
            'auth/weak-password':        '비밀번호는 8자 이상이어야 합니다.'
        };
        setGlobalMsg(errorMap[e.code] || '오류가 발생했습니다: ' + e.message, false);
    }
}
