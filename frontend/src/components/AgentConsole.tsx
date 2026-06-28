import React, { useEffect, useState } from "react";
import { dbService, subscribeToCollection } from "../services/db";
import { API_BASE_URL } from "../services/firebase";
import { AgentLog } from "../types";
import { Terminal, RefreshCw, Trash2, Clock, ChevronDown, ChevronUp } from "lucide-react";

export const AgentConsole: React.FC = () => {
  const [logs, setLogs] = useState<AgentLog[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [expandedLog, setExpandedLog] = useState<string | null>(null);
  const [simulatedDays, setSimulatedDays] = useState(0);
  const [isProcessing, setIsProcessing] = useState<string | null>(null);

  const loadLogs = async () => {
    const data = await dbService.getAgentLogs();
    setLogs(data);
  };

  useEffect(() => {
    void Promise.resolve().then(loadLogs);
    
    // Read current time offset to initialize display
    const offset = parseInt(localStorage.getItem("nagrik_time_offset_ms") || "0", 10);
    window.setTimeout(() => {
      setSimulatedDays(Math.floor(offset / (24 * 3600 * 1000)));
    }, 0);

    const unsubscribe = subscribeToCollection("agent_logs", loadLogs);
    return unsubscribe;
  }, []);

  const handleClearLogs = async () => {
    await dbService.clearAgentLogs();
    await loadLogs();
  };

  const handleTriggerEscalation = async () => {
    setIsProcessing("escalation");
    try {
      const res = await fetch(`${API_BASE_URL}/agents/escalate`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to trigger sweep");
      await loadLogs();
    } catch (e) {
      console.error("Failed to run escalation sweep:", e);
    } finally {
      setIsProcessing(null);
    }
  };

  const handleFastForward = async (days: number) => {
    setIsProcessing("time");
    try {
      const currentOffset = parseInt(localStorage.getItem("nagrik_time_offset_ms") || "0", 10);
      const addedOffset = days * 24 * 3600 * 1000;
      const newOffset = currentOffset + addedOffset;
      localStorage.setItem("nagrik_time_offset_ms", newOffset.toString());
      setSimulatedDays(Math.floor(newOffset / (24 * 3600 * 1000)));

      // Update simulation time offset on the backend to match SLA sweep evaluations
      const res = await fetch(`${API_BASE_URL}/simulation/fast-forward`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ days })
      });
      if (!res.ok) throw new Error("Failed to fast-forward");

      await loadLogs();
    } catch (e) {
      console.error("Fast forward failed:", e);
    } finally {
      setIsProcessing(null);
    }
  };

  const resetTime = async () => {
    setIsProcessing("time");
    try {
      localStorage.setItem("nagrik_time_offset_ms", "0");
      setSimulatedDays(0);
      
      const res = await fetch(`${API_BASE_URL}/simulation/reset`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to reset");
      
      await loadLogs();
    } catch (e) {
      console.error("Time reset failed:", e);
    } finally {
      setIsProcessing(null);
    }
  };

  const toggleLog = (id: string) => {
    setExpandedLog(expandedLog === id ? null : id);
  };

  return (
    <div
      className={`fixed bottom-0 right-0 left-0 z-50 bg-slate-900 text-slate-100 border-t border-slate-800 transition-all duration-300 shadow-2xl ${
        isOpen ? "h-96" : "h-12"
      }`}
    >
      {/* Console Header */}
      <div
        className="h-12 bg-slate-950 px-4 flex justify-between items-center cursor-pointer select-none border-b border-slate-800"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-2">
          <Terminal className="h-4.5 w-4.5 text-secondary animate-pulse" />
          <span className="text-sm font-bold tracking-wide uppercase flex items-center gap-2">
            Civic Agent Telemetry Feed
            {simulatedDays > 0 && (
              <span className="bg-amber-500/20 text-amber-400 border border-amber-500/30 text-[10px] normal-case px-2 py-0.5 rounded">
                Clock Fast-Forwarded: +{simulatedDays} Days
              </span>
            )}
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-xs text-slate-400 hidden md:inline">
            Active: Intake (1.0) | Verification (1.1) | Routing (1.0) | Escalation (1.2)
          </span>
          {isOpen ? <ChevronDown className="h-5 w-5" /> : <ChevronUp className="h-5 w-5" />}
        </div>
      </div>

      {/* Console Body */}
      {isOpen && (
        <div className="h-84 flex flex-col md:flex-row">
          {/* Simulation Controls (Left Panel) */}
          <div className="w-full md:w-80 border-b md:border-b-0 md:border-r border-slate-800 bg-slate-950/50 p-4 flex flex-col gap-3">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              Demo Simulation Controls
            </h3>
            
            <div className="flex flex-col gap-2">
              <p className="text-[11px] text-slate-400 leading-tight">
                Simulate time progression to check Escalation Agent SLA breach tracking (Garbage: 3d, Water Leak: 2d, Pothole: 7d).
              </p>
              
              <div className="grid grid-cols-3 gap-1.5 mt-1">
                <button
                  onClick={() => handleFastForward(1)}
                  disabled={isProcessing !== null}
                  className="bg-slate-800 hover:bg-slate-700 text-xs font-semibold py-1.5 px-2 rounded border border-slate-700 text-slate-300 transition-colors disabled:opacity-50"
                >
                  +1 Day
                </button>
                <button
                  onClick={() => handleFastForward(3)}
                  disabled={isProcessing !== null}
                  className="bg-slate-800 hover:bg-slate-700 text-xs font-semibold py-1.5 px-2 rounded border border-slate-700 text-slate-300 transition-colors disabled:opacity-50"
                >
                  +3 Days
                </button>
                <button
                  onClick={() => handleFastForward(7)}
                  disabled={isProcessing !== null}
                  className="bg-slate-800 hover:bg-slate-700 text-xs font-semibold py-1.5 px-2 rounded border border-slate-700 text-slate-300 transition-colors disabled:opacity-50"
                >
                  +7 Days
                </button>
              </div>

              {simulatedDays > 0 && (
                <button
                  onClick={resetTime}
                  disabled={isProcessing !== null}
                  className="text-[10px] text-red-400 hover:text-red-300 text-left font-medium mt-1 w-fit disabled:opacity-50"
                >
                  Reset simulation time
                </button>
              )}
            </div>

            <hr className="border-slate-800 my-1" />

            <div className="flex flex-col gap-2">
              <button
                disabled={isProcessing !== null}
                onClick={handleTriggerEscalation}
                className="w-full bg-primary hover:bg-primary-hover text-white text-xs font-bold py-2 px-3 rounded flex items-center justify-center gap-1.5 transition-all shadow-md disabled:opacity-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isProcessing === "escalation" ? "animate-spin" : ""}`} />
                Run SLA Compliance Sweep
              </button>

              <button
                onClick={handleClearLogs}
                className="w-full bg-slate-800 hover:bg-slate-750 text-slate-300 text-xs font-semibold py-2 px-3 rounded flex items-center justify-center gap-1.5 transition-all border border-slate-700"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Clear Telemetry Feed
              </button>
            </div>
          </div>

          <div className="flex-1 flex flex-col h-full bg-slate-950">
            <div className="flex items-center justify-between px-4 py-2 bg-slate-950 border-b border-slate-900 text-xs select-none">
              <span className="font-bold text-slate-500">TELEMETRY REGISTRY</span>
              <span className="text-[10px] text-slate-600">{logs.length} RECORDS</span>
            </div>

            <div className="flex-1 overflow-y-auto p-4 font-mono text-xs flex flex-col gap-1.5 bg-slate-950 text-slate-300">
              {logs.length === 0 ? (
                <div className="text-slate-600 italic text-center mt-12">
                  [EMPTY REGISTRY: NO RECORDED TELEMETRY]
                </div>
              ) : (
                logs.map((log, index) => {
                  const isLatest = index === 0;
                  const isExpanded = expandedLog === log.id;

                  // Custom agent glyphs
                  const agentGlyph: Record<string, string> = {
                    INTAKE: "⌕ [INTK]",
                    VERIFICATION: "⚯ [VERF]",
                    ROUTING: "🧭 [ROUT]",
                    ESCALATION: "⧁ [ESCL]",
                  };
                  const glyph = agentGlyph[log.agentName.toUpperCase()] || "⊙ [AGNT]";

                  // Log level indicator character
                  const levelChar = {
                    info: "·",
                    success: "✓",
                    warning: "!",
                    error: "✗"
                  }[log.type] || "·";

                  return (
                    <div
                      key={log.id}
                      className={`border-b border-slate-900 pb-2 mb-2 last:border-b-0 hover:bg-slate-900/45 transition-colors relative pl-4 ${
                        isLatest ? "border-l-2 border-l-terracotta" : "border-l-2 border-l-slate-800"
                      }`}
                    >
                      <div
                        className="flex flex-col sm:flex-row sm:items-baseline gap-2 cursor-pointer"
                        onClick={() => toggleLog(log.id)}
                      >
                        {/* Timestamp Left Column */}
                        <span className="text-[10px] text-slate-500 select-none w-20 shrink-0">
                          [{new Date(log.timestamp).toLocaleTimeString()}]
                        </span>

                        {/* Agent ID & Action */}
                        <div className="flex flex-wrap items-center gap-2 flex-1">
                          <span className={`text-[10px] font-bold ${
                            isLatest ? "text-terracotta" : "text-slate-400"
                          }`}>
                            {glyph}
                          </span>
                          <span className="text-slate-500 font-bold">{levelChar}</span>
                          <span className="text-slate-200">{log.action}</span>
                          {log.issueId && (
                            <span className="text-[9px] text-slate-500 bg-slate-900 px-1 py-0.2 rounded">
                              NGK-{log.issueId.substring(0, 8).toUpperCase()}
                            </span>
                          )}
                        </div>

                        <div className="text-[10px] text-slate-500 shrink-0 self-end sm:self-center">
                          {isExpanded ? "[collapse]" : "[expand]"}
                        </div>
                      </div>
                      
                      {isExpanded && (
                        <div className="mt-2 pl-24 text-[11px] leading-relaxed text-slate-400 border-l border-dashed border-slate-800">
                          <div className="bg-slate-900/60 p-2.5 rounded font-sans whitespace-pre-wrap">
                            {log.details}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
