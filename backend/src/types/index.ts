import { Timestamp } from "firebase-admin/firestore";

export type Role = "citizen" | "staff";
export type IssueStatus = "verifying" | "routed" | "in_progress" | "escalated" | "resolved" | "duplicate_merged";
export type Severity = "low" | "moderate" | "high" | "critical";
export type IssueCategory = "pothole" | "water_leak" | "streetlight" | "garbage" | "drainage" | "road_damage" | "other";

export interface UserProfile {
  displayName: string;
  role: Role;
  authProvider: "anonymous" | "email";
  createdAt: Timestamp;
  civicPoints: number;
  reportsCount: number;
  confirmationsCount: number;
  locality: string | null;
  fcmToken: string | null;
}

export interface Issue {
  title: string;
  description: string;
  category: IssueCategory;
  severity: Severity;
  status: IssueStatus;
  isEscalated: boolean;
  priorityTier: number;
  urgencyScore: number;
  location: {
    lat: number;
    lng: number;
    geohash: string;
    address: string | null;
    ward: string | null;
  };
  media: {
    photoUrl: string | null;
    videoUrl: string | null;
    voiceNoteUrl: string | null;
    voiceTranscript: string | null;
  };
  reportedBy: string[];
  confirmationCount: number;
  primaryReportId: string;
  departmentId: string | null;
  draftedComplaint: string | null;
  escalationNotice: string | null;
  escalationCount: number;
  slaDeadline: Timestamp | null;
  parentIssueId: string | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  resolvedAt: Timestamp | null;
  resolvedBy: string | null;
}

export interface Report {
  userId: string;
  rawMediaUrl: string;
  mediaType: "photo" | "video";
  voiceNoteUrl: string | null;
  userTextNote: string | null;
  location: {
    lat: number;
    lng: number;
    geohash: string;
  };
  issueId: string | null;
  processingStatus: "pending" | "processed" | "failed";
  createdAt: Timestamp;
}

export interface Department {
  name: string;
  category: IssueCategory;
  ward: string;
  contactEmail: string;
  contactPhone: string | null;
}

export interface AgentLog {
  agentName: "intake" | "verification" | "routing" | "escalation";
  issueId: string | null;
  reportId: string | null;
  action: string;
  inputSummary: string;
  outputSummary: string;
  success: boolean;
  errorMessage: string | null;
  timestamp: Timestamp;
}

export interface GlobalConfig {
  mergeRadiusMeters: number;
  mergeTimeWindowHours: number;
  categorySlaHours: Record<IssueCategory, number>;
  escalationIntervalHours: number;
  civicPointsPerReport: number;
  civicPointsPerConfirmation: number;
}
