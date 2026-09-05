import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore, initializeFirestore } from "firebase/firestore";

// Credenciales oficiales de Firebase Firestore (Proyecto the-creators-cookbook-77bc)
const firebaseConfig = {
  apiKey: "AIzaSyAqlHC0rrRQIpkpa7l8CTPSu7J35nL8jkk",
  authDomain: "the-creators-cookbook-77bc.firebaseapp.com",
  projectId: "the-creators-cookbook-77bc",
  storageBucket: "the-creators-cookbook-77bc.firebasestorage.app",
  messagingSenderId: "934032523334",
  appId: "1:934032523334:web:370c8cab124df7327eca47",
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

let firestoreDb;
try {
  firestoreDb = initializeFirestore(app, {
    ignoreUndefinedProperties: true,
  });
} catch {
  firestoreDb = getFirestore(app);
}

export const db = firestoreDb;
export default app;
