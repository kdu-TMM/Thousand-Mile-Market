/* ===== 상태 ===== */
let myUid        = null;
let myNickname   = null;
let currentRoomId = null;
let currentRoom  = null;
let roomsUnsub   = null;
let msgsUnsub    = null;
let searchTimer  = null;
let allRooms     = [];
let typeFilter   = 'all';  // 'all' | 'sell' | 'buy'
let statusFilter = 'all';  // 'all' | 'waiting' | 'active' | 'ended'

/* ===== 초기화 ===== */
document.addEventListener('DOMContentLoaded', () => {
    if (SERVER_UID) {
        myUid      = SERVER_UID;
        myNickname = SERVER_NICKNAME;
        initChat();
        return;
    }

    const handleAuth = (e) => {
        const user = e?.detail?.user ?? window.auth?.currentUser;
        if (!user) { showLoginPrompt(); return; }
        if (myUid) return;
        startChat(user);
    };

    window.addEventListener('firebase-ready', handleAuth);
    window.addEventListener('auth-changed', handleAuth);

    if (window.firebaseReady) {
        const user = window.auth?.currentUser;
        if (user) startChat(user);
        else showLoginPrompt();
    }
});

function startChat(user) {
    myUid      = user.uid;
    myNickname = user.displayName || user.email || '사용자';
    initChat();

    /* Spring 세션 백그라운드 동기화 (실패해도 채팅에 영향 없음) */
    fetch('/api/auth/session', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ uid: user.uid, nickname: user.displayName || user.email })
    }).catch(() => {});
}

function showLoginPrompt() {
    document.getElementById('chatLoginPrompt').style.display = 'flex';
    document.getElementById('chatLayout').style.display      = 'none';
}

function initChat() {
    document.getElementById('chatLoginPrompt').style.display = 'none';
    document.getElementById('chatLayout').style.display      = 'flex';
    subscribeRooms();

    if (INIT_TARGET_UID && INIT_TARGET_UID !== myUid) {
        openOrCreateRoom(INIT_TARGET_UID, INIT_TARGET_NICKNAME,
                         INIT_PRODUCT_ID, INIT_PRODUCT_NAME);
    }
}

/* ===== 채팅방 목록 실시간 구독 ===== */
function subscribeRooms() {
    if (roomsUnsub) roomsUnsub();

    const { collection, query, where, orderBy, onSnapshot } = window.fs;
    const q = query(
        collection(window.db, 'chatRooms'),
        where('participants', 'array-contains', myUid),
        orderBy('lastMessageAt', 'desc')
    );

    const handleSnap = snap => {
        const prevStatus = currentRoomId
            ? allRooms.find(r => r.id === currentRoomId)?.status
            : null;

        allRooms = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        renderRoomList(getFilteredRooms());

        if (currentRoomId) {
            const updated = allRooms.find(r => r.id === currentRoomId);
            if (updated) {
                if (updated.status === 'confirmed' && prevStatus !== 'confirmed') {
                    appendSystemMessage('🎉 양측 모두 종료하여 구매확정이 완료되었습니다!');
                }
                currentRoom = updated;
                syncInputState(updated);
            }
        }
    };

    roomsUnsub = onSnapshot(q, handleSnap, () => {
        const qFallback = query(
            collection(window.db, 'chatRooms'),
            where('participants', 'array-contains', myUid)
        );
        roomsUnsub = onSnapshot(qFallback, snap => {
            allRooms = snap.docs
                .map(d => ({ id: d.id, ...d.data() }))
                .sort((a, b) => tsMillis(b.lastMessageAt) - tsMillis(a.lastMessageAt));
            renderRoomList(getFilteredRooms());
        }, err => console.error('채팅방 목록 오류:', err));
    });
}

/* ===== 필터 ===== */
function getFilteredRooms() {
    return allRooms.filter(room => {
        if (typeFilter === 'buy'  && (!room.productId || room.buyerUid !== myUid)) return false;
        if (typeFilter === 'sell' && (!room.productId || room.buyerUid === myUid)) return false;

        const isEnded = room.status === 'ended' || room.status === 'confirmed';
        if (statusFilter === 'waiting') return !isEnded && !room.lastMessage;
        if (statusFilter === 'active')  return !isEnded && !!room.lastMessage;
        if (statusFilter === 'ended')   return isEnded;
        return true;
    });
}

