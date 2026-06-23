import React, { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { dbService, subscribeToCollection } from "../services/db";
import { authService } from "../services/auth";
import { Issue, Department, Complaint } from "../types";
import { IssueTimeline } from "../components/IssueTimeline";
import { ArrowLeft, MapPin, Calendar, User, Phone, Mail, Award, CheckCircle, Wrench } from "lucide-react";

export const IssueDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [issue, setIssue] = useState<Issue | null>(null);
  const [department, setDepartment] = useState<Department | null>(null);
  const [complaint, setComplaint] = useState<Complaint | null>(null);
  const [currentUser, setCurrentUser] = useState(authService.getCurrentUser());

  const navigate = useNavigate();

  const loadData = async () => {
    if (!id) return;
    const item = await dbService.getIssueById(id);
    if (item) {
      setIssue(item);

      if (item.departmentId) {
        const departments = await dbService.getDepartments();
        const dept = departments.find((d) => d.id === item.departmentId);
        if (dept) setDepartment(dept);
      }

      const complaints = await dbService.getComplaints();
      const comp = complaints.find((c) => c.issueId === item.id);
      if (comp) setComplaint(comp);
    }
  };

  useEffect(() => {
    loadData();
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
  }, [id]);

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

  // Resolve eligibility: reporter of the issue, or admin email
  const canResolve = currentUser && (
    currentUser.id === issue.createdBy ||
    currentUser.email === "admin@nagrik.gov.in"
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header Back Link */}
      <div className="flex items-center gap-2 mb-6">
        <button
          onClick={() => navigate(-1)}
          className="p-2 hover:bg-slate-150 rounded-lg text-slate-500 hover:text-slate-700 transition-colors flex items-center gap-1 text-xs font-semibold"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Ticket Details Column */}
        <div className="lg:col-span-2 space-y-6 text-left">
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
            <div className="government-banner"></div>
            <div className="p-6 md:p-8">
              {/* Badges */}
              <div className="flex flex-wrap items-center gap-2.5 mb-4">
                <span className="text-[10px] uppercase font-bold tracking-wider text-primary bg-primary/5 px-2.5 py-1 rounded-md border border-primary/10">
                  {issue.category}
                </span>
                <span className={`text-[10px] font-bold px-2 py-0.5 border rounded ${severityColors}`}>
                  {issue.severity} Severity
                </span>
                <span className={`text-[10px] font-bold px-2 py-0.5 border rounded ${statusColors}`}>
                  {issue.status}
                </span>
              </div>

              {/* Title */}
              <h1 className="text-xl md:text-2xl font-extrabold tracking-tight text-slate-800 mb-4">
                {issue.title}
              </h1>

              {/* Citizen Details */}
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-500 border-b border-slate-100 pb-5 mb-5 font-medium">
                <span className="flex items-center gap-1.5">
                  <User className="h-4 w-4 text-slate-400" />
                  Reported by: <span className="font-bold text-slate-700">{issue.createdByName || "Citizen"}</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <Calendar className="h-4 w-4 text-slate-400" />
                  Date Logged: <span className="font-bold text-slate-700">{new Date(issue.createdAt).toLocaleString()}</span>
                </span>
              </div>

              {/* Description */}
              <div className="space-y-2.5 mb-6">
                <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider">Incident Details</h3>
                <p className="text-sm text-slate-600 leading-relaxed bg-slate-50 border border-slate-100 p-4 rounded-xl">
                  {issue.description}
                </p>
              </div>

              {/* Photo Media */}
              {issue.mediaUrls && issue.mediaUrls.length > 0 && (
                <div className="space-y-2.5 mb-6">
                  <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider">Evidence Image</h3>
                  <div className="max-h-80 overflow-hidden rounded-xl border border-slate-200">
                    <img
                      src={issue.mediaUrls[0]}
                      alt="Incident Evidence"
                      className="w-full h-full object-cover"
                    />
                  </div>
                </div>
              )}

              {/* Location mapping metadata */}
              <div className="space-y-2.5 mb-6">
                <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider">Spatial Metadata</h3>
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <MapPin className="h-5 w-5 text-primary shrink-0" />
                    <div className="text-left min-w-0">
                      <p className="text-xs font-bold text-slate-700 truncate">{issue.location}</p>
                      <p className="text-[10px] text-slate-400">Ward coverage: {issue.ward}</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono text-slate-500 shrink-0 font-bold">
                    GPS: [{issue.latitude.toFixed(4)}, {issue.longitude.toFixed(4)}]
                  </span>
                </div>
              </div>

              {/* Administrative Resolution Controls */}
              {canResolve && issue.status !== "RESOLVED" && (
                <div className="mt-8 pt-6 border-t border-slate-150 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div className="text-left">
                    <p className="text-xs font-bold text-slate-800">Close Ticket Resolution Loop</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">As a registered validator or reporter, you can mark the issue resolved once fixed.</p>
                  </div>
                  <button
                    onClick={handleResolveIssue}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold py-2.5 px-4 rounded-lg flex items-center gap-1.5 transition-all shadow-sm shrink-0 border border-emerald-700/25"
                  >
                    <CheckCircle className="h-4.5 w-4.5" />
                    Resolve Issue Ticket
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Assigned Department */}
          {department && (
            <div className="bg-white border border-slate-200 rounded-2xl p-6 md:p-8 text-left shadow-sm">
              <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider mb-4">Assigned Department Contact</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-primary/5 text-primary rounded-lg">
                    <Wrench className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-800">Responsible Board</h4>
                    <p className="text-xs text-slate-500 mt-0.5">{department.name}</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs text-slate-600 font-medium">
                    <Mail className="h-3.5 w-3.5 text-slate-400" />
                    <span>{department.email}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-600 font-medium">
                    <Phone className="h-3.5 w-3.5 text-slate-400" />
                    <span>{department.contactNumber}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Life cycle timeline Column */}
        <div className="space-y-6 text-left">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 md:p-8 shadow-sm">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-6 flex items-center gap-2">
              <Award className="h-4.5 w-4.5 text-primary" />
              Agent Audit Timeline
            </h3>
            <IssueTimeline issue={issue} />
          </div>
        </div>
      </div>
    </div>
  );
};
