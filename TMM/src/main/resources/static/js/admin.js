/* ===== 상태 ===== */
let allReports   = [];
let allUsers     = [];
let allProducts  = [];
let currentReportFilter  = '검토중';
let currentProductFilter = 'all';
let activeReportId = null;

const PAGE_SIZE = 10;
let currentReportPage  = 1;
let currentUserPage    = 1;
let currentProductPage = 1;
let filteredUsers      = [];

/* ===== 초기화 ===== */
function initAdmin() {
    if (window.firebaseReady) {
        checkAdminAccess();
    } else {
        window.addEventListener('firebase-ready', checkAdminAccess);
    }
}
document.addEventListener('DOMContentLoaded', initAdmin);

async function checkAdminAccess() {
    const user = window.auth?.currentUser;
    if (!user) {
        showGuard();
        return;
    }

    try {
        const snap = await window.fs.getDoc(window.fs.doc(window.db, 'users', user.uid));
        if (!snap.exists() || snap.data().isAdmin !== true) {
            showGuard();
            return;
        }
        showAdmin();
        loadReports();
    } catch (e) {
        console.error('관리자 확인 실패:', e);
        showGuard();
    }
}

function showGuard() {
    document.getElementById('adminLoading').style.display = 'none';
    document.getElementById('adminGuard').style.display   = 'flex';
}

function showAdmin() {
    document.getElementById('adminLoading').style.display  = 'none';
    document.getElementById('adminContent').style.display  = 'block';
}

/* ===== 탭 전환 ===== */
function switchAdminTab(tab, btn) {
    document.querySelectorAll('.admin-nav-item').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    document.querySelectorAll('.admin-tab-panel').forEach(p => p.style.display = 'none');
    document.getElementById('tab' + capitalize(tab)).style.display = 'block';

    if (tab === 'reports')  loadReports();
    if (tab === 'users')    loadUsers();
    if (tab === 'products') loadProducts();
}

function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

/* ===== 신고 관리 ===== */
async function loadReports() {
    const tbody = document.getElementById('reportTableBody');
    tbody.innerHTML = '<tr><td colspan="4" class="admin-empty">불러오는 중...</td></tr>';

    try {
        const [reportSnap, productSnap] = await Promise.all([
            window.fs.getDocs(
                window.fs.query(
                    window.fs.collection(window.db, 'reports'),
                    window.fs.orderBy('createdAt', 'desc')
                )
            ).catch(() =>
                window.fs.getDocs(window.fs.collection(window.db, 'reports'))
            ),
            window.fs.getDocs(window.fs.collection(window.db, 'products'))
        ]);

        /* 상품 ID → 작성자 닉네임 맵 */
        const productAuthorMap = {};
        productSnap.docs.forEach(d => {
            const p = d.data();
            productAuthorMap[String(d.id)] = p.sellerNickname || p.sellerUid || '-';
        });

        allReports = reportSnap.docs
            .map(d => {
                const r = { id: d.id, ...d.data() };
                if (r.targetType === 'product') {
                    r.targetAuthor = productAuthorMap[String(r.targetId)] || '-';
                } else {
                    r.targetAuthor = '-';
                }
                return r;
            })
            .sort((a, b) => tsMillis(b.createdAt) - tsMillis(a.createdAt));

        /* 사이드바 뱃지 업데이트 */
        const pendingCount = allReports.filter(r => r.status === '검토중').length;
        const badge = document.getElementById('navBadgeReports');
        if (badge) badge.textContent = pendingCount > 0 ? pendingCount : '';

        renderReports();
    } catch (e) {
        tbody.innerHTML = '<tr><td colspan="4" class="admin-empty">불러오기 실패</td></tr>';
    }
}

