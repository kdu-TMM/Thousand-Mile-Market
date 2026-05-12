/* ===== 상태 ===== */
let stompClient  = null;
let myUid        = null;
let myNickname   = null;
let currentRoomId = null;
let roomSubscription = null;
let searchTimer  = null;

/* ===== 초기화 ===== */
document.addEventListener('DOMContentLoaded', () => {
    /* 1) 서버 세션이 있으면 바로 진입 */
    if (SERVER_UID) {
        myUid      = SERVER_UID;
        myNickname = SERVER_NICKNAME;
        initChat();
        return;
    }

    /* 2) Firebase 인증 상태 확인 대기 */
    window.addEventListener('firebase-ready', () => {
        const user = window.auth?.currentUser;
        if (!user) { showLoginPrompt(); return; }
        syncSession(user);
    });

    /* firebase-ready가 이미 발화된 경우 (페이지 재진입 등) */
    if (window.firebaseReady) {
        const user = window.auth?.currentUser;
        if (user) syncSession(user);
        else showLoginPrompt();
    }
});

function syncSession(user) {
    user.getIdToken().then(token => {
        fetch('/api/auth/session', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ uid: user.uid, nickname: user.displayName || user.email })
        }).then(res => {
            if (res.ok) {
                myUid      = user.uid;
                myNickname = user.displayName || user.email || '사용자';
                initChat();
            } else {
                showLoginPrompt();
            }
        }).catch(() => showLoginPrompt());
    });
}

function showLoginPrompt() {
    document.getElementById('chatLoginPrompt').style.display = 'flex';
    document.getElementById('chatLayout').style.display = 'none';
}

function initChat() {
    document.getElementById('chatLoginPrompt').style.display = 'none';
    document.getElementById('chatLayout').style.display = 'flex';
    connectStomp();
    loadRooms();

    /* URL 파라미터로 자동 채팅방 열기 (상품 페이지에서 진입) */
    if (INIT_TARGET_UID && INIT_TARGET_UID !== myUid) {
        openOrCreateRoom(INIT_TARGET_UID, INIT_TARGET_NICKNAME,
                         INIT_PRODUCT_ID, INIT_PRODUCT_NAME);
    }
}

/* ===== STOMP 연결 ===== */
function connectStomp() {
    stompClient = new StompJs.Client({
        webSocketFactory: () => new SockJS('/ws'),
        reconnectDelay: 5000,
        onConnect: () => console.log('WebSocket 연결됨'),
        onStompError: frame => console.error('STOMP 오류:', frame)
    });
    stompClient.activate();
}

/* ===== 채팅방 목록 ===== */
function loadRooms() {
    fetch('/api/chat/rooms')
        .then(r => r.ok ? r.json() : [])
        .then(rooms => renderRoomList(rooms))
        .catch(() => {});
}

function renderRoomList(rooms) {
    const ul = document.getElementById('chatRoomList');
    ul.innerHTML = '';
    if (!rooms.length) {
        ul.innerHTML = '<li class="chat-room-empty">채팅방이 없습니다.</li>';
        return;
    }
    rooms.forEach(room => {
        const li = document.createElement('li');
        li.className = 'chat-room-item' + (room.id == currentRoomId ? ' active' : '');
        li.dataset.roomId = room.id;
        li.onclick = () => selectRoom(room);
        li.innerHTML = `
            <div class="chat-room-avatar">${(room.targetNickname || '?')[0]}</div>
            <div class="chat-room-meta">
                <div class="chat-room-top">
                    <span class="chat-room-name">${room.targetNickname || '(알 수 없음)'}</span>
                    <span class="chat-room-time">${formatTime(room.lastMessageAt)}</span>
                </div>
                <div class="chat-room-bottom">
                    <span class="chat-room-preview">${room.lastMessage || ''}</span>
                    ${room.unreadCount > 0 ? `<span class="chat-unread-badge">${room.unreadCount}</span>` : ''}
                </div>
                ${room.productName ? `<span class="chat-room-product">${room.productName}</span>` : ''}
            </div>`;
        ul.appendChild(li);
    });
}

