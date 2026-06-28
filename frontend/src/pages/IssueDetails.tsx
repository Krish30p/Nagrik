import React, { useCallback, useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { dbService, subscribeToCollection } from "../services/db";
import { authService } from "../services/auth";
import { Issue, Department, Complaint } from "../types";
import { IssueTimeline } from "../components/IssueTimeline";
import { StatusStamp } from "../components/StatusStamp";
import { ArrowLeft, MapPin, Calendar, User, Phone, Mail, Award, CheckCircle, Wrench } from "lucide-react";

export const IssueDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [issue, setIssue] = useState<Issue | null>(null);
  const [department, setDepartment] = useState<Department | null>(null);
  const [complaint, setComplaint] = useState<Complaint | null>(null);
  const [currentUser, setCurrentUser] = useState(authService.getCurrentUser());

  const navigate = useNavigate();

  const loadData = useCallback(async () => {
    if (!id) return;
    const item = await dbService.getIssueById(id);
    if (item) {
      setIssue(item);

      const complaints = await dbService.getComplaints();
      const comp = complaints.find((c) => c.issueId === item.id);
      if (comp) {
        setComplaint(comp);
        const departments = await dbService.getDepartments();
        const dept = departments.find((d) => d.id === comp.departmentId);
        if (dept) setDepartment(dept);
      } else if (item.departmentId) {
        const departments = await dbService.getDepartments();
        const dept = departments.find((d) => d.id === item.departmentId);
        if (dept) setDepartment(dept);
      }
    }
  }, [id]);

  useEffect(() => {
    void Promise.resolve().then(loadData);
    const unsubscribeIssues = subscribeToCollection("issues", loadData);
    const unsubscribeComplaints = subscribeToCollection("complaints", loadData);

    const unsubscribeAuth = authService.onAuthStateChanged((user) => {
      setCurrentUser(user);
    });

    return () => {
      unsubscribeIssues();
      unsubscribeComplaints();
      unsubscribeAuth();
    };
  }, [loadData]);

  const handleResolveIssue = async () => {
    if (!issue) return;

    try {
      // Update status in db (server Cloud Function handles resolution, points, and logs)
      await dbService.updateIssue(issue.id, {
        status: "RESOLVED"
      });

      await loadData();
    } catch (e) {
      console.error(e);
      alert("Resolution error");
    }
  };

  if (!issue) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 text-center text-slate-400">
        Loading ticket details or ticket not found...
      </div>
    );
  }

  const severityColors = {
    LOW: "bg-green-50 border-green-200 text-green-700",
    MEDIUM: "bg-blue-50 border-blue-200 text-blue-700",
    HIGH: "bg-amber-50 border-amber-200 text-amber-700",
    CRITICAL: "bg-red-50 border-red-200 text-red-700",
  }[issue.severity];

  const statusColors = {
    REPORTED: "bg-slate-100 text-slate-800 border-slate-200",
    VERIFIED: "bg-indigo-50 text-indigo-700 border-indigo-200",
    ROUTED: "bg-purple-50 text-purple-700 border-purple-200",
    IN_PROGRESS: "bg-blue-50 text-blue-700 border-blue-200",
    ESCALATED: "bg-red-100 text-red-700 border-red-200",
    RESOLVED: "bg-green-150 text-green-800 border-green-250",
    DUPLICATE_MERGED: "bg-slate-100 text-slate-400 border-slate-200",
  }[issue.status];

  // Resolve eligibility: reporter of the issue, or municipal staff member
  const canResolve = currentUser && (
    currentUser.id === issue.createdBy ||
    authService.isStaff()
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 min-h-[calc(100vh-56px)] bg-background text-ink font-ui">
      {/* Header Back Link */}
      <div className="flex items-center gap-2 mb-6">
        <button
          onClick={() => navigate(-1)}
          className="px-3 py-1.5 hover:bg-seal-tint/40 rounded border border-rule text-ink-muted hover:text-seal transition-colors flex items-center gap-1.5 text-xs font-mono uppercase tracking-wider"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to registry
        </button>
      </div>

      {/* Case Header Section */}
      <section className="relative mb-8 text-left">
        {/* FILED Watermark */}
        <div className="absolute -top-4 right-0 opacity-[0.03] select-none pointer-events-none transform -rotate-12">
          <span className="font-display text-secondary text-[80px] font-bold tracking-widest">FILED</span>
        </div>
        <div className="flex flex-col md:flex-row md:justify-between md:items-end gap-2">
          <div>
            <h2 className="font-display text-2xl md:text-3xl font-bold text-ink leading-tight">{issue.title}</h2>
            <p className="font-mono text-[10px] text-secondary tracking-wider mt-1 uppercase font-bold">
              WARD COVERAGE: {issue.ward.toUpperCase()}
            </p>
          </div>
          <div className="text-left md:text-right font-mono shrink-0">
            <p className="text-xs text-ink-muted font-bold">NGK-{issue.id.substring(0, 8).toUpperCase()}</p>
            <p className="text-[10px] text-ink-muted/50">FILE_REF_04X</p>
          </div>
        </div>
        <div className="double-rule-bottom w-full mt-4"></div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Ticket Details Column */}
        <div className="lg:col-span-2 space-y-6 text-left">
          
          {/* Status & Map Area */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-paper-raised border border-rule rounded-md p-4 flex flex-col justify-center items-center relative overflow-hidden h-28">
              <div className="absolute inset-0 opacity-5 pointer-events-none">
                <div className="w-full h-full bg-[radial-gradient(#1B1B16_1px,transparent_1px)] [background-size:12px_12px]"></div>
              </div>
              <p className="font-mono text-[10px] text-ink-muted uppercase mb-2 font-bold">Current Status</p>
              <StatusStamp status={issue.status} className="scale-125" />
            </div>

            <div className="bg-paper-raised border border-rule rounded-md p-4 flex flex-col justify-between h-28 font-mono">
              <div>
                <p className="text-[10px] text-ink-muted uppercase font-bold">Geographic Index</p>
                <p className="text-xs text-ink font-bold mt-1.5 truncate">{issue.location}</p>
              </div>
              <span className="text-[9px] text-ink-muted">
                GPS COORD: [{issue.latitude.toFixed(4)}N, {issue.longitude.toFixed(4)}E]
              </span>
            </div>
          </div>

          {/* Formal Letter Draft Section */}
          {complaint && (
            <section className="bg-paper-raised border border-rule rounded-md p-6 md:p-8 relative shadow-sm text-left">
              <div className="text-center mb-6">
                <h3 className="font-display text-base uppercase tracking-widest text-ink font-bold">
                  {department?.name || "DEPARTMENT OF CIVIC OPERATIONS"}
                </h3>
                <p className="font-mono text-[9px] text-ink-muted">OFFICIAL COMPLAINT REGISTRY</p>
                <div className="w-16 h-px bg-rule mx-auto mt-2"></div>
              </div>
              <div className="space-y-4 font-display text-sm text-ink leading-relaxed italic pr-2">
                {complaint.generatedComplaint}
              </div>
              <div className="mt-8 pt-4 border-t border-dashed border-rule flex justify-between items-end">
                <div className="space-y-0.5">
                  <p className="font-display text-xs italic font-bold">Routing Agent Elias</p>
                  <p className="font-mono text-[9px] text-ink-muted uppercase">SYSTEM IDENTIFIER: ROUT-1.0</p>
                </div>
                <div className="text-right">
                  <div className="stamp-oval font-mono text-[9px] text-secondary border-secondary rotate-3 bg-paper font-bold px-2 py-0.5">
                    {new Date(complaint.createdAt).toLocaleDateString()}
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* Incident details metadata */}
          <div className="bg-paper-raised border border-rule rounded-md p-6">
            {/* Citizen info */}
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-ink-muted border-b border-dashed border-rule pb-4 mb-5 font-mono">
              <span className="flex items-center gap-1.5">
                <User className="h-4 w-4 text-ink-muted/50" />
                FILED BY: <span className="font-bold text-ink">{issue.createdByName || "CITIZEN"}</span>
              </span>
              <span className="flex items-center gap-1.5">
                <Calendar className="h-4 w-4 text-ink-muted/50" />
                DATE LOGGED: <span className="font-bold text-ink">{new Date(issue.createdAt).toLocaleString()}</span>
              </span>
            </div>

            {/* Description */}
            <div className="space-y-2 mb-6">
              <h3 className="font-mono text-[10px] text-ink-muted uppercase tracking-wider font-bold">Incident Log Description</h3>
              <p className="font-ui text-sm text-ink leading-relaxed bg-paper border border-rule p-4 rounded">
                {issue.description}
              </p>
            </div>

            {/* Evidence Image */}
            {issue.mediaUrls && issue.mediaUrls.length > 0 && (
              <div className="space-y-2 mb-6">
                <h3 className="font-mono text-[10px] text-ink-muted uppercase tracking-wider font-bold">Evidence Photograph</h3>
                <div className="max-h-80 overflow-hidden rounded border border-rule bg-paper">
                  <img
                    src={issue.mediaUrls[0]}
                    alt="Evidence Registry"
                    className="w-full h-full object-contain"
                  />
                </div>
              </div>
            )}

            {/* Administrative Resolution Controls */}
            {canResolve && issue.status !== "RESOLVED" && (
              <div className="mt-8 pt-6 border-t border-rule flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="text-left font-ui">
                  <p className="text-xs font-bold text-ink uppercase tracking-wide">Close Ticket Resolution Loop</p>
                  <p className="text-[11px] text-ink-muted mt-0.5">As a registered validator or reporter, you can mark the issue resolved once fixed.</p>
                </div>
                <button
                  onClick={handleResolveIssue}
                  className="bg-primary text-paper hover:bg-primary/95 text-xs font-mono uppercase tracking-wide py-2.5 px-4 rounded border border-primary transition-all shrink-0 flex items-center gap-2 group"
                >
                  <CheckCircle className="h-4 w-4" />
                  Resolve Case file
                </button>
              </div>
            )}
          </div>

          {/* Assigned Department */}
          {department && (
            <div className="bg-paper-raised border border-rule rounded-md p-6 text-left">
              <h3 className="font-mono text-xs font-bold text-ink uppercase tracking-wider mb-4 border-b border-rule pb-2">
                ASSIGNED DEPARTMENT CONTACT
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-mono text-[11px]">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-seal-tint text-seal rounded border border-seal/20">
                    <Wrench className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="font-bold text-ink">RESPONSIBLE BOARD</h4>
                    <p className="text-ink-muted mt-0.5 font-ui text-[12px]">{department.name}</p>
                  </div>
                </div>

                <div className="space-y-1.5 justify-self-start md:justify-self-end text-left md:text-right">
                  <div className="flex items-center gap-2 font-medium justify-start md:justify-end">
                    <Mail className="h-3.5 w-3.5 text-ink-muted" />
                    <span>{department.email}</span>
                  </div>
                  <div className="flex items-center gap-2 font-medium justify-start md:justify-end">
                    <Phone className="h-3.5 w-3.5 text-ink-muted" />
                    <span>{department.contactNumber}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Life cycle timeline Column */}
        <div className="space-y-6 text-left">
          <div className="bg-paper-raised border border-rule rounded-md p-6">
            <h3 className="font-mono text-xs font-bold text-ink uppercase tracking-wider mb-6 flex items-center gap-2 border-b border-rule pb-2">
              <Award className="h-4 w-4 text-seal" />
              AGENT AUDIT LOG TRAIL
            </h3>
            <IssueTimeline issue={issue} />
          </div>
        </div>
      </div>
    </div>
  );
};
