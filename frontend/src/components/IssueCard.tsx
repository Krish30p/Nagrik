import React from "react";
import { Link } from "react-router-dom";
import { Issue } from "../types";
import { MapPin, Calendar, Users, AlertTriangle, Clock } from "lucide-react";
import { getSimulatedCurrentTime } from "../utils/time";

interface IssueCardProps {
  issue: Issue;
}

export const IssueCard: React.FC<IssueCardProps> = ({ issue }) => {
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
    ESCALATED: "bg-red-100 text-red-700 border-red-200 animate-pulse",
    RESOLVED: "bg-green-150 text-green-800 border-green-250",
    DUPLICATE_MERGED: "bg-slate-100 text-slate-400 border-slate-200",
  }[issue.status];

  // Calculate SLA time progress
  const createdTime = new Date(issue.createdAt).getTime();
  const slaMs = issue.slaDays * 24 * 60 * 60 * 1000;
  const currentTime = getSimulatedCurrentTime().getTime();
  const elapsedMs = currentTime - createdTime;
  const timeRemainingMs = Math.max(0, slaMs - elapsedMs);
  const remainingDays = (timeRemainingMs / (24 * 60 * 60 * 1000)).toFixed(1);
  const percentageElapsed = Math.min(100, (elapsedMs / slaMs) * 100);

  const isBreached = elapsedMs > slaMs;

  return (
    <Link
      to={`/issues/${issue.id}`}
      className="block bg-white rounded-xl border border-slate-200 hover:border-primary/30 hover:shadow-md transition-all duration-200 overflow-hidden"
    >
      <div className="p-5 flex flex-col h-full justify-between">
        <div>
          {/* Badge Row */}
          <div className="flex justify-between items-start gap-2 mb-3">
            <span className="text-[10px] uppercase font-bold tracking-wider text-primary bg-primary/5 px-2.5 py-1 rounded-md border border-primary/10">
              {issue.category}
            </span>
            <div className="flex items-center gap-1.5">
              <span className={`text-[10px] font-bold px-2 py-0.5 border rounded ${severityColors}`}>
                {issue.severity}
              </span>
              <span className={`text-[10px] font-bold px-2 py-0.5 border rounded ${statusColors}`}>
                {issue.status}
              </span>
            </div>
          </div>

          {/* Title & Desc */}
          <h3 className="text-base font-bold text-slate-800 line-clamp-1 mb-1.5 hover:text-primary transition-colors">
            {issue.title}
          </h3>
          <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed mb-4">
            {issue.description}
          </p>
        </div>

        {/* Details Footer */}
        <div className="space-y-3.5 pt-3.5 border-t border-slate-100 text-slate-500 text-xs">
          <div className="flex justify-between items-center gap-4">
            <div className="flex items-center gap-1.5 truncate">
              <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" />
              <span className="truncate font-medium text-slate-600">{issue.location}</span>
            </div>
            <div className="flex items-center gap-1.5 text-slate-400 shrink-0 font-medium">
              <Calendar className="h-3.5 w-3.5" />
              <span>{new Date(issue.createdAt).toLocaleDateString()}</span>
            </div>
          </div>

          {/* SLA and Confirmation telemetry */}
          <div className="space-y-2">
            <div className="flex justify-between items-center text-[11px] font-semibold text-slate-700">
              <div className="flex items-center gap-1.5">
                <Clock className={`h-3.5 w-3.5 ${isBreached ? "text-danger" : "text-slate-400"}`} />
                <span>
                  {isBreached ? (
                    <span className="text-danger font-bold uppercase tracking-wide">SLA Breached</span>
                  ) : (
                    <span>SLA: {remainingDays} days remaining</span>
                  )}
                </span>
              </div>
              <div className="flex items-center gap-1 bg-slate-100 px-1.5 py-0.5 rounded text-[10px]">
                <Users className="h-3 w-3 text-slate-400" />
                <span>Urgency: {issue.urgencyScore}</span>
              </div>
            </div>

            {/* SLA Progress Bar */}
            {issue.status !== "RESOLVED" && (
              <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-350 ${
                    isBreached ? "bg-danger" : percentageElapsed > 75 ? "bg-amber-500" : "bg-primary"
                  }`}
                  style={{ width: `${percentageElapsed}%` }}
                ></div>
              </div>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
};
