import React, { useEffect, useState } from "react";
import { Issue, Complaint, Escalation } from "../types";
import { dbService } from "../services/db";
import { FileText, ChevronDown, ChevronUp } from "lucide-react";

interface IssueTimelineProps {
  issue: Issue;
}

export const IssueTimeline: React.FC<IssueTimelineProps> = ({ issue }) => {
  const [complaint, setComplaint] = useState<Complaint | null>(null);
  const [escalations, setEscalations] = useState<Escalation[]>([]);
  const [viewComplaint, setViewComplaint] = useState(false);
  const [viewNotice, setViewNotice] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      const allComplaints = await dbService.getComplaints();
      const comp = allComplaints.find((c) => c.issueId === issue.id) || null;
      setComplaint(comp);

      const allEscalations = await dbService.getEscalations();
      const escList = allEscalations.filter((e) => e.issueId === issue.id);
      setEscalations(escList);
    };
    fetchData();
  }, [issue.id, issue.status]);

  const statusHierarchy = ["REPORTED", "VERIFIED", "ROUTED", "IN_PROGRESS", "ESCALATED", "RESOLVED"];
  const currentStatusIndex = statusHierarchy.indexOf(issue.status);

  const timelineSteps = [
    {
      key: "REPORTED",
      title: "REPORT LOGGED BY CITIZEN",
      agent: "INTK",
      time: new Date(issue.createdAt).toLocaleTimeString(),
      description: "Incident entry filed in municipal ledger. Intake Agent triggered to analyze category, severity, and landmark data.",
      details: () => (
        <div className="bg-paper border border-rule rounded p-2.5 mt-1.5 text-[10px] space-y-0.5 text-ink-muted">
          <p><span className="font-bold text-ink">CATEGORY:</span> {issue.category.toUpperCase()}</p>
          <p><span className="font-bold text-ink">ESTIMATED SEVERITY:</span> {issue.severity}</p>
          <p><span className="font-bold text-ink">GEOGRAPHIC MAP REFERENCE:</span> [{issue.latitude.toFixed(4)}N, {issue.longitude.toFixed(4)}E]</p>
          {issue.voiceTranscript && (
            <p><span className="font-bold text-ink">VOICE TRANSCRIPT:</span> "{issue.voiceTranscript.toUpperCase()}"</p>
          )}
        </div>
      ),
    },
    {
      key: "VERIFIED",
      title: "SPATIAL VERIFICATION COMPLETED",
      agent: "VERF",
      time: new Date(new Date(issue.createdAt).getTime() + 45000).toLocaleTimeString(), // simulated offset
      description: "Verification Agent scanned 50m radius. Spatial-temporal overlap analysis executed to resolve duplicates.",
      details: () => (
        <div className="bg-paper border border-rule rounded p-2.5 mt-1.5 text-[10px] space-y-0.5 text-ink-muted">
          <p><span className="font-bold text-ink">CLUSTER STATUS:</span> {issue.threadId ? `MERGED INTO THREAD ID: ${issue.threadId.substring(0,8).toUpperCase()}` : "CONFIRMED UNIQUE NEW CASE THREAD"}</p>
          <p><span className="font-bold text-ink">URGENCY SCORE:</span> {issue.urgencyScore}/100</p>
        </div>
      ),
    },
    {
      key: "ROUTED",
      title: "ROUTE CONFIGURED & DISPATCHED",
      agent: "ROUT",
      time: new Date(new Date(issue.createdAt).getTime() + 90000).toLocaleTimeString(), // simulated offset
      description: "Routing Agent matched file to department ward index. Formal government complaint letter drafted.",
      details: () => (
        <div className="mt-1.5 text-[10px]">
          {complaint ? (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between bg-seal-tint border border-seal/20 rounded px-2.5 py-1 text-seal font-bold">
                <span>OFFICIAL DRAFT GENERATED</span>
                <button
                  onClick={() => setViewComplaint(!viewComplaint)}
                  className="flex items-center gap-1 font-mono hover:underline text-[9px] uppercase"
                >
                  <FileText className="h-3 w-3" />
                  {viewComplaint ? "Hide" : "View Letter"}
                </button>
              </div>
              {viewComplaint && (
                <pre className="bg-slate-900 text-slate-200 p-3 rounded overflow-x-auto whitespace-pre-wrap font-mono text-[9px] leading-relaxed border border-slate-800 max-h-60">
                  {complaint.generatedComplaint}
                </pre>
              )}
            </div>
          ) : (
            <p className="text-ink-muted italic">[COMPLAINT DRAFT GENERATION IN PROGRESS...]</p>
          )}
        </div>
      ),
    },
    {
      key: "IN_PROGRESS",
      title: "ASSIGNED & WORK SCHEDULED",
      agent: "DEPT",
      time: new Date(new Date(issue.createdAt).getTime() + 180000).toLocaleTimeString(), // simulated offset
      description: "Responsible municipal board acknowledged file. Scheduled for physical investigation and work order execution.",
    },
    {
      key: "ESCALATED",
      title: "LEDGER ESCALATED (SLA BREACH)",
      agent: "ESCL",
      time: new Date(new Date(issue.createdAt).getTime() + (issue.slaDays * 24 * 3600 * 1000)).toLocaleTimeString(),
      description: "Escalation Agent detected resolution timeline exceeded SLA parameter. Level 1 Notice generated.",
      details: () => (
        <div className="mt-1.5 text-[10px] space-y-1.5">
          {escalations.map((esc) => (
            <div key={esc.id} className="border border-status-escalated/30 bg-status-escalated/5 rounded p-2">
              <div className="flex justify-between items-center text-status-escalated font-bold mb-1">
                <span>ESCALATION LETTER (LEVEL {esc.escalationLevel})</span>
                <button
                  onClick={() => setViewNotice(viewNotice === esc.id ? null : esc.id)}
                  className="hover:underline flex items-center gap-1 font-mono text-[9px] uppercase"
                >
                  <FileText className="h-3 w-3" />
                  {viewNotice === esc.id ? "Hide" : "View"}
                </button>
              </div>
              {viewNotice === esc.id && (
                <pre className="bg-slate-900 text-slate-200 p-3 rounded overflow-x-auto whitespace-pre-wrap font-mono text-[9px] leading-relaxed border border-slate-800 max-h-60">
                  {esc.generatedNotice}
                </pre>
              )}
            </div>
          ))}
        </div>
      ),
    },
    {
      key: "RESOLVED",
      title: "CIVIC RECORD CLOSED",
      agent: "AUDT",
      time: new Date(issue.updatedAt).toLocaleTimeString(),
      description: "Field repair completed. Operations desk closed file audit loop. Citizen confirmation notification dispatched.",
    }
  ];

  // Only display ESCALATED step if the ticket actually went through escalation
  const visibleSteps = timelineSteps.filter((step) => {
    if (step.key === "ESCALATED" && escalations.length === 0 && issue.status !== "ESCALATED") {
      return false;
    }
    return true;
  });

  return (
    <div className="flow-root font-mono text-xs text-ink">
      <div className="border-l-2 border-rule ml-2 pl-4 py-1 space-y-6 relative text-left">
        {visibleSteps.map((step) => {
          const isCompleted =
            issue.status === "RESOLVED" ||
            statusHierarchy.indexOf(step.key) <= currentStatusIndex ||
            (step.key === "ESCALATED" && escalations.length > 0);

          const isActive = issue.status === step.key;

          return (
            <div key={step.key} className="relative group">
              {/* Active Indicator dot */}
              <span className={`absolute -left-[21px] top-1.5 h-2 w-2 rounded-full border ${
                isActive
                  ? "bg-secondary border-secondary scale-125"
                  : isCompleted
                  ? "bg-seal border-seal"
                  : "bg-paper border-rule text-ink-muted"
              }`} />

              <div className="flex justify-between items-baseline gap-2">
                <span className={`font-bold tracking-tight text-[11px] ${
                  isActive ? "text-secondary" : isCompleted ? "text-ink" : "text-ink-muted/50"
                }`}>
                  {step.title}
                </span>
                
                {isCompleted && (
                  <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded border ${
                    isActive
                      ? "bg-secondary/10 border-secondary text-secondary"
                      : "bg-paper border-rule text-ink-muted"
                  }`}>
                    {step.agent}
                  </span>
                )}
              </div>

              <div className="flex gap-4 items-baseline mt-1">
                <span className="text-[9px] text-ink-muted whitespace-nowrap shrink-0">{step.time}</span>
                <p className={`text-[10px] leading-tight font-ui ${
                  isCompleted ? "text-ink-muted" : "text-ink-muted/30"
                }`}>
                  {step.description}
                </p>
              </div>

              {isCompleted && step.details && step.details()}
            </div>
          );
        })}
      </div>
    </div>
  );
};
