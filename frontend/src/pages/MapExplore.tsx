import React, { useEffect, useState, useRef } from "react";
import { Link } from "react-router-dom";
import { dbService, subscribeToCollection } from "../services/db";
import { Issue, Severity } from "../types";
import { MapPin, Filter, Layers, Sparkles, Navigation } from "lucide-react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { GOOGLE_MAPS_API_KEY } from "../services/config";
import { StatusStamp } from "../components/StatusStamp";

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
      style: "mapbox://styles/mapbox/light-v11",
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
      el.className = "custom-file-tag-marker cursor-pointer flex flex-col items-center select-none";

      const tagBg = getSeverityColor(issue.severity);
      const isEscalated = issue.status === "ESCALATED";

      el.innerHTML = `
        <div class="flex flex-col items-center marker-stamp">
          <div class="text-white px-2 py-0.5 flex items-center gap-1 border-l-2 border-ink text-[9px] font-mono font-bold tracking-tight rounded-[2px]" style="background-color: ${tagBg}">
            <span>${issue.category.substring(0, 4).toUpperCase()}</span>
            <span>NGK-${issue.id.substring(0, 4).toUpperCase()}</span>
          </div>
          <div class="w-[1px] h-3 bg-ink"></div>
          <div class="w-1.5 h-1.5 bg-ink rounded-full relative">
            ${isEscalated ? `<div class="absolute rounded-full animate-ping inset-[-6px] bg-secondary opacity-40"></div>` : ""}
          </div>
        </div>
      `;

      el.addEventListener("click", (e) => {
        e.stopPropagation();
        setSelectedIssue(issue);
        map.easeTo({
          center: [issue.longitude, issue.latitude],
          zoom: 14,
        });
      });

      const marker = new mapboxgl.Marker({ element: el })
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
          ["heatmap-density"],
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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col lg:flex-row gap-6 h-[calc(100vh-112px)] min-h-[500px] text-ink font-ui">
      {/* Filters Sidebar */}
      <div className="w-full lg:w-72 shrink-0 bg-paper-raised border border-rule rounded p-5 flex flex-col gap-4 text-left h-fit lg:h-full overflow-y-auto">
        <div className="flex items-center gap-2 border-b border-rule pb-3 mb-1">
          <Filter className="h-4 w-4 text-primary" />
          <h2 className="text-xs font-bold uppercase tracking-wider font-mono">Registry Filters</h2>
        </div>

        {/* Category */}
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-bold uppercase tracking-wider text-ink-muted font-mono">Category</label>
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="bg-paper border border-rule text-ink text-xs rounded p-2 focus:outline-none font-mono"
          >
            <option value="ALL">ALL CATEGORIES</option>
            <option value="Garbage">GARBAGE</option>
            <option value="Streetlight">STREETLIGHT</option>
            <option value="Pothole">POTHOLE</option>
            <option value="Water Leakage">WATER LEAKAGE</option>
            <option value="Critical Infrastructure">CRITICAL INFRASTRUCTURE</option>
          </select>
        </div>

        {/* Severity */}
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-bold uppercase tracking-wider text-ink-muted font-mono">Severity</label>
          <select
            value={filterSeverity}
            onChange={(e) => setFilterSeverity(e.target.value)}
            className="bg-paper border border-rule text-ink text-xs rounded p-2 focus:outline-none font-mono"
          >
            <option value="ALL">ALL SEVERITIES</option>
            <option value="LOW">LOW</option>
            <option value="MEDIUM">MEDIUM</option>
            <option value="HIGH">HIGH</option>
            <option value="CRITICAL">CRITICAL</option>
          </select>
        </div>

        {/* Status */}
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-bold uppercase tracking-wider text-ink-muted font-mono">Status</label>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="bg-paper border border-rule text-ink text-xs rounded p-2 focus:outline-none font-mono"
          >
            <option value="ALL">ALL STATUSES</option>
            <option value="REPORTED">REPORTED</option>
            <option value="VERIFIED">VERIFIED</option>
            <option value="ROUTED">ROUTED</option>
            <option value="IN_PROGRESS">IN PROGRESS</option>
            <option value="ESCALATED">ESCALATED</option>
            <option value="RESOLVED">RESOLVED</option>
          </select>
        </div>

        {/* Ward */}
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-bold uppercase tracking-wider text-ink-muted font-mono">Ward</label>
          <select
            value={filterWard}
            onChange={(e) => setFilterWard(e.target.value)}
            className="bg-paper border border-rule text-ink text-xs rounded p-2 focus:outline-none font-mono"
          >
            <option value="ALL">ALL WARDS</option>
            <option value="Ward 1">WARD 1 (CENTRAL)</option>
            <option value="Ward 2">WARD 2 (WEST)</option>
            <option value="Ward 3">WARD 3 (EAST)</option>
            <option value="Ward 4">WARD 4 (SOUTH)</option>
          </select>
        </div>

        <hr className="border-rule my-2 border-dashed" />

        {/* Map Layers */}
        <div className="flex flex-col gap-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-ink-muted flex items-center gap-1 font-mono">
            <Layers className="h-3.5 w-3.5" /> MAP OVERLAYS
          </span>
          <button
            onClick={() => setShowHeatmap(!showHeatmap)}
            className={`w-full text-xs font-mono font-bold py-2 px-3 rounded border transition-all flex items-center justify-center gap-1.5 ${
              showHeatmap
                ? "bg-secondary text-paper border-secondary hover:brightness-105"
                : "bg-paper text-ink-muted border-rule hover:bg-surface-container-low"
            }`}
          >
            <Sparkles className="h-3.5 w-3.5" />
            {showHeatmap ? "HIDE HEATMAP" : "SHOW CIVIC HEATMAP"}
          </button>
        </div>
      </div>

      {/* Main Map Box */}
      <div className="flex-1 bg-paper border border-rule rounded relative flex flex-col overflow-hidden h-full">
        {/* Map Header */}
        <div className="bg-paper-raised border-b border-rule py-3 px-4 flex flex-col sm:flex-row sm:justify-between sm:items-center text-left gap-2 z-10">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-ink flex items-center gap-1.5 font-mono">
              <Navigation className="h-3.5 w-3.5 text-primary" />
              LIVE CITY GIS REGISTRY
            </h3>
            <p className="text-[10px] text-ink-muted">Displaying {filteredIssues.length} active infrastructure tickets</p>
          </div>
          <div className="flex items-center gap-3">
            {/* Coordinate readout */}
            <div className="hidden sm:flex flex-col text-right font-mono text-[9px] text-ink-muted">
              <span>CURRENT REGION</span>
              <span className="font-bold text-ink">28.6139° N, 77.2090° E</span>
            </div>
            <span className="bg-seal-tint border border-seal/20 text-seal text-[9px] font-bold px-2 py-0.5 rounded flex items-center gap-1 font-mono uppercase">
              <span className="h-1.5 w-1.5 rounded-full bg-seal animate-pulse"></span>
              AGENT ENGINE LIVE
            </span>
          </div>
        </div>

        {/* Interactive Mapbox Map */}
        <div className="flex-1 relative overflow-hidden flex items-center justify-center bg-[#f7f3ea]">
          <div ref={mapContainerRef} className="absolute inset-0 w-full h-full" style={{ minHeight: '400px' }} />

          {/* Dossier Drawer Preview (Dossier detail page drawer overlay) */}
          {selectedIssue && (
            <div className="absolute bottom-4 inset-x-4 md:left-auto md:right-4 md:w-96 bg-paper-raised border-t-4 border-secondary border-l border-r border-b border-rule rounded-t p-5 z-20 text-left transition-all duration-200 shadow-lg">
              <div className="flex justify-between items-start gap-2 mb-3">
                <div>
                  <h4 className="font-display text-sm font-bold text-ink mb-1">
                    INCIDENT CASE FILE #{selectedIssue.id.substring(0, 8).toUpperCase()}
                  </h4>
                  <div className="inline-block scale-90 -ml-1">
                    <StatusStamp status={selectedIssue.status} />
                  </div>
                </div>
                <button
                  onClick={() => setSelectedIssue(null)}
                  className="text-sm text-ink-muted hover:text-ink font-bold px-1.5"
                >
                  ✕
                </button>
              </div>
              <div className="dashed-rule h-px w-full my-3"></div>
              
              <div className="space-y-2 mb-4 font-ui text-xs">
                <div className="flex gap-2">
                  <span className="font-mono text-[10px] text-ink-muted w-20 shrink-0">LOCATION:</span>
                  <span className="text-ink font-bold">{selectedIssue.location}</span>
                </div>
                <div className="flex gap-2">
                  <span className="font-mono text-[10px] text-ink-muted w-20 shrink-0">CATEGORY:</span>
                  <span className="text-ink uppercase font-bold">{selectedIssue.category}</span>
                </div>
                <div className="flex gap-2">
                  <span className="font-mono text-[10px] text-ink-muted w-20 shrink-0">DESCRIPTION:</span>
                  <span className="text-ink-muted line-clamp-2 leading-relaxed">{selectedIssue.description}</span>
                </div>
              </div>
              
              <div className="flex gap-2 pt-2">
                <Link
                  to={`/issues/${selectedIssue.id}`}
                  className="flex-1 bg-secondary text-paper text-center py-2.5 text-xs font-mono font-bold uppercase tracking-wider rounded hover:brightness-105 transition-all shadow-sm"
                >
                  VIEW FULL DOSSIER
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
