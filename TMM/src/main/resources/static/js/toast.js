window.showToast = function(message, type, duration) {
    type     = type     || 'info';
    duration = (duration === undefined) ? 4000 : duration;

    var container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        document.body.appendChild(container);
    }

    var icons = { success: '✓', error: '✕', info: 'ℹ', warning: '⚠' };
    var icon  = icons[type] || icons.info;

    var toast = document.createElement('div');
    toast.className = 'toast toast-' + type;
    toast.innerHTML =
        '<span class="toast-icon">' + icon + '</span>' +
        '<span class="toast-msg">'  + message + '</span>' +
        '<button class="toast-close" onclick="(function(t){t.classList.remove(\'toast-show\');setTimeout(function(){t.remove()},350)})(this.parentElement)">✕</button>';

    container.appendChild(toast);

    /* 두 번의 rAF으로 transition 시작 보장 */
    requestAnimationFrame(function() {
        requestAnimationFrame(function() {
            toast.classList.add('toast-show');
        });
    });

    if (duration > 0) {
        setTimeout(function() {
            toast.classList.remove('toast-show');
            setTimeout(function() { toast.remove(); }, 350);
        }, duration);
    }
};

/* 로그인/회원가입 직후 플래시 토스트 */
document.addEventListener('DOMContentLoaded', function() {
    try {
        var loginName = sessionStorage.getItem('tmm_login_flash');
        if (loginName) {
            sessionStorage.removeItem('tmm_login_flash');
            window.showToast(loginName + '님, 환영합니다!', 'success');
        }
        var signupName = sessionStorage.getItem('tmm_signup_flash');
        if (signupName) {
            sessionStorage.removeItem('tmm_signup_flash');
            window.showToast(signupName + '님, 회원가입이 완료되었습니다!', 'success');
        }
    } catch(_) {}
});
