import express, { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import cors from "cors";
import dotenv from "dotenv";
import { User, Issue, Thread, Department, Complaint, Escalation, Notification, AgentLog, SimulationState } from "./models";
import { intakeAgent, verificationAgent, routingAgent, escalationAgent } from "./agents";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/nagrik"; // Fallback to standard local MongoDB
const JWT_SECRET = process.env.JWT_SECRET || "nagrik_developer_token_key";

app.use(cors());
app.use(express.json());

// ==========================================
// SEED DATA HELPER
// ==========================================
const DEFAULT_DEPARTMENTS = [
  { id: "dept_garbage", name: "Sanitation & Waste Management Department", category: "Garbage", ward: "All Wards", email: "sanitation@municipal.gov.in", contactNumber: "+91 11 2345 6781" },
  { id: "dept_electricity", name: "Municipal Electricity & Public Lighting Board", category: "Streetlight", ward: "All Wards", email: "lighting@municipal.gov.in", contactNumber: "+91 11 2345 6782" },
  { id: "dept_pwd", name: "Public Works Department (PWD) - Roads Division", category: "Pothole", ward: "All Wards", email: "pwd.roads@municipal.gov.in", contactNumber: "+91 11 2345 6783" },
  { id: "dept_water", name: "Water Supply and Sewerage Board", category: "Water Leakage", ward: "All Wards", email: "watersupply@municipal.gov.in", contactNumber: "+91 11 2345 6784" },
  { id: "dept_infrastructure", name: "Critical Infrastructure & Public Safety Commission", category: "Critical Infrastructure", ward: "All Wards", email: "safety.infra@municipal.gov.in", contactNumber: "+91 11 2345 6785" }
];

async function seedDatabase() {
  try {
    const deptCount = await Department.countDocuments();
    if (deptCount === 0) {
      await Department.insertMany(DEFAULT_DEPARTMENTS);
      console.log("[MongoDB Seed] Seeded municipal departments.");
    }

    const stateCount = await SimulationState.countDocuments();
    if (stateCount === 0) {
      await SimulationState.create({ timeOffsetMs: 0 });
      console.log("[MongoDB Seed] Seeded simulation state.");
    }

    const userCount = await User.countDocuments();
    if (userCount === 0) {
      // Seed default accounts
      const salt = await bcrypt.genSalt(10);
      const adminPass = await bcrypt.hash("password", salt);
      const citizenPass = await bcrypt.hash("password", salt);

      await User.create([
        { name: "Admin Officer", email: "admin@nagrik.gov.in", password: adminPass, points: 500, level: 5, photoURL: "https://api.dicebear.com/7.x/adventurer/svg?seed=Admin" },
        { name: "Aarav Sharma", email: "aarav@gmail.com", password: citizenPass, points: 250, level: 3, photoURL: "https://api.dicebear.com/7.x/adventurer/svg?seed=Aarav" }
      ]);
      console.log("[MongoDB Seed] Seeded default users.");
    }
  } catch (err) {
    console.error("Seeding error:", err);
  }
}

// ==========================================
// JWT AUTH MIDDLEWARE
// ==========================================
interface AuthRequest extends Request {
  userId?: string;
  userEmail?: string;
  userName?: string;
}

const authenticateToken = (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) return res.status(401).json({ message: "Authentication token required" });

  jwt.verify(token, JWT_SECRET, (err: any, decoded: any) => {
    if (err) return res.status(403).json({ message: "Invalid or expired token" });
    req.userId = decoded.userId;
    req.userEmail = decoded.email;
    req.userName = decoded.name;
    next();
  });
};

// ==========================================
// 1. AUTH ROUTES
// ==========================================
app.post("/api/auth/register", async (req: Request, res: Response) => {
  const { name, email, password } = req.body;
  try {
    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ message: "Email already registered" });

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = await User.create({
      name,
      email,
      password: hashedPassword,
      photoURL: `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(name)}`
    });

    const token = jwt.sign({ userId: newUser._id, email: newUser.email, name: newUser.name }, JWT_SECRET, { expiresIn: "7d" });
    
    // Hide password
    const userObject = newUser.toObject();
    delete userObject.password;

    res.status(201).json({ token, user: userObject });
  } catch (err: any) {
    res.status(550).json({ message: err.message });
  }
});