function filterReports(status, btn) {
    currentReportFilter = status;
    currentReportPage = 1;
    document.querySelectorAll('#tabReports .admin-filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderReports();
}

function renderReports() {
    const tbody = document.getElementById('reportTableBody');
    const items = allReports.filter(r => r.status === currentReportFilter);

    if (!items.length) {
        tbody.innerHTML = '<tr><td colspan="8" class="admin-empty">신고가 없습니다.</td></tr>';
        renderPagination(0, 1, 'setReportPage', 'reportPagination');
        return;
    }

    const start = (currentReportPage - 1) * PAGE_SIZE;
    const pageItems = items.slice(start, start + PAGE_SIZE);

    tbody.innerHTML = pageItems.map(r => `
        <tr>
            <td>${typeLabel(r.targetType)}</td>
            <td>${escHtml(r.targetAuthor || '-')}</td>
            <td>${escHtml(r.reason || '-')}</td>
            <td>
                <button class="admin-btn info" onclick="openReportModal('${r.id}')">상세</button>
            </td>
        </tr>
    `).join('');
    renderPagination(items.length, currentReportPage, 'setReportPage', 'reportPagination');
}

function setReportPage(page) { currentReportPage = page; renderReports(); }

/* ===== 신고 상세 모달 ===== */
function openReportModal(reportId) {
    const report = allReports.find(r => r.id === reportId);
    if (!report) return;

    activeReportId = reportId;
    const body = document.getElementById('reportDetailBody');
    body.innerHTML = `
        <div class="admin-detail-row"><span class="admin-detail-label">신고 유형</span><span class="admin-detail-value">${typeLabel(report.targetType)}</span></div>
        <div class="admin-detail-row"><span class="admin-detail-label">신고 대상</span><span class="admin-detail-value">${escHtml(report.targetTitle || report.targetId || '-')}</span></div>
        <div class="admin-detail-row"><span class="admin-detail-label">작성자</span><span class="admin-detail-value">${escHtml(report.targetAuthor || '-')}</span></div>
        <div class="admin-detail-row"><span class="admin-detail-label">신고 사유</span><span class="admin-detail-value">${escHtml(report.reason || '-')}</span></div>
        <div class="admin-detail-row"><span class="admin-detail-label">상세 내용</span><span class="admin-detail-value">${escHtml(report.detail || '-')}</span></div>
        <div class="admin-detail-row"><span class="admin-detail-label">신고자</span><span class="admin-detail-value">${escHtml(report.reporterNickname || '-')}</span></div>
        <div class="admin-detail-row"><span class="admin-detail-label">신고일</span><span class="admin-detail-value">${formatDate(report.createdAt)}</span></div>
        <div class="admin-detail-row"><span class="admin-detail-label">현재 상태</span><span class="admin-detail-value">${statusBadge(report.status)}</span></div>
        ${report.adminNote ? `<div class="admin-detail-row"><span class="admin-detail-label">관리자 메모</span><span class="admin-detail-value">${escHtml(report.adminNote)}</span></div>` : ''}
    `;
    document.getElementById('reportAdminNote').value = report.adminNote || '';

    /* 검토중인 신고만 처리 버튼 표시 */
    const actions = document.querySelector('.admin-modal-actions');
    if (report.status === '검토중') {
        actions.innerHTML = `
            <button class="admin-action-btn hide-btn" onclick="updateReportStatus('처리완료')">숨김처리</button>
            <button class="admin-action-btn reject" onclick="updateReportStatus('반려')">반려</button>
        `;
    } else {
        actions.innerHTML = '';
    }

    document.getElementById('reportDetailModal').style.display = 'flex';
}

function closeReportModal(event) {
    if (event && event.target !== document.getElementById('reportDetailModal')) return;
    document.getElementById('reportDetailModal').style.display = 'none';
    activeReportId = null;
}

async function updateReportStatus(newStatus) {
    if (!activeReportId) return;
    const note   = document.getElementById('reportAdminNote').value.trim();
    const report = allReports.find(r => r.id === activeReportId);

    try {
        await window.fs.updateDoc(
            window.fs.doc(window.db, 'reports', activeReportId),
            { status: newStatus, adminNote: note, resolvedAt: new Date().toISOString() }
        );

        /* 처리완료 시 상품 숨김 처리 */
        if (newStatus === '처리완료' && report?.targetType === 'product' && report?.targetId) {
            await window.fs.updateDoc(
                window.fs.doc(window.db, 'products', String(report.targetId)),
                { status: '숨김' }
            );
            const product = allProducts.find(p => String(p.id) === String(report.targetId));
            if (product) product.status = '숨김';
        }

        const idx = allReports.findIndex(r => r.id === activeReportId);
        if (idx !== -1) {
            allReports[idx].status    = newStatus;
            allReports[idx].adminNote = note;
        }

        document.getElementById('reportDetailModal').style.display = 'none';
        activeReportId = null;
        /* 사이드바 뱃지 업데이트 */
        const pendingCount = allReports.filter(r => r.status === '검토중').length;
        const badge = document.getElementById('navBadgeReports');
        badge.textContent = pendingCount > 0 ? pendingCount : '';

        renderReports();
    } catch (e) {
        alert('처리 중 오류가 발생했습니다: ' + e.message);
    }
}

/* ===== 신고된 게시물 삭제 ===== */
async function deleteReportedProduct() {
    if (!activeReportId) return;
    const report = allReports.find(r => r.id === activeReportId);
    if (!report?.targetId) return alert('삭제할 게시물 정보를 찾을 수 없습니다.');
    if (!confirm('해당 게시물을 완전히 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) return;

    try {
        /* Firestore에서 상품 삭제 */
        await window.fs.deleteDoc(window.fs.doc(window.db, 'products', String(report.targetId)));

        /* 로컬 캐시에서 제거 */
        const pIdx = allProducts.findIndex(p => String(p.id) === String(report.targetId));
        if (pIdx !== -1) allProducts.splice(pIdx, 1);

        /* 신고 상태를 '처리완료'로 갱신 */
        await window.fs.updateDoc(
            window.fs.doc(window.db, 'reports', activeReportId),
            { status: '처리완료', resolvedAt: new Date().toISOString() }
        );
        const rIdx = allReports.findIndex(r => r.id === activeReportId);
        if (rIdx !== -1) allReports[rIdx].status = '처리완료';

        document.getElementById('reportDetailModal').style.display = 'none';
        activeReportId = null;

        const pendingCount = allReports.filter(r => r.status === '검토중').length;
        const badge = document.getElementById('navBadgeReports');
        badge.textContent = pendingCount > 0 ? pendingCount : '';

        renderReports();
        alert('게시물이 삭제되었습니다.');
    } catch (e) {
        alert('삭제 중 오류가 발생했습니다: ' + e.message);
    }
}

/* ===== 사용자 관리 ===== */
async function loadUsers() {
    const tbody = document.getElementById('userTableBody');
    tbody.innerHTML = '<tr><td colspan="6" class="admin-empty">불러오는 중...</td></tr>';

    try {
        const [usersSnap, productsSnap] = await Promise.all([
            window.fs.getDocs(window.fs.collection(window.db, 'users')),
            window.fs.getDocs(window.fs.collection(window.db, 'products'))
        ]);

        /* 사용자별 숨김 게시물 수 집계 */
        const hiddenCountMap = {};
        productsSnap.docs.forEach(d => {
            const p = d.data();
            if (p.status === '숨김' && p.sellerUid) {
                hiddenCountMap[p.sellerUid] = (hiddenCountMap[p.sellerUid] || 0) + 1;
            }
        });

        allUsers = usersSnap.docs
            .map(d => ({ uid: d.id, ...d.data(), hiddenCount: hiddenCountMap[d.id] || 0 }))
            .filter(u => !u.isAdmin);
        filteredUsers = [];
        renderUsers(allUsers);
    } catch (e) {
        tbody.innerHTML = '<tr><td colspan="6" class="admin-empty">불러오기 실패</td></tr>';
    }
}

function searchUsers() {
    currentUserPage = 1;
    const q = document.getElementById('userSearchInput').value.trim().toLowerCase();
    filteredUsers = !q
        ? allUsers
        : allUsers.filter(u =>
            (u.nickname || '').toLowerCase().includes(q) ||
            (u.userId   || '').toLowerCase().includes(q)
          );
    renderUsers(filteredUsers);
}

const SUSPEND_DURATIONS = [3, 7, 30];

function suspendedLabel(u) {
    if (!u.suspended) return '<span class="admin-status active">정상</span>';
    return '<span class="admin-status suspended">정지</span>';
}

function renderUsers(users) {
    const tbody = document.getElementById('userTableBody');
    if (!users.length) {
        tbody.innerHTML = '<tr><td colspan="6" class="admin-empty">사용자가 없습니다.</td></tr>';
        renderPagination(0, 1, 'setUserPage', 'userPagination');
        return;
    }

    const start = (currentUserPage - 1) * PAGE_SIZE;
    const pageItems = users.slice(start, start + PAGE_SIZE);

    tbody.innerHTML = pageItems.map(u => `
        <tr>
            <td><b>${escHtml(u.nickname || '-')}</b></td>
            <td>${u.hiddenCount > 0
                ? `<span style="color:#e53935;font-weight:600;">${u.hiddenCount}건</span>`
                : '<span style="color:#aaa;">0건</span>'}</td>
            <td>${suspendedLabel(u)}</td>
            <td>
                <div class="admin-btn-group">
                    ${u.suspended
                        ? `<button class="admin-btn info"   onclick="toggleUserSuspend('${u.uid}', false)">정지 해제</button>`
                        : `<button class="admin-btn danger" onclick="toggleUserSuspend('${u.uid}', true)">정지</button>`}
                </div>
            </td>
        </tr>
    `).join('');
    renderPagination(users.length, currentUserPage, 'setUserPage', 'userPagination');
}

function setUserPage(page) { currentUserPage = page; renderUsers(filteredUsers.length ? filteredUsers : allUsers); }

async function toggleUserSuspend(uid, suspend) {
    if (suspend) {
        const user = allUsers.find(u => u.uid === uid);
        const cnt  = user?.suspendCount || 0;
        const isPermanent = cnt >= SUSPEND_DURATIONS.length;
        const days = isPermanent ? null : SUSPEND_DURATIONS[cnt];
        const label = isPermanent ? '영구 정지' : `${days}일 정지`;

        if (!confirm(`해당 사용자를 ${label}(${cnt + 1}회차) 처리하고 게시물을 모두 숨김 처리하시겠습니까?`)) return;

        const suspendedUntil = isPermanent ? null : new Date(Date.now() + days * 86400 * 1000).toISOString();
        try {
            await window.fs.updateDoc(
                window.fs.doc(window.db, 'users', uid),
                { suspended: true, suspendedUntil, suspendCount: cnt + 1 }
            );

            /* 삭제 대신 status: '삭제' 로 표시 (복구 가능) */
            const pSnap = await window.fs.getDocs(
                window.fs.query(
                    window.fs.collection(window.db, 'products'),
                    window.fs.where('sellerUid', '==', uid)
                )
            );
            const toHide = pSnap.docs.filter(d => d.data().status !== '삭제');
            await Promise.all(toHide.map(d =>
                window.fs.updateDoc(d.ref, {
                    status:     '삭제',
                    prevStatus: d.data().status || '판매중'
                })
            ));

            if (user) { user.suspended = true; user.suspendedUntil = suspendedUntil; user.suspendCount = cnt + 1; }
            renderUsers(allUsers);
            alert(`${label} 처리되었고 게시물 ${toHide.length}개가 숨김 처리되었습니다.`);
        } catch (e) {
            alert('처리 중 오류: ' + e.message);
        }
    } else {
        if (!confirm('해당 사용자의 정지를 해제하시겠습니까?\n정지로 인해 숨김된 게시물도 함께 복구됩니다.')) return;
        try {
            await window.fs.updateDoc(
                window.fs.doc(window.db, 'users', uid),
                { suspended: false, suspendedUntil: null }
            );

            /* 정지로 숨김된(status === '삭제') 게시물 복구 */
            const pSnap = await window.fs.getDocs(
                window.fs.query(
                    window.fs.collection(window.db, 'products'),
                    window.fs.where('sellerUid', '==', uid),
                    window.fs.where('status',    '==', '삭제')
                )
            );
            await Promise.all(pSnap.docs.map(d => {
                const prev = d.data().prevStatus || '판매중';
                return window.fs.updateDoc(d.ref, { status: prev, prevStatus: null });
            }));

            const user = allUsers.find(u => u.uid === uid);
            if (user) { user.suspended = false; user.suspendedUntil = null; }
            renderUsers(allUsers);
            const msg = pSnap.size > 0
                ? `정지가 해제되었고 게시물 ${pSnap.size}개가 복구되었습니다.`
                : '정지가 해제되었습니다.';
            alert(msg);
        } catch (e) {
            alert('처리 중 오류: ' + e.message);
        }
    }
}

/* ===== 상품 관리 ===== */
async function loadProducts() {
    const tbody = document.getElementById('productTableBody');
    tbody.innerHTML = '<tr><td colspan="4" class="admin-empty">불러오는 중...</td></tr>';

    try {
        const snap = await window.fs.getDocs(
            window.fs.query(
                window.fs.collection(window.db, 'products'),
                window.fs.orderBy('date', 'desc')
            )
        ).catch(() =>
            window.fs.getDocs(window.fs.collection(window.db, 'products'))
        );

        allProducts = snap.docs.map(d => ({ id: d.id, ...d.data() }))
            .sort((a, b) => (b.date || '') > (a.date || '') ? 1 : -1);
        renderProducts();
    } catch (e) {
        tbody.innerHTML = '<tr><td colspan="4" class="admin-empty">불러오기 실패</td></tr>';
    }
}

function filterProducts(status, btn) {
    currentProductFilter = status;
    currentProductPage = 1;
    document.querySelectorAll('#tabProducts .admin-filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderProducts();
}

function renderProducts() {
    const tbody = document.getElementById('productTableBody');
    const items = currentProductFilter === 'all'
        ? allProducts
        : allProducts.filter(p => p.status === currentProductFilter);

    if (!items.length) {
        tbody.innerHTML = '<tr><td colspan="7" class="admin-empty">상품이 없습니다.</td></tr>';
        renderPagination(0, 1, 'setProductPage', 'productPagination');
        return;
    }

    const start = (currentProductPage - 1) * PAGE_SIZE;
    const pageItems = items.slice(start, start + PAGE_SIZE);

    tbody.innerHTML = pageItems.map(p => {
        const price = p.type === 'auction'
            ? (p.currentPrice ?? 0).toLocaleString() + '원'
            : (p.price ?? 0).toLocaleString() + '원';
        const statusClass = { '판매중': 'sell', '경매중': 'auction', '판매완료': 'done', '숨김': 'hidden', '예약중': 'warn', '삭제': 'suspended' }[p.status] || 'done';
        return `
            <tr>
                <td>
                    <a href="/product/${p.id}" target="_blank" class="admin-product-link">${escHtml(p.title || '-')}</a>
                </td>
                <td>${escHtml(p.category || '-')}</td>
                <td><span class="admin-status ${statusClass}">${p.status || '-'}</span></td>
                <td>
                    <div class="admin-btn-group">
                        ${p.status === '숨김'
                            ? `<button class="admin-btn info" onclick="toggleProductHidden('${p.id}', false)">숨김 해제</button>`
                            : p.status === '삭제'
                            ? `<button class="admin-btn info" onclick="restoreDeletedProduct('${p.id}')">복구</button>`
                            : `<button class="admin-btn warn" onclick="toggleProductHidden('${p.id}', true)">강제 숨김</button>`}
                    </div>
                </td>
            </tr>
        `;
    }).join('');
    renderPagination(items.length, currentProductPage, 'setProductPage', 'productPagination');
}

function setProductPage(page) { currentProductPage = page; renderProducts(); }

async function toggleProductHidden(productId, hide) {
    const action = hide ? '숨김 처리' : '숨김 해제';
    if (!confirm(`해당 상품을 ${action}하시겠습니까?`)) return;

    try {
        /* Bug Fix: String 비교로 타입 불일치(숫자 id) 해결 */
        const product = allProducts.find(p => String(p.id) === String(productId));

        let newStatus;
        let extraFields = {};
        if (hide) {
            /* 숨김 처리: 원래 상태를 prevStatus에 보관 */
            newStatus    = '숨김';
            extraFields  = { prevStatus: product?.status || '판매중' };
        } else {
            /* 숨김 해제: prevStatus → 없으면 type으로 추론 (경매중 / 판매중) */
            newStatus   = product?.prevStatus
                || (product?.type === 'auction' ? '경매중' : '판매중');
            extraFields = { prevStatus: null };
        }

        await window.fs.updateDoc(
            window.fs.doc(window.db, 'products', productId),
            { status: newStatus, ...extraFields }
        );

        if (product) {
            if (hide) {
                product.prevStatus = product.status;
            } else {
                delete product.prevStatus;
            }
            product.status = newStatus;
        }
        renderProducts();
    } catch (e) {
        alert('처리 중 오류: ' + e.message);
    }
}

/* ===== 삭제 상태 상품 개별 복구 ===== */
async function restoreDeletedProduct(productId) {
    if (!confirm('해당 상품을 복구하시겠습니까?')) return;
    try {
        const product  = allProducts.find(p => String(p.id) === String(productId));
        const newStatus = product?.prevStatus || (product?.type === 'auction' ? '경매중' : '판매중');
        await window.fs.updateDoc(
            window.fs.doc(window.db, 'products', productId),
            { status: newStatus, prevStatus: null }
        );
        if (product) { product.status = newStatus; delete product.prevStatus; }
        renderProducts();
    } catch (e) {
        alert('복구 중 오류: ' + e.message);
    }
}

/* ===== 페이지네이션 ===== */
function renderPagination(total, current, setter, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

    const start = Math.max(1, current - 2);
    const end   = Math.min(totalPages, start + 4);
    let html = `<button class="pg-btn" ${current === 1 ? 'disabled' : ''} onclick="${setter}(${current - 1})">‹</button>`;
    if (start > 1) html += `<button class="pg-btn" onclick="${setter}(1)">1</button>`;
    if (start > 2) html += `<span class="pg-ellipsis">…</span>`;
    for (let i = start; i <= end; i++) {
        html += `<button class="pg-btn${i === current ? ' active' : ''}" onclick="${setter}(${i})">${i}</button>`;
    }
    if (end < totalPages - 1) html += `<span class="pg-ellipsis">…</span>`;
    if (end < totalPages)     html += `<button class="pg-btn" onclick="${setter}(${totalPages})">${totalPages}</button>`;
    html += `<button class="pg-btn" ${current === totalPages ? 'disabled' : ''} onclick="${setter}(${current + 1})">›</button>`;
    container.innerHTML = html;
}

/* ===== 유틸 ===== */
function setText(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
}

function tsMillis(ts) {
    if (!ts) return 0;
    if (ts.toMillis) return ts.toMillis();
    return new Date(ts).getTime();
}

function formatDate(ts) {
    if (!ts) return '-';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    if (isNaN(d)) return '-';
    return `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')}`;
}

function escHtml(str) {
    return String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function typeLabel(type) {
    return { product: '상품', user: '사용자', chat: '채팅' }[type] || escHtml(type || '-');
}

function statusBadge(status) {
    const map = { '검토중': 'pending', '처리완료': 'resolved', '반려': 'rejected' };
    return `<span class="admin-status ${map[status] || ''}">${status || '-'}</span>`;
}