/* ===== 채팅방 선택 ===== */
function selectRoom(room) {
    currentRoomId = room.id;

    /* 사이드바 active */
    document.querySelectorAll('.chat-room-item').forEach(el => el.classList.remove('active'));
    document.querySelector(`[data-room-id="${room.id}"]`)?.classList.add('active');

    /* 헤더 정보 */
    document.getElementById('chatPartnerName').textContent = room.targetNickname || '(알 수 없음)';
    const badge = document.getElementById('chatProductBadge');
    if (room.productName) {
        badge.textContent = room.productName;
        badge.style.display = 'inline-block';
    } else {
        badge.style.display = 'none';
    }

    /* 이전 구독 해제 */
    if (roomSubscription) roomSubscription.unsubscribe();

    /* 새 구독 */
    if (stompClient?.connected) {
        roomSubscription = stompClient.subscribe(
            '/topic/chat/' + room.id,
            msg => appendMessage(JSON.parse(msg.body))
        );
    }

    /* 내역 로드 */
    document.getElementById('chatPlaceholder').style.display = 'none';
    document.getElementById('chatContent').style.display = 'flex';
    document.getElementById('chatMessages').innerHTML = '';

    fetch(`/api/chat/rooms/${room.id}/messages`)
        .then(r => r.ok ? r.json() : [])
        .then(msgs => {
            msgs.forEach(m => appendMessage(m, true));
            scrollToBottom();
        });
}

/* ===== 메시지 추가 ===== */
function appendMessage(msg, isHistory = false) {
    const isMine = msg.senderUid === myUid;
    const ul = document.getElementById('chatMessages');
    const li = document.createElement('li');

    if (isMine) {
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

/* ===== 메시지 전송 ===== */
function sendMessage() {
    const input = document.getElementById('chatInput');
    const text = input.value.trim();
    if (!text || !currentRoomId || !stompClient?.connected) return;

    stompClient.publish({
        destination: '/app/chat.send',
        body: JSON.stringify({
            roomId:         String(currentRoomId),
            senderUid:      myUid,
            senderNickname: myNickname,
            content:        text
        })
    });
    input.value = '';
}

document.addEventListener('DOMContentLoaded', () => {
    const input = document.getElementById('chatInput');
    if (!input) return;
    input.addEventListener('keydown', e => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
});

/* ===== 채팅방 생성 or 열기 ===== */
function openOrCreateRoom(targetUid, targetNickname, productId, productName) {
    fetch('/api/chat/rooms', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ targetUid, targetNickname, productId, productName })
    }).then(r => r.ok ? r.json() : null)
      .then(room => {
          if (!room) return;
          loadRooms();
          selectRoom(room);
      });
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
            if (snap.empty) { result.classList.add('hidden'); return; }
            result.classList.remove('hidden');
            snap.docs.forEach(doc => {
                const u = doc.data();
                if (u.uid === myUid) return;
                const li = document.createElement('li');
                li.className = 'chat-search-item';
                li.textContent = u.nickname;
                li.onclick = () => {
                    result.classList.add('hidden');
                    document.getElementById('nickSearch').value = '';
                    openOrCreateRoom(u.uid, u.nickname, null, null);
                };
                result.appendChild(li);
            });
        });
    }, 300);
}

/* ===== 거래완료 ===== */
function completeTrade() {
    if (!confirm('거래를 완료로 처리하시겠습니까?')) return;
    alert('거래완료 처리되었습니다.');
}

/* ===== 드롭다운 ===== */
function toggleDropdown() {
    document.getElementById('chatDropdown').classList.toggle('hidden');
}
document.addEventListener('click', e => {
    if (!e.target.closest('.chat-dropdown-wrap')) {
        document.getElementById('chatDropdown')?.classList.add('hidden');
    }
});

function leaveRoom() {
    if (!confirm('채팅방에서 나가시겠습니까?')) return;
    currentRoomId = null;
    document.getElementById('chatContent').style.display = 'none';
    document.getElementById('chatPlaceholder').style.display = 'flex';
    loadRooms();
}

/* ===== 유틸 ===== */
function scrollToBottom() {
    const ul = document.getElementById('chatMessages');
    ul.scrollTop = ul.scrollHeight;
}

function formatTime(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d)) return '';
    const now = new Date();
    const diffDay = Math.floor((now - d) / 86400000);
    if (diffDay === 0) return d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
    if (diffDay < 7)  return ['일','월','화','수','목','금','토'][d.getDay()] + '요일';
    return `${d.getMonth()+1}/${d.getDate()}`;
}

function escHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