app.post("/api/auth/login", async (req: Request, res: Response) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: "User not found. Check credentials." });

    const validPass = await bcrypt.compare(password, user.password!);
    if (!validPass) return res.status(400).json({ message: "Invalid password" });

    const token = jwt.sign({ userId: user._id, email: user.email, name: user.name }, JWT_SECRET, { expiresIn: "7d" });
    
    const userObject = user.toObject();
    delete userObject.password;

    res.status(200).json({ token, user: userObject });
  } catch (err: any) {
    res.status(550).json({ message: err.message });
  }
});

app.get("/api/auth/profile", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findById(req.userId).select("-password");
    if (!user) return res.status(404).json({ message: "Profile not found" });
    res.status(200).json(user);
  } catch (err: any) {
    res.status(550).json({ message: err.message });
  }
});

// ==========================================
// 2. ISSUES ROUTES
// ==========================================
app.post("/api/issues/create", authenticateToken, async (req: AuthRequest, res: Response) => {
  const { description, latitude, longitude, voiceTranscript, imageUrl, ward } = req.body;
  try {
    // 1. Run Intake Agent
    const issue = await intakeAgent.process(
      description,
      latitude,
      longitude,
      voiceTranscript,
      imageUrl,
      req.userId,
      req.userName,
      ward
    );

    // 2. Run Verification Agent in background (Non-blocking or blocking)
    await verificationAgent.verify(issue.id);

    // 3. Run Routing Agent
    await routingAgent.route(issue.id);

    const updatedIssue = await Issue.findById(issue._id);
    res.status(201).json(updatedIssue);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

app.get("/api/issues", async (req: Request, res: Response) => {
  try {
    const issues = await Issue.find().sort({ createdAt: -1 });
    res.status(200).json(issues);
  } catch (err: any) {
    res.status(550).json({ message: err.message });
  }
});

app.get("/api/issues/:id", async (req: Request, res: Response) => {
  try {
    const issue = await Issue.findById(req.params.id);
    if (!issue) return res.status(404).json({ message: "Issue not found" });
    res.status(200).json(issue);
  } catch (err: any) {
    res.status(550).json({ message: err.message });
  }
});

app.post("/api/issues/:id/resolve", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const issue = await Issue.findById(req.params.id);
    if (!issue) return res.status(404).json({ message: "Issue not found" });

    issue.status = "RESOLVED";
    issue.updatedAt = new Date();
    await issue.save();

    if (issue.threadId) {
      await Thread.findByIdAndUpdate(issue.threadId, { status: "RESOLVED" });
    }

    // Award resolution payout
    await User.findByIdAndUpdate(issue.createdBy, {
      $inc: { points: 100 }
    });

    await Notification.create({
      userId: issue.createdBy,
      title: "Issue Resolved!",
      body: `Excellent! The team resolved your ticket: "${issue.title}".`,
      read: false
    });

    await AgentLog.create({
      agentName: "Verification Agent",
      issueId: issue.id,
      action: "Resolution Audited",
      details: `Resolution confirmed by Admin for ticket \`${issue.id}\`. Payout of **100 points** processed.`,
      type: "success"
    });

    res.status(200).json(issue);
  } catch (err: any) {
    res.status(550).json({ message: err.message });
  }
});

// ==========================================
// 3. DASHBOARD / METRICS ROUTES
// ==========================================
app.get("/api/dashboard/stats", async (req: Request, res: Response) => {
  try {
    const total = await Issue.countDocuments();
    const open = await Issue.countDocuments({ status: { $ne: "RESOLVED" } });
    const resolved = await Issue.countDocuments({ status: "RESOLVED" });
    const escalated = await Issue.countDocuments({ status: "ESCALATED" });
    const issues = await Issue.find().select("category ward status severity");

    res.status(200).json({
      total,
      open,
      resolved,
      escalated,
      issues
    });
  } catch (err: any) {
    res.status(550).json({ message: err.message });
  }
});

app.get("/api/dashboard/leaderboard", async (req: Request, res: Response) => {
  try {
    const users = await User.find().select("-password").sort({ points: -1 });
    res.status(200).json(users);
  } catch (err: any) {
    res.status(550).json({ message: err.message });
  }
});

// ==========================================
// 4. AGENTS & TELEMETRY
// ==========================================
app.get("/api/agent-logs", async (req: Request, res: Response) => {
  try {
    const logs = await AgentLog.find().sort({ timestamp: -1 }).limit(100);
    res.status(200).json(logs);
  } catch (err: any) {
    res.status(550).json({ message: err.message });
  }
});

app.post("/api/agent-logs/clear", async (req: Request, res: Response) => {
  try {
    await AgentLog.deleteMany({});
    res.status(200).json({ message: "Logs cleared" });
  } catch (err: any) {
    res.status(550).json({ message: err.message });
  }
});

app.post("/api/agents/escalate", async (req: Request, res: Response) => {
  try {
    const count = await escalationAgent.sweep();
    res.status(200).json({ escalatedCount: count });
  } catch (err: any) {
    res.status(550).json({ message: err.message });
  }
});

// ==========================================
// 5. SIMULATION TIME CONTROLS
// ==========================================
app.post("/api/simulation/fast-forward", async (req: Request, res: Response) => {
  const { days } = req.body;
  try {
    const addedMs = days * 24 * 3600 * 1000;
    
    let state = await SimulationState.findOne();
    if (!state) state = new SimulationState({ timeOffsetMs: 0 });
    
    state.timeOffsetMs += addedMs;
    state.updatedAt = new Date();
    await state.save();

    await AgentLog.create({
      agentName: "Escalation Agent",
      action: "Simulation Clock Traveled",
      details: `Fast-forwarded clock by **${days} days**. Total offset is now ${Math.floor(state.timeOffsetMs / (24 * 3600 * 1000))} days. Sweeping compliance...`,
      type: "warning"
    });

    // Run sweep immediately
    const count = await escalationAgent.sweep();

    res.status(200).json({ success: true, totalOffsetDays: Math.floor(state.timeOffsetMs / (24 * 3600 * 1000)), escalated: count });
  } catch (err: any) {
    res.status(550).json({ message: err.message });
  }
});

app.post("/api/simulation/reset", async (req: Request, res: Response) => {
  try {
    await SimulationState.findOneAndUpdate({}, { timeOffsetMs: 0 }, { upsert: true });
    await AgentLog.create({
      agentName: "Escalation Agent",
      action: "Simulation Clock Reset",
      details: "Simulated time-offset has been reset to system current time.",
      type: "info"
    });
    res.status(200).json({ success: true });
  } catch (err: any) {
    res.status(550).json({ message: err.message });
  }
});

// ==========================================
// 6. NOTIFICATIONS
// ==========================================
app.get("/api/notifications", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const list = await Notification.find({ userId: req.userId }).sort({ createdAt: -1 });
    res.status(200).json(list);
  } catch (err: any) {
    res.status(550).json({ message: err.message });
  }
});

