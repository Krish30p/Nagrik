import { USE_MOCK_SERVICES } from "./config";
import { Issue, Thread, Department, Complaint, Escalation, Notification, AgentLog } from "../types";

// Dynamic event-emitter for reactive updates in simulation mode
type ChangeListener = () => void;
const dbListeners = new Map<string, Set<ChangeListener>>();

export function subscribeToCollection(collection: string, listener: ChangeListener): () => void {
  if (!dbListeners.has(collection)) {
    dbListeners.set(collection, new Set());
  }
  dbListeners.get(collection)!.add(listener);
  return () => {
    const list = dbListeners.get(collection);
    if (list) {
      list.delete(listener);
    }
  };
}

function triggerCollectionUpdate(collection: string) {
  const list = dbListeners.get(collection);
  if (list) {
    list.forEach(listener => listener());
  }
}

// Initial Seeding Data
const DEFAULT_DEPARTMENTS: Department[] = [
  { id: "dept_garbage", name: "Sanitation & Waste Management Department", category: "Garbage", ward: "All Wards", email: "sanitation@municipal.gov.in", contactNumber: "+91 11 2345 6781" },
  { id: "dept_electricity", name: "Municipal Electricity & Public Lighting Board", category: "Streetlight", ward: "All Wards", email: "lighting@municipal.gov.in", contactNumber: "+91 11 2345 6782" },
  { id: "dept_pwd", name: "Public Works Department (PWD) - Roads Division", category: "Pothole", ward: "All Wards", email: "pwd.roads@municipal.gov.in", contactNumber: "+91 11 2345 6783" },
  { id: "dept_water", name: "Water Supply and Sewerage Board", category: "Water Leakage", ward: "All Wards", email: "watersupply@municipal.gov.in", contactNumber: "+91 11 2345 6784" },
  { id: "dept_infrastructure", name: "Critical Infrastructure & Public Safety Commission", category: "Critical Infrastructure", ward: "All Wards", email: "safety.infra@municipal.gov.in", contactNumber: "+91 11 2345 6785" }
];

