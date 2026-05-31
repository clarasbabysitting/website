// ============================================================
// Clara's Babysitting — Firebase Configuration
// ============================================================
// IMPORTANT: Replace the placeholder values below with your
// own Firebase project credentials.
// Get them from: Firebase Console > Project Settings > General
// ============================================================

const firebaseConfig = {
  const firebaseConfig = {
    apiKey: "AIzaSyDPqpCLfcXLOVQgRfknrB7sB3ogtN_DA1w",
    authDomain: "babysitting-d5791.firebaseapp.com",
    projectId: "babysitting-d5791",
    storageBucket: "babysitting-d5791.firebasestorage.app",
    messagingSenderId: "664714812625",
    appId: "1:664714812625:web:f431276528d23b09fbb9f0",
    measurementId: "G-R4N37SNN6W"
  };
};

// ---- Initialize Firebase ----
firebase.initializeApp(firebaseConfig);

// ---- Export shared references ----
const auth = firebase.auth();
const db   = firebase.firestore();

// ---- Persistence (keep user logged in) ----
auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);

// ---- Firestore settings ----
db.settings({ experimentalForceLongPolling: false });

// Expose globally for other scripts
window.auth = auth;
window.db   = db;
window.firebase = firebase;

console.log("🌿 Clara's Babysitting — Firebase initialised");
