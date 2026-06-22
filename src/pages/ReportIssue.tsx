import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { dbService } from "../services/db";
import { authService } from "../services/auth";
import { intakeAgent } from "../services/agents/intake";
import { verificationAgent } from "../services/agents/verification";
import { routingAgent } from "../services/agents/routing";
import { MapPin, Image as ImageIcon, Mic, Sparkles, Navigation, Send, CheckCircle2 } from "lucide-react";

// Pre-set demo assets to let the user easily demo different agents
const DEMO_PRESETS = [
  {
    name: "Demo Pothole",
    image: "https://images.unsplash.com/photo-1515162305285-0293e4767cc2?auto=format&fit=crop&q=80&w=800",
    desc: "Extremely deep pothole in the middle of the driving lane. Cars are swerving dangerously to avoid it.",
    lat: 28.6189,
    lng: 77.2030,
    ward: "Ward 1 (Central)"
  },
  {
    name: "Demo Water Leakage",
    image: "https://images.unsplash.com/photo-1542060748-10c28b629f6f?auto=format&fit=crop&q=80&w=800",
    desc: "High pressure water pipe leak on the corner of the block. Clean drinking water is gushing out.",
    lat: 28.6273,
    lng: 77.2245,
    ward: "Ward 2 (West)"
  },
  {
    name: "Demo Broken Streetlight",
    image: "https://images.unsplash.com/photo-1509021436665-8f37df706a73?auto=format&fit=crop&q=80&w=800",
    desc: "The street light pole is completely dead. Entire footpath is unsafe after sunset.",
    lat: 28.5911,
    lng: 77.1855,
    ward: "Ward 3 (East)"
  }
];

