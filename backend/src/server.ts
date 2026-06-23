import express, { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import multer from "multer";
import { GridFSBucket, ObjectId } from "mongodb";
import { Readable } from "stream";
import http from "http";
import { WebSocketServer, WebSocket } from "ws";

// Load models and agents
import { User, Report, Issue, Department, AgentLog, Config, SimulationState, Notification } from "./models";
import { intakeAgent, verificationAgent, routingAgent, escalationAgent, setWsNotifier, notifyCollectionChange } from "./agents";

// Load environment variables
const envPath = path.resolve(__dirname, "../.env");
dotenv.config({ path: envPath });

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/nagrik";
const JWT_SECRET = process.env.JWT_SECRET || "nagrik_developer_token_key_change_me";
const CORS_ORIGIN = process.env.CORS_ORIGIN || "http://localhost:5173";

app.use(cors({
  origin: CORS_ORIGIN.split(",").map(o => o.trim()),
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));
app.use(express.json());

// Set up Multer for memory storage uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 } // 25MB cap
});

// ==========================================
// WEBSOCKET & CHANGE STREAMS REAL-TIME RELAY
// ==========================================
const wss = new WebSocketServer({ server });
const clients = new Set<WebSocket>();

wss.on("connection", (ws: WebSocket) => {
  console.log("[WebSocket] Client connected");
  clients.add(ws);

  ws.on("close", () => {
    console.log("[WebSocket] Client disconnected");
    clients.delete(ws);
  });
});

function broadcastEvent(payload: any) {
  const message = JSON.stringify(payload);
  clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

// Set up Mongoose notifier callback (Fallback Mode)
setWsNotifier((collectionName) => {
  console.log(`[WebSocket Helper] Programmatic broadcast for collection: ${collectionName}`);
  broadcastEvent({ collection: collectionName, type: "change" });
});

// Attempt to initialize Native MongoDB Change Streams (Replica Set mode)
mongoose.connection.once("open", () => {
  console.log("[MongoDB] Initializing Change Streams check...");
  try {
    const issuesStream = mongoose.connection.collection("issues").watch();
    issuesStream.on("change", (change) => {
      console.log("[Change Stream] Broadcast change in issues collection");
      broadcastEvent({ collection: "issues", type: "change" });
    });
    issuesStream.on("error", (err) => {
      console.warn("[MongoDB] Change stream error on 'issues' (likely standalone server). Native Change Streams disabled for 'issues'.");
    });

    const logsStream = mongoose.connection.collection("agent_logs").watch();
    logsStream.on("change", (change) => {
      console.log("[Change Stream] Broadcast change in agent_logs collection");
      broadcastEvent({ collection: "agent_logs", type: "change" });
    });
    logsStream.on("error", (err) => {
      console.warn("[MongoDB] Change stream error on 'agent_logs' (likely standalone server). Native Change Streams disabled for 'agent_logs'.");
    });

    const notificationsStream = mongoose.connection.collection("notifications").watch();
    notificationsStream.on("change", (change) => {
      console.log("[Change Stream] Broadcast change in notifications collection");
      broadcastEvent({ collection: "notifications", type: "change" });
    });
    notificationsStream.on("error", (err) => {
      console.warn("[MongoDB] Change stream error on 'notifications' (likely standalone server). Native Change Streams disabled for 'notifications'.");
    });
  } catch (err) {
    console.warn(
      "[MongoDB] Standalone server detected. Native Change Streams are disabled. Using local programmatic fallback emitter."
    );
  }
});

// ==========================================
// JWT AUTHENTICATION MIDDLEWARE
// ==========================================
interface AuthRequest extends Request {
  userId?: string;     // authUserId
  userDocId?: string;   // Mongoose ObjectId string
  userRole?: "citizen" | "staff";
}

const authenticateToken = (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) return res.status(401).json({ message: "Authentication token required" });

  jwt.verify(token, JWT_SECRET, (err: any, decoded: any) => {
    if (err) return res.status(403).json({ message: "Invalid or expired token" });
    req.userId = decoded.userId;
    req.userDocId = decoded.userDocId;
    req.userRole = decoded.role;
    next();
  });
};

