import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { authService } from "../services/auth";
import { dbService, ReportHistoryItem } from "../services/db";
import { ArrowLeft, Clock, FileText, MapPin, Merge } from "lucide-react";
import { StatusStamp } from "../components/StatusStamp";

export const MyReports: React.FC = () => {
  const [reports, setReports] = useState<ReportHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const currentUser = authService.getCurrentUser();

  const loadReports = useCallback(async () => {
    if (currentUser) {
      try {
        const data = await dbService.getReports();
        setReports(data);
      } catch (err) {
        console.error("Failed to load user reports:", err);
      }
    }
    setLoading(false);
  }, [currentUser]);

  useEffect(() => {
    void Promise.resolve().then(loadReports);
  }, [loadReports]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-ink-muted font-mono text-xs">
        LOADING CITIZEN REPORT REGISTRY...
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-56px)] bg-background text-ink font-ui w-full max-w-5xl mx-auto px-4 md:px-8 py-8 flex flex-col justify-start">
      {/* Back navigation */}
      <div className="mb-8 text-left">
        <Link
          to="/"
          className="px-3 py-1.5 hover:bg-seal-tint/40 rounded border border-rule text-ink-muted hover:text-seal transition-colors inline-flex items-center gap-1.5 text-xs font-mono uppercase tracking-wider mb-6"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Return to Map
        </Link>
        <h1 className="font-display text-2xl font-bold text-ink mb-1">Citizen File Registry</h1>
        <p className="text-xs text-ink-muted">Track the status of incident records you have filed in the municipal ledger.</p>
      </div>

      {reports.length === 0 ? (
        <div className="mt-16 flex flex-col items-center text-center max-w-md mx-auto py-12 border-t border-rule border-dashed">
          <FileText className="h-16 w-16 text-rule mb-4" />
          <h2 className="font-display text-base font-bold text-ink mb-2">No Reports Filed</h2>
          <p className="text-xs text-ink-muted mb-6">You have not registered any public infrastructure issues yet.</p>
          <Link
            to="/report"
            className="bg-secondary text-paper font-mono uppercase tracking-wider text-xs py-3 px-6 rounded-none hover:brightness-105 transition-all"
          >
            File Your First Report
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {reports.map((report) => {
            const issue = report.issue;
            const hasLinkedIssue = !!issue;
            
            // Status text mapping
            let currentStatus = report.processingStatus === "failed" ? "DUPLICATE_MERGED" : (issue?.status || "REPORTED");
            if (report.processingStatus === "pending") currentStatus = "REPORTED";

            return (
              <div
                key={report.id}
                className="bg-paper-raised border border-rule rounded-md p-5 flex flex-col sm:flex-row gap-5 hover:border-ink transition-colors text-left relative"
              >
                {/* Media Thumbnail */}
                <div className="w-full sm:w-28 h-28 rounded border border-rule overflow-hidden shrink-0 bg-paper relative flex items-center justify-center">
                  {report.rawMediaUrl ? (
                    <img
                      src={report.rawMediaUrl}
                      alt="Registry Evidence"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="font-mono text-[9px] text-ink-muted">NO IMAGE ATTACHED</span>
                  )}
                  {report.issueId && report.issueId !== issue?.id && (
                    <div className="absolute inset-0 bg-paper/70 backdrop-blur-sm flex items-center justify-center">
                      <span className="bg-paper border border-rule text-ink text-[9px] font-mono font-bold px-2 py-0.5 rounded shadow-sm flex items-center gap-1 uppercase tracking-tight marker-stamp">
                        <Merge className="h-3 w-3 text-secondary" />
                        MERGED
                      </span>
                    </div>
                  )}
                </div>

                {/* Content details */}
                <div className="flex flex-col justify-between flex-grow min-w-0">
                  <div className="min-w-0">
                    <div className="flex justify-between items-start gap-4 mb-2">
                      <h3 className="font-display text-sm font-bold text-ink line-clamp-1 truncate flex-grow">
                        {issue?.title || report.userTextNote || "INCIDENT REPORT UNDER ANALYSIS"}
                      </h3>
                      {hasLinkedIssue && (
                        <span className={`text-[9px] font-mono font-bold px-1.5 py-0.2 border rounded ${
                          issue.severity === 'CRITICAL' || issue.severity === 'HIGH' ? 'bg-status-escalated/10 border-status-escalated text-status-escalated' : 'bg-paper border-rule text-ink-muted'
                        }`}>
                          {issue.severity}
                        </span>
                      )}
                    </div>
                    {hasLinkedIssue && (
                      <div className="flex flex-wrap gap-2 mb-3">
                        <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 bg-paper border border-rule text-ink-muted rounded">
                          {issue.category.toUpperCase()}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="mt-2">
                    <div className="flex items-center justify-between gap-4 mb-3 border-t border-dashed border-rule pt-3">
                      <div className="scale-90 -ml-2 select-none">
                        <StatusStamp status={currentStatus} />
                      </div>
                      
                      {hasLinkedIssue && (
                        <Link
                          to={`/issues/${issue.id}`}
                          className="bg-paper hover:bg-surface-container text-ink font-mono font-bold px-3 py-1.5 border border-rule rounded transition-colors text-[10px] uppercase tracking-tight"
                        >
                          View Case file
                        </Link>
                      )}
                    </div>
                    <div className="flex items-center justify-between text-ink-muted font-mono text-[9px]">
                      <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5 text-ink-muted/50" /> {new Date(report.createdAt).toLocaleDateString()}</span>
                      <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5 text-ink-muted/50" /> [{report.latitude.toFixed(4)}N, {report.longitude.toFixed(4)}E]</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
export default MyReports;
