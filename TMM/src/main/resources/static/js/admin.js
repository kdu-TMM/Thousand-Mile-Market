/* ===== 상태 ===== */
let allReports   = [];
let allUsers     = [];
let allProducts  = [];
let currentReportFilter  = '검토중';
let currentProductFilter = 'all';
let activeReportId = null;

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
    tbody.innerHTML = '<tr><td colspan="8" class="admin-empty">불러오는 중...</td></tr>';

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
        tbody.innerHTML = '<tr><td colspan="8" class="admin-empty">불러오기 실패</td></tr>';
    }
}

function filterReports(status, btn) {
    currentReportFilter = status;
    document.querySelectorAll('#tabReports .admin-filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderReports();
}

function renderReports() {
    const tbody = document.getElementById('reportTableBody');
    const items = allReports.filter(r => r.status === currentReportFilter);

    if (!items.length) {
        tbody.innerHTML = '<tr><td colspan="8" class="admin-empty">신고가 없습니다.</td></tr>';
        return;
    }

    tbody.innerHTML = items.map(r => `
        <tr>
            <td>${typeLabel(r.targetType)}</td>
            <td class="admin-ellipsis" style="max-width:130px;">${escHtml(r.targetTitle || r.targetId || '-')}</td>
            <td>${escHtml(r.targetAuthor || '-')}</td>
            <td>${escHtml(r.reason || '-')}</td>
            <td>${escHtml(r.reporterNickname || '-')}</td>
            <td>${formatDate(r.createdAt)}</td>
            <td>${statusBadge(r.status)}</td>
            <td>
                <button class="admin-btn info" onclick="openReportModal('${r.id}')">상세</button>
            </td>
        </tr>
    `).join('');
}

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

        /* 처리완료 + 상품 신고인 경우 게시물 숨김 처리 */
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
        renderUsers(allUsers);
    } catch (e) {
        tbody.innerHTML = '<tr><td colspan="6" class="admin-empty">불러오기 실패</td></tr>';
    }
}

function searchUsers() {
    const q = document.getElementById('userSearchInput').value.trim().toLowerCase();
    const filtered = !q
        ? allUsers
        : allUsers.filter(u =>
            (u.nickname || '').toLowerCase().includes(q) ||
            (u.userId   || '').toLowerCase().includes(q)
          );
    renderUsers(filtered);
}

const SUSPEND_DURATIONS = [3, 7, 30]; // 1회차·2회차·3회차 (이후 영구)

function suspendedLabel(u) {
    if (!u.suspended) {
        const cnt = u.suspendCount || 0;
        const next = cnt < SUSPEND_DURATIONS.length ? `다음 ${SUSPEND_DURATIONS[cnt]}일` : '다음 영구';
        return cnt > 0
            ? `<span class="admin-status active">정상 (${cnt}회, ${next})</span>`
            : '<span class="admin-status active">정상</span>';
    }
    if (!u.suspendedUntil) return '<span class="admin-status suspended">영구 정지</span>';
    const days = Math.ceil((new Date(u.suspendedUntil) - Date.now()) / 86400000);
    return days > 0
        ? `<span class="admin-status suspended">정지 (${days}일 남음)</span>`
        : `<span class="admin-status suspended">정지 (기간 만료)</span>`;
}

function nextPenaltyLabel(suspendCount) {
    const cnt = suspendCount || 0;
    if (cnt < SUSPEND_DURATIONS.length) return `${SUSPEND_DURATIONS[cnt]}일 정지`;
    return '영구 정지';
}

function renderUsers(users) {
    const tbody = document.getElementById('userTableBody');
    if (!users.length) {
        tbody.innerHTML = '<tr><td colspan="6" class="admin-empty">사용자가 없습니다.</td></tr>';

        return;
    }

    tbody.innerHTML = users.map(u => `
        <tr>
            <td><b>${escHtml(u.nickname || '-')}</b></td>
            <td>${escHtml(u.userId || '-')}</td>
            <td>${u.hiddenCount > 0
                ? `<span style="color:#e53935;font-weight:600;">${u.hiddenCount}건</span>`
                : '<span style="color:#aaa;">0건</span>'}</td>
            <td>${u.createdAt ? u.createdAt.slice(0, 10) : '-'}</td>
            <td>${suspendedLabel(u)}</td>
            <td>
                <div class="admin-btn-group">
                    ${u.suspended
                        ? `<button class="admin-btn info"  onclick="toggleUserSuspend('${u.uid}', false)">정지 해제</button>`
                        : `<button class="admin-btn danger" onclick="toggleUserSuspend('${u.uid}', true)">${nextPenaltyLabel(u.suspendCount)}</button>`}
                </div>
            </td>
        </tr>
    `).join('');
}

