import { API_BASE_URL, WS_URL } from "./firebase";
import { getAuthHeaders } from "./auth";
import { Issue, Thread, Department, Complaint, Escalation, Notification, AgentLog } from "../types";

type ChangeListener = () => void;

export interface ReportHistoryItem {
  id: string;
  userId: string;
  rawMediaUrl: string;
  mediaType: "photo" | "video";
  voiceNoteUrl?: string | null;
  userTextNote?: string | null;
  latitude: number;
  longitude: number;
  issueId: string | null;
  processingStatus: "pending" | "processed" | "failed";
  createdAt: string;
  issue?: Issue | null;
}

// WebSocket connection management for real-time updates
let socket: WebSocket | null = null;
const socketListeners = new Set<(collectionName: string) => void>();

function getWebSocketConnection() {
  if (socket && (socket.readyState === WebSocket.CONNECTING || socket.readyState === WebSocket.OPEN)) {
    return socket;
  }

  console.log("[WebSocket] Connecting to real-time change stream relay...");
  socket = new WebSocket(WS_URL);

  socket.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      if (data.collection) {
        console.log(`[WebSocket] Change broadcast received for collection: ${data.collection}`);
        socketListeners.forEach((listener) => listener(data.collection));
      }
    } catch (err) {
      console.error("[WebSocket] Event parsing failed:", err);
    }
  };

  socket.onerror = (err) => {
    console.error("[WebSocket] Connection error:", err);
  };

  socket.onclose = () => {
    console.log("[WebSocket] Relay connection closed. Reconnecting in 3 seconds...");
    socket = null;
    setTimeout(getWebSocketConnection, 3000);
  };

  return socket;
}

// Auto init WebSocket connection
setTimeout(getWebSocketConnection, 100);

export function subscribeToCollection(collectionName: string, listener: ChangeListener): () => void {
  // Map collection names (e.g. complaints/escalations are simulated from issues)
  const mappedCollection = collectionName === "complaints" || collectionName === "escalations" ? "issues" : collectionName;

  const wrapper = (changedCollection: string) => {
    if (changedCollection === mappedCollection) {
      listener();
    }
  };

  socketListeners.add(wrapper);
  getWebSocketConnection();

  return () => {
    socketListeners.delete(wrapper);
  };
}

