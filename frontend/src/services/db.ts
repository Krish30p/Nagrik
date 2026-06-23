import { db, functions } from "./firebase";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  orderBy,
  onSnapshot,
  where
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { Issue, Thread, Department, Complaint, Escalation, Notification, AgentLog, Severity, IssueStatus } from "../types";

type ChangeListener = () => void;

export function subscribeToCollection(collectionName: string, listener: ChangeListener): () => void {
  // Translate collections if needed
  let fsCollection = collectionName;
  if (collectionName === "agent_logs") {
    fsCollection = "agent_logs";
  }
  const q = query(collection(db, fsCollection));
  return onSnapshot(q, () => {
    listener();
  });
}

// Map Firestore fields to UI expected fields
function mapFirestoreIssueToFrontend(docId: string, data: any): Issue {
  // Category mapping
  let category: Issue["category"] = "Garbage";
  if (data.category === "pothole") category = "Pothole";
  else if (data.category === "water_leak") category = "Water Leakage";
  else if (data.category === "streetlight") category = "Streetlight";
  else if (data.category === "garbage") category = "Garbage";
  else if (data.category === "other") category = "Critical Infrastructure";

  // Severity mapping
  let severity: Severity = "MEDIUM";
  if (data.severity === "low") severity = "LOW";
  else if (data.severity === "moderate") severity = "MEDIUM";
  else if (data.severity === "high") severity = "HIGH";
  else if (data.severity === "critical") severity = "CRITICAL";

  // Status mapping
  let status: IssueStatus = "REPORTED";
  if (data.status === "verifying") status = "REPORTED";
  else if (data.status === "routed") status = "ROUTED";
  else if (data.status === "in_progress") status = "IN_PROGRESS";
  else if (data.status === "escalated") status = "ESCALATED";
  else if (data.status === "resolved") status = "RESOLVED";

  // Media Urls
  const mediaUrls: string[] = [];
  if (data.media?.photoUrl) mediaUrls.push(data.media.photoUrl);
  if (data.media?.videoUrl) mediaUrls.push(data.media.videoUrl);

  return {
    id: docId,
    title: data.title || "Civic Issue",
    category,
    description: data.description || "",
    severity,
    status,
    location: data.location?.address || "Coordinate Location",
    latitude: data.location?.lat || 0,
    longitude: data.location?.lng || 0,
    ward: data.location?.ward || "Ward 1 (Central)",
    createdBy: data.reportedBy?.[0] || "",
    createdByName: "Citizen",
    mediaUrls,
    voiceTranscript: data.media?.voiceTranscript || undefined,
    urgencyScore: data.urgencyScore || 20,
    threadId: data.parentIssueId || undefined,
    departmentId: data.departmentId || undefined,
    slaDays: 7, // Default
    createdAt: data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
    updatedAt: data.updatedAt?.toDate?.()?.toISOString() || new Date().toISOString()
  };
}

