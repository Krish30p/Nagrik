import mongoose, { Schema, Document } from "mongoose";

// GeoJSON Point Schema
const PointSchema = new Schema({
  type: {
    type: String,
    enum: ["Point"],
    default: "Point",
    required: true
  },
  coordinates: {
    type: [Number], // [longitude, latitude]
    required: true
  }
});

// ==========================================
// 1. USER SCHEMA & MODEL
// ==========================================
export interface IUser extends Document {
  authUserId: string; // Atlas Auth unique identifier
  displayName: string;
  role: "citizen" | "staff";
  authProvider: "anonymous" | "email";
  createdAt: Date;
  civicPoints: number;
  reportsCount: number;
  confirmationsCount: number;
  locality: string | null;
  fcmToken: string | null;
}

const UserSchema: Schema = new Schema({
  authUserId: { type: String, required: true, unique: true },
  displayName: { type: String, required: true },
  role: { type: String, enum: ["citizen", "staff"], default: "citizen" },
  authProvider: { type: String, enum: ["anonymous", "email"], required: true },
  createdAt: { type: Date, default: Date.now },
  civicPoints: { type: Number, default: 0 },
  reportsCount: { type: Number, default: 0 },
  confirmationsCount: { type: Number, default: 0 },
  locality: { type: String, default: null },
  fcmToken: { type: String, default: null }
});

export const User = mongoose.model<IUser>("User", UserSchema);

// ==========================================
// 2. REPORT SCHEMA & MODEL
// ==========================================
export interface IReport extends Document {
  userId: mongoose.Types.ObjectId;
  rawMediaUrl: string;
  mediaType: "photo" | "video";
  voiceNoteUrl: string | null;
  userTextNote: string | null;
  location: {
    type: "Point";
    coordinates: [number, number]; // [longitude, latitude]
  };
  issueId: mongoose.Types.ObjectId | null;
  processingStatus: "pending" | "processed" | "failed";
  createdAt: Date;
}

const ReportSchema: Schema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  rawMediaUrl: { type: String, required: true },
  mediaType: { type: String, enum: ["photo", "video"], required: true },
  voiceNoteUrl: { type: String, default: null },
  userTextNote: { type: String, default: null },
  location: { type: PointSchema, required: true },
  issueId: { type: Schema.Types.ObjectId, ref: "Issue", default: null },
  processingStatus: { type: String, enum: ["pending", "processed", "failed"], default: "pending" },
  createdAt: { type: Date, default: Date.now }
});

ReportSchema.index({ userId: 1, createdAt: -1 });
ReportSchema.index({ location: "2dsphere" });

export const Report = mongoose.model<IReport>("Report", ReportSchema);

// ==========================================
// 3. ISSUE SCHEMA & MODEL
// ==========================================
export interface IIssue extends Document {
  title: string;
  description: string;
  category: "pothole" | "water_leak" | "streetlight" | "garbage" | "drainage" | "road_damage" | "other";
  severity: "low" | "moderate" | "high" | "critical";
  status: "verifying" | "routed" | "in_progress" | "escalated" | "resolved" | "duplicate_merged";
  isEscalated: boolean;
  priorityTier: number;
  urgencyScore: number;
  location: {
    type: "Point";
    coordinates: [number, number]; // [longitude, latitude]
    address: string | null;
    ward: string | null;
  };
  media: {
    photoUrl: string | null;
    videoUrl: string | null;
    voiceNoteUrl: string | null;
    voiceTranscript: string | null;
  };
  reportedBy: mongoose.Types.ObjectId[];
  confirmationCount: number;
  primaryReportId: mongoose.Types.ObjectId;
  departmentId: mongoose.Types.ObjectId | null;
  draftedComplaint: string | null;
  escalationNotice: string | null;
  escalationCount: number;
  slaDeadline: Date | null;
  parentIssueId: mongoose.Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
  resolvedAt: Date | null;
  resolvedBy: mongoose.Types.ObjectId | null;
}

const IssueSchema: Schema = new Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  category: {
    type: String,
    enum: ["pothole", "water_leak", "streetlight", "garbage", "drainage", "road_damage", "other"],
    required: true
  },
  severity: { type: String, enum: ["low", "moderate", "high", "critical"], default: "moderate" },
  status: {
    type: String,
    enum: ["verifying", "routed", "in_progress", "escalated", "resolved", "duplicate_merged"],
    default: "verifying"
  },
  isEscalated: { type: Boolean, default: false },
  priorityTier: { type: Number, default: 1 },
  urgencyScore: { type: Number, default: 20 },
  location: {
    type: {
      type: String,
      enum: ["Point"],
      default: "Point",
      required: true
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      required: true
    },
    address: { type: String, default: null },
    ward: { type: String, default: null }
  },
  media: {
    photoUrl: { type: String, default: null },
    videoUrl: { type: String, default: null },
    voiceNoteUrl: { type: String, default: null },
    voiceTranscript: { type: String, default: null }
  },
  reportedBy: [{ type: Schema.Types.ObjectId, ref: "User", required: true }],
  confirmationCount: { type: Number, default: 1 },
  primaryReportId: { type: Schema.Types.ObjectId, ref: "Report", required: true },
  departmentId: { type: Schema.Types.ObjectId, ref: "Department", default: null },
  draftedComplaint: { type: String, default: null },
  escalationNotice: { type: String, default: null },
  escalationCount: { type: Number, default: 0 },
  slaDeadline: { type: Date, default: null },
  parentIssueId: { type: Schema.Types.ObjectId, ref: "Issue", default: null },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  resolvedAt: { type: Date, default: null },
  resolvedBy: { type: Schema.Types.ObjectId, ref: "User", default: null }
});