app.patch("/api/notifications/:id/read", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    await Notification.findByIdAndUpdate(req.params.id, { read: true });
    res.status(200).json({ success: true });
  } catch (err: any) {
    res.status(550).json({ message: err.message });
  }
});

// ==========================================
// 7. COMPLAINTS & ESCALATIONS
// ==========================================
app.get("/api/complaints", async (req: Request, res: Response) => {
  try {
    const list = await Complaint.find();
    res.status(200).json(list);
  } catch (err: any) {
    res.status(550).json({ message: err.message });
  }
});

app.get("/api/escalations", async (req: Request, res: Response) => {
  try {
    const list = await Escalation.find();
    res.status(200).json(list);
  } catch (err: any) {
    res.status(550).json({ message: err.message });
  }
});

app.get("/api/departments", async (req: Request, res: Response) => {
  try {
    const list = await Department.find();
    res.status(200).json(list);
  } catch (err: any) {
    res.status(550).json({ message: err.message });
  }
});

// ==========================================
// CONNECTION & LISTENER
// ==========================================
mongoose
  .connect(MONGODB_URI)
  .then(() => {
    console.log("[MongoDB] Connected to database.");
    seedDatabase();
    app.listen(PORT, () => {
      console.log(`[Server] Express API server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("Database connection error:", err);
  });