// ==========================================
// MODEL TO FRONTEND PRESENTATION FORMAT MAPPERS
// ==========================================
function mapIssueToFrontend(issue: any) {
  const data = issue.toObject ? issue.toObject() : issue;
  
  // Category mapping back to UI uppercase labels
  let category: string = "Garbage";
  if (data.category === "pothole") category = "Pothole";
  else if (data.category === "water_leak") category = "Water Leakage";
  else if (data.category === "streetlight") category = "Streetlight";
  else if (data.category === "garbage") category = "Garbage";
  else if (data.category === "drainage") category = "Drainage";
  else if (data.category === "road_damage") category = "Road Damage";
  else if (data.category === "other") category = "Critical Infrastructure";

  // Severity mapping
  const severity: string = (data.severity || "moderate").toUpperCase();

  // Status mapping
  let status: string = "REPORTED";
  if (data.status === "verifying") status = "REPORTED";
  else if (data.status === "routed") status = "ROUTED";
  else if (data.status === "in_progress") status = "IN_PROGRESS";
  else if (data.status === "escalated") status = "ESCALATED";
  else if (data.status === "resolved") status = "RESOLVED";
  else if (data.status === "duplicate_merged") status = "DUPLICATE_MERGED";

  return {
    id: data._id.toString(),
    title: data.title,
    category,
    description: data.description,
    severity,
    status,
    location: data.location?.address || "Coordinate Location",
    latitude: data.location?.coordinates?.[1] || 0,
    longitude: data.location?.coordinates?.[0] || 0,
    ward: data.location?.ward || "Ward 1 (Central)",
    createdBy: data.reportedBy?.[0]?.toString() || "",
    createdByName: "Citizen",
    mediaUrls: data.media?.photoUrl ? [data.media.photoUrl] : (data.media?.videoUrl ? [data.media.videoUrl] : []),
    voiceTranscript: data.media?.voiceTranscript || undefined,
    urgencyScore: data.urgencyScore || 20,
    threadId: data.parentIssueId?.toString() || undefined,
    departmentId: data.departmentId?.toString() || undefined,
    slaDays: data.category === "water_leak" ? 2 : (data.category === "garbage" ? 3 : (data.category === "streetlight" ? 5 : 7)),
    createdAt: data.createdAt?.toISOString?.() || new Date(data.createdAt).toISOString(),
    updatedAt: data.updatedAt?.toISOString?.() || new Date(data.updatedAt).toISOString()
  };
}

function mapReportToFrontend(report: any) {
  const data = report.toObject ? report.toObject() : report;
  return {
    id: data._id.toString(),
    userId: data.userId.toString(),
    rawMediaUrl: data.rawMediaUrl,
    mediaType: data.mediaType,
    voiceNoteUrl: data.voiceNoteUrl,
    userTextNote: data.userTextNote,
    latitude: data.location?.coordinates?.[1] || 0,
    longitude: data.location?.coordinates?.[0] || 0,
    issueId: data.issueId?.toString() || null,
    processingStatus: data.processingStatus,
    createdAt: data.createdAt?.toISOString?.() || new Date(data.createdAt).toISOString()
  };
}

function mapAgentLogToFrontend(log: any) {
  const data = log.toObject ? log.toObject() : log;
  
  let agentName = "Intake Agent";
  if (data.agentName === "intake") agentName = "Intake Agent";
  else if (data.agentName === "verification") agentName = "Verification Agent";
  else if (data.agentName === "routing") agentName = "Routing Agent";
  else if (data.agentName === "escalation") agentName = "Escalation Agent";

  return {
    id: data._id.toString(),
    timestamp: data.timestamp?.toISOString?.() || new Date(data.timestamp).toISOString(),
    agentName,
    issueId: data.issueId?.toString() || undefined,
    action: data.action,
    details: data.outputSummary || data.errorMessage || "",
    type: data.success ? (data.agentName === "escalation" && !data.success ? "error" : "success") : "error"
  };
}