// Indexes
IssueSchema.index({ location: "2dsphere" });
IssueSchema.index({ category: 1, createdAt: -1 });
IssueSchema.index({ status: 1, slaDeadline: 1 });
IssueSchema.index({ "location.ward": 1, status: 1 });

export const Issue = mongoose.model<IIssue>("Issue", IssueSchema);

// ==========================================
// 4. DEPARTMENT SCHEMA & MODEL
// ==========================================
export interface IDepartment extends Document {
  name: string;
  category: "pothole" | "water_leak" | "streetlight" | "garbage" | "drainage" | "road_damage" | "other";
  ward: string;
  contactEmail: string;
  contactPhone: string | null;
}

const DepartmentSchema: Schema = new Schema({
  name: { type: String, required: true },
  category: {
    type: String,
    enum: ["pothole", "water_leak", "streetlight", "garbage", "drainage", "road_damage", "other"],
    required: true
  },
  ward: { type: String, required: true },
  contactEmail: { type: String, required: true },
  contactPhone: { type: String, default: null }
});

DepartmentSchema.index({ category: 1, ward: 1 });

export const Department = mongoose.model<IDepartment>("Department", DepartmentSchema);

// ==========================================
// 5. AGENT LOG SCHEMA & MODEL
// ==========================================
export interface IAgentLog extends Document {
  agentName: "intake" | "verification" | "routing" | "escalation";
  issueId: mongoose.Types.ObjectId | null;
  reportId: mongoose.Types.ObjectId | null;
  action: string;
  inputSummary: string;
  outputSummary: string;
  success: boolean;
  errorMessage: string | null;
  timestamp: Date;
}

const AgentLogSchema: Schema = new Schema({
  agentName: { type: String, enum: ["intake", "verification", "routing", "escalation"], required: true },
  issueId: { type: Schema.Types.ObjectId, ref: "Issue", default: null },
  reportId: { type: Schema.Types.ObjectId, ref: "Report", default: null },
  action: { type: String, required: true },
  inputSummary: { type: String, required: true },
  outputSummary: { type: String, required: true },
  success: { type: Boolean, default: true },
  errorMessage: { type: String, default: null },
  timestamp: { type: Date, default: Date.now }
});

export const AgentLog = mongoose.model<IAgentLog>("AgentLog", AgentLogSchema);

// ==========================================
// 6. GLOBAL CONFIG SCHEMA & MODEL
// ==========================================
export interface IConfig extends Document {
  _id: any; // "global"
  mergeRadiusMeters: number;
  mergeTimeWindowHours: number;
  categorySlaHours: {
    pothole: number;
    water_leak: number;
    streetlight: number;
    garbage: number;
    drainage: number;
    road_damage: number;
    other: number;
  };
  escalationIntervalHours: number;
  civicPointsPerReport: number;
  civicPointsPerConfirmation: number;
}

const ConfigSchema: Schema = new Schema({
  _id: { type: String, required: true }, // "global"
  mergeRadiusMeters: { type: Number, default: 50 },
  mergeTimeWindowHours: { type: Number, default: 72 },
  categorySlaHours: {
    pothole: { type: Number, default: 72 },
    water_leak: { type: Number, default: 24 },
    streetlight: { type: Number, default: 48 },
    garbage: { type: Number, default: 24 },
    drainage: { type: Number, default: 48 },
    road_damage: { type: Number, default: 96 },
    other: { type: Number, default: 72 }
  },
  escalationIntervalHours: { type: Number, default: 6 },
  civicPointsPerReport: { type: Number, default: 10 },
  civicPointsPerConfirmation: { type: Number, default: 5 }
});

export const Config = mongoose.model<IConfig>("Config", ConfigSchema);

// ==========================================
// 7. SIMULATION STATE SCHEMA & MODEL
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

// ==========================================
// 8. NOTIFICATION SCHEMA & MODEL
// ==========================================
export interface INotification extends Document {
  userId: string;
  title: string;
  body: string;
  read: boolean;
  createdAt: Date;
}

const NotificationSchema: Schema = new Schema({
  userId: { type: String, required: true },
  title: { type: String, required: true },
  body: { type: String, required: true },
  read: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

export const Notification = mongoose.model<INotification>("Notification", NotificationSchema);

