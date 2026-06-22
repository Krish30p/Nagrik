import { GoogleGenerativeAI } from "@google/generative-ai";
import { User, Issue, Thread, Department, Complaint, Escalation, Notification, AgentLog, SimulationState } from "../models";
import mongoose from "mongoose";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const genAI = GEMINI_API_KEY ? new GoogleGenerativeAI(GEMINI_API_KEY) : null;

// Helper to log agent telemetry
async function createAgentLog(
  agentName: "Intake Agent" | "Verification Agent" | "Routing Agent" | "Escalation Agent",
  action: string,
  details: string,
  type: "info" | "success" | "warning" | "error",
  issueId?: string
) {
  await AgentLog.create({
    agentName,
    issueId,
    action,
    details,
    type
  });
}

// Equirectangular approximation for coordinate distance in meters
function getDistanceInMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.cos(((lat1 + lat2) * Math.PI) / 360) * dLon;
  return Math.sqrt(dLat * dLat + a * a) * R;
}

export const intakeAgent = {
  async process(description: string, latitude: number, longitude: number, voiceTranscript?: string, imageUrl?: string, userId?: string, userName?: string, ward?: string) {
    await createAgentLog(
      "Intake Agent",
      "Activating Intake Agent Analysis",
      `Analyzing ticket:\n- Description: "${description}"\n- Voice Note: "${voiceTranscript || "N/A"}"`,
      "info"
    );

    const combinedText = `${description} ${voiceTranscript || ""}`.trim();
    let category: "Garbage" | "Streetlight" | "Pothole" | "Water Leakage" | "Critical Infrastructure" = "Garbage";
    let severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" = "MEDIUM";
    let title = "Civic Issue Reported";
    let landmarks = "Coordinates Location";

    if (genAI) {
      try {
        const model = genAI.getGenerativeModel({
          model: "gemini-2.5-flash",
          generationConfig: { responseMimeType: "application/json" }
        });

        const prompt = `
          Analyze this public report: "${combinedText}".
          Return a JSON object with this exact schema:
          {
            "title": "A short, concise 4-7 word title describing the issue",
            "category": "One of: 'Garbage' | 'Streetlight' | 'Pothole' | 'Water Leakage' | 'Critical Infrastructure'",
            "severity": "One of: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'",
            "landmarks": "Any landmarks, street details, or locations mentioned (max 50 chars)"
          }
        `;

        const response = await model.generateContent(prompt);
        const resText = response.response.text().trim();
        const cleaned = resText.replace(/^```json\s*/i, "").replace(/```$/, "").trim();
        const parsed = JSON.parse(cleaned);

        title = parsed.title || title;
        category = parsed.category || category;
        severity = parsed.severity || severity;
        landmarks = parsed.landmarks || landmarks;
      } catch (e: any) {
        console.error("Gemini Intake API Error, falling back to heuristics:", e);
      }
    } else {
      // Local Heuristics
      const norm = combinedText.toLowerCase();
      if (norm.includes("pothole") || norm.includes("crater") || norm.includes("road")) {
        category = "Pothole";
        severity = "HIGH";
        title = "Road Pothole Blockage";
      } else if (norm.includes("water") || norm.includes("leak") || norm.includes("pipe") || norm.includes("flood")) {
        category = "Water Leakage";
        severity = "CRITICAL";
        title = "Water Pipeline Leakage";
      } else if (norm.includes("light") || norm.includes("dark") || norm.includes("lamp") || norm.includes("electricity")) {
        category = "Streetlight";
        severity = "MEDIUM";
        title = "Broken Streetlight & Dark Alley";
      } else if (norm.includes("bridge") || norm.includes("collapse") || norm.includes("hazard")) {
        category = "Critical Infrastructure";
        severity = "CRITICAL";
        title = "Infrastructure Structural Hazard";
      }
    }

    const slaDays = category === "Garbage" ? 3 : category === "Streetlight" ? 5 : category === "Pothole" ? 7 : category === "Water Leakage" ? 2 : 1;

    // Create Issue Document in MongoDB
    const issue = await Issue.create({
      title,
      category,
      description,
      severity,
      status: "REPORTED",
      location: landmarks,
      latitude,
      longitude,
      ward: ward || "Ward 1 (Central)",
      createdBy: new mongoose.Types.ObjectId(userId),
      createdByName: userName || "Citizen",
      mediaUrls: imageUrl ? [imageUrl] : [],
      voiceTranscript: voiceTranscript || undefined,
      urgencyScore: 20,
      slaDays
    });

    await createAgentLog(
      "Intake Agent",
      "Analysis Completed",
      `Incident recorded with ID: \`${issue.id}\` ("${title}")\n- Category: \`${category}\`\n- Severity: \`${severity}\`\n- SLA Limit: \`${slaDays} days\``,
      "success",
      issue.id
    );

    return issue;
  }
};