export const dbService = {
  // Initialize Database: Seed initial departments, sample issues, and mock users
  initialize() {
    if (USE_MOCK_SERVICES) {
      // Seed departments
      if (!localStorage.getItem("nagrik_departments")) {
        localStorage.setItem("nagrik_departments", JSON.stringify(DEFAULT_DEPARTMENTS));
      }

      // Seed mock users
      if (!localStorage.getItem("nagrik_mock_users")) {
        const seedUsers = [
          { id: "usr_admin", name: "Admin Officer", email: "admin@nagrik.gov.in", points: 500, level: 5, reportsCount: 5, confirmationsCount: 12, createdAt: new Date().toISOString() },
          { id: "usr_citizen1", name: "Aarav Sharma", email: "aarav@gmail.com", points: 280, level: 3, reportsCount: 4, confirmationsCount: 8, createdAt: new Date().toISOString() },
          { id: "usr_citizen2", name: "Priya Patel", email: "priya@gmail.com", points: 190, level: 2, reportsCount: 2, confirmationsCount: 5, createdAt: new Date().toISOString() }
        ];
        localStorage.setItem("nagrik_mock_users", JSON.stringify(seedUsers));
      }

      // Seed initial issues if none exist
      if (!localStorage.getItem("nagrik_issues")) {
        const initialIssues: Issue[] = [
          {
            id: "iss_1",
            title: "Overflowing commercial garbage dump",
            category: "Garbage",
            description: "Huge bin overflowing behind the main market complex. Stray animals are scattering the waste and it smells terrible.",
            severity: "MEDIUM",
            status: "ROUTED",
            location: "Behind Central Market Complex, Ward 1",
            latitude: 28.6139,
            longitude: 77.2090,
            ward: "Ward 1 (Central)",
            createdBy: "usr_citizen1",
            createdByName: "Aarav Sharma",
            mediaUrls: ["https://images.unsplash.com/photo-1611284446314-60a58ac0deb9?auto=format&fit=crop&q=80&w=800"],
            urgencyScore: 40,
            threadId: "thr_garbage_central",
            departmentId: "dept_garbage",
            slaDays: 3,
            createdAt: new Date(Date.now() - 48 * 3600 * 1000).toISOString(), // 2 days ago
            updatedAt: new Date(Date.now() - 36 * 3600 * 1000).toISOString(),
          },
          {
            id: "iss_2",
            title: "Major water pipe burst on Main Road",
            category: "Water Leakage",
            description: "A huge underground pipe burst has flooded the street. Thousands of gallons of potable water are being wasted.",
            severity: "CRITICAL",
            status: "IN_PROGRESS",
            location: "Opposite Metro Station Pillar 124, Ward 2",
            latitude: 28.6253,
            longitude: 77.2215,
            ward: "Ward 2 (West)",
            createdBy: "usr_citizen2",
            createdByName: "Priya Patel",
            mediaUrls: ["https://images.unsplash.com/photo-1542060748-10c28b629f6f?auto=format&fit=crop&q=80&w=800"],
            urgencyScore: 85,
            threadId: "thr_water_west",
            departmentId: "dept_water",
            slaDays: 2,
            createdAt: new Date(Date.now() - 12 * 3600 * 1000).toISOString(), // 12 hours ago
            updatedAt: new Date(Date.now() - 10 * 3600 * 1000).toISOString(),
          },
          {
            id: "iss_3",
            title: "Dead streetlights creating dark zone",
            category: "Streetlight",
            description: "Four consecutive streetlights are broken. The entire alley is pitch black at night, making it very unsafe for women and children.",
            severity: "HIGH",
            status: "REPORTED",
            location: "Lane 5, Shastri Nagar, Ward 3",
            latitude: 28.5921,
            longitude: 77.1895,
            ward: "Ward 3 (East)",
            createdBy: "usr_citizen1",
            createdByName: "Aarav Sharma",
            mediaUrls: ["https://images.unsplash.com/photo-1509021436665-8f37df706a73?auto=format&fit=crop&q=80&w=800"],
            urgencyScore: 50,
            threadId: "thr_light_east",
            slaDays: 5,
            createdAt: new Date(Date.now() - 24 * 3600 * 1000).toISOString(), // 1 day ago
            updatedAt: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
          }
        ];

        const initialThreads: Thread[] = [
          { id: "thr_garbage_central", issueIds: ["iss_1"], confirmationCount: 0, urgencyScore: 40, status: "ROUTED", createdAt: new Date(Date.now() - 48 * 3600 * 1000).toISOString() },
          { id: "thr_water_west", issueIds: ["iss_2"], confirmationCount: 1, urgencyScore: 85, status: "IN_PROGRESS", createdAt: new Date(Date.now() - 12 * 3600 * 1000).toISOString() },
          { id: "thr_light_east", issueIds: ["iss_3"], confirmationCount: 0, urgencyScore: 50, status: "REPORTED", createdAt: new Date(Date.now() - 24 * 3600 * 1000).toISOString() }
        ];

        const initialComplaints: Complaint[] = [
          {
            id: "comp_1",
            issueId: "iss_1",
            departmentId: "dept_garbage",
            generatedComplaint: "Dear Sir/Madam,\n\nWe would like to draw your immediate attention to an overflowing garbage dump located at Behind Central Market Complex, Ward 1.\n\nThis issue has been classified as Garbage with MEDIUM severity. The debris has started spilling onto neighboring footpaths, causing an immediate sanitization hazard and attracting stray animals. Residents and shoppers are facing severe distress due to the foul odor.\n\nPlease initiate prompt clearing operations and arrange for regular waste collection from this point to prevent recurring public health hazards.\n\nSincerely,\nNagrik AI Operations Platform\n(On behalf of Citizens of Central Ward)",
            status: "SENT",
            createdAt: new Date(Date.now() - 36 * 3600 * 1000).toISOString()
          }
        ];

        localStorage.setItem("nagrik_issues", JSON.stringify(initialIssues));
        localStorage.setItem("nagrik_threads", JSON.stringify(initialThreads));
        localStorage.setItem("nagrik_complaints", JSON.stringify(initialComplaints));
      }

      // Initial agent logs
      if (!localStorage.getItem("nagrik_agent_logs")) {
        const seedLogs: AgentLog[] = [
          { id: "log_1", timestamp: new Date(Date.now() - 48 * 3600 * 1000).toISOString(), agentName: "Intake Agent", issueId: "iss_1", action: "Report Intake Analysis", details: "Analyzed report image. Classified as **Garbage** with **MEDIUM** severity. Identified landmark: *Central Market Complex*.", type: "success" },
          { id: "log_2", timestamp: new Date(Date.now() - 48 * 3600 * 1000).toISOString(), agentName: "Verification Agent", issueId: "iss_1", action: "Duplicate Check", details: "Scanned radius 50m. No overlapping active threads found. Created new thread: `thr_garbage_central`.", type: "info" },
          { id: "log_3", timestamp: new Date(Date.now() - 36 * 3600 * 1000).toISOString(), agentName: "Routing Agent", issueId: "iss_1", action: "Authority Routing", details: "Mapped ticket to **Sanitation & Waste Management Department**. Generated formal complaint letter and scheduled for dispatch.", type: "success" }
        ];
        localStorage.setItem("nagrik_agent_logs", JSON.stringify(seedLogs));
      }
    }
  },

  // ISSUES CRUD
  async getIssues(): Promise<Issue[]> {
    if (USE_MOCK_SERVICES) {
      return JSON.parse(localStorage.getItem("nagrik_issues") || "[]");
    }
    return []; // Live Firebase implementation
  },

  async getIssueById(id: string): Promise<Issue | null> {
    const issues = await this.getIssues();
    return issues.find(i => i.id === id) || null;
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
    }
    throw new Error("Live connection pending.");
  },

  async updateIssue(id: string, updates: Partial<Issue>): Promise<Issue> {
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
    }
    throw new Error("Live connection pending.");
  },

  // THREADS CRUD
  async getThreads(): Promise<Thread[]> {
    if (USE_MOCK_SERVICES) {
      return JSON.parse(localStorage.getItem("nagrik_threads") || "[]");
    }
    return [];
  },

  async getThreadById(id: string): Promise<Thread | null> {
    const threads = await this.getThreads();
    return threads.find(t => t.id === id) || null;
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
    throw new Error("Live connection pending.");
  },

  async updateThread(id: string, updates: Partial<Thread>): Promise<Thread> {
    if (USE_MOCK_SERVICES) {
      const threads = await this.getThreads();
      const index = threads.findIndex(t => t.id === id);
      if (index === -1) throw new Error("Thread not found");

      const updatedThread = {
        ...threads[index],
        ...updates
      };
      threads[index] = updatedThread;
      localStorage.setItem("nagrik_threads", JSON.stringify(threads));
      triggerCollectionUpdate("threads");
      return updatedThread;
    }
    throw new Error("Live connection pending.");
  },

  // DEPARTMENTS
  async getDepartments(): Promise<Department[]> {
    if (USE_MOCK_SERVICES) {
      return JSON.parse(localStorage.getItem("nagrik_departments") || "[]");
    }
    return [];
  },

  // COMPLAINTS CRUD
  async getComplaints(): Promise<Complaint[]> {
    if (USE_MOCK_SERVICES) {
      return JSON.parse(localStorage.getItem("nagrik_complaints") || "[]");
    }
    return [];
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
    throw new Error("Live connection pending.");
  },

  // ESCALATIONS CRUD
  async getEscalations(): Promise<Escalation[]> {
    if (USE_MOCK_SERVICES) {
      return JSON.parse(localStorage.getItem("nagrik_escalations") || "[]");
    }
    return [];
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
    throw new Error("Live connection pending.");
  },

  // NOTIFICATIONS CRUD
  async getNotifications(userId: string): Promise<Notification[]> {
    if (USE_MOCK_SERVICES) {
      const allNotifs: Notification[] = JSON.parse(localStorage.getItem("nagrik_notifications") || "[]");
      return allNotifs.filter(n => n.userId === userId).sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }
    return [];
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
    throw new Error("Live connection pending.");
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
    }
  },

  // AGENT TELEMETRY LOGS
  async getAgentLogs(): Promise<AgentLog[]> {
    if (USE_MOCK_SERVICES) {
      const logs = JSON.parse(localStorage.getItem("nagrik_agent_logs") || "[]");
      return logs.sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    }
    return [];
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
    throw new Error("Live connection pending.");
  },

  async clearAgentLogs(): Promise<void> {
    if (USE_MOCK_SERVICES) {
      localStorage.setItem("nagrik_agent_logs", JSON.stringify([]));
      triggerCollectionUpdate("agent_logs");
    }
  }
};
