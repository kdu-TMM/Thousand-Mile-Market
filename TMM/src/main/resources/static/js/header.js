function openLoginModal() {
    document.getElementById('loginModal').classList.add('active');
}

function closeLoginModal(e) {
    if (!e || e.target === document.getElementById('loginModal')) {
        document.getElementById('loginModal').classList.remove('active');
    }
}

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