export const verificationAgent = {
  async verify(issueId: string): Promise<void> {
    await createAgentLog(
      "Verification Agent",
      "Activating Verification Sweep",
      `Scanning MongoDB registries for coordinate overlaps matching Ticket: \`${issueId}\`.`,
      "info",
      issueId
    );

    const issue = await Issue.findById(issueId);
    if (!issue) return;

    const timeThresholdMs = 72 * 60 * 60 * 1000; // 72 Hours
    const createdTime = new Date(issue.createdAt).getTime();

    // Query active reports of the same category
    const candidates = await Issue.find({
      category: issue.category,
      _id: { $ne: issue._id },
      threadId: { $exists: true }
    });

    let duplicateMatch: any = null;
    for (const other of candidates) {
      const otherTime = new Date(other.createdAt).getTime();
      if (Math.abs(createdTime - otherTime) <= timeThresholdMs) {
        const distance = getDistanceInMeters(
          issue.latitude,
          issue.longitude,
          other.latitude,
          other.longitude
        );
        if (distance <= 50) {
          duplicateMatch = other;
          break;
        }
      }
    }

    let baseUrgency = 20;
    if (issue.severity === "MEDIUM") baseUrgency = 40;
    if (issue.severity === "HIGH") baseUrgency = 60;
    if (issue.severity === "CRITICAL") baseUrgency = 80;

    if (duplicateMatch) {
      const threadId = duplicateMatch.threadId;
      const thread = await Thread.findById(threadId);

      if (thread) {
        thread.issueIds.push(issue._id as mongoose.Types.ObjectId);
        thread.confirmationCount += 1;
        const newUrgency = Math.min(100, baseUrgency + (thread.confirmationCount * 15));
        thread.urgencyScore = newUrgency;
        await thread.save();

        issue.threadId = thread._id as mongoose.Types.ObjectId;
        issue.urgencyScore = newUrgency;
        issue.status = "VERIFIED";
        issue.departmentId = duplicateMatch.departmentId || undefined;
        await issue.save();

        // Citizen notifications
        await Notification.create({
          userId: issue.createdBy,
          title: "Report Verified & Merged",
          body: `Your ticket "${issue.title}" has been successfully merged into thread ${threadId}.`,
          read: false
        });

        // Award points
        await User.findByIdAndUpdate(issue.createdBy, {
          $inc: { points: 20, confirmationsCount: 1 }
        });

        await createAgentLog(
          "Verification Agent",
          "Duplicate Found & Aggregated",
          `Merged report into Thread: \`${threadId}\`.\n- Urgency upgraded to **${newUrgency}**\n- Verification payout processed (+20 points).`,
          "success",
          issue.id
        );
      }
    } else {
      // Unique report
      const thread = await Thread.create({
        issueIds: [issue._id],
        confirmationCount: 0,
        urgencyScore: baseUrgency,
        status: "VERIFIED"
      });

      issue.threadId = thread._id as mongoose.Types.ObjectId;
      issue.status = "VERIFIED";
      await issue.save();

      await createAgentLog(
        "Verification Agent",
        "Unique Report Verified",
        `Created new thread \`${thread.id}\` with urgency: **${baseUrgency}**.`,
        "success",
        issue.id
      );
    }
  }
};

