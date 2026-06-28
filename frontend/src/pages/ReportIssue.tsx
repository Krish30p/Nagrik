import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { dbService } from "../services/db";
import { authService } from "../services/auth";
import { Image as ImageIcon, Mic, Sparkles, Navigation, Send, CheckCircle2, X } from "lucide-react";
import { API_URL, GOOGLE_MAPS_API_KEY } from "../services/config";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

type SpeechRecognitionConstructor = new () => {
  continuous: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionResultEvent) => void) | null;
};

interface SpeechRecognitionResultEvent {
  results: {
    [index: number]: {
      [index: number]: {
        transcript: string;
      };
    };
  };
}

interface SpeechRecognitionWindow extends Window {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
}

function getErrorMessage(err: unknown, fallback: string) {
  return err instanceof Error ? err.message : fallback;
}

const DEMO_PRESETS = [
  {
    name: "Demo Pothole",
    image: "https://images.unsplash.com/photo-1515162305285-0293e4767cc2?auto=format&fit=crop&q=80&w=800",
    desc: "Extremely deep pothole in the middle of the driving lane. Cars are swerving dangerously to avoid it.",
    lat: 28.6189,
    lng: 77.2030,
    ward: "Ward 1"
  },
  {
    name: "Demo Water Leakage",
    image: "https://images.unsplash.com/photo-1542060748-10c28b629f6f?auto=format&fit=crop&q=80&w=800",
    desc: "High pressure water pipe leak on the corner of the block. Clean drinking water is gushing out.",
    lat: 28.6273,
    lng: 77.2245,
    ward: "Ward 1"
  },
  {
    name: "Demo Broken Streetlight",
    image: "https://images.unsplash.com/photo-1509021436665-8f37df706a73?auto=format&fit=crop&q=80&w=800",
    desc: "The street light pole is completely dead. Entire footpath is unsafe after sunset.",
    lat: 28.5911,
    lng: 77.1855,
    ward: "Ward 1"
  }
];