function toggleTypeMenu() {
    const menu  = document.getElementById('chatTypeMenu');
    const arrow = document.getElementById('chatTypeArrow');
    const isHidden = menu.classList.contains('hidden');
    menu.classList.toggle('hidden');
    arrow.style.transform = isHidden ? 'rotate(180deg)' : '';
}

function setTypeFilter(type) {
    typeFilter = type;
    const labels = { all: '전체 대화', sell: '판매 대화', buy: '구매 대화' };
    document.getElementById('chatTypeLabel').textContent = labels[type];
    document.getElementById('chatTypeMenu').classList.add('hidden');
    document.getElementById('chatTypeArrow').style.transform = '';
    renderRoomList(getFilteredRooms());
}

function setStatusFilter(status, btn) {
    statusFilter = status;
    document.querySelectorAll('.chat-stab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderRoomList(getFilteredRooms());
}

/* ===== 채팅방 목록 렌더링 ===== */
function getRoomStatusBadge(room) {
    if (room.status === 'confirmed') return '<span class="room-badge confirmed">구매확정</span>';
    if (room.status === 'ended')     return '<span class="room-badge ended">종료</span>';
    if (!room.lastMessage)           return '<span class="room-badge waiting">대기</span>';
    return '';
}

function renderRoomList(rooms) {
    const ul = document.getElementById('chatRoomList');
    ul.innerHTML = '';
    if (!rooms.length) {
        ul.innerHTML = '<li class="chat-room-empty">채팅방이 없습니다.</li>';
        return;
    }
    rooms.forEach(room => {
        const targetNickname = room.user1Uid === myUid ? room.user2Nickname : room.user1Nickname;
        const hasUnread      = room.unreadUids?.includes(myUid);
        const li = document.createElement('li');
        li.className      = 'chat-room-item' + (room.id === currentRoomId ? ' active' : '');
        li.dataset.roomId = room.id;
        li.onclick        = () => selectRoom(room);
        li.innerHTML = `
            <div class="chat-room-avatar">${(targetNickname || '?')[0]}</div>
            <div class="chat-room-meta">
                <div class="chat-room-top">
                    <span class="chat-room-name">${targetNickname || '(알 수 없음)'}</span>
                    <span class="chat-room-time">${formatTime(room.lastMessageAt)}</span>
                </div>
                <div class="chat-room-bottom">
                    <span class="chat-room-preview">${room.lastMessage || ''}</span>
                    ${hasUnread ? '<span class="chat-unread-badge">N</span>' : ''}
                </div>
                <div class="chat-room-footer">
                    ${room.productName ? `<span class="chat-room-product">${room.productName}</span>` : ''}
                    ${getRoomStatusBadge(room)}
                </div>
            </div>`;
        ul.appendChild(li);
    });
}

/* ===== 채팅방 선택 ===== */
function selectRoom(room) {
    currentRoomId = room.id;
    currentRoom   = room;

    document.querySelectorAll('.chat-room-item').forEach(el => el.classList.remove('active'));
    document.querySelector(`[data-room-id="${room.id}"]`)?.classList.add('active');

    const targetNickname = room.user1Uid === myUid ? room.user2Nickname : room.user1Nickname;
    document.getElementById('chatPartnerName').textContent = targetNickname || '(알 수 없음)';

    const badge = document.getElementById('chatProductBadge');
    if (room.productName) {
        badge.textContent   = room.productName;
        badge.style.display = 'inline-block';
        badge.style.cursor  = 'pointer';
        badge.onclick       = () => onProductBadgeClick(room);
    } else {
        badge.style.display = 'none';
        badge.style.cursor  = '';
        badge.onclick       = null;
    }

    document.getElementById('chatPlaceholder').style.display = 'none';
    document.getElementById('chatContent').style.display     = 'flex';
    document.getElementById('chatMessages').innerHTML        = '';

    syncInputState(room);
    markAsRead(room.id);
    subscribeMessages(room.id);
}

function syncInputState(room) {
    const input   = document.getElementById('chatInput');
    const sendBtn = document.getElementById('sendBtn');
    const isEnded = room.status === 'ended' || room.status === 'confirmed';
    if (input)   { input.disabled = isEnded; input.placeholder = isEnded ? '종료된 대화방입니다.' : '메시지를 입력하세요 (Enter: 전송, Shift+Enter: 줄바꿈)'; }
    if (sendBtn) sendBtn.disabled = isEnded;
}

/* ===== 메시지 실시간 구독 ===== */
function subscribeMessages(roomId) {
    if (msgsUnsub) msgsUnsub();

    const { collection, query, orderBy, onSnapshot } = window.fs;
    const q = query(
        collection(window.db, 'chatRooms', roomId, 'messages'),
        orderBy('sentAt', 'asc')
    );

    let firstLoad = true;
    msgsUnsub = onSnapshot(q, snap => {
        if (firstLoad) {
            firstLoad = false;
            snap.docs.forEach(d => appendMessage({ id: d.id, ...d.data() }, true));
            scrollToBottom();
        } else {
            snap.docChanges().forEach(change => {
                if (change.type === 'added') appendMessage({ id: change.doc.id, ...change.doc.data() });
            });
        }
    }, err => console.error('메시지 구독 오류:', err));
}

/* ===== 읽음 처리 ===== */
function markAsRead(roomId) {
    const { doc, updateDoc, arrayRemove } = window.fs;
    updateDoc(doc(window.db, 'chatRooms', roomId), {
        unreadUids: arrayRemove(myUid)
    }).catch(() => {});
}

/* ===== 메시지 렌더링 ===== */
function appendMessage(msg, isHistory = false) {
    const isMine = msg.senderUid === myUid;
    const ul = document.getElementById('chatMessages');
    const li = document.createElement('li');

    if (msg.type === 'system') {
        li.className = 'chat-sys-msg';
        li.innerHTML = `<span>${escHtml(msg.content)}</span>`;
    } else if (isMine) {
        li.className = 'chat-msg chat-msg-me';
        li.innerHTML = `
            <div class="chat-bubble-wrap">
                <span class="chat-time-small">${formatTime(msg.sentAt)}</span>
                <div class="chat-bubble chat-bubble-me">${escHtml(msg.content)}</div>
            </div>`;
    } else {
        li.className = 'chat-msg chat-msg-other';
        li.innerHTML = `
            <div class="chat-avatar-small">${(msg.senderNickname || '?')[0]}</div>
            <div>
                <b class="chat-sender-name">${escHtml(msg.senderNickname)}</b>
                <div class="chat-bubble-wrap">
                    <div class="chat-bubble chat-bubble-other">${escHtml(msg.content)}</div>
                    <span class="chat-time-small">${formatTime(msg.sentAt)}</span>
                </div>
            </div>`;
    }
    ul.appendChild(li);
    if (!isHistory) scrollToBottom();
}

function appendSystemMessage(text) {
    const ul = document.getElementById('chatMessages');
    if (!ul) return;
    const li = document.createElement('li');
    li.className = 'chat-sys-msg';
    li.innerHTML = `<span>${escHtml(text)}</span>`;
    ul.appendChild(li);
    scrollToBottom();
}

/* ===== 메시지 전송 ===== */
async function sendMessage() {
    const input = document.getElementById('chatInput');
    const text  = input.value.trim();
    if (!text || !currentRoomId || !currentRoom) return;
    if (currentRoom.status === 'ended' || currentRoom.status === 'confirmed') return;

    const { collection, addDoc, doc, updateDoc, serverTimestamp, arrayUnion } = window.fs;
    const otherUid = currentRoom.user1Uid === myUid ? currentRoom.user2Uid : currentRoom.user1Uid;
    input.value = '';

    try {
        await addDoc(collection(window.db, 'chatRooms', currentRoomId, 'messages'), {
            senderUid:      myUid,
            senderNickname: myNickname,
            content:        text,
            sentAt:         serverTimestamp()
        });
        await updateDoc(doc(window.db, 'chatRooms', currentRoomId), {
            lastMessage:   text,
            lastMessageAt: new Date(),
            unreadUids:    arrayUnion(otherUid)
        });
    } catch (e) {
        console.error('메시지 전송 실패:', e);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const input = document.getElementById('chatInput');
    if (!input) return;
    input.addEventListener('keydown', e => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
    });
});