export const routingAgent = {
  async route(issueId: string): Promise<void> {
    await createAgentLog(
      "Routing Agent",
      "Activating Routing Analysis",
      `Analyzing ticket and resolving authority for Issue ID: \`${issueId}\`.`,
      "info",
      issueId
    );

    const issue = await Issue.findById(issueId);
    if (!issue) return;

    let departmentId = "dept_pwd";
    if (issue.category === "Garbage") departmentId = "dept_garbage";
    else if (issue.category === "Streetlight") departmentId = "dept_electricity";
    else if (issue.category === "Pothole") departmentId = "dept_pwd";
    else if (issue.category === "Water Leakage") departmentId = "dept_water";
    else if (issue.category === "Critical Infrastructure") departmentId = "dept_infrastructure";

    const departments = await Department.findOne({ id: departmentId });
    const deptName = departments ? departments.name : "Public Works Department";

    // Official complaint draft template
    let letterContent = `OFFICIAL CIVIC ACTION COMPLAINT\nReference ID: CIV-${issueId.toUpperCase()}\n\nTO:\nThe Director / Chief Engineer\n${deptName}\n\nSUBJECT: Attention required: ${issue.title}\n\nDear Sir/Madam,\n\nWe bring to your attention a public defect regarding ${issue.title} located at ${issue.location}.\n\nSincerely,\nNagrik AI Operations`;

    if (genAI) {
      try {
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        const prompt = `
          Draft a formal, extremely professional, and government-grade complaint letter to be sent to a municipal department.
          - Ticket ID: ${issueId}
          - Department: ${deptName}
          - Category: ${issue.category}
          - Title: ${issue.title}
          - Description: ${issue.description}
          - Landmark / Location: ${issue.location}
          - Ward: ${issue.ward}
          - Severity: ${issue.severity}
          
          Output ONLY the letter content. No intro/outro commentary, no markdown.
        `;
        const response = await model.generateContent(prompt);
        letterContent = response.response.text().trim();
      } catch (e) {
        console.error("Gemini Routing complaint drafting error:", e);
      }
    }

    await Complaint.create({
      issueId: issue._id,
      departmentId,
      generatedComplaint: letterContent,
      status: "SENT"
    });

    issue.departmentId = departmentId;
    issue.status = "ROUTED";
    await issue.save();

    if (issue.threadId) {
      await Thread.findByIdAndUpdate(issue.threadId, { status: "ROUTED" });
    }

    await Notification.create({
      userId: issue.createdBy,
      title: "Complaint Routed",
      body: `Your ticket "${issue.title}" has been successfully routed to the ${deptName}.`,
      read: false
    });

    await createAgentLog(
      "Routing Agent",
      "Complaint Dispatched",
      `Ticket routed to \`${deptName}\`. Formal notice compiled and registered.`,
      "success",
      issueId
    );
  }
};

export const escalationAgent = {
  async sweep(): Promise<number> {
    await createAgentLog(
      "Escalation Agent",
      "SLA Sweep Active",
      "Sweep triggered. Auditing active SLA margins across database documents.",
      "info"
    );

    // Read time offset
    let timeOffset = 0;
    const simState = await SimulationState.findOne();
    if (simState) timeOffset = simState.timeOffsetMs;

    const currentTime = new Date(Date.now() + timeOffset);
    const activeIssues = await Issue.find({
      status: { $nin: ["RESOLVED", "ESCALATED"] }
    });

    let escalatedCount = 0;

    for (const issue of activeIssues) {
      const createdTime = new Date(issue.createdAt).getTime();
      const elapsedMs = currentTime.getTime() - createdTime;
      const slaMs = issue.slaDays * 24 * 60 * 60 * 1000;

      if (elapsedMs > slaMs) {
        escalatedCount++;
        const elapsedDays = (elapsedMs / (24 * 3600 * 1000)).toFixed(1);

        let newSeverity = issue.severity;
        if (issue.severity === "LOW") newSeverity = "MEDIUM";
        else if (issue.severity === "MEDIUM") newSeverity = "HIGH";
        else if (issue.severity === "HIGH") newSeverity = "CRITICAL";

        const warningNotice = `SLA warning issued for ticket ${issue.id}. SLA Limit: ${issue.slaDays} days. Total Elapsed: ${elapsedDays} days. Upgrading priority.`;

        await Escalation.create({
          issueId: issue._id,
          escalationLevel: 1,
          generatedNotice: warningNotice
        });

        issue.status = "ESCALATED";
        issue.severity = newSeverity;
        await issue.save();

        if (issue.threadId) {
          await Thread.findByIdAndUpdate(issue.threadId, { status: "ESCALATED" });
        }

        await Notification.create({
          userId: issue.createdBy,
          title: "URGENT: SLA Escalated",
          body: `Your ticket "${issue.title}" breached its SLA deadline and has been escalated.`,
          read: false
        });

        await createAgentLog(
          "Escalation Agent",
          "SLA Breach Triggered",
          `Ticket \`${issue.id}\` breached SLA limit (${issue.slaDays} days). Upgraded severity to **${newSeverity}**.`,
          "warning",
          issue.id
        );
      }
    }

    await createAgentLog(
      "Escalation Agent",
      "SLA Sweep Completed",
      `Completed sweep. Escalated **${escalatedCount}** active tickets.`,
      escalatedCount > 0 ? "warning" : "success"
    );

    return escalatedCount;
  }
};
