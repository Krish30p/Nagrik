// Sourced from environment variables with safe defaults for local Express + MongoDB mode
export const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
export const WS_URL = import.meta.env.VITE_WS_URL || "ws://localhost:5000";

console.log(`[Config] Connecting to backend at: ${API_BASE_URL}`);
console.log(`[Config] WebSocket Change Stream at: ${WS_URL}`);
