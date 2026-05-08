/**
 * 뷰 전환 기능
 * @param {string} viewId - 표시할 뷰의 이름 (dashboard, sales, settings)
 */
function switchView(viewId) {
    const views = ['dashboardView', 'salesView', 'settingsView'];
    const sidebarIds = ['side-dash', 'side-sales', 'side-settings'];
    const navIds = ['nav-dash', 'nav-sales'];

    // 1. 모든 뷰 숨기기
    views.forEach(v => {
        const el = document.getElementById(v);
        if (el) el.classList.add('hidden-view');
    });
    
    // 2. 모든 사이드바 활성 스타일 제거
    sidebarIds.forEach(s => {
        const el = document.getElementById(s);
        if(el) {
            el.classList.remove('active', 'text-blue-600', 'bg-blue-50/50');
            el.classList.add('text-slate-500');
        }
    });

    // 3. 모든 상단 네비게이션 활성 스타일 제거
    navIds.forEach(n => {
        const el = document.getElementById(n);
        if(el) el.classList.remove('nav-active-bar');
    });

    // 4. 선택한 뷰 보여주기 및 스타일 적용
    const targetView = document.getElementById(viewId + 'View');
    if (targetView) targetView.classList.remove('hidden-view');
    
    const activeSidebar = document.getElementById('side-' + (viewId === 'dashboard' ? 'dash' : viewId));
    if(activeSidebar) {
        activeSidebar.classList.add('active', 'text-blue-600', 'bg-blue-50/50');
        activeSidebar.classList.remove('text-slate-500');
    }

    const activeNav = document.getElementById('nav-' + (viewId === 'dashboard' ? 'dash' : (viewId === 'sales' ? 'sales' : '')));
    if(activeNav) activeNav.classList.add('nav-active-bar');

    // 5. 스크롤 최상단으로 이동
    const mainContent = document.querySelector('main');
    if (mainContent) mainContent.scrollTo(0, 0);
}

/**
 * 프로필 설정 저장 기능
 */
function saveSettings() {
    const newName = document.getElementById('setting-name').value.trim();
    const newBio = document.getElementById('setting-bio').value.trim();
    
    const nameDisplays = document.querySelectorAll('.userNameText');
    const bioDisplays = document.querySelectorAll('.userBioText');
    
    if(newName) nameDisplays.forEach(el => el.innerText = newName + " 님");
    if(newBio) bioDisplays.forEach(el => el.innerText = newBio);
    
    // 버튼 시각적 피드백
    const btn = event.currentTarget;
    const originalText = btn.innerText;
    btn.innerText = "저장 완료!";
    btn.disabled = true;

    setTimeout(() => {
        btn.innerText = originalText;
        btn.disabled = false;
        switchView('dashboard');
    }, 800);
}