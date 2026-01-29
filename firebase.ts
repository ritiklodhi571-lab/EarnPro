
import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/12.8.0/firebase-app.js";
import { 
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut
} from "https://www.gstatic.com/firebasejs/12.8.0/firebase-auth.js";

import { 
  getFirestore,
  collection,
  query,
  where,
  addDoc,
  onSnapshot,
  serverTimestamp,
  orderBy,
  doc,
  setDoc
} from "https://www.gstatic.com/firebasejs/12.8.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCNW9OycJLk2eqlNX-yU2CkKJBuC3i2B0c",
  authDomain: "earnpro-4ea08.firebaseapp.com",
  projectId: "earnpro-4ea08",
  storageBucket: "earnpro-4ea08.firebasestorage.app",
  messagingSenderId: "516326583560",
  appId: "1:516326583560:web:f5601209e2fe6a182110bd"
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);

export {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  onAuthStateChanged,
  signOut,
  collection,
  query,
  where,
  addDoc,
  onSnapshot,
  serverTimestamp,
  orderBy,
  doc,
  setDoc
};