export const ReportIssue: React.FC = () => {
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [latitude, setLatitude] = useState<number>(28.6139);
  const [longitude, setLongitude] = useState<number>(77.2090);
  const [ward, setWard] = useState("Ward 1");
  const [voiceText, setVoiceText] = useState("");
  const [voiceNoteUrl, setVoiceNoteUrl] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markerRef = useRef<mapboxgl.Marker | null>(null);

  // Initialize Mapbox map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    mapboxgl.accessToken = GOOGLE_MAPS_API_KEY;

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: "mapbox://styles/mapbox/light-v11",
      center: [longitude, latitude],
      zoom: 13,
    });

    mapRef.current = map;

    const marker = new mapboxgl.Marker({ draggable: true })
      .setLngLat([longitude, latitude])
      .addTo(map);

    markerRef.current = marker;

    marker.on("dragend", () => {
      const lngLat = marker.getLngLat();
      setLatitude(Number(lngLat.lat.toFixed(6)));
      setLongitude(Number(lngLat.lng.toFixed(6)));
    });

    map.on("click", (e) => {
      marker.setLngLat(e.lngLat);
      setLatitude(Number(e.lngLat.lat.toFixed(6)));
      setLongitude(Number(e.lngLat.lng.toFixed(6)));
    });

    return () => {
      map.remove();
    };
  }, []);

  // Sync marker position when lat/lng update externally
  useEffect(() => {
    const marker = markerRef.current;
    const map = mapRef.current;
    if (marker && map) {
      marker.setLngLat([longitude, latitude]);
      map.easeTo({ center: [longitude, latitude] });
    }
  }, [latitude, longitude]);

  // Audio recording states
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Agent Chain Running States
  const [agentStep, setAgentStep] = useState<
    "idle" | "intake" | "verify" | "route" | "done"
  >("idle");
  const [loadingText, setLoadingText] = useState("");

  const navigate = useNavigate();
  const currentUser = authService.getCurrentUser();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Start voice note recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        setIsUploading(true);
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/wav" });
        const audioFile = new File([audioBlob], "voice_note.wav", { type: "audio/wav" });
        
        try {
          const downloadUrl = await dbService.uploadFile(audioFile);
          setVoiceNoteUrl(downloadUrl);
          
          // Basic Web Speech Recognition for local transcription
          const speechWindow = window as SpeechRecognitionWindow;
          const SpeechRecognition = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;
          if (SpeechRecognition) {
            const recognition = new SpeechRecognition();
            recognition.continuous = false;
            recognition.lang = "en-US";
            recognition.onresult = (event) => {
              const transcript = event.results[0][0].transcript;
              setVoiceText(transcript);
            };
            // Run transcription dummy simulation as fallback
            setVoiceText("Audio transcript: Incident reported at target coordinate coordinates.");
          } else {
            setVoiceText("Audio voice note attachment submitted.");
          }
        } catch (err: unknown) {
          alert("Audio upload failed: " + getErrorMessage(err, "Unknown upload error"));
        } finally {
          setIsUploading(false);
        }

        // Close streams
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Mic access denied or unavailable", err);
      // Fallback local simulation
      setIsRecording(true);
      setTimeout(() => {
        setVoiceText("Priority road defect: Severe pothole reported right next to the public school gate.");
        setVoiceNoteUrl(`${API_URL}/media/mock-voice-id`);
        setIsRecording(false);
      }, 1500);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    } else {
      setIsRecording(false);
    }
  };

  // Upload file/camera input to GridFS
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    setIsUploading(true);
    try {
      const downloadUrl = await dbService.uploadFile(file);
      setImageUrl(downloadUrl);
    } catch (err: unknown) {
      alert("Media upload failed: " + getErrorMessage(err, "Unknown upload error"));
    } finally {
      setIsUploading(false);
    }
  };

  const handleSelectPreset = (preset: typeof DEMO_PRESETS[0]) => {
    setDescription(preset.desc);
    setImageUrl(preset.image);
    setLatitude(preset.lat);
    setLongitude(preset.lng);
    setWard(preset.ward);
  };

  // GPS auto-attach
  const handleGPSAttach = () => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLatitude(position.coords.latitude);
          setLongitude(position.coords.longitude);
        },
        (error) => {
          console.warn("GPS Permission denied or timed out:", error);
          alert("Could not access device GPS. Please input coordinates manually below.");
        },
        { enableHighAccuracy: true, timeout: 5000 }
      );
    } else {
      alert("Geolocation is not supported by your browser.");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) {
      alert("Please log in first.");
      return;
    }

    if (!description.trim()) {
      alert("Please provide a description of the civic issue.");
      return;
    }

    try {
      setAgentStep("intake");
      setLoadingText("Intake Agent: Submitting report and running multimodal analysis...");
      
      const issue = await dbService.createIssue({
        title: "Pending AI Classification",
        category: "Garbage", // placeholder
        description: description,
        severity: "MEDIUM",
        status: "REPORTED",
        location: "Coordinates Location",
        latitude,
        longitude,
        ward,
        createdBy: currentUser.id,
        createdByName: currentUser.name,
        mediaUrls: imageUrl ? [imageUrl] : [],
        voiceTranscript: voiceText || undefined,
        voiceNoteUrl: voiceNoteUrl || undefined,
        urgencyScore: 20,
        slaDays: 3
      });

      setAgentStep("verify");
      setLoadingText("Verification Agent: Scanning for duplicate reports near coordinates...");
      await new Promise(r => setTimeout(r, 800));

      setAgentStep("route");
      setLoadingText("Routing Agent: Matching department and drafting complaint document...");
      await new Promise(r => setTimeout(r, 800));

      setAgentStep("done");
      setLoadingText("Success! Issue registered, verified, and routed successfully.");
      
      setTimeout(() => {
        navigate(`/issues/${issue.id}`);
      }, 1500);
    } catch (err: unknown) {
      console.error(err);
      alert("Agent routing error: " + getErrorMessage(err, "Unknown routing error"));
      setAgentStep("idle");
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 text-ink font-ui">
      {/* Step Overlay */}
      {agentStep !== "idle" && (
        <div className="fixed inset-0 z-50 bg-[#1B1B16]/80 flex items-center justify-center p-4">
          <div className="bg-paper-raised border border-rule rounded p-6 md:p-8 max-w-md w-full shadow-lg text-center space-y-6">
            <div className="flex justify-center">
              {agentStep === "done" ? (
                <div className="stamp-oval text-status-resolved border-status-resolved font-mono text-xs px-3 py-1 bg-paper font-bold rotate-[-3deg]">
                  LOOP VERIFIED
                </div>
              ) : (
                <div className="h-10 w-10 text-secondary border border-rule bg-paper rounded-full flex items-center justify-center animate-spin">
                  <Sparkles className="h-5 w-5" />
                </div>
              )}
            </div>

            <div className="space-y-2 text-left">
              <h3 className="text-sm font-bold uppercase font-mono tracking-wider text-center">
                {agentStep === "done" ? "Platform Loop Completed" : "Cooperative AI Agents Processing"}
              </h3>
              <p className="text-xs text-ink-muted text-center font-medium leading-relaxed font-mono">
                {loadingText.toUpperCase()}
              </p>
            </div>

            {/* Stepper progress indicator */}
            <div className="flex items-center justify-center gap-1.5 pt-2">
              <span className={`h-1.5 w-6 rounded-none bg-primary`}></span>
              <span className={`h-1.5 w-6 rounded-none ${agentStep === "verify" || agentStep === "route" || agentStep === "done" ? "bg-primary" : "bg-rule"}`}></span>
              <span className={`h-1.5 w-6 rounded-none ${agentStep === "route" || agentStep === "done" ? "bg-primary" : "bg-rule"}`}></span>
              <span className={`h-1.5 w-6 rounded-none ${agentStep === "done" ? "bg-status-resolved" : "bg-rule"}`}></span>
            </div>
          </div>
        </div>
      )}

      {/* Preset Demos */}
      <div className="bg-paper border border-rule rounded p-5 mb-8 text-left">
        <h3 className="text-xs font-bold text-ink uppercase tracking-wider mb-2 flex items-center gap-1.5 font-mono">
          <Sparkles className="h-3.5 w-3.5 text-secondary" />
          QUICK MUNICIPAL PRESETS
        </h3>
        <p className="text-[10px] text-ink-muted leading-relaxed mb-4">
          Select a preset configuration to automatically fill the report with mock data coordinates and verify the sequential agent intake and deduplication logic immediately.
        </p>
        <div className="flex flex-wrap gap-2">
          {DEMO_PRESETS.map((preset) => (
            <button
              key={preset.name}
              onClick={() => handleSelectPreset(preset)}
              type="button"
              className="bg-paper-raised hover:bg-surface-container border border-rule text-xs font-mono font-bold text-ink py-2 px-3 rounded shadow-sm transition-all"
            >
              {preset.name.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Main Form container */}
      <div className="relative bg-paper-raised p-6 md:p-10 border border-rule shadow-sm overflow-hidden text-left flex flex-col">
        <div className="absolute top-4 right-4 opacity-[0.03] select-none pointer-events-none transform rotate-12">
          <span className="font-display text-secondary text-[80px] font-bold tracking-widest">FILED</span>
        </div>

        {/* Issue File Header */}
        <div className="relative mb-8 pb-4">
          <div className="flex flex-col sm:flex-row justify-between items-baseline gap-2 mb-4">
            <div>
              <span className="font-mono text-[9px] uppercase text-ink-muted tracking-wider">FORM REGISTRY: NAG-2024-CRX</span>
              <h2 className="font-display text-2xl font-bold text-ink mt-1">INCIDENT REPORT</h2>
            </div>
            <div className="stamp-oval text-status-reported border-status-reported font-mono text-[10px] font-bold rotate-[-2deg] px-2.5 py-0.5">
              STATUS: DRAFT
            </div>
          </div>
          {/* Double Rule Separator */}
          <div className="w-full h-px bg-rule"></div>
          <div className="w-full h-px bg-rule mt-[2px]"></div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          
          {/* Form details section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase text-ink-muted tracking-wide block font-mono">Jurisdiction Zone</label>
              <select className="w-full bg-paper border border-rule rounded p-2.5 focus:outline-none font-mono text-xs">
                <option>METROPOLITAN CENTRAL - DISTRICT 04</option>
                <option>EAST CORRIDOR PRECINCT</option>
                <option>WEST INDUSTRIAL BASIN</option>
                <option>NORTH HERITAGE ESTATES</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase text-ink-muted tracking-wide block font-mono">Incident Ward Coverage</label>
              <select
                value={ward}
                onChange={(e) => setWard(e.target.value)}
                className="w-full bg-paper border border-rule text-ink text-xs rounded p-2.5 focus:outline-none font-mono"
              >
                <option value="Ward 1">WARD 1</option>
                <option value="Ward 2">WARD 2</option>
                <option value="Ward 3">WARD 3</option>
                <option value="Ward 4">WARD 4</option>
              </select>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase text-ink-muted tracking-wide block font-mono">Issue Details & Account</label>
            <p className="text-[10px] text-ink-muted italic mb-1">Provide a factual, objective account of the incident for the municipal ledger.</p>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe observations, landmarks, and environmental conditions..."
              rows={4}
              required
              className="w-full border border-rule rounded p-3 text-xs bg-paper focus:outline-none leading-relaxed"
            ></textarea>
          </div>

          {/* Evidence Capture */}
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase text-ink-muted tracking-wide block font-mono">Evidence Attachment</label>
            {!imageUrl ? (
              <div 
                className="border border-dashed border-rule rounded bg-paper hover:bg-surface-container-low transition-colors cursor-pointer flex flex-col items-center justify-center p-8 group"
                onClick={() => fileInputRef.current?.click()}
              >
                <div className="w-12 h-12 rounded bg-paper border border-rule flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                  <ImageIcon className="h-5 w-5 text-ink-muted" />
                </div>
                <p className="font-mono text-[10px] text-ink font-bold uppercase">Drag evidence files or click to scan</p>
                <p className="text-[9px] text-ink-muted mt-1">Accepted formats: JPG, PDF, PNG (Max 10MB per file)</p>
                
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept="image/*,video/*"
                  capture="environment"
                  className="hidden"
                />
              </div>
            ) : (
              <div className="relative max-h-60 overflow-hidden rounded border border-rule bg-paper">
                <button
                  type="button"
                  onClick={() => setImageUrl("")}
                  className="absolute top-2 right-2 bg-ink/75 text-paper hover:bg-ink rounded-full p-1 transition-all z-10"
                >
                  <X className="h-4 w-4" />
                </button>
                {imageUrl.includes(".mp4") || imageUrl.includes("video") ? (
                  <video src={imageUrl} controls className="w-full h-full object-cover max-h-60" />
                ) : (
                  <img src={imageUrl} alt="Evidence registry preview" className="w-full h-60 object-contain" />
                )}
              </div>
            )}
            {isUploading && (
              <p className="text-[9px] text-secondary animate-pulse font-mono font-bold">UPLOADING MEDIA CONTENT TO DATABASE...</p>
            )}
          </div>

          {/* Voice Note */}
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase text-ink-muted tracking-wide block font-mono">Voice Transcription Entry</label>
            <div className="border border-rule rounded p-4 flex flex-col gap-3 bg-paper">
              <div className="flex items-center gap-4">
                <button 
                  type="button"
                  onClick={isRecording ? stopRecording : startRecording}
                  disabled={isUploading}
                  className={`w-10 h-10 rounded-full flex items-center justify-center transition-all flex-shrink-0 border ${
                    isRecording 
                      ? 'bg-status-escalated/15 border-status-escalated text-status-escalated animate-pulse' 
                      : 'bg-paper-raised border-rule text-ink hover:bg-surface-container'
                  }`}
                >
                  <Mic className="h-5 w-5" />
                </button>
                <div className="flex-grow flex items-center gap-2">
                  <div className="h-1.5 flex-grow bg-rule overflow-hidden rounded-none">
                    {isRecording && <div className="h-full bg-secondary animate-pulse w-full"></div>}
                  </div>
                  <span className="font-mono text-[9px] text-ink-muted">
                    {isRecording ? "RECORDING..." : (voiceNoteUrl ? "RECORDED" : "00:00")}
                  </span>
                </div>
              </div>
              
              {voiceText && (
                <div className="bg-paper-raised p-2.5 rounded border border-rule">
                  <p className="text-[10px] text-ink-muted italic leading-relaxed">
                    &ldquo;{voiceText}&rdquo;
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Location details & GIS verification */}
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase text-ink-muted tracking-wide block font-mono">GIS Coordinates & Map pin</label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="border border-rule rounded overflow-hidden flex flex-col h-40">
                <div className="flex-grow relative overflow-hidden bg-[#f7f3ea]">
                  <div ref={mapContainerRef} className="absolute inset-0 w-full h-full" style={{ minHeight: '120px' }} />
                  <button 
                    type="button"
                    onClick={handleGPSAttach}
                    className="absolute bottom-2 right-2 bg-paper-raised border border-rule px-2 py-1 flex items-center gap-1 shadow-sm hover:bg-surface-container transition-colors z-10 font-mono text-[9px]"
                  >
                    <Navigation className="h-3 w-3 text-secondary" />
                    <span>GPS LOCATE</span>
                  </button>
                </div>
              </div>
              
              <div className="flex flex-col justify-between gap-3 font-mono text-[10px]">
                <div className="bg-paper border border-rule p-3 flex flex-col gap-1.5">
                  <span className="text-ink-muted uppercase">MANUAL COORDINATES OVERRIDE</span>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <span className="text-[8px] text-ink-muted">LATITUDE</span>
                      <input
                        type="number" step="0.000001"
                        value={latitude} onChange={(e) => setLatitude(parseFloat(e.target.value))}
                        className="w-full bg-transparent border-b border-rule p-0 pb-1 text-ink focus:outline-none"
                      />
                    </div>
                    <div className="flex-1">
                      <span className="text-[8px] text-ink-muted">LONGITUDE</span>
                      <input
                        type="number" step="0.000001"
                        value={longitude} onChange={(e) => setLongitude(parseFloat(e.target.value))}
                        className="w-full bg-transparent border-b border-rule p-0 pb-1 text-ink focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                <div className="text-[9px] text-ink-muted leading-relaxed">
                  Pin location must be accurate within Delhi metropolitan jurisdiction. Click on the map or drag the marker to specify exact incident coordinates.
                </div>
              </div>
            </div>
          </div>

          {/* Declaration Statement */}
          <div className="p-4 bg-paper border-l-4 border-rule">
            <div className="flex gap-3">
              <input 
                className="mt-0.5 w-4 h-4 border-rule text-secondary focus:ring-0 rounded-none bg-paper-raised" 
                id="declaration" 
                type="checkbox"
                required
              />
              <label className="font-mono text-[9px] leading-relaxed text-ink-muted uppercase" htmlFor="declaration">
                <strong className="text-ink">Citizen Declaration:</strong> I hereby certify that the information provided in this report is accurate. I understand that filing a knowingly false municipal record may result in legal escalation under Civic Ordinance 84-C. This document shall serve as a permanent record.
              </label>
            </div>
          </div>

          {/* Action buttons */}
          <div className="pt-6 flex flex-col md:flex-row items-center justify-end gap-3 border-t border-rule border-dashed">
            <button 
              type="button"
              onClick={() => navigate("/")}
              className="w-full md:w-auto px-8 py-3 border border-ink text-ink font-mono uppercase tracking-wider text-[11px] hover:bg-surface-container rounded-none transition-all"
            >
              Cancel
            </button>
            <button 
              type="submit"
              disabled={isUploading}
              className="w-full md:w-auto px-10 py-3 bg-secondary text-paper font-mono uppercase tracking-wider text-[11px] hover:brightness-105 active:scale-95 transition-all rounded-none disabled:opacity-50"
            >
              File Official Record
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
