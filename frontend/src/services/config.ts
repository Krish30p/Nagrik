// Detection for Firebase configuration
export const FIREBASE_CONFIG = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "",
};

export const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || "";
export const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "";

// Toggle live backend vs local simulation
export const USE_MOCK_SERVICES =
  !FIREBASE_CONFIG.apiKey ||
  FIREBASE_CONFIG.apiKey === "YOUR_API_KEY" ||
  import.meta.env.VITE_USE_MOCK === "true";

console.log(`[Nagrik Config] Running in ${USE_MOCK_SERVICES ? "LOCAL SIMULATION" : "LIVE BACKEND"} mode.`);
