let timerInterval = null;

function sendCode() {
    const phone = document.getElementById('vPhone').value.replace(/\D/g, '');
    if (phone.length < 10) {
        showMsg('올바른 휴대폰 번호를 입력해 주세요.');
        return;
    }
    document.getElementById('codeField').style.display = '';
    startTimer(180);
    showMsg('인증번호가 전송되었습니다. (테스트: 123456)', 'ok');
}

function startTimer(sec) {
    clearInterval(timerInterval);
    const el = document.getElementById('verifyTimer');
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
    el.textContent = msg;
    el.className = 'verify-msg ' + (type === 'ok' ? 'ok' : 'err');
}

function goNext() {
    const name    = document.getElementById('vName').value.trim();
    const birth   = document.getElementById('vBirth').value.trim();
    const gender  = document.getElementById('vGender').value.trim();
    const phone   = document.getElementById('vPhone').value.replace(/\D/g, '');
    const carrier = document.querySelector('input[name="carrier"]:checked');
    const code    = document.getElementById('vCode').value.trim();

    if (!name)              return showMsg('이름을 입력해 주세요.');
    if (birth.length !== 6) return showMsg('생년월일 6자리를 입력해 주세요.');
    if (!gender)            return showMsg('주민등록번호 뒷자리 첫 번째 숫자를 입력해 주세요.');
    if (!carrier)           return showMsg('통신사를 선택해 주세요.');
    if (phone.length < 10)  return showMsg('올바른 휴대폰 번호를 입력해 주세요.');
    if (code !== '123456')  return showMsg('인증번호가 올바르지 않습니다.');

    const reqTerms = document.querySelectorAll('.term-check[data-req="true"]');
    if ([...reqTerms].some(c => !c.checked)) return showMsg('필수 약관에 모두 동의해 주세요.');

    sessionStorage.setItem('verifyName', name);
    sessionStorage.setItem('verifyPhone', phone);
    location.href = '/signup';
}
