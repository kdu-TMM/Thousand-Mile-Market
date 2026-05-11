document.addEventListener('DOMContentLoaded', function () {
    const name  = sessionStorage.getItem('verifyName');
    const phone = sessionStorage.getItem('verifyPhone');
    if (!name || !phone) {
        location.href = '/verify';
        return;
    }
    document.getElementById('signupName').value = name;
    const formatted = phone.replace(/(\d{3})(\d{3,4})(\d{4})/, '$1-$2-$3');
    document.getElementById('signupPhone').value = formatted;
});

function showSignupMsg(msg, type) {
    const el = document.getElementById('signupMsg');
    el.textContent = msg;
    el.className = 'verify-msg ' + (type === 'ok' ? 'ok' : 'err');
}

async function doSignup() {
    if (!window.auth || !window.authFuncs) {
        showSignupMsg('초기화 중입니다. 잠시 후 다시 시도해 주세요.');
        return;
    }

    const name      = document.getElementById('signupName').value.trim();
    const phone     = document.getElementById('signupPhone').value.replace(/\D/g, '');
    const userId    = document.getElementById('signupUserId').value.trim();
    const pw        = document.getElementById('signupPw').value;
    const pwConfirm = document.getElementById('signupPwConfirm').value;
    const nickname  = document.getElementById('signupNickname').value.trim();
    const email     = document.getElementById('signupEmail').value.trim();

    if (!userId || userId.length < 4 || userId.length > 12)
        return showSignupMsg('아이디는 4~12자로 입력해 주세요.');
    if (!/^(?=.*[a-zA-Z])(?=.*[0-9])[a-zA-Z0-9]+$/.test(userId))
        return showSignupMsg('아이디는 영문과 숫자를 모두 포함해야 합니다.');
    if (!email)                         return showSignupMsg('이메일을 입력해 주세요.');
    if (!pw || pw.length < 8)           return showSignupMsg('비밀번호는 8자 이상 입력해 주세요.');
    if (pw !== pwConfirm)               return showSignupMsg('비밀번호가 일치하지 않습니다.');
    if (!nickname)                      return showSignupMsg('닉네임을 입력해 주세요.');

    const btn = document.getElementById('signupSubmitBtn');
    btn.disabled = true;
    btn.textContent = '가입 중...';

    try {
        const { createUserWithEmailAndPassword, updateProfile } = window.authFuncs;
        const userCred = await createUserWithEmailAndPassword(window.auth, email, pw);

        await updateProfile(userCred.user, { displayName: nickname });

        await window.fs.setDoc(window.fs.doc(window.db, 'users', userCred.user.uid), {
            uid:       userCred.user.uid,
            name,
            phone,
            userId,
            nickname,
            email,
            profileImg: '',
            region:     '',
            bio:        '',
            createdAt:  new Date().toISOString()
        });

        sessionStorage.removeItem('verifyName');
        sessionStorage.removeItem('verifyPhone');
        location.href = '/';
    } catch (e) {
        btn.disabled = false;
        btn.textContent = '가입하기';
        const errorMap = {
            'auth/email-already-in-use': '이미 사용 중인 이메일입니다.',
            'auth/invalid-email':        '유효하지 않은 이메일 형식입니다.',
            'auth/weak-password':        '비밀번호는 6자 이상이어야 합니다.'
        };
        showSignupMsg(errorMap[e.code] || '오류가 발생했습니다: ' + e.message);
    }
}
