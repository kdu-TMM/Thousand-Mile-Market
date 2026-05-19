import { initializeApp }                          from 'https://www.gstatic.com/firebasejs/11.8.0/firebase-app.js';
import { getFirestore, collection, getDocs,
         doc, getDoc, setDoc, addDoc,
         query, where, limit, orderBy,
         onSnapshot, serverTimestamp,
         updateDoc, arrayUnion, arrayRemove,
         increment } from 'https://www.gstatic.com/firebasejs/11.8.0/firebase-firestore.js';
import { getStorage, ref, uploadBytes,
         getDownloadURL }                          from 'https://www.gstatic.com/firebasejs/11.8.0/firebase-storage.js';
import { getAuth, createUserWithEmailAndPassword,
         signInWithEmailAndPassword, signOut,
         onAuthStateChanged, updateProfile,
         updatePassword, reauthenticateWithCredential,
         EmailAuthProvider,
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

window.db           = getFirestore(app);
window.storage      = getStorage(app);
window.auth         = getAuth(app);
window.storageUtils = { ref, uploadBytes, getDownloadURL };

/* Firestore 유틸 — 일반 JS 파일에서 window.fs.* 로 사용 */
window.fs = {
    collection, getDocs, doc, getDoc, setDoc, addDoc,
    query, where, limit, orderBy,
    onSnapshot, serverTimestamp,
    updateDoc, arrayUnion, arrayRemove,
    increment
};

/* Auth 유틸 */
window.authFuncs = {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    updateProfile,
    updatePassword,
    reauthenticateWithCredential,
    EmailAuthProvider,
    RecaptchaVerifier,
    signInWithPhoneNumber
};

initializeRecaptchaConfig(window.auth)
    .then(() => console.log('[firebase.js] reCAPTCHA Enterprise 설정 로드 완료'))
    .catch(e => console.warn('[firebase.js] reCAPTCHA 설정 로드 실패:', e.message));

const _unsubInit = onAuthStateChanged(window.auth, () => {
    _unsubInit();
    window.firebaseReady = true;
    window.dispatchEvent(new Event('firebase-ready'));
});

onAuthStateChanged(window.auth, (user) => {
    window.dispatchEvent(new CustomEvent('auth-changed', { detail: { user } }));
});
