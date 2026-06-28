import React from "react";
import { Link } from "react-router-dom";
import { Issue } from "../types";
import { MapPin, Calendar, Clock } from "lucide-react";
import { getSimulatedCurrentTime } from "../utils/time";
import { StatusStamp } from "./StatusStamp";

interface IssueCardProps {
  issue: Issue;
}

export const IssueCard: React.FC<IssueCardProps> = ({ issue }) => {
  const severityColors = {
    LOW: "bg-severity-low/10 border-severity-low text-status-resolved",
    MEDIUM: "bg-severity-moderate/10 border-severity-moderate text-status-reported",
    HIGH: "bg-severity-high/10 border-severity-high text-status-routed",
    CRITICAL: "bg-severity-critical/10 border-severity-critical text-status-escalated font-bold",
  }[issue.severity];

  // Calculate SLA time progress
  const createdTime = new Date(issue.createdAt).getTime();
  const slaMs = issue.slaDays * 24 * 60 * 60 * 1000;
  const currentTime = getSimulatedCurrentTime().getTime();
  const elapsedMs = currentTime - createdTime;
  const timeRemainingMs = Math.max(0, slaMs - elapsedMs);
  const remainingDays = (timeRemainingMs / (24 * 60 * 60 * 1000)).toFixed(1);
  const percentageElapsed = Math.min(100, (elapsedMs / slaMs) * 100);

  const isBreached = elapsedMs > slaMs;
  const shortId = issue.id.substring(0, 8).toUpperCase();

  return (
    <Link
      to={`/issues/${issue.id}`}
      className="block bg-paper-raised border border-rule rounded-md hover:bg-surface-container-low hover:border-ink-muted/30 transition-all duration-150 ease-out"
    >
      <div className="p-4 flex flex-col h-full justify-between">
        <div>
          {/* Badge Row */}
          <div className="flex justify-between items-start gap-2 mb-3">
            <span className="font-mono text-[10px] uppercase font-bold tracking-wider text-ink bg-rule/35 px-2 py-0.5 rounded">
              {issue.category}
            </span>
            <div className="flex items-center gap-1.5">
              <span className={`text-[10px] font-mono px-2 py-0.5 border rounded-full ${severityColors}`}>
                {issue.severity}
              </span>
              <StatusStamp status={issue.status} />
            </div>
          </div>

          {/* Title & Desc */}
          <span className="font-mono text-[10px] text-ink-muted block mb-1">NGK-{shortId}</span>
          <h3 className="font-display text-base font-bold text-ink leading-tight mb-1.5 hover:text-secondary transition-colors">
            {issue.title}
          </h3>
          <p className="font-ui text-xs text-ink-muted line-clamp-2 leading-relaxed mb-4">
            {issue.description}
          </p>
        </div>

        {/* Details Footer */}
        <div className="space-y-3 pt-3 border-t border-dashed border-rule text-ink-muted text-xs">
          <div className="flex justify-between items-center gap-4">
            <div className="flex items-center gap-1.5 truncate">
              <MapPin className="h-3.5 w-3.5 text-ink-muted/65 shrink-0" />
              <span className="truncate font-ui text-[11px]">{issue.location}</span>
            </div>
            <div className="flex items-center gap-1.5 text-ink-muted/65 shrink-0 font-mono text-[10px]">
              <Calendar className="h-3.5 w-3.5" />
              <span>{new Date(issue.createdAt).toLocaleDateString()}</span>
            </div>
          </div>

          {/* SLA and Confirmation telemetry */}
          <div className="space-y-2">
            <div className="flex justify-between items-center text-[10px] font-mono text-ink">
              <div className="flex items-center gap-1.5">
                <Clock className={`h-3.5 w-3.5 ${isBreached ? "text-status-escalated" : "text-ink-muted/50"}`} />
                <span>
                  {isBreached ? (
                    <span className="text-status-escalated font-bold uppercase tracking-wide">SLA BREACHED</span>
                  ) : (
                    <span>SLA: {remainingDays} DAYS REMAINING</span>
                  )}
                </span>
              </div>
              <div className="flex items-center gap-1 bg-paper px-1.5 py-0.5 rounded border border-rule text-[9px] font-bold">
                <span>URGENCY: {issue.urgencyScore}</span>
              </div>
            </div>

            {/* SLA Progress Bar (Fuse Style) */}
            {issue.status !== "RESOLVED" && (
              <div className="w-full h-1 bg-rule rounded-full overflow-hidden relative">
                <div
                  className={`h-full transition-all duration-300 ${
                    isBreached ? "bg-status-escalated" : percentageElapsed > 75 ? "bg-status-reported" : "bg-seal"
                  }`}
                  style={{ width: `${100 - percentageElapsed}%` }} // empties left-to-right (from 100% to 0% remaining)
                ></div>
              </div>
            )}
            
            {isBreached && issue.status !== "RESOLVED" && (
              <div className="flex justify-end">
                <span className="font-mono text-[9px] text-status-escalated border border-double border-status-escalated px-1 py-0.2 rotate-3 rounded uppercase font-bold tracking-widest bg-paper">
                  OVERDUE
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
};
