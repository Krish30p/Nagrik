import React, { useEffect, useState, useRef } from "react";
import { Link } from "react-router-dom";
import { dbService, subscribeToCollection } from "../services/db";
import { Issue, Severity } from "../types";
import { MapPin, Filter, Layers, Sparkles, Navigation } from "lucide-react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { GOOGLE_MAPS_API_KEY } from "../services/config";

export const MapExplore: React.FC = () => {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);
  const [filterSeverity, setFilterSeverity] = useState<string>("ALL");
  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const [filterCategory, setFilterCategory] = useState<string>("ALL");
  const [filterWard, setFilterWard] = useState<string>("ALL");
  const [showHeatmap, setShowHeatmap] = useState(false);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);

  const loadData = async () => {
    const data = await dbService.getIssues();
    setIssues(data);
  };

  useEffect(() => {
    void Promise.resolve().then(loadData);
    const unsubscribe = subscribeToCollection("issues", loadData);
    return unsubscribe;
  }, []);

  const filteredIssues = issues.filter((issue) => {
    if (filterSeverity !== "ALL" && issue.severity !== filterSeverity) return false;
    if (filterStatus !== "ALL" && issue.status !== filterStatus) return false;
    if (filterCategory !== "ALL" && issue.category !== filterCategory) return false;
    if (filterWard !== "ALL" && !issue.ward.includes(filterWard)) return false;
    return true;
  });

  // Initialize Mapbox
  useEffect(() => {
    if (!mapContainerRef.current) return;

    mapboxgl.accessToken = GOOGLE_MAPS_API_KEY;

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: [77.2090, 28.6139], // Delhi
      zoom: 11,
    });

    mapRef.current = map;

    return () => {
      map.remove();
    };
  }, []);

  // Update Markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Clear old markers
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    // Add new markers
    filteredIssues.forEach((issue) => {
      const el = document.createElement("div");
      el.className = "custom-marker";
      el.style.width = "14px";
      el.style.height = "14px";
      el.style.borderRadius = "50%";
      el.style.backgroundColor = getSeverityColor(issue.severity);
      el.style.border = "2px solid white";
      el.style.boxShadow = "0 2px 4px rgba(0,0,0,0.3)";
      el.style.cursor = "pointer";
      el.style.position = "relative";

      if (issue.status === "ESCALATED") {
        const pulse = document.createElement("div");
        pulse.className = "absolute rounded-full animate-ping";
        pulse.style.inset = "-6px";
        pulse.style.backgroundColor = getSeverityColor(issue.severity);
        pulse.style.opacity = "0.4";
        el.appendChild(pulse);
      }

      el.addEventListener("click", () => {
        setSelectedIssue(issue);
        map.easeTo({
          center: [issue.longitude, issue.latitude],
          zoom: 13,
        });
      });

      const marker = new mapboxgl.Marker(el)
        .setLngLat([issue.longitude, issue.latitude])
        .addTo(map);

      markersRef.current.push(marker);
    });
  }, [filteredIssues]);

  // Update Heatmap
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const onStyleLoad = () => {
      updateHeatmapLayer(map);
    };

    if (map.isStyleLoaded()) {
      updateHeatmapLayer(map);
    } else {
      map.on('style.load', onStyleLoad);
    }

    return () => {
      map.off('style.load', onStyleLoad);
    };
  }, [filteredIssues, showHeatmap]);

  const updateHeatmapLayer = (map: mapboxgl.Map) => {
    if (map.getLayer("issues-heat")) map.removeLayer("issues-heat");
    if (map.getSource("issues-source")) map.removeSource("issues-source");

    if (!showHeatmap) return;

    const geojson: any = {
      type: "FeatureCollection",
      features: filteredIssues.map((issue) => ({
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [issue.longitude, issue.latitude],
        },
        properties: {
          intensity: issue.severity === "CRITICAL" ? 4 : issue.severity === "HIGH" ? 3 : issue.severity === "MEDIUM" ? 2 : 1,
        },
      })),
    };

    map.addSource("issues-source", {
      type: "geojson",
      data: geojson,
    });

    map.addLayer({
      id: "issues-heat",
      type: "heatmap",
      source: "issues-source",
      maxzoom: 15,
      paint: {
        "heatmap-weight": ["get", "intensity"],
        "heatmap-intensity": [
          "interpolate",
          ["linear"],
          ["zoom"],
          0, 1,
          15, 3
        ],
        "heatmap-color": [
          "interpolate",
          ["linear"],
          ["heatmap-value"],
          0, "rgba(33,102,172,0)",
          0.2, "rgba(103,169,207,0.5)",
          0.4, "rgba(209,229,240,0.6)",
          0.6, "rgba(253,219,199,0.7)",
          0.8, "rgba(239,138,98,0.8)",
          1, "rgba(178,24,43,0.9)"
        ],
        "heatmap-radius": [
          "interpolate",
          ["linear"],
          ["zoom"],
          0, 5,
          15, 30
        ],
        "heatmap-opacity": 0.6,
      },
    });
  };

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

        {/* Interactive Mapbox Map */}
        <div className="flex-1 relative overflow-hidden flex items-center justify-center">
          <div ref={mapContainerRef} className="absolute inset-0 w-full h-full" />

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