/* ===== 채팅방 생성 or 열기 ===== */
async function openOrCreateRoom(targetUid, targetNickname, productId, productName) {
    const { collection, query, where, getDocs, addDoc } = window.fs;
    const key = generateRoomKey(myUid, targetUid, productId);
    const q   = query(
        collection(window.db, 'chatRooms'),
        where('roomKey', '==', key),
        where('participants', 'array-contains', myUid),
        window.fs.limit(1)
    );

    try {
        const snap = await getDocs(q);
        let room;

        if (!snap.empty) {
            room = { id: snap.docs[0].id, ...snap.docs[0].data() };
        } else {
            const now = new Date();
            const ref = await addDoc(collection(window.db, 'chatRooms'), {
                roomKey:       key,
                participants:  [myUid, targetUid],
                user1Uid:      myUid,
                user1Nickname: myNickname,
                user2Uid:      targetUid,
                user2Nickname: targetNickname,
                productId:     productId  || null,
                productName:   productName || null,
                buyerUid:      productId  ? myUid : null,
                lastMessage:   '',
                lastMessageAt: now,
                unreadUids:    [],
                status:        'active',
                endedBy:       [],
                createdAt:     now
            });
            room = {
                id: ref.id, roomKey: key,
                participants: [myUid, targetUid],
                user1Uid: myUid, user1Nickname: myNickname,
                user2Uid: targetUid, user2Nickname: targetNickname,
                productId: productId || null, productName: productName || null,
                buyerUid: productId ? myUid : null,
                lastMessage: '', unreadUids: [],
                status: 'active', endedBy: []
            };
        }
        selectRoom(room);
    } catch (e) {
        console.error('채팅방 생성 실패:', e);
    }
}

