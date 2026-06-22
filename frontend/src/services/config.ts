export const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
export const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "";
export const GEMINI_API_KEY = ""; // Kept as stub for local mock agent type compatibility

// Default to mock mode (true) unless the user explicitly toggles it to false (MongoDB server mode)
export const USE_MOCK_SERVICES = localStorage.getItem("nagrik_use_mock") !== "false";

console.log(`[Nagrik Config] Client mode: ${USE_MOCK_SERVICES ? "LOCAL BROWSER SIMULATION" : "MONGODB SERVER CONNECTED"}`);