export const dbService = {
  initialize() {
    // Seeding is handled backend-side by calling the seedDepartments Cloud Function
    console.log("[dbService] Client Firestore database service initialized.");
  },

  // ISSUES
  async getIssues(): Promise<Issue[]> {
    const q = query(collection(db, "issues"), orderBy("createdAt", "desc"));
    const snapshot = await getDocs(q);
    const issuesList: Issue[] = [];
    
    snapshot.forEach((snapDoc) => {
      const data = snapDoc.data();
      // Filter out duplicate_merged from primary feeds if needed
      if (data.status !== "duplicate_merged") {
        issuesList.push(mapFirestoreIssueToFrontend(snapDoc.id, data));
      }
    });
    
    return issuesList;
  },

  async getIssueById(id: string): Promise<Issue | null> {
    const docRef = doc(db, "issues", id);
    const snap = await getDoc(docRef);
    if (!snap.exists()) return null;
    return mapFirestoreIssueToFrontend(snap.id, snap.data());
  },

  async createIssue(issue: Omit<Issue, "id" | "createdAt" | "updatedAt">): Promise<Issue> {
    console.log("[dbService] Creating report via submitReport Cloud Function...");
    const submitReportFn = httpsCallable(functions, "submitReport");
    
    const res = await submitReportFn({
      mediaType: "photo",
      rawMediaUrl: issue.mediaUrls && issue.mediaUrls.length > 0 ? issue.mediaUrls[0] : "https://placeholder.svg",
      userTextNote: issue.description,
      voiceNoteUrl: null,
      location: {
        lat: issue.latitude,
        lng: issue.longitude
      }
    });

    const { reportId } = res.data as { reportId: string };
    console.log(`[dbService] Report created with ID: ${reportId}. Waiting for Intake Agent processing...`);

    // Poll/wait for the report document to be updated with issueId by the background trigger
    const reportRef = doc(db, "reports", reportId);
    
    return new Promise<Issue>((resolve, reject) => {
      let attempts = 0;
      const unsubscribe = onSnapshot(reportRef, async (snapshot) => {
        const data = snapshot.data();
        attempts++;
        
        if (data && data.issueId) {
          unsubscribe();
          const issueObj = await this.getIssueById(data.issueId);
          if (issueObj) {
            resolve(issueObj);
          } else {
            reject(new Error("Linked issue document could not be retrieved."));
          }
        } else if (data && data.processingStatus === "failed") {
          unsubscribe();
          reject(new Error("Intake Agent processing failed."));
        } else if (attempts > 30) { // 30 second timeout
          unsubscribe();
          reject(new Error("AI Agent processing timed out."));
        }
      }, (error) => {
        unsubscribe();
        reject(error);
      });
    });
  },

  async updateIssue(id: string, updates: Partial<Issue>): Promise<Issue> {
    console.log(`[dbService] Updating issue ${id}...`);
    
    if (updates.status === "RESOLVED") {
      const resolveIssueFn = httpsCallable(functions, "resolveIssue");
      await resolveIssueFn({ issueId: id });
      
      const updated = await this.getIssueById(id);
      if (!updated) throw new Error("Updated issue not found.");
      return updated;
    }
    
    throw new Error("Direct client updates are not permitted by security rules.");
  },

  // THREADS
  async getThreads(): Promise<Thread[]> {
    const q = query(collection(db, "issues"), where("status", "==", "duplicate_merged"));
    const snapshot = await getDocs(q);
    const threads: Thread[] = [];
    
    // Group issues by parentId
    const groups: Record<string, string[]> = {};
    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      if (data.parentIssueId) {
        if (!groups[data.parentIssueId]) groups[data.parentIssueId] = [];
        groups[data.parentIssueId].push(docSnap.id);
      }
    });

    for (const [parentId, children] of Object.entries(groups)) {
      threads.push({
        id: parentId,
        issueIds: [parentId, ...children],
        confirmationCount: children.length,
        urgencyScore: 40,
        status: "ROUTED",
        createdAt: new Date().toISOString()
      });
    }

    return threads;
  },

  async getThreadById(id: string): Promise<Thread | null> {
    const parentDoc = await this.getIssueById(id);
    if (!parentDoc) return null;
    
    const q = query(collection(db, "issues"), where("parentIssueId", "==", id));
    const snapshot = await getDocs(q);
    const childrenIds: string[] = [];
    snapshot.forEach(docSnap => childrenIds.push(docSnap.id));

    return {
      id,
      issueIds: [id, ...childrenIds],
      confirmationCount: childrenIds.length + 1,
      urgencyScore: parentDoc.urgencyScore,
      status: parentDoc.status,
      createdAt: parentDoc.createdAt
    };
  },
  
  // REPORTS
  async getReports(userId: string): Promise<any[]> {
    const q = query(
      collection(db, "reports"),
      where("userId", "==", userId)
    );
    const snapshot = await getDocs(q);
    const list: any[] = [];
    
    for (const docSnap of snapshot.docs) {
      const data = docSnap.data();
      let issueDetails = null;
      if (data.issueId) {
        issueDetails = await this.getIssueById(data.issueId);
      }
      
      list.push({
        id: docSnap.id,
        ...data,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
        issue: issueDetails
      });
    }
    
    return list;
  },

  // DEPARTMENTS
  async getDepartments(): Promise<Department[]> {
    const q = query(collection(db, "departments"));
    const snapshot = await getDocs(q);
    const list: Department[] = [];
    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      list.push({
        id: docSnap.id,
        name: data.name,
        category: data.category,
        ward: data.ward,
        email: data.contactEmail,
        contactNumber: data.contactPhone || ""
      });
    });
    return list;
  },

  // COMPLAINTS (Read from issues directly in Firebase mode)
  async getComplaints(): Promise<Complaint[]> {
    const issues = await this.getIssues();
    return issues
      .filter((i) => i.departmentId && i.draftedComplaint)
      .map((i) => ({
        id: `complaint_${i.id}`,
        issueId: i.id,
        departmentId: i.departmentId!,
        generatedComplaint: i.draftedComplaint!,
        status: "SENT",
        createdAt: i.updatedAt
      }));
  },

  // ESCALATIONS (Read from issues directly in Firebase mode)
  async getEscalations(): Promise<Escalation[]> {
    const issues = await this.getIssues();
    return issues
      .filter((i) => i.isEscalated && i.escalationNotice)
      .map((i) => ({
        id: `esc_${i.id}`,
        issueId: i.id,
        escalationLevel: 1,
        generatedNotice: i.escalationNotice!,
        createdAt: i.updatedAt
      }));
  },

  // NOTIFICATIONS
  async getNotifications(userId: string): Promise<Notification[]> {
    const q = query(
      collection(db, "notifications"),
      where("userId", "==", userId),
      orderBy("createdAt", "desc")
    );
    const snapshot = await getDocs(q);
    const list: Notification[] = [];
    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      list.push({
        id: docSnap.id,
        userId: data.userId,
        title: data.title,
        body: data.body,
        read: data.read || false,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString()
      });
    });
    return list;
  },

  async markNotificationRead(id: string): Promise<void> {
    const resolveIssueFn = httpsCallable(functions, "markNotificationRead");
    await resolveIssueFn({ id });
  },

  // AGENT TELEMETRY LOGS
  async getAgentLogs(): Promise<AgentLog[]> {
    const q = query(collection(db, "agent_logs"), orderBy("timestamp", "desc"));
    const snapshot = await getDocs(q);
    const logs: AgentLog[] = [];
    
    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      
      // Map Firestore agent names to UI names
      let agentName: AgentLog["agentName"] = "Intake Agent";
      if (data.agentName === "intake") agentName = "Intake Agent";
      else if (data.agentName === "verification") agentName = "Verification Agent";
      else if (data.agentName === "routing") agentName = "Routing Agent";
      else if (data.agentName === "escalation") agentName = "Escalation Agent";

      logs.push({
        id: docSnap.id,
        timestamp: data.timestamp?.toDate?.()?.toISOString() || new Date().toISOString(),
        agentName,
        issueId: data.issueId || undefined,
        action: data.action,
        details: data.outputSummary || data.errorMessage || "",
        type: data.success ? "success" : "error"
      });
    });
    
    return logs;
  },

  async clearAgentLogs(): Promise<void> {
    const clearFn = httpsCallable(functions, "clearAgentLogs");
    await clearFn();
  }
};