function generateRoomKey(uid1, uid2, productId) {
    const sorted = uid1 < uid2 ? `${uid1}:${uid2}` : `${uid2}:${uid1}`;
    return productId ? `${sorted}:${productId}` : sorted;
}

/* ===== 닉네임 검색 ===== */
function searchUser(query) {
    clearTimeout(searchTimer);
    const result = document.getElementById('searchResult');
    if (!query.trim()) { result.classList.add('hidden'); return; }

    searchTimer = setTimeout(() => {
        if (!window.db || !window.fs) return;
        window.fs.getDocs(
            window.fs.query(
                window.fs.collection(window.db, 'users'),
                window.fs.where('nickname', '>=', query),
                window.fs.where('nickname', '<', query + ''),
                window.fs.limit(5)
            )
        ).then(snap => {
            result.innerHTML = '';
            const items = snap.docs.filter(d => d.data().uid !== myUid);
            if (!items.length) { result.classList.add('hidden'); return; }
            result.classList.remove('hidden');
            items.forEach(d => {
                const u = d.data();
                const temp      = u.mannerTemp ?? 36.5;
                const tempColor = temp >= 50 ? '#ff6f00' : temp >= 36.5 ? '#43a047' : '#1e88e5';
                const tempWidth = Math.min(100, (temp / 100) * 100).toFixed(1);
                const li = document.createElement('li');
                li.className = 'chat-search-item';
                li.innerHTML = `
                    <div class="search-avatar">${escHtml((u.nickname || '?')[0])}</div>
                    <div class="search-info">
                        <div class="search-top">
                            <span class="search-nickname">${escHtml(u.nickname)}</span>
                            ${u.region ? `<span class="search-region">${escHtml(u.region)}</span>` : ''}
                        </div>
                        <div class="search-temp">
                            <span class="search-temp-val" style="color:${tempColor}">${temp}°</span>
                            <div class="search-temp-bar">
                                <div class="search-temp-fill" style="width:${tempWidth}%;background:${tempColor}"></div>
                            </div>
                        </div>
                    </div>`;
                li.onclick = () => {
                    result.classList.add('hidden');
                    document.getElementById('nickSearch').value = '';
                    openOrCreateRoom(u.uid, u.nickname, null, null);
                };
                result.appendChild(li);
            });
        }).catch(e => console.error('닉네임 검색 오류:', e));
    }, 300);
}

/* ===== 드롭다운 ===== */
function toggleDropdown() {
    document.getElementById('chatDropdown').classList.toggle('hidden');
}

document.addEventListener('click', e => {
    if (!e.target.closest('.chat-dropdown-wrap')) {
        document.getElementById('chatDropdown')?.classList.add('hidden');
    }
    if (!e.target.closest('.chat-type-wrap')) {
        document.getElementById('chatTypeMenu')?.classList.add('hidden');
        const arrow = document.getElementById('chatTypeArrow');
        if (arrow) arrow.style.transform = '';
    }
});

