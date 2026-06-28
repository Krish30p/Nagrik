import React from "react";

interface StatusStampProps {
  status: string;
  className?: string;
}

export const StatusStamp: React.FC<StatusStampProps> = ({ status, className = "" }) => {
  const normalizedStatus = status.toUpperCase().replace("_", " ");

  const colorClasses: Record<string, string> = {
    REPORTED: "text-status-reported border-status-reported",
    VERIFIED: "text-status-verifying border-status-verifying",
    ROUTED: "text-status-routed border-status-routed",
    "IN PROGRESS": "text-status-in-progress border-status-in-progress",
    ESCALATED: "text-status-escalated border-status-escalated shadow-[0_2px_8px_rgba(162,59,46,0.1)]",
    RESOLVED: "text-status-resolved border-status-resolved",
    DUPLICATE: "text-status-duplicate border-status-duplicate",
    DUPLICATE_MERGED: "text-status-duplicate border-status-duplicate",
  };

  const currentColors = colorClasses[normalizedStatus] || "text-ink-muted border-ink-muted";

  return (
    <div className={`stamp-oval font-mono text-[10px] font-bold tracking-wider uppercase bg-paper ${currentColors} ${className}`}>
      {normalizedStatus}
    </div>
  );
};
