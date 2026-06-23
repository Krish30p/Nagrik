import { initializeApp } from "firebase/app";
import { getAuth, connectAuthEmulator } from "firebase/auth";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";
import { getStorage, connectStorageEmulator } from "firebase/storage";
import { getFunctions, connectFunctionsEmulator } from "firebase/functions";

// Sourced from environment variables with safe defaults for local emulator mode
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "dummy-api-key-for-local-emulator",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "nagrik-mvp.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "demo-nagrik-mvp",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "nagrik-mvp.appspot.com",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "1234567890",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:1234567890:web:1234567890"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const functions = getFunctions(app);

// In development, connect to the Firebase Emulators
const isLocal = import.meta.env.DEV || window.location.hostname === "localhost";

if (isLocal) {
  console.log("[Firebase Client] Connecting to local Firebase Emulators...");
  
  // Connect Auth
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  
  // Connect Firestore
  connectFirestoreEmulator(db, "127.0.0.1", 8080);
  
  // Connect Storage
  connectStorageEmulator(storage, "127.0.0.1", 9199);
  
  // Connect Functions
  connectFunctionsEmulator(functions, "127.0.0.1", 5001);
}
export default app;
