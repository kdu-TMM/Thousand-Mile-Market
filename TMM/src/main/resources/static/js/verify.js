console.log('[verify.js] 파일 로드 시작');

let timerInterval = null;
let confirmationResult = null;

function resetRecaptcha() {
    if (window.recaptchaVerifier) {
        try { window.recaptchaVerifier.clear(); } catch (e) {}
        window.recaptchaVerifier = null;
    }
    const container = document.getElementById('recaptcha-container');
    if (container) container.innerHTML = '';
}

async function sendCode() {
    console.log('[verify.js] sendCode() 호출됨');

    const phoneEl = document.getElementById('vPhone');
    if (!phoneEl) { console.error('[verify.js] vPhone 요소 없음'); return; }

    const phone = phoneEl.value.replace(/\D/g, '');
    if (phone.length < 10) {
        showMsg('올바른 휴대폰 번호를 입력해 주세요.');
        return;
    }

    if (!window.auth || !window.authFuncs) {
        showMsg('Firebase 초기화 중입니다. 잠시 후 다시 시도해 주세요.');
        return;
    }

    const btn = document.getElementById('sendCodeBtn');
    if (btn) { btn.disabled = true; btn.textContent = '전송 중...'; }

    /* 매 전송마다 reCAPTCHA 새로 생성 (중복 렌더 방지) */
    resetRecaptcha();
    window.recaptchaVerifier = new window.authFuncs.RecaptchaVerifier(
        window.auth,
        'recaptcha-container',
        { size: 'invisible' }
    );

    /* 한국 번호 포맷: 010XXXXXXXX → +8210XXXXXXXX */
    const phoneFormatted = '+82' + phone.replace(/^0/, '');

    try {
        /* render() 완료 후 SMS 발송 (타이밍 오류 방지) */
        await window.recaptchaVerifier.render();
        confirmationResult = await window.authFuncs.signInWithPhoneNumber(
            window.auth, phoneFormatted, window.recaptchaVerifier
        );
        const codeField = document.getElementById('codeField');
        if (codeField) codeField.style.display = 'block';
        startTimer(180);
        showMsg('인증번호가 발송되었습니다.', 'ok');
        if (btn) { btn.disabled = false; btn.textContent = '재전송'; }
    } catch (err) {
        console.error('[verify.js] SMS 발송 실패:', err.code, err.message);
        const errMap = {
            'auth/invalid-phone-number': '올바르지 않은 휴대폰 번호입니다.',
            'auth/too-many-requests':    '너무 많은 요청입니다. 잠시 후 다시 시도해 주세요.',
            'auth/quota-exceeded':       'SMS 한도를 초과했습니다.',
            'auth/captcha-check-failed': 'reCAPTCHA 인증 실패. 페이지를 새로고침 해주세요.'
        };
        showMsg(errMap[err.code] || 'SMS 발송 실패: ' + err.message);
        if (btn) { btn.disabled = false; btn.textContent = '인증번호 전송'; }
        resetRecaptcha();
    }
}

function startTimer(sec) {
    clearInterval(timerInterval);
    const el = document.getElementById('verifyTimer');
    if (!el) return;
    timerInterval = setInterval(() => {
        const m = String(Math.floor(sec / 60)).padStart(1, '0');
        const s = String(sec % 60).padStart(2, '0');
        el.textContent = m + ':' + s;
        if (sec-- <= 0) {
            clearInterval(timerInterval);
            el.textContent = '만료';
        }
    }, 1000);
}

function toggleAllTerms(cb) {
    document.querySelectorAll('.term-check').forEach(c => c.checked = cb.checked);
}

function syncAllTerms() {
    const all = document.querySelectorAll('.term-check');
    document.getElementById('agreeAll').checked = [...all].every(c => c.checked);
}

function showMsg(msg, type) {
    const el = document.getElementById('verifyMsg');
    if (!el) { console.error('[verify.js] verifyMsg 요소 없음'); return; }
    el.textContent = msg;
    el.className = 'verify-msg ' + (type === 'ok' ? 'ok' : 'err');
}

function goNext() {
    const name    = document.getElementById('vName').value.trim();
    const birth   = document.getElementById('vBirth').value.trim();
    const gender  = document.getElementById('vGender').value.trim();
    const phone   = document.getElementById('vPhone').value.replace(/\D/g, '');
    const carrier = document.querySelector('input[name="carrier"]:checked');
    const code    = document.getElementById('vCode')?.value.trim();

    if (!name)              return showMsg('이름을 입력해 주세요.');
    if (birth.length !== 6) return showMsg('생년월일 6자리를 입력해 주세요.');
    if (!gender)            return showMsg('주민등록번호 뒷자리 첫 번째 숫자를 입력해 주세요.');
    if (!carrier)           return showMsg('통신사를 선택해 주세요.');
    if (phone.length < 10)  return showMsg('올바른 휴대폰 번호를 입력해 주세요.');
    if (!code)              return showMsg('인증번호를 입력해 주세요.');

    const reqTerms = document.querySelectorAll('.term-check[data-req="true"]');
    if ([...reqTerms].some(c => !c.checked)) return showMsg('필수 약관에 모두 동의해 주세요.');

    if (!confirmationResult) {
        return showMsg('인증번호를 먼저 전송해 주세요.');
    }

    const btn = document.querySelector('.verify-next-btn');
    if (btn) { btn.disabled = true; btn.textContent = '확인 중...'; }

    confirmationResult.confirm(code)
        .then(() => {
            sessionStorage.setItem('verifyName', name);
            sessionStorage.setItem('verifyPhone', phone);
            location.href = '/signup';
        })
        .catch(err => {
            if (btn) { btn.disabled = false; btn.textContent = '다음'; }
            const errMap = {
                'auth/invalid-verification-code': '인증번호가 올바르지 않습니다.',
                'auth/code-expired':              '인증번호가 만료되었습니다. 다시 전송해 주세요.'
            };
            showMsg(errMap[err.code] || '인증 실패: ' + err.message);
        });
}

