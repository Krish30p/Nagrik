import { USE_MOCK_SERVICES, API_URL } from "./config";
import { User } from "../types";

type AuthStateListener = (user: User | null) => void;
const listeners = new Set<AuthStateListener>();

// Initial session state
let currentUser: User | null = (() => {
  const saved = localStorage.getItem("nagrik_user");
  return saved ? JSON.parse(saved) : null;
})();

function notifyListeners() {
  listeners.forEach(listener => listener(currentUser));
}

// Fetch helper with Auth headers
export function getAuthHeaders() {
  const token = localStorage.getItem("nagrik_jwt");
  return {
    "Content-Type": "application/json",
    ...(token ? { "Authorization": `Bearer ${token}` } : {})
  };
}

export const authService = {
  onAuthStateChanged(callback: AuthStateListener) {
    listeners.add(callback);
    callback(currentUser);
    return () => {
      listeners.delete(callback);
    };
  },

  getCurrentUser(): User | null {
    return currentUser;
  },

  async login(email: string, password: string): Promise<User> {
    if (USE_MOCK_SERVICES) {
      const mockUsers = JSON.parse(localStorage.getItem("nagrik_mock_users") || "[]");
      const found = mockUsers.find((u: any) => u.email === email);
      if (!found) {
        throw new Error("User not found in local simulation. Please register first!");
      }

      currentUser = {
        id: found.id,
        name: found.name,
        email: found.email,
        photoURL: found.photoURL || `https://api.dicebear.com/7.x/adventurer/svg?seed=${found.name}`,
        points: found.points || 150,
        level: found.level || 1,
        reportsCount: found.reportsCount || 0,
        confirmationsCount: found.confirmationsCount || 0,
        createdAt: found.createdAt || new Date().toISOString(),
      };

      localStorage.setItem("nagrik_use_mock", "true");
      localStorage.setItem("nagrik_user", JSON.stringify(currentUser));
      notifyListeners();
      return currentUser;
    } else {
      // Connect to MongoDB REST API
      const res = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to sign in.");
      }

      localStorage.removeItem("nagrik_use_mock");
      localStorage.setItem("nagrik_jwt", data.token);

      // Translate _id to id for frontend type compatibility
      currentUser = {
        ...data.user,
        id: data.user._id
      };

      localStorage.setItem("nagrik_user", JSON.stringify(currentUser));
      notifyListeners();
      return currentUser!;
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
        points: 100,
        level: 1,
        reportsCount: 0,
        confirmationsCount: 0,
        createdAt: new Date().toISOString(),
      };

      mockUsers.push(newUser);
      localStorage.setItem("nagrik_mock_users", JSON.stringify(mockUsers));
      localStorage.setItem("nagrik_use_mock", "true");
      
      currentUser = newUser;
      localStorage.setItem("nagrik_user", JSON.stringify(newUser));
      notifyListeners();
      return newUser;
    } else {
      // Connect to MongoDB REST API
      const res = await fetch(`${API_URL}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to create account.");
      }

      localStorage.removeItem("nagrik_use_mock");
      localStorage.setItem("nagrik_jwt", data.token);

      currentUser = {
        ...data.user,
        id: data.user._id
      };

      localStorage.setItem("nagrik_user", JSON.stringify(currentUser));
      notifyListeners();
      return currentUser!;
    }
  },

  async logout(): Promise<void> {
    currentUser = null;
    localStorage.removeItem("nagrik_user");
    localStorage.removeItem("nagrik_jwt");
    localStorage.removeItem("nagrik_use_mock");
    notifyListeners();
  },

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
        
        mockUsers[userIndex].level = Math.floor(mockUsers[userIndex].points / 100) + 1;
        
        localStorage.setItem("nagrik_mock_users", JSON.stringify(mockUsers));

        if (currentUser && currentUser.id === userId) {
          currentUser = mockUsers[userIndex];
          localStorage.setItem("nagrik_user", JSON.stringify(currentUser));
          notifyListeners();
        }
      }
    } else {
      // In live MongoDB mode, database endpoints (like create issue or resolve issue) 
      // automatically execute points accrual in the backend! We just fetch profile to sync.
      try {
        const res = await fetch(`${API_URL}/auth/profile`, {
          headers: getAuthHeaders()
        });
        if (res.ok) {
          const user = await res.json();
          currentUser = {
            ...user,
            id: user._id
          };
          localStorage.setItem("nagrik_user", JSON.stringify(currentUser));
          notifyListeners();
        }
      } catch (err) {
        console.error("Points profile sync error:", err);
      }
    }
  }
};
