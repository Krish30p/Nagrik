import React, { useCallback, useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { dbService, subscribeToCollection } from "../services/db";
import { authService } from "../services/auth";
import { Issue, Department } from "../types";
import { IssueTimeline } from "../components/IssueTimeline";
import { ArrowLeft, MapPin, Calendar, User, Phone, Mail, Award, CheckCircle, Wrench } from "lucide-react";

export const IssueDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [issue, setIssue] = useState<Issue | null>(null);
  const [department, setDepartment] = useState<Department | null>(null);
  const [currentUser, setCurrentUser] = useState(authService.getCurrentUser());

  const navigate = useNavigate();

  const loadData = useCallback(async () => {
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
      if (comp?.departmentId && !item.departmentId) {
        const departments = await dbService.getDepartments();
        const dept = departments.find((d) => d.id === comp.departmentId);
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

  // Resolve eligibility: reporter of the issue, or admin email
  const canResolve = currentUser && (
    currentUser.id === issue.createdBy ||
    currentUser.email === "admin@nagrik.gov.in"
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 min-h-[calc(100vh-64px)] bg-background text-on-surface font-body-md">
      {/* Header Back Link */}
      <div className="flex items-center gap-2 mb-6">
        <button
          onClick={() => navigate(-1)}
          className="p-2 hover:bg-surface-variant rounded-lg text-on-surface-variant hover:text-on-surface transition-colors flex items-center gap-1 text-sm font-label-bold"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Ticket Details Column */}
        <div className="lg:col-span-2 space-y-6 text-left">
          <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl overflow-hidden shadow-sm">
            <div className="p-6 md:p-8">
              {/* Badges */}
              <div className="flex flex-wrap items-center gap-2.5 mb-4 font-label-md">
                <span className="text-xs uppercase font-bold tracking-wider text-primary bg-primary-container/20 px-2.5 py-1 rounded-md border border-primary/20">
                  {issue.category}
                </span>
                <span className={`text-xs font-bold px-2 py-0.5 border rounded ${issue.severity === 'CRITICAL' || issue.severity === 'HIGH' ? 'bg-error-container text-on-error-container border-error' : 'bg-surface-container text-on-surface-variant border-outline-variant'}`}>
                  {issue.severity} Severity
                </span>
                <span className={`text-xs font-bold px-2 py-0.5 border rounded ${issue.status === 'RESOLVED' ? 'bg-primary-container text-on-primary-container border-primary' : 'bg-surface-container text-on-surface-variant border-outline-variant'}`}>
                  {issue.status}
                </span>
              </div>

              {/* Title */}
              <h1 className="font-headline-lg text-on-surface mb-4">
                {issue.title}
              </h1>

              {/* Citizen Details */}
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-on-surface-variant border-b border-outline-variant pb-5 mb-5 font-body-sm">
                <span className="flex items-center gap-1.5">
                  <User className="h-4 w-4" />
                  Reported by: <span className="font-bold text-on-surface">{issue.createdByName || "Citizen"}</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <Calendar className="h-4 w-4" />
                  Date Logged: <span className="font-bold text-on-surface">{new Date(issue.createdAt).toLocaleString()}</span>
                </span>
              </div>

              {/* Description */}
              <div className="space-y-2.5 mb-6">
                <h3 className="font-label-bold text-on-surface-variant uppercase tracking-wider">Incident Details</h3>
                <p className="font-body-md text-on-surface leading-relaxed bg-surface-container-low border border-outline-variant p-4 rounded-xl">
                  {issue.description}
                </p>
              </div>

              {/* Photo Media */}
              {issue.mediaUrls && issue.mediaUrls.length > 0 && (
                <div className="space-y-2.5 mb-6">
                  <h3 className="font-label-bold text-on-surface-variant uppercase tracking-wider">Evidence Image</h3>
                  <div className="max-h-80 overflow-hidden rounded-xl border border-outline-variant">
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
                <h3 className="font-label-bold text-on-surface-variant uppercase tracking-wider">Spatial Metadata</h3>
                <div className="bg-surface-container-low border border-outline-variant rounded-xl p-4 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <MapPin className="h-5 w-5 text-primary shrink-0" />
                    <div className="text-left min-w-0">
                      <p className="font-label-bold text-on-surface truncate">{issue.location}</p>
                      <p className="font-body-sm text-on-surface-variant">Ward coverage: {issue.ward}</p>
                    </div>
                  </div>
                  <span className="font-label-md text-on-surface-variant shrink-0">
                    GPS: [{issue.latitude.toFixed(4)}, {issue.longitude.toFixed(4)}]
                  </span>
                </div>
              </div>

              {/* Administrative Resolution Controls */}
              {canResolve && issue.status !== "RESOLVED" && (
                <div className="mt-8 pt-6 border-t border-outline-variant flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div className="text-left">
                    <p className="font-label-bold text-on-surface">Close Ticket Resolution Loop</p>
                    <p className="font-body-sm text-on-surface-variant mt-0.5">As a registered validator or reporter, you can mark the issue resolved once fixed.</p>
                  </div>
                  <button
                    onClick={handleResolveIssue}
                    className="bg-primary text-on-primary font-label-bold py-2.5 px-4 rounded-lg flex items-center gap-2 transition-all shadow-sm shrink-0 border border-transparent hover:bg-primary-container hover:text-on-primary-container"
                  >
                    <CheckCircle className="h-4 w-4" />
                    Resolve Issue Ticket
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Assigned Department */}
          {department && (
            <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-6 md:p-8 text-left shadow-sm">
              <h3 className="font-label-bold text-on-surface-variant uppercase tracking-wider mb-4">Assigned Department Contact</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-primary-container/20 text-primary rounded-lg border border-primary/20">
                    <Wrench className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="font-label-bold text-on-surface">Responsible Board</h4>
                    <p className="font-body-sm text-on-surface-variant mt-0.5">{department.name}</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2 font-body-sm text-on-surface font-medium">
                    <Mail className="h-4 w-4 text-on-surface-variant" />
                    <span>{department.email}</span>
                  </div>
                  <div className="flex items-center gap-2 font-body-sm text-on-surface font-medium">
                    <Phone className="h-4 w-4 text-on-surface-variant" />
                    <span>{department.contactNumber}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Life cycle timeline Column */}
        <div className="space-y-6 text-left">
          <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-6 md:p-8 shadow-sm">
            <h3 className="font-headline-md text-on-surface mb-6 flex items-center gap-2">
              <Award className="h-5 w-5 text-primary" />
              Agent Audit Timeline
            </h3>
            <IssueTimeline issue={issue} />
          </div>
        </div>
      </div>
    </div>
  );
};
