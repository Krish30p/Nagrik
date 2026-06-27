import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { authService } from "../services/auth";
import { dbService, ReportHistoryItem } from "../services/db";
import { ArrowLeft, Clock, FileText, MapPin, Merge } from "lucide-react";

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
      <div className="min-h-screen flex items-center justify-center bg-[#FAF8F4] text-[#5B6B63] font-mono text-xs">
        LOADING CITIZEN REPORT REGISTRY...
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-64px)] bg-background text-on-surface font-body-md w-full max-w-5xl mx-auto px-4 md:px-8 py-8 flex-grow">
      {/* Back navigation */}
      <div className="mb-8">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm font-label-bold text-on-surface-variant hover:text-primary mb-6 transition-colors duration-200"
        >
          <ArrowLeft className="h-4 w-4" />
          Return to Map
        </Link>
        <h1 className="font-headline-lg text-headline-lg text-on-surface mb-2">My Reports</h1>
        <p className="font-body-lg text-body-lg text-on-surface-variant">Track the status of issues you've reported.</p>
      </div>

      {reports.length === 0 ? (
        <div className="mt-16 flex flex-col items-center text-center max-w-md mx-auto py-12 border-t border-outline-variant border-dashed">
          <FileText className="h-24 w-24 text-outline-variant mb-6" />
          <h2 className="font-headline-md text-headline-md text-on-surface mb-2">No reports found</h2>
          <p className="font-body-md text-body-md text-on-surface-variant mb-8">Start by reporting a new issue in your area.</p>
          <Link
            to="/report"
            className="bg-primary-container text-on-primary font-label-bold text-label-bold px-8 py-3 rounded-lg hover:bg-primary transition-colors h-12 flex items-center justify-center w-full sm:w-auto"
          >
            Report Your First Issue
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {reports.map((report) => {
            const issue = report.issue;
            const hasLinkedIssue = !!issue;
            
            // Status Badge config mapping
            let statusText = "Pending Analysis";
            let statusClasses = "text-on-surface-variant";
            
            if (report.processingStatus === "failed") {
              statusText = "Analysis Failed";
              statusClasses = "text-error";
            } else if (hasLinkedIssue) {
              if (issue.status === "REPORTED") {
                statusText = "REPORTED";
                statusClasses = "text-on-surface-variant";
              } else if (issue.status === "ROUTED") {
                statusText = "ROUTED";
                statusClasses = "text-primary";
              } else if (issue.status === "IN_PROGRESS") {
                statusText = "IN PROGRESS";
                statusClasses = "text-secondary";
              } else if (issue.status === "ESCALATED") {
                statusText = "ESCALATED";
                statusClasses = "text-error";
              } else if (issue.status === "RESOLVED") {
                statusText = "RESOLVED";
                statusClasses = "text-primary-container";
              }
            }

            return (
              <div
                key={report.id}
                className="bg-surface-container-lowest border border-outline-variant rounded-xl p-4 flex flex-col sm:flex-row gap-4 hover:border-primary transition-colors group text-left relative"
              >
                {/* Media Thumbnail */}
                <div className="w-full sm:w-32 h-32 rounded-lg overflow-hidden shrink-0 bg-surface-container relative">
                  {report.rawMediaUrl ? (
                    <img
                      src={report.rawMediaUrl}
                      alt="Submitted evidence"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-xs font-mono text-outline-variant">
                      NO IMAGE
                    </div>
                  )}
                  {report.issueId && report.issueId !== issue?.id && (
                    <div className="absolute inset-0 bg-surface/50 backdrop-blur-sm flex items-center justify-center">
                      <span className="bg-primary-container text-on-primary-container text-[10px] font-bold px-2 py-1 rounded shadow-sm flex items-center gap-1 uppercase tracking-wider">
                        <Merge className="h-3 w-3" />
                        Merged
                      </span>
                    </div>
                  )}
                </div>

                {/* Content details */}
                <div className="flex flex-col justify-between flex-grow">
                  <div>
                    <div className="flex justify-between items-start mb-1">
                      <h3 className="font-headline-md text-headline-md text-on-surface line-clamp-1 group-hover:text-primary transition-colors">
                        {issue?.title || report.userTextNote || "Incident Report Under Analysis"}
                      </h3>
                      {hasLinkedIssue && (
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${
                          issue.severity === 'CRITICAL' || issue.severity === 'HIGH' ? 'bg-error-container text-on-error-container' : 'bg-surface-container text-on-surface-variant'
                        }`}>
                          {issue.severity}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2 mb-3">
                      {hasLinkedIssue && (
                        <span className="inline-flex items-center px-2 py-1 rounded bg-surface-container text-on-surface-variant font-label-md text-label-md">
                          {issue.category}
                        </span>
                      )}
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center gap-4 mb-2">
                      <span className={`font-label-bold text-label-bold ${statusClasses}`}>
                        {statusText}
                      </span>
                      {hasLinkedIssue && (
                        <Link
                          to={`/issues/${issue.id}`}
                          className="ml-auto bg-surface-container-low hover:bg-surface-container text-on-surface font-label-md px-3 py-1.5 rounded transition-colors text-xs flex items-center gap-1"
                        >
                          View Details
                        </Link>
                      )}
                    </div>
                    <div className="flex items-center justify-between text-on-surface-variant font-body-sm text-body-sm">
                      <span className="flex items-center gap-1"><Clock className="h-4 w-4" /> {new Date(report.createdAt).toLocaleDateString()}</span>
                      <span className="flex items-center gap-1 line-clamp-1"><MapPin className="h-4 w-4" /> [{report.latitude.toFixed(4)}, {report.longitude.toFixed(4)}]</span>
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
