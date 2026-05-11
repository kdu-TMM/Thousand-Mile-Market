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

/* 초기화 완료 신호 */
window.dispatchEvent(new Event('firebase-ready'));
