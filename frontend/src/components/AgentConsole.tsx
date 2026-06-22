import React, { useEffect, useState } from "react";
import { dbService, subscribeToCollection } from "../services/db";
import { escalationAgent } from "../services/agents/escalation";
import { AgentLog } from "../types";
import { Terminal, Shield, ArrowRight, RefreshCw, Trash2, Clock, Play, ChevronDown, ChevronUp } from "lucide-react";

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
    loadLogs();
    
    // Read current time offset to initialize display
    const offset = parseInt(localStorage.getItem("nagrik_time_offset_ms") || "0", 10);
    setSimulatedDays(Math.floor(offset / (24 * 3600 * 1000)));

    const unsubscribe = subscribeToCollection("agent_logs", loadLogs);
    return unsubscribe;
  }, []);

  const handleClearLogs = async () => {
    await dbService.clearAgentLogs();
  };

  const handleTriggerEscalation = async () => {
    setIsProcessing("escalation");
    try {
      await escalationAgent.checkSLAAndEscalate();
      await loadLogs();
    } catch (e) {
      console.error(e);
    } finally {
      setIsProcessing(null);
    }
  };

  const handleFastForward = async (days: number) => {
    const currentOffset = parseInt(localStorage.getItem("nagrik_time_offset_ms") || "0", 10);
    const addedOffset = days * 24 * 3600 * 1000;
    const newOffset = currentOffset + addedOffset;
    localStorage.setItem("nagrik_time_offset_ms", newOffset.toString());
    setSimulatedDays(Math.floor(newOffset / (24 * 3600 * 1000)));

    await dbService.createAgentLog(
      "Escalation Agent",
      "Time Travel Event",
      `Fast-forwarded simulation clock by **${days} days**. Total offset: **${Math.floor(newOffset / (24 * 3600 * 1000))} days**. Checking SLA breaches...`,
      "warning"
    );

    // Automatically trigger Escalation Agent check
    await handleTriggerEscalation();
  };

  const resetTime = async () => {
    localStorage.setItem("nagrik_time_offset_ms", "0");
    setSimulatedDays(0);
    await dbService.createAgentLog(
      "Escalation Agent",
      "Time Reset",
      `Reset simulation clock to normal system time.`,
      "info"
    );
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
                  className="bg-slate-800 hover:bg-slate-700 text-xs font-semibold py-1.5 px-2 rounded border border-slate-700 text-slate-300 transition-colors"
                >
                  +1 Day
                </button>
                <button
                  onClick={() => handleFastForward(3)}
                  className="bg-slate-800 hover:bg-slate-700 text-xs font-semibold py-1.5 px-2 rounded border border-slate-700 text-slate-300 transition-colors"
                >
                  +3 Days
                </button>
                <button
                  onClick={() => handleFastForward(7)}
                  className="bg-slate-800 hover:bg-slate-700 text-xs font-semibold py-1.5 px-2 rounded border border-slate-700 text-slate-300 transition-colors"
                >
                  +7 Days
                </button>
              </div>

              {simulatedDays > 0 && (
                <button
                  onClick={resetTime}
                  className="text-[10px] text-red-400 hover:text-red-300 text-left font-medium mt-1 w-fit"
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
                <RefreshCw className={`h-3.5 w-3.5 ${isProcessing ? "animate-spin" : ""}`} />
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

          {/* Telemetry Stream Output (Right Panel) */}
          <div className="flex-1 flex flex-col h-full bg-slate-900">
            <div className="flex items-center justify-between px-4 py-2 bg-slate-950 border-b border-slate-850 text-xs">
              <span className="font-bold text-slate-400">Telemetry Log Stream</span>
              <span className="text-[10px] text-slate-500">{logs.length} entries</span>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 font-mono text-xs flex flex-col gap-2.5">
              {logs.length === 0 ? (
                <div className="text-slate-500 italic text-center mt-12">
                  No telemetry logs. Submit an issue or trigger agent tasks to stream logs.
                </div>
              ) : (
                logs.map((log) => {
                  const logTypeStyles = {
                    info: "text-blue-400 border-blue-500/20 bg-blue-950/20",
                    success: "text-emerald-400 border-emerald-500/20 bg-emerald-950/20",
                    warning: "text-amber-400 border-amber-500/20 bg-amber-950/20",
                    error: "text-red-400 border-red-500/20 bg-red-950/20"
                  }[log.type];

                  const isExpanded = expandedLog === log.id;

                  return (
                    <div
                      key={log.id}
                      className={`border rounded-lg p-2.5 transition-all ${logTypeStyles}`}
                    >
                      <div
                        className="flex justify-between items-center cursor-pointer"
                        onClick={() => toggleLog(log.id)}
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-bold bg-slate-850 text-slate-200 px-1.5 py-0.5 rounded text-[10px]">
                            {log.agentName}
                          </span>
                          <span className="font-bold">{log.action}</span>
                          {log.issueId && (
                            <span className="text-[10px] text-slate-400 font-normal">
                              (Ticket: {log.issueId})
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-slate-500 text-[10px]">
                          <span>{new Date(log.timestamp).toLocaleTimeString()}</span>
                          {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                        </div>
                      </div>
                      
                      {isExpanded && (
                        <div className="mt-3.5 pt-3 border-t border-slate-800 text-[11px] leading-relaxed whitespace-pre-wrap text-slate-300 font-sans">
                          {log.details}
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
