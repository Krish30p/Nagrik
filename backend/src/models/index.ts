import mongoose, { Schema, Document } from "mongoose";

// ==========================================
// 1. USER SCHEMA & MODEL
// ==========================================
export interface IUser extends Document {
  name: string;
  email: string;
  password?: string;
  photoURL?: string;
  points: number;
  level: number;
  reportsCount: number;
  confirmationsCount: number;
  createdAt: Date;
}

const UserSchema: Schema = new Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  photoURL: { type: String },
  points: { type: Number, default: 100 },
  level: { type: Number, default: 1 },
  reportsCount: { type: Number, default: 0 },
  confirmationsCount: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now }
});

export const User = mongoose.model<IUser>("User", UserSchema);

// ==========================================
// 2. THREAD SCHEMA & MODEL
// ==========================================
export interface IThread extends Document {
  issueIds: mongoose.Types.ObjectId[];
  confirmationCount: number;
  urgencyScore: number;
  status: string;
  createdAt: Date;
}

const ThreadSchema: Schema = new Schema({
  issueIds: [{ type: Schema.Types.ObjectId, ref: "Issue" }],
  confirmationCount: { type: Number, default: 0 },
  urgencyScore: { type: Number, default: 20 },
  status: { type: String, default: "REPORTED" },
  createdAt: { type: Date, default: Date.now }
});

export const Thread = mongoose.model<IThread>("Thread", ThreadSchema);

// ==========================================
// 3. ISSUE SCHEMA & MODEL
// ==========================================
export interface IIssue extends Document {
  title: string;
  category: "Garbage" | "Streetlight" | "Pothole" | "Water Leakage" | "Critical Infrastructure";
  description: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  status: "REPORTED" | "VERIFIED" | "ROUTED" | "IN_PROGRESS" | "ESCALATED" | "RESOLVED";
  location: string;
  latitude: number;
  longitude: number;
  ward: string;
  createdBy: mongoose.Types.ObjectId;
  createdByName?: string;
  mediaUrls: string[];
  voiceTranscript?: string;
  urgencyScore: number;
  threadId?: mongoose.Types.ObjectId;
  departmentId?: string;
  slaDays: number;
  createdAt: Date;
  updatedAt: Date;
}

const IssueSchema: Schema = new Schema({
  title: { type: String, required: true },
  category: { 
    type: String, 
    enum: ["Garbage", "Streetlight", "Pothole", "Water Leakage", "Critical Infrastructure"],
    required: true 
  },
  description: { type: String, required: true },
  severity: { type: String, enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"], default: "MEDIUM" },
  status: { 
    type: String, 
    enum: ["REPORTED", "VERIFIED", "ROUTED", "IN_PROGRESS", "ESCALATED", "RESOLVED"],
    default: "REPORTED" 
  },
  location: { type: String, required: true },
  latitude: { type: Number, required: true },
  longitude: { type: Number, required: true },
  ward: { type: String, required: true },
  createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  createdByName: { type: String },
  mediaUrls: [{ type: String }],
  voiceTranscript: { type: String },
  urgencyScore: { type: Number, default: 20 },
  threadId: { type: Schema.Types.ObjectId, ref: "Thread" },
  departmentId: { type: String },
  slaDays: { type: Number, required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

export const Issue = mongoose.model<IIssue>("Issue", IssueSchema);

// ==========================================
// 4. DEPARTMENT SCHEMA & MODEL
// ==========================================
export interface IDepartment extends Document {
  id: string; // custom id
  name: string;
  category: string;
  ward: string;
  email: string;
  contactNumber: string;
}

const DepartmentSchema: Schema = new Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  category: { type: String, required: true },
  ward: { type: String, required: true },
  email: { type: String, required: true },
  contactNumber: { type: String, required: true }
});

export const Department = mongoose.model<IDepartment>("Department", DepartmentSchema);

// ==========================================
// 5. COMPLAINT SCHEMA & MODEL
// ==========================================
export interface IComplaint extends Document {
  issueId: mongoose.Types.ObjectId;
  departmentId: string;
  generatedComplaint: string;
  status: "PENDING" | "SENT" | "ACKNOWLEDGED";
  createdAt: Date;
}

const ComplaintSchema: Schema = new Schema({
  issueId: { type: Schema.Types.ObjectId, ref: "Issue", required: true },
  departmentId: { type: String, required: true },
  generatedComplaint: { type: String, required: true },
  status: { type: String, enum: ["PENDING", "SENT", "ACKNOWLEDGED"], default: "PENDING" },
  createdAt: { type: Date, default: Date.now }
});

export const Complaint = mongoose.model<IComplaint>("Complaint", ComplaintSchema);

// ==========================================
// 6. ESCALATION SCHEMA & MODEL
// ==========================================
export interface IEscalation extends Document {
  issueId: mongoose.Types.ObjectId;
  escalationLevel: number;
  generatedNotice: string;
  createdAt: Date;
}

const EscalationSchema: Schema = new Schema({
  issueId: { type: Schema.Types.ObjectId, ref: "Issue", required: true },
  escalationLevel: { type: Number, required: true },
  generatedNotice: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

export const Escalation = mongoose.model<IEscalation>("Escalation", EscalationSchema);

// ==========================================
// 7. NOTIFICATION SCHEMA & MODEL
// ==========================================
export interface INotification extends Document {
  userId: mongoose.Types.ObjectId;
  title: string;
  body: string;
  read: boolean;
  createdAt: Date;
}

const NotificationSchema: Schema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  title: { type: String, required: true },
  body: { type: String, required: true },
  read: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

export const Notification = mongoose.model<INotification>("Notification", NotificationSchema);

// ==========================================
// 8. AGENT LOG SCHEMA & MODEL
// ==========================================
export interface IAgentLog extends Document {
  timestamp: Date;
  agentName: "Intake Agent" | "Verification Agent" | "Routing Agent" | "Escalation Agent";
  issueId?: string;
  action: string;
  details: string;
  type: "info" | "success" | "warning" | "error";
}

const AgentLogSchema: Schema = new Schema({
  timestamp: { type: Date, default: Date.now },
  agentName: { type: String, enum: ["Intake Agent", "Verification Agent", "Routing Agent", "Escalation Agent"], required: true },
  issueId: { type: String },
  action: { type: String, required: true },
  details: { type: String, required: true },
  type: { type: String, enum: ["info", "success", "warning", "error"], required: true }
});

export const AgentLog = mongoose.model<IAgentLog>("AgentLog", AgentLogSchema);

// ==========================================
// 9. SIMULATION STATE SCHEMA & MODEL
// ==========================================
export interface ISimulationState extends Document {
  timeOffsetMs: number;
  updatedAt: Date;
}

const SimulationStateSchema: Schema = new Schema({
  timeOffsetMs: { type: Number, default: 0 },
  updatedAt: { type: Date, default: Date.now }
});

export const SimulationState = mongoose.model<ISimulationState>("SimulationState", SimulationStateSchema);
