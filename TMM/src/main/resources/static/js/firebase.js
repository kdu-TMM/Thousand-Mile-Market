import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.8.0/firebase-app.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/11.8.0/firebase-firestore.js';
import { getStorage }   from 'https://www.gstatic.com/firebasejs/11.8.0/firebase-storage.js';
import { getAuth }      from 'https://www.gstatic.com/firebasejs/11.8.0/firebase-auth.js';

const firebaseConfig = {
    apiKey:            "AIzaSyDLxhAV6pRt2Ht91W9qmfofoikKfGl9TBg",
    authDomain:        "thousand-mile-market.firebaseapp.com",
    projectId:         "thousand-mile-market",
    storageBucket:     "thousand-mile-market.firebasestorage.app",
    messagingSenderId: "607580438456",
    appId:             "1:607580438456:web:3408a35953420d9af7994d"
};

const app = initializeApp(firebaseConfig);

/* 다른 JS 파일에서 window.db / window.storage / window.auth 로 접근 */
window.db      = getFirestore(app);
window.storage = getStorage(app);
window.auth    = getAuth(app);
