import { USE_MOCK_SERVICES } from "./config";
import { User } from "../types";

// Private mock session state
let mockCurrentUser: User | null = (() => {
  const saved = localStorage.getItem("nagrik_user");
  return saved ? JSON.parse(saved) : null;
})();

type AuthStateListener = (user: User | null) => void;
const listeners = new Set<AuthStateListener>();

function notifyListeners() {
  listeners.forEach(listener => listener(mockCurrentUser));
}

// Live Firebase Auth imports (resolved dynamically/safely)
// We declare variables that can hold Firebase auth references
let firebaseAuth: any = null;
let firestoreDb: any = null;

if (!USE_MOCK_SERVICES) {
  // Real Firebase Auth setup will be initialized in a main entrypoint,
  // but we can import standard Firebase client libraries safely.
}

export const authService = {
  // Listen to auth state changes
  onAuthStateChanged(callback: AuthStateListener) {
    listeners.add(callback);
    callback(mockCurrentUser); // immediate initial call
    return () => {
      listeners.delete(callback);
    };
  },

  getCurrentUser(): User | null {
    return mockCurrentUser;
  },

  async login(email: string, password: string): Promise<User> {
    if (USE_MOCK_SERVICES) {
      // Simple mock login: verify email exists in mock db
      const mockUsers = JSON.parse(localStorage.getItem("nagrik_mock_users") || "[]");
      const found = mockUsers.find((u: any) => u.email === email);
      if (!found) {
        throw new Error("User not found in local simulation. Please register first!");
      }
      
      mockCurrentUser = {
        id: found.id,
        name: found.name,
        email: found.email,
        photoURL: found.photoURL || `https://api.dicebear.com/7.x/adventurer/svg?seed=${found.name}`,
        points: found.points || 150,
        level: found.level || 1,
        reportsCount: found.reportsCount || found.reports?.length || 0,
        confirmationsCount: found.confirmationsCount || 0,
        createdAt: found.createdAt || new Date().toISOString(),
      };
      
      localStorage.setItem("nagrik_user", JSON.stringify(mockCurrentUser));
      notifyListeners();
      return mockCurrentUser;
    } else {
      // Live Firebase Login placeholder
      // In a real app: signInWithEmailAndPassword, then fetch user doc from Firestore
      throw new Error("Live Firebase login not fully connected. Check environment variables.");
    }
  },

  async register(name: string, email: string, password: string): Promise<User> {
    if (USE_MOCK_SERVICES) {
      const mockUsers = JSON.parse(localStorage.getItem("nagrik_mock_users") || "[]");
      if (mockUsers.some((u: any) => u.email === email)) {
        throw new Error("User with this email already exists!");
      }

      const newUser: User = {
        id: "usr_" + Math.random().toString(36).substr(2, 9),
        name,
        email,
        photoURL: `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(name)}`,
        points: 100, // starting points
        level: 1,
        reportsCount: 0,
        confirmationsCount: 0,
        createdAt: new Date().toISOString(),
      };

      mockUsers.push(newUser);
      localStorage.setItem("nagrik_mock_users", JSON.stringify(mockUsers));
      
      mockCurrentUser = newUser;
      localStorage.setItem("nagrik_user", JSON.stringify(newUser));
      notifyListeners();
      return newUser;
    } else {
      // Live Firebase Registration
      throw new Error("Live Firebase registration not fully connected. Check environment variables.");
    }
  },

  async logout(): Promise<void> {
    if (USE_MOCK_SERVICES) {
      mockCurrentUser = null;
      localStorage.removeItem("nagrik_user");
      notifyListeners();
    } else {
      // Live Firebase SignOut
    }
  },

  // Award points to user for civic action (reporting, confirming)
  async awardPoints(userId: string, pointsAmount: number, actionType: 'report' | 'confirm'): Promise<void> {
    if (USE_MOCK_SERVICES) {
      const mockUsers = JSON.parse(localStorage.getItem("nagrik_mock_users") || "[]");
      const userIndex = mockUsers.findIndex((u: any) => u.id === userId);
      if (userIndex !== -1) {
        mockUsers[userIndex].points = (mockUsers[userIndex].points || 0) + pointsAmount;
        if (actionType === 'report') {
          mockUsers[userIndex].reportsCount = (mockUsers[userIndex].reportsCount || 0) + 1;
        } else {
          mockUsers[userIndex].confirmationsCount = (mockUsers[userIndex].confirmationsCount || 0) + 1;
        }
        
        // Calculate level based on points (100 points per level)
        mockUsers[userIndex].level = Math.floor(mockUsers[userIndex].points / 100) + 1;
        
        localStorage.setItem("nagrik_mock_users", JSON.stringify(mockUsers));

        // If it's currently logged in user, update current session
        if (mockCurrentUser && mockCurrentUser.id === userId) {
          mockCurrentUser = mockUsers[userIndex];
          localStorage.setItem("nagrik_user", JSON.stringify(mockCurrentUser));
          notifyListeners();
        }
      }
    } else {
      // Live Firestore update
    }
  }
};
