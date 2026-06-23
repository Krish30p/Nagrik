// Helper to get simulated current time based on localStorage offset (used for local demos)
export function getSimulatedCurrentTime(): Date {
  const offset = parseInt(localStorage.getItem("nagrik_time_offset_ms") || "0", 10);
  return new Date(Date.now() + offset);
}
