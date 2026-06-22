export const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
export const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "";
export const GEMINI_API_KEY = ""; // Kept as stub for local mock agent type compatibility

// Set mock mode either via environment variables or a localStorage override
export const USE_MOCK_SERVICES = 
  import.meta.env.VITE_USE_MOCK === "true" || 
  localStorage.getItem("nagrik_use_mock") === "true" ||
  !localStorage.getItem("nagrik_jwt") && localStorage.getItem("nagrik_user") !== null;

console.log(`[Nagrik Config] Client mode: ${USE_MOCK_SERVICES ? "LOCAL BROWSER SIMULATION" : "MONGODB SERVER CONNECTED"}`);
