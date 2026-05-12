import { initializeApp }                          from 'https://www.gstatic.com/firebasejs/11.8.0/firebase-app.js';
import { getFirestore, collection, getDocs,
         doc, getDoc, setDoc,
         query, where }                           from 'https://www.gstatic.com/firebasejs/11.8.0/firebase-firestore.js';
import { getStorage }                             from 'https://www.gstatic.com/firebasejs/11.8.0/firebase-storage.js';
import { getAuth, createUserWithEmailAndPassword,
         signInWithEmailAndPassword, signOut,
         onAuthStateChanged, updateProfile,
         RecaptchaVerifier, signInWithPhoneNumber,
         initializeRecaptchaConfig }             from 'https://www.gstatic.com/firebasejs/11.8.0/firebase-auth.js';

const firebaseConfig = {
    apiKey:            "AIzaSyDLxhAV6pRt2Ht91W9qmfofoikKfGl9TBg",
    authDomain:        "thousand-mile-market.firebaseapp.com",
    projectId:         "thousand-mile-market",
    storageBucket:     "thousand-mile-market.firebasestorage.app",
    messagingSenderId: "607580438456",
    appId:             "1:607580438456:web:3408a35953420d9af7994d"
};

const app = initializeApp(firebaseConfig);

window.db         = getFirestore(app);
window.storage    = getStorage(app);
window.auth       = getAuth(app);

/* Firestore 유틸 — 일반 JS 파일에서 window.fs.* 로 사용 */
window.fs = { collection, getDocs, doc, getDoc, setDoc, query, where };

/* Auth 유틸 — 일반 JS 파일에서 window.authFuncs.* 로 사용 */
window.authFuncs = {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    updateProfile,
    RecaptchaVerifier,
    signInWithPhoneNumber
};

/* reCAPTCHA Enterprise 설정 명시적 로드 */
initializeRecaptchaConfig(window.auth)
    .then(() => console.log('[firebase.js] reCAPTCHA Enterprise 설정 로드 완료'))
    .catch(e => console.warn('[firebase.js] reCAPTCHA 설정 로드 실패:', e.message));

/* onAuthStateChanged 첫 콜백 이후에 firebase-ready 발사
   (이 시점에 currentUser가 실제 로그인 상태를 반영함) */
const _unsubInit = onAuthStateChanged(window.auth, () => {
    _unsubInit();                          // 최초 1회만 실행
    window.firebaseReady = true;
    window.dispatchEvent(new Event('firebase-ready'));
});
