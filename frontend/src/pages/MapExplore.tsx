import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { dbService, subscribeToCollection } from "../services/db";
import { Issue, Severity } from "../types";
import { MapPin, Filter, Layers, Sparkles, Navigation } from "lucide-react";

export const MapExplore: React.FC = () => {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);
  const [filterSeverity, setFilterSeverity] = useState<string>("ALL");
  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const [filterCategory, setFilterCategory] = useState<string>("ALL");
  const [filterWard, setFilterWard] = useState<string>("ALL");
  const [showHeatmap, setShowHeatmap] = useState(false);

  const loadData = async () => {
    const data = await dbService.getIssues();
    setIssues(data);
  };

  useEffect(() => {
    void Promise.resolve().then(loadData);
    const unsubscribe = subscribeToCollection("issues", loadData);
    return unsubscribe;
  }, []);

  // Boundaries for coordinates mapping
  const minLat = 28.55;
  const maxLat = 28.65;
  const minLng = 77.15;
  const maxLng = 77.25;

  const mapX = (lng: number) => {
    const clamped = Math.max(minLng, Math.min(maxLng, lng));
    return 40 + ((clamped - minLng) / (maxLng - minLng)) * 520;
  };

  const mapY = (lat: number) => {
    const clamped = Math.max(minLat, Math.min(maxLat, lat));
    return 440 - ((clamped - minLat) / (maxLat - minLat)) * 400; // Inverted Y in SVG
  };

  const filteredIssues = issues.filter((issue) => {
    if (filterSeverity !== "ALL" && issue.severity !== filterSeverity) return false;
    if (filterStatus !== "ALL" && issue.status !== filterStatus) return false;
    if (filterCategory !== "ALL" && issue.category !== filterCategory) return false;
    if (filterWard !== "ALL" && !issue.ward.includes(filterWard)) return false;
    return true;
  });

  const getSeverityColor = (severity: Severity) => {
    if (severity === "LOW") return "#1a7a52"; // primary-container
    if (severity === "MEDIUM") return "#ffbf00"; // secondary-container
    if (severity === "HIGH") return "#fbbc00"; // secondary-fixed-dim
    return "#ba1a1a"; // error
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col lg:flex-row gap-6 h-[calc(100vh-130px)] min-h-[500px]">
      {/* Filters Sidebar */}
      <div className="w-full lg:w-72 shrink-0 bg-surface border border-outline-variant rounded-xl p-5 flex flex-col gap-4 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.1)] text-left h-fit lg:h-full overflow-y-auto">
        <div className="flex items-center gap-2 border-b border-outline-variant pb-3 mb-1">
          <Filter className="h-4.5 w-4.5 text-primary" />
          <h2 className="text-sm font-bold text-on-surface uppercase tracking-wider">Map Filters</h2>
        </div>

        {/* Category */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Category</label>
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="bg-slate-50 border border-slate-200 text-slate-700 text-xs rounded-lg p-2 font-medium focus:outline-none"
          >
            <option value="ALL">All Categories</option>
            <option value="Garbage">Garbage</option>
            <option value="Streetlight">Streetlight</option>
            <option value="Pothole">Pothole</option>
            <option value="Water Leakage">Water Leakage</option>
            <option value="Critical Infrastructure">Critical Infrastructure</option>
          </select>
        </div>

        {/* Severity */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Severity</label>
          <select
            value={filterSeverity}
            onChange={(e) => setFilterSeverity(e.target.value)}
            className="bg-slate-50 border border-slate-200 text-slate-700 text-xs rounded-lg p-2 font-medium focus:outline-none"
          >
            <option value="ALL">All Severities</option>
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
            <option value="CRITICAL">Critical</option>
          </select>
        </div>

        {/* Status */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Status</label>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="bg-slate-50 border border-slate-200 text-slate-700 text-xs rounded-lg p-2 font-medium focus:outline-none"
          >
            <option value="ALL">All Statuses</option>
            <option value="REPORTED">Reported</option>
            <option value="VERIFIED">Verified</option>
            <option value="ROUTED">Routed</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="ESCALATED">Escalated</option>
            <option value="RESOLVED">Resolved</option>
          </select>
        </div>

        {/* Ward */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Ward</label>
          <select
            value={filterWard}
            onChange={(e) => setFilterWard(e.target.value)}
            className="bg-slate-50 border border-slate-200 text-slate-700 text-xs rounded-lg p-2 font-medium focus:outline-none"
          >
            <option value="ALL">All Wards</option>
            <option value="Ward 1">Ward 1 (Central)</option>
            <option value="Ward 2">Ward 2 (West)</option>
            <option value="Ward 3">Ward 3 (East)</option>
            <option value="Ward 4">Ward 4 (South)</option>
          </select>
        </div>

        <hr className="border-slate-100 my-2" />

        {/* Map Layers */}
        <div className="flex flex-col gap-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
            <Layers className="h-3 w-3" /> Map Overlays
          </span>
          <button
            onClick={() => setShowHeatmap(!showHeatmap)}
            className={`w-full text-xs font-bold py-2 px-3 rounded-lg border transition-all flex items-center justify-center gap-1.5 ${
              showHeatmap
                ? "bg-secondary text-white border-secondary hover:bg-secondary-hover"
                : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
            }`}
          >
            <Sparkles className="h-3.5 w-3.5" />
            {showHeatmap ? "Hide Heatmap" : "Show Civic Heatmap"}
          </button>
        </div>
      </div>

      {/* Main Map Box */}
      <div className="flex-1 bg-surface border border-outline-variant rounded-xl relative flex flex-col shadow-sm overflow-hidden h-full">
        {/* Map Header */}
        <div className="bg-surface-bright border-b border-outline-variant py-3 px-4 flex justify-between items-center text-left">
          <div>
            <h3 className="text-sm font-bold text-on-surface flex items-center gap-1.5">
              <Navigation className="h-4 w-4 text-primary" />
              Live City GIS View
            </h3>
            <p className="text-[10px] text-on-surface-variant">Displaying {filteredIssues.length} active infrastructure tickets</p>
          </div>
          <span className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping"></span>
            Agent Engine Live
          </span>
        </div>

        {/* Interactive SVG Map */}
        <div className="flex-1 relative map-bg select-none overflow-hidden flex items-center justify-center">
          <svg
            viewBox="0 0 600 480"
            className="w-full h-full max-w-[650px] max-h-[500px]"
          >
            {/* Map Grid Gridlines */}
            <defs>
              <pattern id="mapGrid" width="30" height="30" patternUnits="userSpaceOnUse">
                <path d="M 30 0 L 0 0 0 30" fill="none" stroke="#E2E8F0" strokeWidth="0.5" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#mapGrid)" />

            {/* Ward Boundaries */}
            {/* Ward 1 Central */}
            <path d="M 40 40 L 300 40 L 300 240 L 40 240 Z" fill="#F0FDFA" stroke="#99F6E4" strokeWidth="1.5" strokeDasharray="4 4" />
            <text x="50" y="60" fill="#0D9488" fontSize="10" fontWeight="bold">Ward 1 (Central)</text>

            {/* Ward 2 West */}
            <path d="M 300 40 L 560 40 L 560 240 L 300 240 Z" fill="#EFF6FF" stroke="#BFDBFE" strokeWidth="1.5" strokeDasharray="4 4" />
            <text x="310" y="60" fill="#1D4ED8" fontSize="10" fontWeight="bold">Ward 2 (West)</text>

            {/* Ward 3 East */}
            <path d="M 40 240 L 300 240 L 300 440 L 40 440 Z" fill="#FEF3C7" stroke="#FDE68A" strokeWidth="1.5" strokeDasharray="4 4" />
            <text x="50" y="260" fill="#B45309" fontSize="10" fontWeight="bold">Ward 3 (East)</text>

            {/* Ward 4 South */}
            <path d="M 300 240 L 560 240 L 560 440 L 300 440 Z" fill="#FAF5FF" stroke="#E9D5FF" strokeWidth="1.5" strokeDasharray="4 4" />
            <text x="310" y="260" fill="#6B21A8" fontSize="10" fontWeight="bold">Ward 4 (South)</text>

            {/* Heatmap overlay (renders semi-transparent circles around coordinates) */}
            {showHeatmap &&
              filteredIssues.map((issue) => {
                const cx = mapX(issue.longitude);
                const cy = mapY(issue.latitude);
                let heatColor = "rgba(239, 68, 68, 0.25)"; // Critical Red
                let heatRadius = 40;
                if (issue.severity === "LOW") {
                  heatColor = "rgba(16, 185, 129, 0.25)"; // Green
                  heatRadius = 20;
                } else if (issue.severity === "MEDIUM") {
                  heatColor = "rgba(59, 130, 246, 0.25)"; // Blue
                  heatRadius = 25;
                } else if (issue.severity === "HIGH") {
                  heatColor = "rgba(245, 158, 11, 0.25)"; // Amber
                  heatRadius = 35;
                }

                return (
                  <circle
                    key={`heat-${issue.id}`}
                    cx={cx}
                    cy={cy}
                    r={heatRadius}
                    fill={heatColor}
                    className="transition-all duration-500"
                  />
                );
              })}

            {/* Issue Pin Markers */}
            {filteredIssues.map((issue) => {
              const cx = mapX(issue.longitude);
              const cy = mapY(issue.latitude);
              const color = getSeverityColor(issue.severity);
              const isSelected = selectedIssue?.id === issue.id;

              return (
                <g
                  key={issue.id}
                  className="cursor-pointer"
                  onClick={() => setSelectedIssue(issue)}
                >
                  {/* Pulse for escalated issues */}
                  {issue.status === "ESCALATED" && (
                    <circle
                      cx={cx}
                      cy={cy}
                      r="16"
                      fill={color}
                      opacity="0.15"
                      className="animate-ping"
                    />
                  )}

                  {/* Marker Pin */}
                  <circle
                    cx={cx}
                    cy={cy}
                    r={isSelected ? "8" : "5"}
                    fill={color}
                    stroke="#FFF"
                    strokeWidth={isSelected ? "2.5" : "1.5"}
                    className="transition-all duration-200 hover:scale-125"
                  />
                </g>
              );
            })}
          </svg>

          {/* Issue Floating Mini-Card */}
          {selectedIssue && (
            <div className="absolute bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 bg-surface border border-outline-variant rounded-xl shadow-[0_20px_40px_-15px_rgba(0,0,0,0.1)] p-4 z-10 text-left transition-all duration-200">
              <div className="flex justify-between items-start gap-2 mb-2">
                <span className="text-[10px] uppercase font-bold text-primary bg-primary-container/10 px-2 py-0.5 rounded border border-primary/20">
                  {selectedIssue.category}
                </span>
                <button
                  onClick={() => setSelectedIssue(null)}
                  className="text-xs text-on-surface-variant hover:text-on-surface font-bold px-1.5"
                >
                  ✕
                </button>
              </div>
              <h4 className="text-sm font-bold text-on-surface line-clamp-1 mb-1">
                {selectedIssue.title}
              </h4>
              <p className="text-xs text-on-surface-variant line-clamp-2 leading-relaxed mb-3">
                {selectedIssue.description}
              </p>
              <div className="flex items-center gap-1 text-[10px] text-slate-400 mb-3">
                <MapPin className="h-3 w-3" />
                <span className="truncate">{selectedIssue.location}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-bold">
                  Status: {selectedIssue.status}
                </span>
                <Link
                  to={`/issues/${selectedIssue.id}`}
                  className="bg-primary text-white text-[10px] font-bold px-3 py-1.5 rounded-lg hover:bg-primary-hover shadow-sm"
                >
                  View Details
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
