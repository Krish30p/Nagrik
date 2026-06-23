export type Severity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type IssueStatus =
  | 'REPORTED'
  | 'VERIFIED'
  | 'ROUTED'
  | 'IN_PROGRESS'
  | 'ESCALATED'
  | 'RESOLVED';

export interface User {
  id: string;
  name: string;
  email: string;
  photoURL?: string;
  points: number;
  level: number;
  reportsCount: number;
  confirmationsCount: number;
  createdAt: string;
}

export interface Issue {
  id: string;
  title: string;
  category: 'Garbage' | 'Streetlight' | 'Pothole' | 'Water Leakage' | 'Critical Infrastructure';
  description: string;
  severity: Severity;
  status: IssueStatus;
  location: string; // Landmark/Address description
  latitude: number;
  longitude: number;
  ward: string;
  createdBy: string; // User ID
  createdByName?: string; // Cache user name for easy display
  mediaUrls: string[];
  voiceTranscript?: string;
  urgencyScore: number; // calculated based on confirmations, severity, duplicate count
  threadId?: string; // linked thread
  departmentId?: string;
  draftedComplaint?: string;
  isEscalated?: boolean;
  escalationNotice?: string;
  primaryReportId?: string;
  parentIssueId?: string;
  slaDays: number;
  createdAt: string;
  updatedAt: string;
}

export interface Thread {
  id: string;
  issueIds: string[];
  confirmationCount: number;
  urgencyScore: number;
  status: IssueStatus;
  createdAt: string;
}

export interface Department {
  id: string;
  name: string;
  category: string;
  ward: string;
  email: string;
  contactNumber: string;
}

export interface Complaint {
  id: string;
  issueId: string;
  departmentId: string;
  generatedComplaint: string; // formal drafted letter
  status: 'PENDING' | 'SENT' | 'ACKNOWLEDGED';
  createdAt: string;
}

export interface Escalation {
  id: string;
  issueId: string;
  escalationLevel: 1 | 2 | 3;
  generatedNotice: string; // formal escalation notice
  createdAt: string;
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
}

// Agent Log telemetry for the Developer Agent Console
export interface AgentLog {
  id: string;
  timestamp: string;
  agentName: 'Intake Agent' | 'Verification Agent' | 'Routing Agent' | 'Escalation Agent';
  issueId?: string;
  action: string;
  details: string; // Markdown details, prompt templates or raw JSON responses
  type: 'info' | 'success' | 'warning' | 'error';
}