export const dbService = {
  initialize() {
    console.log("[dbService] Client Mongoose/Express database service initialized.");
    // Call seed reference data endpoint on load if needed
    fetch(`${API_BASE_URL}/seed`, { method: "POST" })
      .then(res => res.json())
      .then(data => console.log("[dbService] Database seed check completed:", data))
      .catch(err => console.error("[dbService] Auto-seed failed:", err));
  },

  // ISSUES
  async getIssues(): Promise<Issue[]> {
    const res = await fetch(`${API_BASE_URL}/issues`);
    if (!res.ok) throw new Error("Failed to fetch active issues list");
    const list: Issue[] = await res.json();
    // Filter out duplicate_merged issues for main map/dashboard views
    return list.filter((i) => i.status !== "DUPLICATE_MERGED");
  },

  async getIssueById(id: string): Promise<Issue | null> {
    const res = await fetch(`${API_BASE_URL}/issues/${id}`);
    if (!res.ok) return null;
    return res.json();
  },

  async createIssue(issue: Omit<Issue, "id" | "createdAt" | "updatedAt"> & { voiceNoteUrl?: string }): Promise<Issue> {
    console.log("[dbService] Creating report via submitReport API endpoint...");
    const res = await fetch(`${API_BASE_URL}/issues/create`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeaders()
      },
      body: JSON.stringify({
        mediaType: "photo",
        rawMediaUrl: issue.mediaUrls && issue.mediaUrls.length > 0 ? issue.mediaUrls[0] : "https://placeholder.svg",
        voiceNoteUrl: issue.voiceNoteUrl || null,
        userTextNote: issue.description,
        location: {
          lat: issue.latitude,
          lng: issue.longitude
        }
      })
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.message || "Failed to create issue report");
    }

    const { reportId } = await res.json();
    console.log(`[dbService] Report created with ID: ${reportId}. Waiting for Intake Agent processing...`);

    // Poll/wait until the report document is updated with issueId by the background trigger
    return new Promise<Issue>((resolve, reject) => {
      let attempts = 0;
      const interval = setInterval(async () => {
        attempts++;
        try {
          const myReportsRes = await fetch(`${API_BASE_URL}/my-reports`, {
            headers: getAuthHeaders()
          });
          if (myReportsRes.ok) {
            const reports: ReportHistoryItem[] = await myReportsRes.json();
            const report = reports.find((r) => r.id === reportId);
            if (report && report.issueId) {
              clearInterval(interval);
              const issueObj = await this.getIssueById(report.issueId);
              if (issueObj) {
                resolve(issueObj);
              } else {
                reject(new Error("Linked issue details could not be retrieved"));
              }
            } else if (report && report.processingStatus === "failed") {
              clearInterval(interval);
              reject(new Error("Intake Agent processing failed."));
            }
          }
        } catch (err) {
          console.error(err);
        }

        if (attempts > 20) {
          clearInterval(interval);
          reject(new Error("AI Agent processing timed out."));
        }
      }, 3000);
    });
  },

  async updateIssue(id: string, updates: Partial<Issue>): Promise<Issue> {
    console.log(`[dbService] Updating issue status: ${id}...`);
    if (updates.status === "RESOLVED") {
      const res = await fetch(`${API_BASE_URL}/issues/${id}/resolve`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders()
        },
        body: JSON.stringify({ status: "resolved" })
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to resolve issue");
      }

      const updated = await this.getIssueById(id);
      if (!updated) throw new Error("Updated issue not found");
      return updated;
    }

    throw new Error("Direct client updates are not permitted by document security rules.");
  },

  // THREADS
  async getThreads(): Promise<Thread[]> {
    const res = await fetch(`${API_BASE_URL}/issues`);
    if (!res.ok) throw new Error("Failed to fetch threads catalog");
    const allIssues: Issue[] = await res.json();
    
    // Find duplicate_merged issues and group them by parentId
    const duplicates = allIssues.filter((i) => i.status === "DUPLICATE_MERGED" && i.threadId);
    
    const groups: Record<string, string[]> = {};
    duplicates.forEach((issue) => {
      const parentId = issue.threadId!;
      if (!groups[parentId]) groups[parentId] = [];
      groups[parentId].push(issue.id);
    });

    const threadsList: Thread[] = [];
    for (const [parentId, childIds] of Object.entries(groups)) {
      const parentDoc = allIssues.find((i) => i.id === parentId);
      if (parentDoc) {
        threadsList.push({
          id: parentId,
          issueIds: [parentId, ...childIds],
          confirmationCount: childIds.length + 1,
          urgencyScore: parentDoc.urgencyScore,
          status: parentDoc.status,
          createdAt: parentDoc.createdAt
        });
      }
    }
    return threadsList;
  },

  async getThreadById(id: string): Promise<Thread | null> {
    const threads = await this.getThreads();
    const thread = threads.find((t) => t.id === id);
    if (thread) return thread;

    // Default thread of size 1 if no duplicates are linked yet
    const parentDoc = await this.getIssueById(id);
    if (!parentDoc) return null;
    return {
      id: parentDoc.id,
      issueIds: [parentDoc.id],
      confirmationCount: 1,
      urgencyScore: parentDoc.urgencyScore,
      status: parentDoc.status,
      createdAt: parentDoc.createdAt
    };
  },
  
  // REPORTS
  async getReports(): Promise<ReportHistoryItem[]> {
    const res = await fetch(`${API_BASE_URL}/my-reports`, {
      headers: getAuthHeaders()
    });
    if (!res.ok) throw new Error("Failed to fetch user reports history");
    return res.json();
  },

  // DEPARTMENTS
  async getDepartments(): Promise<Department[]> {
    const res = await fetch(`${API_BASE_URL}/departments`);
    if (!res.ok) throw new Error("Failed to fetch departments list");
    return res.json();
  },

  // COMPLAINTS
  async getComplaints(): Promise<Complaint[]> {
    const res = await fetch(`${API_BASE_URL}/complaints`);
    if (!res.ok) throw new Error("Failed to fetch drafted complaints");
    return res.json();
  },

  // ESCALATIONS
  async getEscalations(): Promise<Escalation[]> {
    const res = await fetch(`${API_BASE_URL}/escalations`);
    if (!res.ok) throw new Error("Failed to fetch active escalations");
    return res.json();
  },

  // NOTIFICATIONS
  async getNotifications(): Promise<Notification[]> {
    const res = await fetch(`${API_BASE_URL}/notifications`, {
      headers: getAuthHeaders()
    });
    if (!res.ok) throw new Error("Failed to fetch user notifications");
    return res.json();
  },

  async markNotificationRead(id: string): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/notifications/${id}/read`, {
      method: "PATCH",
      headers: getAuthHeaders()
    });
    if (!res.ok) throw new Error("Failed to update notification state");
  },

  // AGENT TELEMETRY LOGS
  async getAgentLogs(): Promise<AgentLog[]> {
    const res = await fetch(`${API_BASE_URL}/agent-logs`);
    if (!res.ok) throw new Error("Failed to fetch agent logs");
    return res.json();
  },

  async clearAgentLogs(): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/agent-logs/clear`, {
      method: "POST"
    });
    if (!res.ok) throw new Error("Failed to clear agent logs");
  },

  // GRIDFS FILE UPLOADER
  async uploadFile(file: File): Promise<string> {
    console.log(`[dbService] Uploading file: ${file.name} to GridFS bucket...`);
    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch(`${API_BASE_URL}/media/upload`, {
      method: "POST",
      body: formData
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || "Failed to upload file to media storage");
    }

    const data = await res.json();
    return data.downloadUrl;
  }
};
