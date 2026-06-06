let userIdChecked = false;
let phoneVerified  = false;
let smsTimerInterval = null;
let smsTimerSeconds  = 0;

// ===== 공통 메시지 헬퍼 =====
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

// ===== 아이디 중복확인 =====
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

// ===== 전화번호 인증 =====
function resetPhoneVerify() {
    if (phoneVerified) return; // 이미 인증 완료면 입력 막음
    phoneVerified = false;
    clearSmsTimer();
    document.getElementById('smsCodeRow').style.display = 'none';
    setMsg('msgPhone', '', false);
    setMsg('msgSms', '', false);
    const sendBtn = document.getElementById('smsSendBtn');
    sendBtn.textContent = '인증';
    sendBtn.disabled = false;
}

function clearSmsTimer() {
    if (smsTimerInterval) {
        clearInterval(smsTimerInterval);
        smsTimerInterval = null;
    }
    const timerEl = document.getElementById('smsTimer');
    if (timerEl) timerEl.textContent = '';
}

function startSmsTimer() {
    smsTimerSeconds = 5 * 60;
    updateTimerDisplay();
    clearSmsTimer();
    smsTimerInterval = setInterval(() => {
        smsTimerSeconds--;
        updateTimerDisplay();
        if (smsTimerSeconds <= 0) {
            clearSmsTimer();
            setMsg('msgSms', '인증 시간이 만료되었습니다. 재발송해 주세요.', false);
            const verifyBtn = document.getElementById('smsVerifyBtn');
            if (verifyBtn) verifyBtn.disabled = true;
        }
    }, 1000);
}

function updateTimerDisplay() {
    const el = document.getElementById('smsTimer');
    if (!el) return;
    const m = Math.floor(smsTimerSeconds / 60);
    const s = smsTimerSeconds % 60;
    el.textContent = m + ':' + String(s).padStart(2, '0');
}

async function sendSmsCode() {
    const rawPhone = document.getElementById('signupPhone').value.trim();
    const phone    = rawPhone.replace(/\D/g, '');

    if (!phone.match(/^01[0-9]{8,9}$/)) {
        setMsg('msgPhone', '올바른 전화번호를 입력해 주세요. (예: 01012345678)', false);
        return;
    }

    const sendBtn = document.getElementById('smsSendBtn');
    sendBtn.disabled  = true;
    sendBtn.textContent = '발송 중...';
    setMsg('msgPhone', '', false);
    setMsg('msgSms', '', false);

    try {
        const res  = await fetch('/api/sms/send', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ phone })
        });
        const data = await res.json();

        if (res.ok) {
            setMsg('msgPhone', '인증번호가 발송되었습니다.', true);
            document.getElementById('smsCodeRow').style.display = 'flex';
            const codeInput = document.getElementById('smsCode');
            codeInput.value    = '';
            codeInput.disabled = false;
            const verifyBtn = document.getElementById('smsVerifyBtn');
            verifyBtn.disabled    = false;
            verifyBtn.textContent = '확인';
            startSmsTimer();
            sendBtn.textContent = '재발송';
            // 재발송은 60초 후 허용
            setTimeout(() => { if (!phoneVerified) sendBtn.disabled = false; }, 60000);
        } else {
            setMsg('msgPhone', data.message || 'SMS 발송에 실패했습니다.', false);
            sendBtn.disabled    = false;
            sendBtn.textContent = '인증';
        }
    } catch {
        setMsg('msgPhone', '네트워크 오류가 발생했습니다.', false);
        sendBtn.disabled    = false;
        sendBtn.textContent = '인증';
    }
}

async function verifySmsCode() {
    const phone = document.getElementById('signupPhone').value.replace(/\D/g, '');
    const code  = document.getElementById('smsCode').value.trim();

    if (!code || code.length !== 6) {
        setMsg('msgSms', '6자리 인증번호를 입력해 주세요.', false);
        return;
    }

    const verifyBtn = document.getElementById('smsVerifyBtn');
    verifyBtn.disabled    = true;
    verifyBtn.textContent = '확인 중...';

    try {
        const res  = await fetch('/api/sms/verify', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ phone, code })
        });
        const data = await res.json();

        if (res.ok && data.verified) {
            phoneVerified = true;
            clearSmsTimer();
            setMsg('msgSms', '인증이 완료되었습니다.', true);
            // 인증 완료 후 입력 잠금
            document.getElementById('signupPhone').disabled = true;
            document.getElementById('smsCode').disabled     = true;
            document.getElementById('smsSendBtn').disabled  = true;
            verifyBtn.textContent = '인증완료';
            verifyBtn.classList.add('verified');
        } else {
            setMsg('msgSms', data.message || '인증번호가 올바르지 않습니다.', false);
            verifyBtn.disabled    = false;
            verifyBtn.textContent = '확인';
        }
    } catch {
        setMsg('msgSms', '네트워크 오류가 발생했습니다.', false);
        verifyBtn.disabled    = false;
        verifyBtn.textContent = '확인';
    }
}

// ===== 가입하기 =====
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
    setMsg('msgPhone', '', false);
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
    if (!phone || !phone.match(/^01[0-9]{8,9}$/)) {
        setMsg('msgPhone', '전화번호를 입력해 주세요.', false);
        return;
    }
    if (!phoneVerified) {
        setMsg('msgPhone', '전화번호 인증을 완료해 주세요.', false);
        return;
    }

    const btn = document.getElementById('signupSubmitBtn');
    btn.disabled    = true;
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
        btn.disabled    = false;
        btn.textContent = '가입하기';
        const errorMap = {
            'auth/email-already-in-use': '이미 사용 중인 아이디입니다.',
            'auth/weak-password':        '비밀번호는 8자 이상이어야 합니다.'
        };
        setGlobalMsg(errorMap[e.code] || '오류가 발생했습니다: ' + e.message, false);
    }
}