async function toggleUserSuspend(uid, suspend) {
    if (suspend) {
        const user = allUsers.find(u => u.uid === uid);
        const cnt  = user?.suspendCount || 0;
        const isPermanent = cnt >= SUSPEND_DURATIONS.length;
        const days = isPermanent ? null : SUSPEND_DURATIONS[cnt];
        const label = isPermanent ? '영구 정지' : `${days}일 정지`;

        if (!confirm(`해당 사용자를 ${label}(${cnt + 1}회차)하고 게시물을 모두 삭제하시겠습니까?`)) return;

        const suspendedUntil = isPermanent ? null : new Date(Date.now() + days * 86400 * 1000).toISOString();
        try {
            await window.fs.updateDoc(
                window.fs.doc(window.db, 'users', uid),
                { suspended: true, suspendedUntil, suspendCount: cnt + 1 }
            );

            const pSnap = await window.fs.getDocs(
                window.fs.query(
                    window.fs.collection(window.db, 'products'),
                    window.fs.where('sellerUid', '==', uid)
                )
            );
            await Promise.all(pSnap.docs.map(d => window.fs.deleteDoc(d.ref)));

            if (user) { user.suspended = true; user.suspendedUntil = suspendedUntil; user.suspendCount = cnt + 1; }
            renderUsers(allUsers);
            alert(`${label} 처리되었고 게시물 ${pSnap.size}개가 삭제되었습니다.`);
        } catch (e) {
            alert('처리 중 오류: ' + e.message);
        }
    } else {
        if (!confirm('해당 사용자의 정지를 해제하시겠습니까?')) return;
        try {
            await window.fs.updateDoc(
                window.fs.doc(window.db, 'users', uid),
                { suspended: false, suspendedUntil: null }
            );
            const user = allUsers.find(u => u.uid === uid);
            if (user) { user.suspended = false; user.suspendedUntil = null; }
            renderUsers(allUsers);
        } catch (e) {
            alert('처리 중 오류: ' + e.message);
        }
    }
}

/* ===== 상품 관리 ===== */
async function loadProducts() {
    const tbody = document.getElementById('productTableBody');
    tbody.innerHTML = '<tr><td colspan="7" class="admin-empty">불러오는 중...</td></tr>';

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
        tbody.innerHTML = '<tr><td colspan="7" class="admin-empty">불러오기 실패</td></tr>';
    }
}

function filterProducts(status, btn) {
    currentProductFilter = status;
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
        return;
    }

    tbody.innerHTML = items.map(p => {
        const price = p.type === 'auction'
            ? (p.currentPrice ?? 0).toLocaleString() + '원'
            : (p.price ?? 0).toLocaleString() + '원';
        const statusClass = { '판매중': 'sell', '경매중': 'auction', '판매완료': 'done', '숨김': 'hidden', '예약중': 'warn' }[p.status] || 'done';
        return `
            <tr>
                <td>
                    <a href="/product/${p.id}" target="_blank" class="admin-product-link">${escHtml(p.title || '-')}</a>
                </td>
                <td>${price}</td>
                <td>${escHtml(p.sellerNickname || p.sellerUid || '-')}</td>
                <td>${escHtml(p.category || '-')}</td>
                <td>${(p.date || '').slice(0, 10)}</td>
                <td><span class="admin-status ${statusClass}">${p.status || '-'}</span></td>
                <td>
                    <div class="admin-btn-group">
                        ${p.status === '숨김'
                            ? `<button class="admin-btn info"  onclick="toggleProductHidden('${p.id}', false)">숨김 해제</button>`
                            : `<button class="admin-btn warn" onclick="toggleProductHidden('${p.id}', true)">강제 숨김</button>`}
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

async function toggleProductHidden(productId, hide) {
    const action = hide ? '숨김 처리' : '숨김 해제';
    if (!confirm(`해당 상품을 ${action}하시겠습니까?`)) return;

    try {
        const newStatus = hide ? '숨김' : '판매중';
        await window.fs.updateDoc(
            window.fs.doc(window.db, 'products', productId),
            { status: newStatus }
        );
        const product = allProducts.find(p => p.id === productId);
        if (product) product.status = newStatus;
        renderProducts();
    } catch (e) {
        alert('처리 중 오류: ' + e.message);
    }
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
