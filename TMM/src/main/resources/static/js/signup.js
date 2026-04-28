document.addEventListener('DOMContentLoaded', function () {
    const name  = sessionStorage.getItem('verifyName');
    const phone = sessionStorage.getItem('verifyPhone');
    if (name) document.getElementById('signupName').value = name;
    if (phone) {
        const formatted = phone.replace(/(\d{3})(\d{3,4})(\d{4})/, '$1-$2-$3');
        document.getElementById('signupPhone').value = formatted;
    }
});
