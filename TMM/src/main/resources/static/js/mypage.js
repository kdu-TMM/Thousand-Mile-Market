function switchMypageTab(tab, btn) {
    document.querySelectorAll('.mypage-tab').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    document.querySelectorAll('.mypage-tab-panel').forEach(p => p.style.display = 'none');
    document.getElementById('mpTab' + tab).style.display = 'block';
}

function saveMypageSettings(e) {
    const name   = document.getElementById('settingName').value.trim();
    const bio    = document.getElementById('settingBio').value.trim();
    const region = document.getElementById('settingRegion').value.trim();

    if (name)   document.getElementById('mpName').textContent = name;
    if (bio)    document.getElementById('mpBio').textContent = bio;
    if (region) document.getElementById('mpRegion').textContent = region;

    const btn = e.currentTarget;
    const orig = btn.textContent;
    btn.textContent = '저장 완료!';
    btn.disabled = true;
    setTimeout(() => {
        btn.textContent = orig;
        btn.disabled = false;
        switchMypageTab('Dashboard', document.querySelector('.mypage-tab'));
    }, 800);
}
