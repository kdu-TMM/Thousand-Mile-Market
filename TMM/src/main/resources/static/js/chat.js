/* ===== 상태 ===== */
let myUid          = null;
let myNickname     = null;
let currentRoomId  = null;
let currentRoom    = null;
let roomsUnsub     = null;
let msgsUnsub      = null;
let searchTimer    = null;

/* ===== 초기화 ===== */
document.addEventListener('DOMContentLoaded', () => {
    if (SERVER_UID) {
        myUid      = SERVER_UID;
        myNickname = SERVER_NICKNAME;
        initChat();
        return;
    }

    window.addEventListener('firebase-ready', () => {
        const user = window.auth?.currentUser;
        if (!user) { showLoginPrompt(); return; }
        syncSession(user);
    });

    if (window.firebaseReady) {
        const user = window.auth?.currentUser;
        if (user) syncSession(user);
        else showLoginPrompt();
    }
});

function syncSession(user) {
    fetch('/api/auth/session', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ uid: user.uid, nickname: user.displayName || user.email })
    }).then(res => {
        if (res.ok) {
            myUid      = user.uid;
            myNickname = user.displayName || user.email || '사용자';
            initChat();
        } else showLoginPrompt();
    }).catch(() => showLoginPrompt());
}

function showLoginPrompt() {
    document.getElementById('chatLoginPrompt').style.display = 'flex';
    document.getElementById('chatLayout').style.display    = 'none';
}

function initChat() {
    document.getElementById('chatLoginPrompt').style.display = 'none';
    document.getElementById('chatLayout').style.display    = 'flex';
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

    roomsUnsub = onSnapshot(q, snap => {
        const rooms = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        renderRoomList(rooms);
    }, () => {
        /* 인덱스 미활성 등 오류 시 orderBy 없이 클라이언트 정렬로 폴백 */
        const qFallback = query(
            collection(window.db, 'chatRooms'),
            where('participants', 'array-contains', myUid)
        );
        roomsUnsub = onSnapshot(qFallback, snap => {
            const rooms = snap.docs
                .map(d => ({ id: d.id, ...d.data() }))
                .sort((a, b) => tsMillis(b.lastMessageAt) - tsMillis(a.lastMessageAt));
            renderRoomList(rooms);
        }, err => console.error('채팅방 목록 오류:', err));
    });
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
        li.className   = 'chat-room-item' + (room.id === currentRoomId ? ' active' : '');
        li.dataset.roomId = room.id;
        li.onclick     = () => selectRoom(room);
        li.innerHTML   = `
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
                ${room.productName ? `<span class="chat-room-product">${room.productName}</span>` : ''}
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
        badge.textContent    = room.productName;
        badge.style.display  = 'inline-block';
    } else {
        badge.style.display  = 'none';
    }

    document.getElementById('chatPlaceholder').style.display = 'none';
    document.getElementById('chatContent').style.display     = 'flex';
    document.getElementById('chatMessages').innerHTML        = '';

    markAsRead(room.id);
    subscribeMessages(room.id);
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
                if (change.type === 'added') {
                    appendMessage({ id: change.doc.id, ...change.doc.data() });
                }
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

/* ===== 메시지 추가 (렌더링) ===== */
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
async function sendMessage() {
    const input = document.getElementById('chatInput');
    const text  = input.value.trim();
    if (!text || !currentRoomId || !currentRoom) return;

    const { collection, addDoc, doc, updateDoc, serverTimestamp, arrayUnion } = window.fs;
    const otherUid = currentRoom.user1Uid === myUid
        ? currentRoom.user2Uid
        : currentRoom.user1Uid;

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
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
});

/* ===== 채팅방 생성 or 열기 ===== */
async function openOrCreateRoom(targetUid, targetNickname, productId, productName) {
    const { collection, query, where, getDocs, addDoc, doc, serverTimestamp } = window.fs;
    const key  = generateRoomKey(myUid, targetUid, productId);
    const q    = query(
        collection(window.db, 'chatRooms'),
        where('roomKey', '==', key),
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
                lastMessage:   '',
                lastMessageAt: now,
                unreadUids:    [],
                createdAt:     now
            });
            room = {
                id:            ref.id,
                roomKey:       key,
                participants:  [myUid, targetUid],
                user1Uid:      myUid,      user1Nickname: myNickname,
                user2Uid:      targetUid,  user2Nickname: targetNickname,
                productId:     productId  || null,
                productName:   productName || null,
                lastMessage:   '',
                unreadUids:    []
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
    if (msgsUnsub) { msgsUnsub(); msgsUnsub = null; }
    currentRoomId = null;
    currentRoom   = null;
    document.getElementById('chatContent').style.display    = 'none';
    document.getElementById('chatPlaceholder').style.display = 'flex';
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
    const now    = new Date();
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
