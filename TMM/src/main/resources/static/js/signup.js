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

// ===== 시/군/구 연동 =====
const SIGNUP_SIGUNGU = {
    '서울특별시': ['강남구','강서구','관악구','광진구','구로구','금천구','노원구','도봉구','동대문구','동작구','마포구','서대문구','서초구','성동구','성북구','송파구','양천구','영등포구','용산구','은평구','종로구','중구','중랑구'],
    '경기도':     ['의정부시','수원시','성남시','고양시','용인시','부천시','안산시','남양주시','화성시','평택시','안양시','시흥시','파주시','김포시','광주시','광명시','하남시','오산시','안성시','이천시','포천시','양주시','구리시','여주시','동두천시','과천시','의왕시','군포시','가평군','양평군','연천군'],
    '인천광역시': ['남동구','연수구','부평구','계양구','미추홀구','서구','동구','중구','강화군','옹진군'],
    '부산광역시': ['해운대구','수영구','사상구','강서구','금정구','남구','동구','동래구','부산진구','북구','사하구','서구','연제구','영도구','중구','기장군'],
    '대구광역시': ['달서구','달성군','동구','북구','서구','남구','중구','수성구'],
    '광주광역시': ['광산구','남구','동구','북구','서구'],
    '대전광역시': ['대덕구','동구','서구','유성구','중구'],
    '울산광역시': ['남구','동구','북구','중구','울주군'],
    '세종특별자치시': [],
    '강원도':     ['춘천시','원주시','강릉시','동해시','태백시','속초시','삼척시','홍천군','횡성군','영월군','평창군','정선군','철원군','화천군','양구군','인제군','고성군','양양군'],
    '충청북도':   ['청주시','충주시','제천시','보은군','옥천군','영동군','증평군','진천군','괴산군','음성군','단양군'],
    '충청남도':   ['천안시','공주시','보령시','아산시','서산시','논산시','계룡시','당진시','금산군','부여군','서천군','청양군','홍성군','예산군','태안군'],
    '전라북도':   ['전주시','군산시','익산시','정읍시','남원시','김제시','완주군','진안군','무주군','장수군','임실군','순창군','고창군','부안군'],
    '전라남도':   ['목포시','여수시','순천시','나주시','광양시','담양군','곡성군','구례군','고흥군','보성군','화순군','장흥군','강진군','해남군','영암군','무안군','함평군','영광군','장성군','완도군','진도군','신안군'],
    '경상북도':   ['포항시','경주시','김천시','안동시','구미시','영주시','영천시','상주시','문경시','경산시','의성군','청송군','영양군','영덕군','청도군','고령군','성주군','칠곡군','예천군','봉화군','울진군','울릉군'],
    '경상남도':   ['창원시','진주시','통영시','사천시','김해시','밀양시','거제시','양산시','의령군','함안군','창녕군','고성군','남해군','하동군','산청군','함양군','거창군','합천군'],
    '제주특별자치도': ['제주시','서귀포시'],
};

function updateSignupSigungu() {
    const sido      = document.getElementById('signupRegion').value;
    const sigunguEl = document.getElementById('signupSigungu');
    const list      = SIGNUP_SIGUNGU[sido] || [];

    sigunguEl.innerHTML = '<option value="">시/군/구 선택 (선택)</option>' +
        list.map(sg => `<option value="${sg}">${sg}</option>`).join('');
    sigunguEl.disabled = !list.length;
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
    const sido      = document.getElementById('signupRegion').value;
    const sigungu   = document.getElementById('signupSigungu')?.value || '';
    const region    = sido && sigungu ? sido + ' ' + sigungu : sido;
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
            phone,
            profileImg: '',
            region,
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