// ==========================================
// 1. AUTH API ENDPOINTS
// ==========================================
app.post("/api/auth/register", async (req: Request, res: Response) => {
  const { name, email, password } = req.body;
  try {
    const existing = await User.findOne({ authUserId: email });
    if (existing) return res.status(400).json({ message: "Email already registered" });

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = await User.create({
      authUserId: email,
      displayName: name,
      role: "citizen",
      authProvider: "email",
      fcmToken: hashedPassword // store hashed password as unique verification locally
    });

    const token = jwt.sign({
      userId: newUser.authUserId,
      userDocId: newUser._id.toString(),
      role: newUser.role
    }, JWT_SECRET, { expiresIn: "7d" });

    res.status(201).json({
      token,
      user: {
        id: newUser._id.toString(),
        name: newUser.displayName,
        role: newUser.role,
        points: newUser.civicPoints
      }
    });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

app.post("/api/auth/login", async (req: Request, res: Response) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ authUserId: email });
    if (!user || user.authProvider !== "email") {
      return res.status(400).json({ message: "User not found or unverified email" });
    }

    const validPass = await bcrypt.compare(password, user.fcmToken || "");
    if (!validPass) return res.status(400).json({ message: "Invalid password" });

    const token = jwt.sign({
      userId: user.authUserId,
      userDocId: user._id.toString(),
      role: user.role
    }, JWT_SECRET, { expiresIn: "7d" });

    res.status(200).json({
      token,
      user: {
        id: user._id.toString(),
        name: user.displayName,
        role: user.role,
        points: user.civicPoints
      }
    });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

app.post("/api/auth/anonymous", async (req: Request, res: Response) => {
  try {
    const anonId = "anon_" + new ObjectId().toString();
    const newUser = await User.create({
      authUserId: anonId,
      displayName: "Citizen",
      role: "citizen",
      authProvider: "anonymous"
    });

    const token = jwt.sign({
      userId: newUser.authUserId,
      userDocId: newUser._id.toString(),
      role: newUser.role
    }, JWT_SECRET, { expiresIn: "7d" });

    res.status(201).json({
      token,
      user: {
        id: newUser._id.toString(),
        name: newUser.displayName,
        role: newUser.role,
        points: newUser.civicPoints
      }
    });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

app.get("/api/auth/profile", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findById(req.userDocId);
    if (!user) return res.status(404).json({ message: "Profile not found" });
    res.status(200).json({
      id: user._id.toString(),
      name: user.displayName,
      role: user.role,
      points: user.civicPoints,
      reportsCount: user.reportsCount,
      confirmationsCount: user.confirmationsCount
    });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// ==========================================
// 2. GRIDFS MEDIA STREAMING ENDPOINTS
// ==========================================
app.post("/api/media/upload", upload.single("file"), async (req: Request, res: Response) => {
  if (!req.file) {
    return res.status(400).json({ message: "No file attachment provided" });
  }

  const mimeType = req.file.mimetype;
  const size = req.file.size;

  // Validation cap
  if (size > 25 * 1024 * 1024) {
    return res.status(400).json({ message: "File size exceeds 25MB cap" });
  }
  if (!/^(image|video|audio)\//.test(mimeType)) {
    return res.status(400).json({ message: "Unsupported file MIME type" });
  }

  try {
    const db = mongoose.connection.db!;
    const bucket = new GridFSBucket(db, { bucketName: "media" });
    const filename = `${Date.now()}_${req.file.originalname}`;
    
    const uploadStream = bucket.openUploadStream(filename, {
      contentType: mimeType
    });

    Readable.from(req.file.buffer).pipe(uploadStream);

    await new Promise((resolve, reject) => {
      uploadStream.on("finish", resolve);
      uploadStream.on("error", reject);
    });

    const downloadUrl = `http://localhost:${PORT}/api/media/${uploadStream.id}`;
    res.status(201).json({
      fileId: uploadStream.id.toString(),
      downloadUrl
    });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

app.get("/api/media/:fileId", async (req: Request, res: Response) => {
  try {
    const fileId = new ObjectId(req.params.fileId);
    const db = mongoose.connection.db!;
    const bucket = new GridFSBucket(db, { bucketName: "media" });

    // Stream download
    res.setHeader("Cache-Control", "public, max-age=31536000");
    const downloadStream = bucket.openDownloadStream(fileId);
    downloadStream.on("error", () => {
      res.status(404).json({ message: "Media file not found" });
    });
    downloadStream.pipe(res);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// ==========================================
// 3. INCIDENTS / REPORTS / ISSUES ENDPOINTS
// ==========================================
app.post("/api/issues/create", authenticateToken, async (req: AuthRequest, res: Response) => {
  const { mediaType, rawMediaUrl, voiceNoteUrl, userTextNote, location } = req.body;
  if (!rawMediaUrl || !location || typeof location.lat !== "number" || typeof location.lng !== "number") {
    return res.status(400).json({ message: "Missing required fields (rawMediaUrl, location)." });
  }

  try {
    const user = await User.findById(req.userDocId);
    if (!user) return res.status(404).json({ message: "User profile not found." });

    const globalConfig = await Config.findById("global") || {
      civicPointsPerReport: 10
    };

    // Save report document (GeoJSON order [lng, lat])
    const report = await Report.create({
      userId: user._id,
      rawMediaUrl,
      mediaType,
      voiceNoteUrl: voiceNoteUrl || null,
      userTextNote: userTextNote || null,
      location: {
        type: "Point",
        coordinates: [location.lng, location.lat]
      },
      issueId: null,
      processingStatus: "pending",
      createdAt: new Date()
    });

    // Transactionally increment user counter
    user.reportsCount += 1;
    user.civicPoints += globalConfig.civicPointsPerReport;
    await user.save();

    notifyCollectionChange("reports");
    notifyCollectionChange("users");

    // Call Intake Agent synchronously to process & run pipeline trigger
    intakeAgent.process(report._id as mongoose.Types.ObjectId).catch(console.error);

    res.status(201).json({
      reportId: report._id.toString(),
      processingStatus: "pending"
    });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

app.get("/api/issues", async (req: Request, res: Response) => {
  try {
    const issues = await Issue.find().sort({ createdAt: -1 });
    const mapped = issues.map(mapIssueToFrontend);
    res.status(200).json(mapped);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

app.get("/api/issues/:id", async (req: Request, res: Response) => {
  try {
    const issue = await Issue.findById(req.params.id);
    if (!issue) return res.status(404).json({ message: "Issue not found" });
    res.status(200).json(mapIssueToFrontend(issue));
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

app.post("/api/issues/:id/confirm", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const issue = await Issue.findById(req.params.id);
    if (!issue) return res.status(404).json({ message: "Issue not found." });

    const user = await User.findById(req.userDocId);
    if (!user) return res.status(404).json({ message: "User not found." });

    const globalConfig = await Config.findById("global") || {
      civicPointsPerConfirmation: 5
    };

    const reporterId = user._id as mongoose.Types.ObjectId;
    const reportedBy = issue.reportedBy || [];

    if (!reportedBy.some((id: any) => id.toString() === reporterId.toString())) {
      reportedBy.push(reporterId);
    }

    const newConfirmationCount = issue.confirmationCount + 1;
    const severityWeights: Record<string, number> = { low: 1, moderate: 2, high: 3, critical: 5 };
    const weight = severityWeights[issue.severity] || 2;
    const newUrgencyScore = weight * newConfirmationCount * (issue.isEscalated ? 1.5 : 1);

    await Issue.findByIdAndUpdate(issue._id, {
      reportedBy,
      confirmationCount: newConfirmationCount,
      urgencyScore: newUrgencyScore,
      updatedAt: new Date()
    });

    user.civicPoints += globalConfig.civicPointsPerConfirmation;
    user.confirmationsCount += 1;
    await user.save();

    await AgentLog.create({
      agentName: "verification",
      issueId: issue._id as mongoose.Types.ObjectId,
      reportId: null,
      action: "citizen_upvote",
      inputSummary: `Citizen upvote added by user ${user._id}`,
      outputSummary: `Confirmation count increased to ${newConfirmationCount}. Urgency: ${newUrgencyScore}`,
      success: true,
      errorMessage: null,
      timestamp: new Date()
    });

    notifyCollectionChange("issues");
    notifyCollectionChange("agent_logs");
    notifyCollectionChange("users");

    res.status(200).json({
      success: true,
      newConfirmationCount
    });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

app.post("/api/issues/:id/resolve", authenticateToken, async (req: AuthRequest, res: Response) => {
  // Enforce staff access control
  if (req.userRole !== "staff") {
    return res.status(403).json({ message: "Only staff accounts can resolve issues." });
  }

  const { status } = req.body;
  // Enforce status must specifically equal resolved
  if (status !== "resolved") {
    return res.status(400).json({ message: "Status update must specifically equal 'resolved'" });
  }

  try {
    const issue = await Issue.findById(req.params.id);
    if (!issue) return res.status(404).json({ message: "Issue not found." });

    issue.status = "resolved";
    issue.resolvedAt = new Date();
    issue.resolvedBy = new ObjectId(req.userDocId);
    issue.updatedAt = new Date();
    await issue.save();

    // Notify all users who reported or upvoted/confirmed this issue
    if (issue.reportedBy && issue.reportedBy.length > 0) {
      const usersToNotify = await User.find({ _id: { $in: issue.reportedBy } });
      for (const u of usersToNotify) {
        await Notification.create({
          userId: u.authUserId,
          title: "Issue Resolved",
          body: `Good news! The issue "${issue.title}" has been resolved by city staff.`,
          read: false
        });
      }
      notifyCollectionChange("notifications");
    }

    await AgentLog.create({
      agentName: "verification",
      issueId: issue._id as mongoose.Types.ObjectId,
      reportId: null,
      action: "issue_resolved",
      inputSummary: `Staff resolved issue: ${req.userDocId}`,
      outputSummary: `Issue marked as resolved manually by human staff override.`,
      success: true,
      errorMessage: null,
      timestamp: new Date()
    });

    notifyCollectionChange("issues");
    notifyCollectionChange("agent_logs");

    res.status(200).json({ success: true });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// ==========================================
// 4. METRICS / TELEMETRY / SYSTEM API
// ==========================================
app.get("/api/dashboard/stats", async (req: Request, res: Response) => {
  try {
    const issues = await Issue.find({ status: { $ne: "duplicate_merged" } });
    
    let totalIssues = 0;
    let resolvedCount = 0;
    let escalatedCount = 0;
    let activeCount = 0;
    
    const byCategory: Record<string, number> = {};
    const byStatus: Record<string, number> = {};
    const hotspots: { lat: number; lng: number; weight: number }[] = [];

    issues.forEach((item) => {
      totalIssues++;
      if (item.status === "resolved") resolvedCount++;
      else if (item.status === "escalated") escalatedCount++;
      else activeCount++;

      const cat = item.category || "other";
      byCategory[cat] = (byCategory[cat] || 0) + 1;

      const status = item.status || "verifying";
      byStatus[status] = (byStatus[status] || 0) + 1;

      if (item.location && item.location.coordinates) {
        hotspots.push({
          lat: item.location.coordinates[1],
          lng: item.location.coordinates[0],
          weight: item.urgencyScore || 20
        });
      }
    });

    res.status(200).json({
      totalIssues,
      resolvedCount,
      avgResolutionTimeHours: 18,
      byCategory,
      byStatus,
      hotspots
    });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

app.get("/api/dashboard/leaderboard", async (req: Request, res: Response) => {
  try {
    const users = await User.find({ authProvider: "email" }).sort({ civicPoints: -1 }).limit(10);
    const mapped = users.map(user => ({
      id: user._id.toString(),
      name: user.displayName,
      points: user.civicPoints,
      reportsCount: user.reportsCount,
      confirmationsCount: user.confirmationsCount
    }));
    res.status(200).json(mapped);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

app.get("/api/agent-logs", async (req: Request, res: Response) => {
  try {
    const logs = await AgentLog.find().sort({ timestamp: -1 }).limit(100);
    const mapped = logs.map(mapAgentLogToFrontend);
    res.status(200).json(mapped);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

app.post("/api/agent-logs/clear", async (req: Request, res: Response) => {
  try {
    await AgentLog.deleteMany({});
    notifyCollectionChange("agent_logs");
    res.status(200).json({ message: "Logs cleared" });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

app.post("/api/agents/escalate", async (req: Request, res: Response) => {
  try {
    const escalated = await escalationAgent.sweep();
    res.status(200).json({ success: true, escalatedCount: escalated });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

app.get("/api/my-reports", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const reports = await Report.find({ userId: req.userDocId }).sort({ createdAt: -1 });
    const mapped = [];

    for (const report of reports) {
      let linkedIssue = null;
      if (report.issueId) {
        const issue = await Issue.findById(report.issueId);
        if (issue) {
          linkedIssue = mapIssueToFrontend(issue);
        }
      }
      mapped.push({
        ...mapReportToFrontend(report),
        issue: linkedIssue
      });
    }

    res.status(200).json(mapped);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// ==========================================
// 4.5. ADDED ROUTES FOR FRONTEND INTEGRATION
// ==========================================
app.get("/api/departments", async (req: Request, res: Response) => {
  try {
    const depts = await Department.find();
    res.status(200).json(depts.map((d: any) => {
      const data = d.toObject ? d.toObject() : d;
      return {
        id: data._id.toString(),
        name: data.name,
        category: data.category,
        ward: data.ward,
        email: data.contactEmail,
        contactNumber: data.contactPhone || ""
      };
    }));
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

app.get("/api/complaints", async (req: Request, res: Response) => {
  try {
    const issues = await Issue.find({
      departmentId: { $ne: null },
      draftedComplaint: { $ne: null }
    }).sort({ updatedAt: -1 });

    const complaints = issues.map((issue: any) => {
      let status: 'PENDING' | 'SENT' | 'ACKNOWLEDGED' = 'PENDING';
      if (issue.status === 'resolved') {
        status = 'ACKNOWLEDGED';
      } else if (['routed', 'in_progress', 'escalated'].includes(issue.status)) {
        status = 'SENT';
      }
      return {
        id: `complaint_${issue._id}`,
        issueId: issue._id.toString(),
        departmentId: issue.departmentId.toString(),
        generatedComplaint: issue.draftedComplaint,
        status,
        createdAt: issue.updatedAt?.toISOString() || new Date(issue.updatedAt).toISOString()
      };
    });

    res.status(200).json(complaints);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

app.get("/api/escalations", async (req: Request, res: Response) => {
  try {
    const issues = await Issue.find({
      $or: [
        { isEscalated: true },
        { escalationNotice: { $ne: null } },
        { escalationCount: { $gt: 0 } }
      ]
    }).sort({ updatedAt: -1 });

    const escalations = issues.map((issue: any) => {
      return {
        id: `escalation_${issue._id}`,
        issueId: issue._id.toString(),
        escalationLevel: (issue.escalationCount || 1) as 1 | 2 | 3,
        generatedNotice: issue.escalationNotice || "Issue SLA breached. Escalated to higher authority.",
        createdAt: issue.updatedAt?.toISOString() || new Date(issue.updatedAt).toISOString()
      };
    });

    res.status(200).json(escalations);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

app.get("/api/notifications", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const notifications = await Notification.find({ userId: req.userId }).sort({ createdAt: -1 });
    res.status(200).json(notifications.map((n: any) => {
      const data = n.toObject ? n.toObject() : n;
      return {
        id: data._id.toString(),
        userId: data.userId,
        title: data.title,
        body: data.body,
        read: data.read,
        createdAt: data.createdAt?.toISOString() || new Date(data.createdAt).toISOString()
      };
    }));
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

app.patch("/api/notifications/:id/read", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const notif = await Notification.findByIdAndUpdate(
      req.params.id,
      { read: true },
      { new: true }
    );
    if (!notif) return res.status(404).json({ message: "Notification not found" });
    notifyCollectionChange("notifications");
    res.status(200).json({ success: true });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// ==========================================
// 5. SIMULATION CONTROLS
// ==========================================
app.post("/api/simulation/fast-forward", async (req: Request, res: Response) => {
  const { days } = req.body;
  if (typeof days !== "number") {
    return res.status(400).json({ message: "days must be a number" });
  }

  try {
    const addedMs = days * 24 * 3600 * 1000;
    let state = await SimulationState.findOne();
    if (!state) state = new SimulationState({ timeOffsetMs: 0 });

    state.timeOffsetMs += addedMs;
    state.updatedAt = new Date();
    await state.save();

    await AgentLog.create({
      agentName: "escalation",
      issueId: null,
      reportId: null,
      action: "fast_forward_simulation",
      inputSummary: `Time fast-forwarded by ${days} days.`,
      outputSummary: `Adjusted backend clock offset. Sweeping SLA compliance...`,
      success: true,
      errorMessage: null,
      timestamp: new Date()
    });

    const escalatedCount = await escalationAgent.sweep();

    res.status(200).json({ success: true, escalatedCount });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

app.post("/api/simulation/reset", async (req: Request, res: Response) => {
  try {
    await SimulationState.findOneAndUpdate({}, { timeOffsetMs: 0 }, { upsert: true });

    await AgentLog.create({
      agentName: "escalation",
      issueId: null,
      reportId: null,
      action: "reset_simulation",
      inputSummary: `Time reset.`,
      outputSummary: `Restored backend clock to normal.`,
      success: true,
      errorMessage: null,
      timestamp: new Date()
    });

    res.status(200).json({ success: true });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// ==========================================
// 6. REFERENCE DATA SEEDING ENDPOINT
// ==========================================
app.post("/api/seed", async (req: Request, res: Response) => {
  try {
    console.log("[MongoDB Seeder] Seeding reference data...");

    // Seeding config
    await Config.findOneAndUpdate(
      { _id: "global" },
      {
        mergeRadiusMeters: 50,
        mergeTimeWindowHours: 72,
        categorySlaHours: {
          pothole: 72,
          water_leak: 24,
          streetlight: 48,
          garbage: 24,
          drainage: 48,
          road_damage: 96,
          other: 72
        },
        escalationIntervalHours: 6,
        civicPointsPerReport: 10,
        civicPointsPerConfirmation: 5
      },
      { upsert: true }
    );

    // Seeding departments
    const seedData = [
      { name: "Ward 1 Roads & PWD Department", category: "pothole", ward: "Ward 1", contactEmail: "roads.ward1@nagrik.gov", contactPhone: "+91 11 2345 6783" },
      { name: "Ward 1 Sanitation & Garbage Board", category: "garbage", ward: "Ward 1", contactEmail: "sanitation.ward1@nagrik.gov", contactPhone: "+91 11 2345 6781" },
      { name: "Ward 1 Electricity and Lighting Division", category: "streetlight", ward: "Ward 1", contactEmail: "power.ward1@nagrik.gov", contactPhone: "+91 11 2345 6782" },
      { name: "Ward 1 Water Supply Board", category: "water_leak", ward: "Ward 1", contactEmail: "water.ward1@nagrik.gov", contactPhone: "+91 11 2345 6784" },
      { name: "Ward 1 Drainage and Sewerage Division", category: "drainage", ward: "Ward 1", contactEmail: "drainage.ward1@nagrik.gov", contactPhone: "+91 11 2345 6785" },
      { name: "Citywide PWD Roads fallback", category: "pothole", ward: "citywide", contactEmail: "pwd.roads@nagrik.gov", contactPhone: "+91 11 2345 0000" },
      { name: "Citywide Water Supply fallback", category: "water_leak", ward: "citywide", contactEmail: "water.city@nagrik.gov", contactPhone: "+91 11 2345 0001" },
      { name: "Citywide Sanitation fallback", category: "garbage", ward: "citywide", contactEmail: "waste.city@nagrik.gov", contactPhone: "+91 11 2345 0002" },
      { name: "Citywide Power and Streetlights fallback", category: "streetlight", ward: "citywide", contactEmail: "light.city@nagrik.gov", contactPhone: "+91 11 2345 0003" },
      { name: "Citywide Public Safety and Infrastructure fallback", category: "other", ward: "citywide", contactEmail: "safety.city@nagrik.gov", contactPhone: "+91 11 2345 0004" }
    ];

    let seededCount = 0;
    for (const dept of seedData) {
      const existing = await Department.findOne({ category: dept.category, ward: dept.ward });
      if (!existing) {
        await Department.create(dept);
        seededCount++;
      }
    }

    // Pre-create staff account
    const staffEmail = "staff@nagrik.gov";
    let staffUser = await User.findOne({ authUserId: staffEmail });
    if (!staffUser) {
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash("password123", salt);
      staffUser = await User.create({
        authUserId: staffEmail,
        displayName: "Municipal Staff Officer",
        role: "staff",
        authProvider: "email",
        fcmToken: hashedPassword // store local password hash
      });
      console.log(`[MongoDB Seeder] Pre-provisioned staff account: ${staffEmail}`);
    }

    res.status(200).json({ success: true, seededCount, staffAccount: staffEmail });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// ==========================================
// SERVER INITIALIZATION
// ==========================================
mongoose
  .connect(MONGODB_URI)
  .then(() => {
    console.log("[MongoDB] Connected to database.");
    
    // Start Server
    server.listen(PORT, () => {
      console.log(`[Server] Express simulation server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("Database connection error:", err);
  });
