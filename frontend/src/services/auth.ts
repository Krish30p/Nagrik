import { auth, db } from "./firebase";
import {
  onAuthStateChanged as firebaseOnAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  signInAnonymously,
  createUserWithEmailAndPassword,
  updateProfile
} from "firebase/auth";
import { doc, getDoc, setDoc, onSnapshot } from "firebase/firestore";
import { User } from "../types";

type AuthStateListener = (user: User | null) => void;
const listeners = new Set<AuthStateListener>();

let currentUser: User | null = null;
let profileUnsubscribe: (() => void) | null = null;

function notifyListeners() {
  listeners.forEach((listener) => listener(currentUser));
}

// Listen to Firebase Auth state
firebaseOnAuthStateChanged(auth, async (firebaseUser) => {
  if (profileUnsubscribe) {
    profileUnsubscribe();
    profileUnsubscribe = null;
  }

  if (firebaseUser) {
    console.log(`[Auth Service] Firebase Auth state changed: logged in as ${firebaseUser.uid} (anonymous: ${firebaseUser.isAnonymous})`);
    
    const userRef = doc(db, "users", firebaseUser.uid);
    const userSnap = await getDoc(userRef);
    
    // Self-healing: if the user profile doesn't exist in Firestore, create it
    if (!userSnap.exists()) {
      const initialProfile = {
        displayName: firebaseUser.isAnonymous ? "Citizen" : (firebaseUser.displayName || "Citizen"),
        role: "citizen",
        authProvider: firebaseUser.isAnonymous ? "anonymous" : "email",
        createdAt: new Date(),
        civicPoints: 0,
        reportsCount: 0,
        confirmationsCount: 0,
        locality: null,
        fcmToken: null
      };
      await setDoc(userRef, initialProfile);
    }

    // Set up a real-time listener to user profile
    profileUnsubscribe = onSnapshot(userRef, async (docSnap) => {
      const data = docSnap.data();
      if (data) {
        // Read custom claims to get role
        const tokenResult = await firebaseUser.getIdTokenResult(true);
        const role = (tokenResult.claims.role as string) || data.role || "citizen";

        currentUser = {
          id: firebaseUser.uid,
          name: data.displayName || "Citizen",
          email: firebaseUser.email || "",
          photoURL: firebaseUser.photoURL || `https://api.dicebear.com/7.x/adventurer/svg?seed=${firebaseUser.uid}`,
          points: data.civicPoints || 0,
          level: Math.floor((data.civicPoints || 0) / 100) + 1,
          reportsCount: data.reportsCount || 0,
          confirmationsCount: data.confirmationsCount || 0,
          createdAt: data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString()
        };
        
        localStorage.setItem("nagrik_user", JSON.stringify(currentUser));
        localStorage.setItem("nagrik_role", role);
        notifyListeners();
      }
    });

  } else {
    console.log("[Auth Service] Firebase Auth state changed: logged out");
    currentUser = null;
    localStorage.removeItem("nagrik_user");
    localStorage.removeItem("nagrik_role");
    notifyListeners();
    
    // Auto sign in anonymously for citizens
    console.log("[Auth Service] Auto signing in anonymously...");
    signInAnonymously(auth).catch((err) => {
      console.error("[Auth Service] Anonymous sign in failed:", err);
    });
  }
});

export const authService = {
  onAuthStateChanged(callback: AuthStateListener) {
    listeners.add(callback);
    callback(currentUser);
    return () => {
      listeners.delete(callback);
    };
  },

  getCurrentUser(): User | null {
    return currentUser || JSON.parse(localStorage.getItem("nagrik_user") || "null");
  },

  isStaff(): boolean {
    return localStorage.getItem("nagrik_role") === "staff";
  },

  async login(email: string, password: string): Promise<User> {
    console.log(`[Auth Service] Logging in ${email}...`);
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    
    // Force refresh token to get claims
    const tokenResult = await userCredential.user.getIdTokenResult(true);
    const role = (tokenResult.claims.role as string) || "citizen";
    localStorage.setItem("nagrik_role", role);

    // Wait until profile is loaded
    await new Promise((resolve) => setTimeout(resolve, 500));
    
    return currentUser!;
  },

  async register(name: string, email: string, password: string): Promise<User> {
    console.log(`[Auth Service] Registering ${email}...`);
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    
    // Update display name
    await updateProfile(userCredential.user, { displayName: name });
    
    // Create profile doc in Firestore (trigger listener will capture it)
    const userRef = doc(db, "users", userCredential.user.uid);
    await setDoc(userRef, {
      displayName: name,
      role: "citizen",
      authProvider: "email",
      createdAt: new Date(),
      civicPoints: 0,
      reportsCount: 0,
      confirmationsCount: 0,
      locality: null,
      fcmToken: null
    });
    
    // Wait until profile listener triggers
    await new Promise((resolve) => setTimeout(resolve, 500));
    
    return currentUser!;
  },

  async logout(): Promise<void> {
    console.log("[Auth Service] Logging out...");
    if (profileUnsubscribe) {
      profileUnsubscribe();
      profileUnsubscribe = null;
    }
    await signOut(auth);
  }
};
export function getAuthHeaders() {
  return {}; // Dummy implementation since SDK handles auth tokens automatically
}
