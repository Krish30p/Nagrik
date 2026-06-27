// All config values are sourced from environment variables.
// Copy frontend/.env.example → frontend/.env.local and fill in your values.

export const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
export const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "";
export const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || "";

// Force MongoDB server mode (disable mock mode)
export const USE_MOCK_SERVICES = false;


if (!GOOGLE_MAPS_API_KEY) {
  console.warn("[Nagrik Config] VITE_GOOGLE_MAPS_API_KEY is not set — map features will be limited.");
}

console.log(`[Nagrik Config] Mode: ${USE_MOCK_SERVICES ? "LOCAL BROWSER SIMULATION" : "MONGODB SERVER CONNECTED"} | API: ${API_URL}`);