export const ReportIssue: React.FC = () => {
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [latitude, setLatitude] = useState<number>(28.6139);
  const [longitude, setLongitude] = useState<number>(77.2090);
  const [ward, setWard] = useState("Ward 1 (Central)");
  const [voiceText, setVoiceText] = useState("");
  const [isRecording, setIsRecording] = useState(false);

  // Agent Chain Running States
  const [agentStep, setAgentStep] = useState<
    "idle" | "intake" | "verify" | "route" | "done"
  >("idle");
  const [loadingText, setLoadingText] = useState("");

  const navigate = useNavigate();
  const currentUser = authService.getCurrentUser();

  const handleSimulateVoice = () => {
    setIsRecording(true);
    setTimeout(() => {
      setVoiceText("Priority road defect: Severe pothole reported right next to the public school gate.");
      setIsRecording(false);
    }, 1200);
  };

  const handleSelectPreset = (preset: typeof DEMO_PRESETS[0]) => {
    setDescription(preset.desc);
    setImageUrl(preset.image);
    setLatitude(preset.lat);
    setLongitude(preset.lng);
    setWard(preset.ward);
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
      // Step 1: Intake Agent
      setAgentStep("intake");
      setLoadingText("Intake Agent: Classifying category & estimating severity...");
      const intakeRes = await intakeAgent.processReport(
        description,
        latitude,
        longitude,
        voiceText,
        imageUrl || "https://images.unsplash.com/photo-1611284446314-60a58ac0deb9?auto=format&fit=crop&q=80&w=800"
      );

      // Save initial issue
      setLoadingText("Intake Agent: Logging ticket in database...");
      const issue = await dbService.createIssue({
        title: intakeRes.title,
        category: intakeRes.category,
        description: description,
        severity: intakeRes.severity,
        status: "REPORTED",
        location: intakeRes.landmarks || "Civic location",
        latitude,
        longitude,
        ward,
        createdBy: currentUser.id,
        createdByName: currentUser.name,
        mediaUrls: [imageUrl || "https://images.unsplash.com/photo-1611284446314-60a58ac0deb9?auto=format&fit=crop&q=80&w=800"],
        voiceTranscript: voiceText || undefined,
        urgencyScore: 20,
        slaDays: intakeRes.category === "Garbage" ? 3 : intakeRes.category === "Streetlight" ? 5 : intakeRes.category === "Pothole" ? 7 : intakeRes.category === "Water Leakage" ? 2 : 1
      });

      // Step 2: Verification Agent
      setAgentStep("verify");
      setLoadingText("Verification Agent: Scanning 50m radius for overlapping active threads...");
      const verifyRes = await verificationAgent.verifyIssue(issue.id);

      // Step 3: Routing Agent
      setAgentStep("route");
      setLoadingText("Routing Agent: Matching department & drafting formal dispatches...");
      await routingAgent.routeIssue(issue.id);

      // Step 4: Award Points
      await authService.awardPoints(currentUser.id, 50, "report");

      setAgentStep("done");
      setLoadingText("Success! Issue registered, verified, and routed successfully.");
      
      setTimeout(() => {
        navigate(`/issues/${issue.id}`);
      }, 1500);
    } catch (err: any) {
      console.error(err);
      alert("Agent routing error: " + err.message);
      setAgentStep("idle");
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
      {/* Step Overlay */}
      {agentStep !== "idle" && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 md:p-8 max-w-md w-full shadow-2xl text-center space-y-6">
            <div className="flex justify-center">
              {agentStep === "done" ? (
                <div className="h-16 w-16 bg-green-50 border border-green-200 text-green-600 rounded-full flex items-center justify-center">
                  <CheckCircle2 className="h-8 w-8" />
                </div>
              ) : (
                <div className="h-16 w-16 bg-teal-50 text-primary border border-teal-100 rounded-full flex items-center justify-center animate-spin">
                  <Sparkles className="h-8 w-8" />
                </div>
              )}
            </div>

            <div className="space-y-2 text-left">
              <h3 className="text-lg font-bold text-slate-800 text-center">
                {agentStep === "done" ? "Platform Loop Completed" : "Cooperative AI Agents Processing"}
              </h3>
              <p className="text-xs text-slate-500 text-center font-medium leading-relaxed">
                {loadingText}
              </p>
            </div>

            {/* Stepper progress indicator */}
            <div className="flex items-center justify-center gap-1">
              <span className={`h-1.5 w-8 rounded-full bg-primary`}></span>
              <span className={`h-1.5 w-8 rounded-full ${agentStep === "verify" || agentStep === "route" || agentStep === "done" ? "bg-primary" : "bg-slate-200"}`}></span>
              <span className={`h-1.5 w-8 rounded-full ${agentStep === "route" || agentStep === "done" ? "bg-primary" : "bg-slate-200"}`}></span>
              <span className={`h-1.5 w-8 rounded-full ${agentStep === "done" ? "bg-emerald-500" : "bg-slate-200"}`}></span>
            </div>
          </div>
        </div>
      )}

      {/* Preset Demos */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 mb-8 text-left shadow-sm">
        <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          Quick Demo Presets
        </h3>
        <p className="text-[11px] text-slate-500 leading-tight mb-4">
          Select a preset to auto-fill the report form with mock coordinates and description to verify our AI Intake & duplicate verification agents immediately.
        </p>
        <div className="flex flex-wrap gap-2.5">
          {DEMO_PRESETS.map((preset) => (
            <button
              key={preset.name}
              onClick={() => handleSelectPreset(preset)}
              type="button"
              className="bg-white hover:bg-slate-100 border border-slate-200 text-xs font-bold text-slate-700 py-2 px-3 rounded-lg shadow-sm transition-all"
            >
              {preset.name}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden text-left">
        <div className="government-banner"></div>
        <div className="p-6 md:p-8">
          <h2 className="text-xl font-bold tracking-tight text-slate-800 mb-2">
            Log Civic Incident Report
          </h2>
          <p className="text-xs text-slate-400 mb-6">
            Citizen reports are logged and routed to corresponding city departments autonomously.
          </p>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Description */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-700">Issue Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe the issue, defect, or safety concern. (e.g. Large pothole on main road lane 4 opposite the central park gate...)"
                rows={4}
                required
                className="bg-slate-50 border border-slate-200 text-slate-800 text-xs rounded-xl p-3 focus:outline-none focus:ring-1 focus:ring-primary leading-relaxed"
              />
            </div>

            {/* Voice Notes Simulation */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-slate-700">Audio Voice Note (Optional)</label>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleSimulateVoice}
                  disabled={isRecording}
                  className={`py-2 px-3.5 border rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                    isRecording
                      ? "bg-red-50 border-red-200 text-red-600 animate-pulse"
                      : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  <Mic className="h-4 w-4" />
                  {isRecording ? "Transcribing Audio..." : "Record Voice Note"}
                </button>
                {voiceText && (
                  <span className="text-[10px] text-green-600 bg-green-50 border border-green-100 px-2.5 py-1 rounded-full font-bold">
                    Voice Note Added
                  </span>
                )}
              </div>
              {voiceText && (
                <p className="text-[11px] text-slate-500 italic bg-slate-50 border border-slate-100 rounded-lg p-2.5 leading-relaxed">
                  "{voiceText}"
                </p>
              )}
            </div>

            {/* Image URL Input */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-700">Report Photo (Image URL)</label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <ImageIcon className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <input
                    type="url"
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    placeholder="https://example.com/pothole.jpg (or select preset above)"
                    className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-xs rounded-xl pl-9 pr-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>
              {imageUrl && (
                <div className="mt-2.5 max-h-48 overflow-hidden rounded-xl border border-slate-100">
                  <img src={imageUrl} alt="Incident preview" className="w-full h-full object-cover" />
                </div>
              )}
            </div>

            {/* Coordinate Locators */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-700">Latitude</label>
                <input
                  type="number"
                  step="0.0001"
                  value={latitude}
                  onChange={(e) => setLatitude(parseFloat(e.target.value))}
                  required
                  className="bg-slate-50 border border-slate-200 text-slate-800 text-xs rounded-xl p-2.5 focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-700">Longitude</label>
                <input
                  type="number"
                  step="0.0001"
                  value={longitude}
                  onChange={(e) => setLongitude(parseFloat(e.target.value))}
                  required
                  className="bg-slate-50 border border-slate-200 text-slate-800 text-xs rounded-xl p-2.5 focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-700">Target Ward</label>
                <select
                  value={ward}
                  onChange={(e) => setWard(e.target.value)}
                  className="bg-slate-50 border border-slate-200 text-slate-700 text-xs rounded-xl p-2.5 focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="Ward 1 (Central)">Ward 1 (Central)</option>
                  <option value="Ward 2 (West)">Ward 2 (West)</option>
                  <option value="Ward 3 (East)">Ward 3 (East)</option>
                  <option value="Ward 4 (South)">Ward 4 (South)</option>
                </select>
              </div>
            </div>

            <button
              type="submit"
              className="w-full bg-primary hover:bg-primary-hover text-white text-sm font-bold py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 shadow-md transition-all border border-teal-700/25"
            >
              <Send className="h-4 w-4" />
              Dispatch Incident Report to AI Agents
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
