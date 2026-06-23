import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { authService } from "../services/auth";
import { dbService } from "../services/db";
import { ArrowLeft, Clock, FileText, MapPin, Merge } from "lucide-react";

export const MyReports: React.FC = () => {
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const currentUser = authService.getCurrentUser();

  const loadReports = async () => {
    if (currentUser) {
      try {
        const data = await dbService.getReports(currentUser.id);
        setReports(data);
      } catch (err) {
        console.error("Failed to load user reports:", err);
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    loadReports();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAF8F4] text-[#5B6B63] font-mono text-xs">
        LOADING CITIZEN REPORT REGISTRY...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAF8F4] text-[#16241D] py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto text-left">
        {/* Back navigation */}
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-xs font-semibold text-[#5B6B63] hover:text-[#1A7A52] mb-6 transition-colors duration-200"
        >
          <ArrowLeft className="h-4 w-4" />
          Return to Map
        </Link>

        {/* Header */}
        <div className="border-b border-[#DCD4C2] pb-6 mb-8">
          <span className="font-mono text-xs text-[#1A7A52] tracking-wider uppercase">
            Citizen Action Portal
          </span>
          <h1 className="text-3xl md:text-4xl font-serif font-medium mt-2 text-[#0F3D2E]">
            My Incident Reports
          </h1>
          <p className="text-sm text-[#5B6B63] mt-2 font-serif italic">
            Immutable tracking record of your civic submissions and their current remediation status.
          </p>
        </div>

        {reports.length === 0 ? (
          <div className="bg-[#EFE9DC] border border-[#DCD4C2] rounded-xl p-12 text-center shadow-sm">
            <FileText className="h-12 w-12 text-[#5B6B63] mx-auto mb-4 opacity-50" />
            <h3 className="text-lg font-serif font-semibold text-[#0F3D2E]">
              No Reports Filed Yet
            </h3>
            <p className="text-sm text-[#5B6B63] mt-2 max-w-md mx-auto">
              Your report history is empty. Be the first to report a broken streetlight, pothole, or garbage dump in your ward.
            </p>
            <Link
              to="/report"
              className="inline-block mt-6 bg-[#1A7A52] hover:bg-[#0F3D2E] text-[#FAF8F4] text-xs font-bold px-6 py-3 rounded-lg shadow-sm transition-all duration-200 uppercase tracking-wider"
            >
              Report First Issue
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            {reports.map((report) => {
              const issue = report.issue;
              const hasLinkedIssue = !!issue;
              const isMerged = issue && issue.status === "RESOLVED" && report.issueId !== issue.id; // Conceptually merged or resolved
              
              // Status Badge config mapping
              let statusText = "Pending Analysis";
              let badgeColor = "bg-slate-100 text-slate-700 border-slate-200";
              
              if (report.processingStatus === "failed") {
                statusText = "Analysis Failed";
                badgeColor = "bg-rose-50 text-rose-700 border-rose-100";
              } else if (hasLinkedIssue) {
                if (issue.status === "REPORTED") {
                  statusText = "Verifying";
                  badgeColor = "bg-slate-100 text-[#5B6B63] border-[#DCD4C2]";
                } else if (issue.status === "ROUTED") {
                  statusText = "Routed";
                  badgeColor = "bg-teal-50 text-[#1A7A52] border-teal-200";
                } else if (issue.status === "IN_PROGRESS") {
                  statusText = "In Progress";
                  badgeColor = "bg-amber-50 text-[#C8932B] border-amber-200";
                } else if (issue.status === "ESCALATED") {
                  statusText = "Escalated";
                  badgeColor = "bg-rose-50 text-[#B5562C] border-rose-200";
                } else if (issue.status === "RESOLVED") {
                  statusText = "Resolved";
                  badgeColor = "bg-emerald-50 text-[#0F3D2E] border-emerald-200";
                }
              }

              return (
                <div
                  key={report.id}
                  className="bg-[#EFE9DC] border border-[#DCD4C2] rounded-lg p-5 flex flex-col md:flex-row gap-5 shadow-sm hover:shadow-md transition-shadow duration-200"
                >
                  {/* Media Thumbnail */}
                  <div className="w-full md:w-32 h-32 rounded-md overflow-hidden bg-[#FAF8F4] flex-shrink-0 border border-[#DCD4C2] relative">
                    {report.rawMediaUrl ? (
                      <img
                        src={report.rawMediaUrl}
                        alt="Submitted evidence"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xs font-mono text-[#5B6B63]">
                        NO IMAGE
                      </div>
                    )}
                  </div>

                  {/* Content details */}
                  <div className="flex-1 flex flex-col justify-between">
                    <div>
                      <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase border tracking-wider ${badgeColor}`}>
                            {statusText}
                          </span>
                          {report.issueId && report.issueId !== issue?.id && (
                            <span className="bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider flex items-center gap-1">
                              <Merge className="h-3 w-3" />
                              Merged
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1 text-[#5B6B63] font-mono text-[11px]">
                          <Clock className="h-3.5 w-3.5" />
                          <span>{new Date(report.createdAt).toLocaleDateString()}</span>
                        </div>
                      </div>

                      <h3 className="text-base font-serif font-bold text-[#0F3D2E] leading-tight">
                        {issue?.title || report.userTextNote || "Incident Report Under Analysis"}
                      </h3>
                      
                      <p className="text-xs text-[#5B6B63] mt-2 line-clamp-2">
                        {issue?.description || report.userTextNote || "Our autonomous Intake Agent is currently inspecting the submitted details and coordinates to classify and assign this ticket."}
                      </p>
                    </div>

                    <div className="mt-4 pt-3 border-t border-[#DCD4C2]/40 flex flex-wrap justify-between items-center gap-4">
                      <div className="flex items-center gap-1.5 text-xs text-[#5B6B63]">
                        <MapPin className="h-3.5 w-3.5 text-[#1A7A52]" />
                        <span>
                          [{report.location.lat.toFixed(4)}, {report.location.lng.toFixed(4)}]
                        </span>
                      </div>
                      
                      {hasLinkedIssue && (
                        <Link
                          to={`/issues/${issue.id}`}
                          className="bg-[#1A7A52] hover:bg-[#0F3D2E] text-[#FAF8F4] text-[11px] font-bold px-4.5 py-2 rounded transition-colors duration-200 uppercase tracking-wider"
                        >
                          Inspect Thread
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
export default MyReports;
