// firebase-init.js
// Reads config from window.ENV (populated by env-loader.js via .env file parsing)
// OR falls back to direct values if you prefer to paste them here for testing.

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth }        from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore }   from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ------------------------------------------------------------------
// Firebase config is loaded from the global ENV object.
// That object is set by env-loader.js which reads your .env file.
// See IMPLEMENTATION.md for full setup instructions.
// ------------------------------------------------------------------
const cfg = window.ENV || {};

const firebaseConfig = {
  apiKey:            cfg.FIREBASE_API_KEY,
  authDomain:        cfg.FIREBASE_AUTH_DOMAIN,
  projectId:         cfg.FIREBASE_PROJECT_ID,
  storageBucket:     cfg.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: cfg.FIREBASE_MESSAGING_SENDER_ID,
  appId:             cfg.FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db   = getFirestore(app);
