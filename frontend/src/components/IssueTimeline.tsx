import React, { useEffect, useState } from "react";
import { Issue, Complaint, Escalation } from "../types";
import { dbService } from "../services/db";
import { CheckCircle2, FileText, Send, AlertOctagon, Wrench, Eye, ShieldCheck } from "lucide-react";

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

  const timelineSteps = [
    {
      key: "REPORTED",
      title: "Citizen Report Logged",
      agent: "Intake Agent",
      description: "Citizen report registered in database. Intake Agent triggered to classify category, estimate initial severity, and identify landmarks.",
      details: () => (
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 mt-2 text-xs space-y-1 text-slate-600">
          <p><span className="font-bold text-slate-700">Category:</span> {issue.category}</p>
          <p><span className="font-bold text-slate-700">Estimated Severity:</span> {issue.severity}</p>
          <p><span className="font-bold text-slate-700">GPS Coordinates:</span> [{issue.latitude.toFixed(4)}, {issue.longitude.toFixed(4)}]</p>
          {issue.voiceTranscript && (
            <p><span className="font-bold text-slate-700">Audio Transcription:</span> "{issue.voiceTranscript}"</p>
          )}
        </div>
      ),
      icon: Eye,
      color: "text-blue-500 bg-blue-50 border-blue-200"
    },
    {
      key: "VERIFIED",
      title: "Spatial Verification Completed",
      agent: "Verification Agent",
      description: "Verification Agent scanned a 50m radius for existing reports. Checked spatial-temporal overlap to cluster duplicates.",
      details: () => (
        <div className="bg-indigo-50/50 border border-indigo-100 rounded-lg p-3 mt-2 text-xs space-y-1 text-slate-600">
          <p><span className="font-bold text-indigo-800">Cluster Status:</span> {issue.threadId ? `Aggregated into thread ${issue.threadId}` : "Unique new thread created"}</p>
          <p><span className="font-bold text-indigo-800">Urgency Score:</span> {issue.urgencyScore}/100 (Calculated via confirmation count)</p>
        </div>
      ),
      icon: ShieldCheck,
      color: "text-indigo-500 bg-indigo-50 border-indigo-200"
    },
    {
      key: "ROUTED",
      title: "Routed & Complaint Dispatched",
      agent: "Routing Agent",
      description: "Routing Agent mapped the ticket to the responsible department and drafted a professional government-facing complaint letter.",
      details: () => (
        <div className="mt-2 text-xs">
          {complaint ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between bg-purple-50 text-purple-700 border border-purple-100 rounded-lg px-3 py-2">
                <span>Official Complaint Drafted</span>
                <button
                  onClick={() => setViewComplaint(!viewComplaint)}
                  className="flex items-center gap-1 font-bold hover:underline"
                >
                  <FileText className="h-3.5 w-3.5" />
                  {viewComplaint ? "Hide Letter" : "View Letter"}
                </button>
              </div>
              {viewComplaint && (
                <pre className="bg-slate-900 text-slate-200 p-4 rounded-lg overflow-x-auto whitespace-pre-wrap font-mono text-[10px] leading-relaxed border border-slate-800 shadow-inner">
                  {complaint.generatedComplaint}
                </pre>
              )}
            </div>
          ) : (
            <p className="text-slate-400 italic">Complaint generation pending...</p>
          )}
        </div>
      ),
      icon: Send,
      color: "text-purple-500 bg-purple-50 border-purple-200"
    },
    {
      key: "IN_PROGRESS",
      title: "Assigned & Work Scheduled",
      agent: "Department Sync",
      description: "The municipal department accepted the ticket and dispatched field personnel to investigate and schedule cleanup.",
      icon: Wrench,
      color: "text-amber-500 bg-amber-50 border-amber-200"
    },
    {
      key: "ESCALATED",
      title: "Ticket Escalated (SLA Warning)",
      agent: "Escalation Agent",
      description: "Escalation Agent scanned database, detected that resolution exceeded the SLA limit, and generated formal notices.",
      details: () => (
        <div className="mt-2 text-xs space-y-2">
          {escalations.map((esc) => (
            <div key={esc.id} className="border border-red-200 bg-red-50/50 rounded-lg p-2.5">
              <div className="flex justify-between items-center text-red-800 font-semibold mb-1">
                <span>Escalation Notice (Level {esc.escalationLevel})</span>
                <button
                  onClick={() => setViewNotice(viewNotice === esc.id ? null : esc.id)}
                  className="hover:underline flex items-center gap-1 font-bold text-[11px]"
                >
                  <FileText className="h-3.5 w-3.5" />
                  {viewNotice === esc.id ? "Hide Notice" : "View Notice"}
                </button>
              </div>
              {viewNotice === esc.id && (
                <pre className="bg-slate-900 text-slate-200 p-4 rounded-lg overflow-x-auto whitespace-pre-wrap font-mono text-[10px] leading-relaxed border border-slate-800 shadow-inner">
                  {esc.generatedNotice}
                </pre>
              )}
            </div>
          ))}
        </div>
      ),
      icon: AlertOctagon,
      color: "text-red-500 bg-red-50 border-red-200"
    },
    {
      key: "RESOLVED",
      title: "Civic Ticket Resolved",
      agent: "Municipal Verification",
      description: "Field personnel executed repairs/cleanup. Operations audit confirmed completion, and notifications were dispatched to reporters.",
      icon: CheckCircle2,
      color: "text-green-500 bg-green-50 border-green-200"
    }
  ];

  // Helper to determine active steps
  const statusHierarchy = ["REPORTED", "VERIFIED", "ROUTED", "IN_PROGRESS", "ESCALATED", "RESOLVED"];
  const currentStatusIndex = statusHierarchy.indexOf(issue.status);

  // Filter steps: Only display ESCALATED step if the ticket actually went through escalation
  const visibleSteps = timelineSteps.filter((step) => {
    if (step.key === "ESCALATED" && escalations.length === 0 && issue.status !== "ESCALATED") {
      return false;
    }
    return true;
  });

  return (
    <div className="flow-root">
      <ul className="-mb-8">
        {visibleSteps.map((step, stepIdx) => {
          const isCompleted =
            issue.status === "RESOLVED" ||
            statusHierarchy.indexOf(step.key) <= currentStatusIndex ||
            (step.key === "ESCALATED" && escalations.length > 0);

          const StepIcon = step.icon;

          return (
            <li key={step.key}>
              <div className="relative pb-8">
                {stepIdx !== visibleSteps.length - 1 ? (
                  <span
                    className={`absolute top-5 left-5 -ml-px h-full w-0.5 ${
                      isCompleted ? "bg-primary" : "bg-slate-200"
                    }`}
                    aria-hidden="true"
                  />
                ) : null}
                <div className="relative flex items-start space-x-3">
                  {/* Icon Column */}
                  <div
                    className={`h-10 w-10 rounded-full border flex items-center justify-center ring-8 ring-white shrink-0 transition-all ${
                      isCompleted ? step.color : "bg-white border-slate-200 text-slate-400"
                    }`}
                  >
                    <StepIcon className="h-5 w-5" />
                  </div>

                  {/* Text Column */}
                  <div className="min-w-0 flex-1 py-1.5 text-left">
                    <div className="flex justify-between items-center gap-2">
                      <h4
                        className={`text-sm font-bold ${
                          isCompleted ? "text-slate-800" : "text-slate-400"
                        }`}
                      >
                        {step.title}
                      </h4>
                      {isCompleted && step.agent && (
                        <span className="text-[9px] uppercase tracking-wider font-extrabold px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 border border-slate-200">
                          {step.agent}
                        </span>
                      )}
                    </div>
                    
                    <p
                      className={`text-xs mt-1 leading-relaxed ${
                        isCompleted ? "text-slate-500" : "text-slate-400"
                      }`}
                    >
                      {step.description}
                    </p>

                    {isCompleted && step.details && step.details()}
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
};