/* ===== 대화 종료 모달 ===== */
function openEndConvModal() {
    document.getElementById('chatDropdown').classList.add('hidden');
    document.getElementById('endConvModal').style.display = 'flex';
}
function closeEndConvModal() {
    document.getElementById('endConvModal').style.display = 'none';
}

async function confirmEndConv() {
    closeEndConvModal();
    if (!currentRoomId || !currentRoom) return;

    const { doc, updateDoc, arrayUnion } = window.fs;
    const endedBy  = Array.isArray(currentRoom.endedBy) ? currentRoom.endedBy : [];
    if (endedBy.includes(myUid)) {
        appendSystemMessage('이미 종료 요청을 하셨습니다.');
        return;
    }

    const otherUid  = currentRoom.user1Uid === myUid ? currentRoom.user2Uid : currentRoom.user1Uid;
    const bothEnded = endedBy.includes(otherUid);
    const newStatus = bothEnded ? 'confirmed' : 'ended';

    try {
        await updateDoc(doc(window.db, 'chatRooms', currentRoomId), {
            endedBy: arrayUnion(myUid),
            status:  newStatus
        });
        if (!bothEnded) {
            appendSystemMessage('대화 종료를 요청했습니다. 상대방도 종료하면 구매확정이 됩니다.');
        }
    } catch (e) {
        console.error('대화 종료 실패:', e);
    }
}

/* ===== 대화방 나가기 모달 ===== */
function openLeaveRoomModal() {
    document.getElementById('chatDropdown').classList.add('hidden');
    document.getElementById('leaveRoomModal').style.display = 'flex';
}
function closeLeaveRoomModal() {
    document.getElementById('leaveRoomModal').style.display = 'none';
}

async function confirmLeaveRoom() {
    closeLeaveRoomModal();
    if (!currentRoomId) return;

    const { doc, updateDoc, arrayRemove } = window.fs;
    try {
        await updateDoc(doc(window.db, 'chatRooms', currentRoomId), {
            participants: arrayRemove(myUid)
        });
    } catch (e) {
        console.error('나가기 실패:', e);
    }

    if (msgsUnsub) { msgsUnsub(); msgsUnsub = null; }
    currentRoomId = null;
    currentRoom   = null;
    document.getElementById('chatContent').style.display     = 'none';
    document.getElementById('chatPlaceholder').style.display = 'flex';
}

/* ===== 상품 배지 클릭: 삭제/숨김 상품 검사 ===== */
async function onProductBadgeClick(room) {
    if (!window.db || !window.fs || !room.productId) return;
    const { doc, getDoc } = window.fs;

    try {
        const snap = await getDoc(doc(window.db, 'products', String(room.productId)));
        const invalid = !snap.exists() || snap.data().status === '숨김';

        if (invalid) {
            appendSystemMessage('더이상 없는 게시물입니다. 잠시 후 채팅방이 삭제됩니다.');
            const roomIdToLeave = room.id;
            setTimeout(() => autoLeaveRoom(roomIdToLeave), 1500);
        } else {
            location.href = '/product/' + room.productId;
        }
    } catch (e) {
        location.href = '/product/' + room.productId;
    }
}

async function autoLeaveRoom(roomId) {
    if (!roomId || !window.fs) return;
    const { doc, updateDoc, arrayRemove } = window.fs;
    try {
        await updateDoc(doc(window.db, 'chatRooms', roomId), {
            participants: arrayRemove(myUid)
        });
    } catch (e) {}

    if (msgsUnsub) { msgsUnsub(); msgsUnsub = null; }
    if (currentRoomId === roomId) {
        currentRoomId = null;
        currentRoom   = null;
        document.getElementById('chatContent').style.display     = 'none';
        document.getElementById('chatPlaceholder').style.display = 'flex';
    }
}

/* ===== 유틸 ===== */
function scrollToBottom() {
    const ul = document.getElementById('chatMessages');
    ul.scrollTop = ul.scrollHeight;
}

function tsMillis(ts) {
    if (!ts) return 0;
    return ts.toMillis ? ts.toMillis() : new Date(ts).getTime();
}

function formatTime(ts) {
    if (!ts) return '';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    if (isNaN(d)) return '';
    const now     = new Date();
    const diffDay = Math.floor((now - d) / 86400000);
    if (diffDay === 0) return d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
    if (diffDay < 7)   return ['일','월','화','수','목','금','토'][d.getDay()] + '요일';
    return `${d.getMonth()+1}/${d.getDate()}`;
}

function escHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
