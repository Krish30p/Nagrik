import { USE_MOCK_SERVICES, API_URL } from "./config";
import { getAuthHeaders } from "./auth";
import { Issue, Thread, Department, Complaint, Escalation, Notification, AgentLog } from "../types";

// Dynamic change listener registry for frontend view updates
type ChangeListener = () => void;
const dbListeners = new Map<string, Set<ChangeListener>>();

export function subscribeToCollection(collection: string, listener: ChangeListener): () => void {
  if (!dbListeners.has(collection)) {
    dbListeners.set(collection, new Set());
  }
  dbListeners.get(collection)!.add(listener);

  // Setup simple short polling (interval) in server mode to auto-refresh metrics
  let pollInterval: any = null;
  if (!USE_MOCK_SERVICES) {
    pollInterval = setInterval(() => {
      listener();
    }, 4000); // Poll every 4 seconds
  }

  return () => {
    const list = dbListeners.get(collection);
    if (list) {
      list.delete(listener);
    }
    if (pollInterval) {
      clearInterval(pollInterval);
    }
  };
}

function triggerCollectionUpdate(collection: string) {
  const list = dbListeners.get(collection);
  if (list) {
    list.forEach(listener => listener());
  }
}

// Map MongoDB _id to frontend id
function mapDoc<T>(doc: any): T {
  if (!doc) return doc;
  return {
    ...doc,
    id: doc._id || doc.id
  } as T;
}

