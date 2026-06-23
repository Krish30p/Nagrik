import { API_BASE_URL } from "./firebase";
import { User } from "../types";

type AuthStateListener = (user: User | null) => void;
const listeners = new Set<AuthStateListener>();

let currentUser: User | null = null;

function notifyListeners() {
  listeners.forEach((listener) => listener(currentUser));
}

// Helper to handle response and store token/user
function handleAuthResponse(data: { token: string; user: any }) {
  const mappedUser: User = {
    id: data.user.id,
    name: data.user.name || "Citizen",
    email: data.user.email || "",
    photoURL: `https://api.dicebear.com/7.x/adventurer/svg?seed=${data.user.id}`,
    points: data.user.points || 0,
    level: Math.floor((data.user.points || 0) / 100) + 1,
    reportsCount: data.user.reportsCount || 0,
    confirmationsCount: data.user.confirmationsCount || 0,
    createdAt: data.user.createdAt || new Date().toISOString()
  };

  localStorage.setItem("nagrik_token", data.token);
  localStorage.setItem("nagrik_user", JSON.stringify(mappedUser));
  localStorage.setItem("nagrik_role", data.user.role || "citizen");
  currentUser = mappedUser;
  notifyListeners();
  return mappedUser;
}

// Auto sign in anonymously on load if no user is present
export async function initializeAuth() {
  const token = localStorage.getItem("nagrik_token");
  const storedUser = localStorage.getItem("nagrik_user");
  
  if (token && storedUser) {
    currentUser = JSON.parse(storedUser);
    notifyListeners();
  } else {
    console.log("[Auth] No session found. Automatically signing in anonymously...");
    try {
      await authService.loginAnonymous();
    } catch (err) {
      console.error("[Auth] Auto anonymous sign-in failed:", err);
    }
  }
}

// Run auth initialization after script loads
setTimeout(initializeAuth, 50);

export const authService = {
  onAuthStateChanged(callback: AuthStateListener) {
    listeners.add(callback);
    callback(currentUser);
    return () => {
      listeners.delete(callback);
    };
  },

  getCurrentUser(): User | null {
    if (!currentUser) {
      const stored = localStorage.getItem("nagrik_user");
      if (stored) currentUser = JSON.parse(stored);
    }
    return currentUser;
  },

  isStaff(): boolean {
    return localStorage.getItem("nagrik_role") === "staff";
  },

  async login(email: string, password: string): Promise<User> {
    console.log(`[Auth] Logging in: ${email}...`);
    const res = await fetch(`${API_BASE_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.message || "Invalid email or password");
    }

    const data = await res.json();
    return handleAuthResponse(data);
  },

  async register(name: string, email: string, password: string): Promise<User> {
    console.log(`[Auth] Registering: ${email}...`);
    const res = await fetch(`${API_BASE_URL}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password })
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.message || "Registration failed");
    }

    const data = await res.json();
    return handleAuthResponse(data);
  },

  async loginAnonymous(): Promise<User> {
    console.log("[Auth] Performing anonymous sign-in...");
    const res = await fetch(`${API_BASE_URL}/auth/anonymous`, {
      method: "POST",
      headers: { "Content-Type": "application/json" }
    });

    if (!res.ok) {
      throw new Error("Anonymous session creation failed");
    }

    const data = await res.json();
    return handleAuthResponse(data);
  },

  async logout(): Promise<void> {
    console.log("[Auth] Logging out current user...");
    localStorage.removeItem("nagrik_token");
    localStorage.removeItem("nagrik_user");
    localStorage.removeItem("nagrik_role");
    currentUser = null;
    notifyListeners();

    // Auto sign back in anonymously
    try {
      await this.loginAnonymous();
    } catch (err) {
      console.error("[Auth] Anonymous fallback failed after logout:", err);
    }
  }
};

export function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem("nagrik_token");
  return token ? { "Authorization": `Bearer ${token}` } : {};
}