export const dbService = {
  initialize() {
    if (USE_MOCK_SERVICES) {
      // Seed default departments & issues in localStorage
      const DEFAULT_DEPARTMENTS = [
        { id: "dept_garbage", name: "Sanitation & Waste Management Department", category: "Garbage", ward: "All Wards", email: "sanitation@municipal.gov.in", contactNumber: "+91 11 2345 6781" },
        { id: "dept_electricity", name: "Municipal Electricity & Public Lighting Board", category: "Streetlight", ward: "All Wards", email: "lighting@municipal.gov.in", contactNumber: "+91 11 2345 6782" },
        { id: "dept_pwd", name: "Public Works Department (PWD) - Roads Division", category: "Pothole", ward: "All Wards", email: "pwd.roads@municipal.gov.in", contactNumber: "+91 11 2345 6783" },
        { id: "dept_water", name: "Water Supply and Sewerage Board", category: "Water Leakage", ward: "All Wards", email: "watersupply@municipal.gov.in", contactNumber: "+91 11 2345 6784" },
        { id: "dept_infrastructure", name: "Critical Infrastructure & Public Safety Commission", category: "Critical Infrastructure", ward: "All Wards", email: "safety.infra@municipal.gov.in", contactNumber: "+91 11 2345 6785" }
      ];
      if (!localStorage.getItem("nagrik_departments")) {
        localStorage.setItem("nagrik_departments", JSON.stringify(DEFAULT_DEPARTMENTS));
      }
    }
  },

  // ISSUES
  async getIssues(): Promise<Issue[]> {
    if (USE_MOCK_SERVICES) {
      return JSON.parse(localStorage.getItem("nagrik_issues") || "[]");
    } else {
      const res = await fetch(`${API_URL}/issues`, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error("Failed to load issues");
      const list = await res.json();
      return list.map((doc: any) => mapDoc<Issue>(doc));
    }
  },

  async getIssueById(id: string): Promise<Issue | null> {
    if (USE_MOCK_SERVICES) {
      const issues = await this.getIssues();
      return issues.find(i => i.id === id) || null;
    } else {
      const res = await fetch(`${API_URL}/issues/${id}`, { headers: getAuthHeaders() });
      if (!res.ok) return null;
      const data = await res.json();
      return mapDoc<Issue>(data);
    }
  },

  async createIssue(issue: Omit<Issue, "id" | "createdAt" | "updatedAt">): Promise<Issue> {
    if (USE_MOCK_SERVICES) {
      const issues = await this.getIssues();
      const newIssue: Issue = {
        ...issue,
        id: "iss_" + Math.random().toString(36).substr(2, 9),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      issues.push(newIssue);
      localStorage.setItem("nagrik_issues", JSON.stringify(issues));
      triggerCollectionUpdate("issues");
      return newIssue;
    } else {
      // In server mode, the backend runs all agents internally.
      // The backend endpoint expects: { description, latitude, longitude, voiceTranscript, imageUrl, ward }
      const payload: any = {
        description: issue.description,
        latitude: issue.latitude,
        longitude: issue.longitude,
        ward: issue.ward,
        voiceTranscript: issue.voiceTranscript || undefined,
        imageUrl: issue.mediaUrls && issue.mediaUrls.length > 0 ? issue.mediaUrls[0] : undefined
      };
      const res = await fetch(`${API_URL}/issues/create`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({ message: "Failed to create issue" }));
        throw new Error(errData.message || "Failed to create issue");
      }
      const data = await res.json();
      triggerCollectionUpdate("issues");
      return mapDoc<Issue>(data);
    }
  },

  async updateIssue(id: string, updates: Partial<Issue>): Promise<Issue> {
    // Standard update triggers resolution or general updates
    if (USE_MOCK_SERVICES) {
      const issues = await this.getIssues();
      const index = issues.findIndex(i => i.id === id);
      if (index === -1) throw new Error("Issue not found");
      const updatedIssue = {
        ...issues[index],
        ...updates,
        updatedAt: new Date().toISOString()
      };
      issues[index] = updatedIssue;
      localStorage.setItem("nagrik_issues", JSON.stringify(issues));
      triggerCollectionUpdate("issues");
      return updatedIssue;
    } else {
      // In live MongoDB mode, we call specialized triggers
      if (updates.status === "RESOLVED") {
        const res = await fetch(`${API_URL}/issues/${id}/resolve`, {
          method: "POST",
          headers: getAuthHeaders()
        });
        if (!res.ok) throw new Error("Failed to resolve issue");
        const data = await res.json();
        triggerCollectionUpdate("issues");
        return mapDoc<Issue>(data);
      }
      throw new Error("Update method not supported for this parameter in server mode.");
    }
  },

  // THREADS
  async getThreads(): Promise<Thread[]> {
    if (USE_MOCK_SERVICES) {
      return JSON.parse(localStorage.getItem("nagrik_threads") || "[]");
    } else {
      // Threads collection read
      const res = await fetch(`${API_URL}/threads`, { headers: getAuthHeaders() });
      if (!res.ok) return [];
      const list = await res.json();
      return list.map((doc: any) => mapDoc<Thread>(doc));
    }
  },

  async getThreadById(id: string): Promise<Thread | null> {
    if (USE_MOCK_SERVICES) {
      const threads = await this.getThreads();
      return threads.find(t => t.id === id) || null;
    } else {
      const res = await fetch(`${API_URL}/threads/${id}`, { headers: getAuthHeaders() });
      if (!res.ok) return null;
      const doc = await res.json();
      return mapDoc<Thread>(doc);
    }
  },

  async createThread(thread: Omit<Thread, "id" | "createdAt">): Promise<Thread> {
    if (USE_MOCK_SERVICES) {
      const threads = await this.getThreads();
      const newThread: Thread = {
        ...thread,
        id: "thr_" + Math.random().toString(36).substr(2, 9),
        createdAt: new Date().toISOString()
      };
      threads.push(newThread);
      localStorage.setItem("nagrik_threads", JSON.stringify(threads));
      triggerCollectionUpdate("threads");
      return newThread;
    }
    throw new Error("Only server is allowed to manage threads.");
  },

  async updateThread(id: string, updates: Partial<Thread>): Promise<Thread> {
    if (USE_MOCK_SERVICES) {
      const threads = await this.getThreads();
      const index = threads.findIndex(t => t.id === id);
      if (index === -1) throw new Error("Thread not found");
      const updatedThread = { ...threads[index], ...updates };
      threads[index] = updatedThread;
      localStorage.setItem("nagrik_threads", JSON.stringify(threads));
      triggerCollectionUpdate("threads");
      return updatedThread;
    }
    throw new Error("Only server is allowed to manage threads.");
  },

  // DEPARTMENTS
  async getDepartments(): Promise<Department[]> {
    if (USE_MOCK_SERVICES) {
      return JSON.parse(localStorage.getItem("nagrik_departments") || "[]");
    } else {
      const res = await fetch(`${API_URL}/departments`, { headers: getAuthHeaders() });
      if (!res.ok) return [];
      const list = await res.json();
      return list.map((doc: any) => mapDoc<Department>(doc));
    }
  },

  // COMPLAINTS
  async getComplaints(): Promise<Complaint[]> {
    if (USE_MOCK_SERVICES) {
      return JSON.parse(localStorage.getItem("nagrik_complaints") || "[]");
    } else {
      const res = await fetch(`${API_URL}/complaints`, { headers: getAuthHeaders() });
      if (!res.ok) return [];
      const list = await res.json();
      return list.map((doc: any) => mapDoc<Complaint>(doc));
    }
  },

  async createComplaint(complaint: Omit<Complaint, "id" | "createdAt">): Promise<Complaint> {
    if (USE_MOCK_SERVICES) {
      const complaints = await this.getComplaints();
      const newComplaint: Complaint = {
        ...complaint,
        id: "comp_" + Math.random().toString(36).substr(2, 9),
        createdAt: new Date().toISOString()
      };
      complaints.push(newComplaint);
      localStorage.setItem("nagrik_complaints", JSON.stringify(complaints));
      triggerCollectionUpdate("complaints");
      return newComplaint;
    }
    throw new Error("Complaints are drafted on the server side.");
  },

  // ESCALATIONS
  async getEscalations(): Promise<Escalation[]> {
    if (USE_MOCK_SERVICES) {
      return JSON.parse(localStorage.getItem("nagrik_escalations") || "[]");
    } else {
      const res = await fetch(`${API_URL}/escalations`, { headers: getAuthHeaders() });
      if (!res.ok) return [];
      const list = await res.json();
      return list.map((doc: any) => mapDoc<Escalation>(doc));
    }
  },

  async createEscalation(escalation: Omit<Escalation, "id" | "createdAt">): Promise<Escalation> {
    if (USE_MOCK_SERVICES) {
      const escalations = await this.getEscalations();
      const newEscalation: Escalation = {
        ...escalation,
        id: "esc_" + Math.random().toString(36).substr(2, 9),
        createdAt: new Date().toISOString()
      };
      escalations.push(newEscalation);
      localStorage.setItem("nagrik_escalations", JSON.stringify(escalations));
      triggerCollectionUpdate("escalations");
      return newEscalation;
    }
    throw new Error("Escalations are computed on the server side.");
  },

  // NOTIFICATIONS
  async getNotifications(userId: string): Promise<Notification[]> {
    if (USE_MOCK_SERVICES) {
      const allNotifs: Notification[] = JSON.parse(localStorage.getItem("nagrik_notifications") || "[]");
      return allNotifs.filter(n => n.userId === userId).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } else {
      const res = await fetch(`${API_URL}/notifications`, { headers: getAuthHeaders() });
      if (!res.ok) return [];
      const list = await res.json();
      return list.map((doc: any) => mapDoc<Notification>(doc));
    }
  },

  async createNotification(userId: string, title: string, body: string): Promise<Notification> {
    if (USE_MOCK_SERVICES) {
      const notifications = JSON.parse(localStorage.getItem("nagrik_notifications") || "[]");
      const newNotif: Notification = {
        id: "ntf_" + Math.random().toString(36).substr(2, 9),
        userId,
        title,
        body,
        read: false,
        createdAt: new Date().toISOString()
      };
      notifications.push(newNotif);
      localStorage.setItem("nagrik_notifications", JSON.stringify(notifications));
      triggerCollectionUpdate("notifications");
      return newNotif;
    }
    throw new Error("Notifications are dispatched on the server side.");
  },

  async markNotificationRead(id: string): Promise<void> {
    if (USE_MOCK_SERVICES) {
      const notifications: Notification[] = JSON.parse(localStorage.getItem("nagrik_notifications") || "[]");
      const index = notifications.findIndex(n => n.id === id);
      if (index !== -1) {
        notifications[index].read = true;
        localStorage.setItem("nagrik_notifications", JSON.stringify(notifications));
        triggerCollectionUpdate("notifications");
      }
    } else {
      await fetch(`${API_URL}/notifications/${id}/read`, {
        method: "PATCH",
        headers: getAuthHeaders()
      });
      triggerCollectionUpdate("notifications");
    }
  },

  // AGENT TELEMETRY LOGS
  async getAgentLogs(): Promise<AgentLog[]> {
    if (USE_MOCK_SERVICES) {
      const logs = JSON.parse(localStorage.getItem("nagrik_agent_logs") || "[]");
      return logs.sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    } else {
      const res = await fetch(`${API_URL}/agent-logs`, { headers: getAuthHeaders() });
      if (!res.ok) return [];
      const list = await res.json();
      return list.map((doc: any) => mapDoc<AgentLog>(doc));
    }
  },

  async createAgentLog(agentName: AgentLog["agentName"], action: string, details: string, type: AgentLog["type"], issueId?: string): Promise<AgentLog> {
    if (USE_MOCK_SERVICES) {
      const logs = JSON.parse(localStorage.getItem("nagrik_agent_logs") || "[]");
      const newLog: AgentLog = {
        id: "log_" + Math.random().toString(36).substr(2, 9),
        timestamp: new Date().toISOString(),
        agentName,
        issueId,
        action,
        details,
        type
      };
      logs.push(newLog);
      localStorage.setItem("nagrik_agent_logs", JSON.stringify(logs));
      triggerCollectionUpdate("agent_logs");
      return newLog;
    }
    return {} as AgentLog; // Server creates logs in server mode
  },

  async clearAgentLogs(): Promise<void> {
    if (USE_MOCK_SERVICES) {
      localStorage.setItem("nagrik_agent_logs", JSON.stringify([]));
      triggerCollectionUpdate("agent_logs");
    } else {
      await fetch(`${API_URL}/agent-logs/clear`, {
        method: "POST",
        headers: getAuthHeaders()
      });
      triggerCollectionUpdate("agent_logs");
    }
  }
};
