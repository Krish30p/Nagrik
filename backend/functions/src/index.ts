import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { GoogleGenerativeAI } from "@google/generative-ai";

admin.initializeApp();
const db = admin.firestore();

// Fetch Gemini API Key from environment config or environment variables
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || functions.config().gemini?.key || "";

// Initialize Generative AI
const genAI = GEMINI_API_KEY ? new GoogleGenerativeAI(GEMINI_API_KEY) : null;

// Equirectangular approximation for coordinate distance in meters
function getDistanceInMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.cos(((lat1 + lat2) * Math.PI) / 360) * dLon;
  return Math.sqrt(dLat * dLat + a * a) * R;
}

// Logging helper for Agent Telemetry
async function createAgentLog(
  agentName: "Intake Agent" | "Verification Agent" | "Routing Agent" | "Escalation Agent",
  action: string,
  details: string,
  type: "info" | "success" | "warning" | "error",
  issueId?: string
) {
  const logRef = db.collection("agent_logs").doc();
  await logRef.set({
    id: logRef.id,
    timestamp: new Date().toISOString(),
    agentName,
    issueId: issueId || null,
    action,
    details,
    type
  });
}

// ----------------------------------------------------
// 1. INTAKE AGENT: HTTP Callable
// ----------------------------------------------------
export const intakeAgent = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Authentication required");
  }

  const { description, latitude, longitude, voiceTranscript, imageUrl } = data;
  if (!description) {
    throw new functions.https.HttpsError("invalid-argument", "Description is required");
  }

  await createAgentLog(
    "Intake Agent",
    "Server-side Intake Analysis",
    `Received report payload:\n- Description: "${description}"\n- Voice Note: "${voiceTranscript || "None"}"`,
    "info"
  );

  const combinedText = `${description} ${voiceTranscript || ""}`.trim();
  let category: "Garbage" | "Streetlight" | "Pothole" | "Water Leakage" | "Critical Infrastructure" = "Garbage";
  let severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" = "MEDIUM";
  let title = "Civic Issue Reported";
  let landmarks = "Coordinates Location";

  // If Gemini is available, call it, otherwise fall back to keyword logic
  if (genAI) {
    try {
      const model = genAI.getGenerativeModel({
        model: "gemini-2.5-flash",
        generationConfig: { responseMimeType: "application/json" }
      });

      const prompt = `
        Analyze this citizen report: "${combinedText}".
        Extract and return a JSON object with:
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
      console.error("Gemini Intake Error:", e);
    }
  } else {
    // Basic Local rules fallback
    const norm = combinedText.toLowerCase();
    if (norm.includes("pothole") || norm.includes("road") || norm.includes("street broken")) {
      category = "Pothole";
      severity = "HIGH";
      title = "Road Pothole Blockage";
    } else if (norm.includes("water") || norm.includes("leak") || norm.includes("pipe")) {
      category = "Water Leakage";
      severity = "CRITICAL";
      title = "Water Pipeline Leakage";
    } else if (norm.includes("light") || norm.includes("dark") || norm.includes("lamp")) {
      category = "Streetlight";
      severity = "MEDIUM";
      title = "Broken Streetlight & Dark Alley";
    } else if (norm.includes("bridge") || norm.includes("collapse") || norm.includes("hazard")) {
      category = "Critical Infrastructure";
      severity = "CRITICAL";
      title = "Infrastructure Structural Hazard";
    }
  }

  // Calculate SLA Days
  const slaDays = category === "Garbage" ? 3 : category === "Streetlight" ? 5 : category === "Pothole" ? 7 : category === "Water Leakage" ? 2 : 1;

  // Save to Firestore
  const issueRef = db.collection("issues").doc();
  const issueData = {
    id: issueRef.id,
    title,
    category,
    description,
    severity,
    status: "REPORTED",
    location: landmarks,
    latitude,
    longitude,
    ward: data.ward || "Ward 1 (Central)",
    createdBy: context.auth.uid,
    createdByName: context.auth.token.name || "Citizen",
    mediaUrls: imageUrl ? [imageUrl] : [],
    voiceTranscript: voiceTranscript || null,
    urgencyScore: 20,
    slaDays,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  await issueRef.set(issueData);

  await createAgentLog(
    "Intake Agent",
    "Ticket Logged Successfully",
    `Logged Issue ID: \`${issueRef.id}\` ("${title}")\n- Category: \`${category}\`\n- Severity: \`${severity}\``,
    "success",
    issueRef.id
  );

  return { success: true, issueId: issueRef.id };
});

// ----------------------------------------------------
// 2. VERIFICATION AGENT: Firestore Document Trigger
// ----------------------------------------------------
export const verifyAgent = functions.firestore
  .document("issues/{issueId}")
  .onCreate(async (snapshot, context) => {
    const issueId = context.params.issueId;
    const issue = snapshot.data();
    if (!issue) return;

    await createAgentLog(
      "Verification Agent",
      "Activating Duplicate Check",
      `Scanning nearby active threads for Issue ID: \`${issueId}\`.`,
      "info",
      issueId
    );

    const timeThresholdMs = 72 * 60 * 60 * 1000;
    const createdTime = new Date(issue.createdAt).getTime();

    // Query active issues of the same category
    const issuesSnapshot = await db
      .collection("issues")
      .where("category", "==", issue.category)
      .get();

    let duplicateMatch: any = null;

    issuesSnapshot.forEach((doc) => {
      const other = doc.data();
      if (other.id === issue.id || !other.threadId) return;

      const otherTime = new Date(other.createdAt).getTime();
      const timeDiff = Math.abs(createdTime - otherTime);

      if (timeDiff <= timeThresholdMs) {
        const distance = getDistanceInMeters(
          issue.latitude,
          issue.longitude,
          other.latitude,
          other.longitude
        );

        if (distance <= 50) {
          duplicateMatch = other;
        }
      }
    });

    let baseUrgency = 20;
    if (issue.severity === "MEDIUM") baseUrgency = 40;
    if (issue.severity === "HIGH") baseUrgency = 60;
    if (issue.severity === "CRITICAL") baseUrgency = 80;

    if (duplicateMatch) {
      // Merge report
      const threadId = duplicateMatch.threadId;
      const threadRef = db.collection("threads").doc(threadId);
      const threadDoc = await threadRef.get();

      if (threadDoc.exists) {
        const threadData = threadDoc.data()!;
        const newIssueIds = [...threadData.issueIds, issueId];
        const newConfirmCount = threadData.confirmationCount + 1;
        const newUrgency = Math.min(100, baseUrgency + (newConfirmCount * 15));

        await threadRef.update({
          issueIds: newIssueIds,
          confirmationCount: newConfirmCount,
          urgencyScore: newUrgency
        });

        await snapshot.ref.update({
          threadId,
          urgencyScore: newUrgency,
          status: "VERIFIED",
          departmentId: duplicateMatch.departmentId || null
        });

        // Add Notification
        const notifRef = db.collection("notifications").doc();
        await notifRef.set({
          id: notifRef.id,
          userId: issue.createdBy,
          title: "Report Verified & Merged",
          body: `Your report has been verified as a match for an existing thread.`,
          read: false,
          createdAt: new Date().toISOString()
        });

        await createAgentLog(
          "Verification Agent",
          "Duplicate Identified & Merged",
          `Merged with issue: \`${duplicateMatch.id}\` in Thread: \`${threadId}\`. Updated Urgency: **${newUrgency}**.`,
          "success",
          issueId
        );
      }
    } else {
      // Create new thread
      const threadRef = db.collection("threads").doc();
      await threadRef.set({
        id: threadRef.id,
        issueIds: [issueId],
        confirmationCount: 0,
        urgencyScore: baseUrgency,
        status: "VERIFIED",
        createdAt: new Date().toISOString()
      });

      await snapshot.ref.update({
        threadId: threadRef.id,
        urgencyScore: baseUrgency,
        status: "VERIFIED"
      });

      await createAgentLog(
        "Verification Agent",
        "Unique Report Verified",
        `Created new thread \`${threadRef.id}\` with base urgency: **${baseUrgency}**.`,
        "success",
        issueId
      );
    }
  });

// ----------------------------------------------------
// 3. ROUTING AGENT: Firestore Document Trigger
// ----------------------------------------------------
export const routeAgent = functions.firestore
  .document("issues/{issueId}")
  .onUpdate(async (change, context) => {
    const issueId = context.params.issueId;
    const oldData = change.before.data();
    const newData = change.after.data();

    // Trigger only when status changes to VERIFIED
    if (oldData.status === newData.status || newData.status !== "VERIFIED") return;

    await createAgentLog(
      "Routing Agent",
      "Activating Routing Analysis",
      `Analyzing ticket and resolving authority for Issue ID: \`${issueId}\`.`,
      "info",
      issueId
    );

    let departmentId = "dept_pwd";
    if (newData.category === "Garbage") departmentId = "dept_garbage";
    else if (newData.category === "Streetlight") departmentId = "dept_electricity";
    else if (newData.category === "Pothole") departmentId = "dept_pwd";
    else if (newData.category === "Water Leakage") departmentId = "dept_water";
    else if (newData.category === "Critical Infrastructure") departmentId = "dept_infrastructure";

    const deptName = {
      dept_garbage: "Sanitation & Waste Management Department",
      dept_electricity: "Municipal Electricity & Public Lighting Board",
      dept_pwd: "Public Works Department (PWD)",
      dept_water: "Water Supply and Sewerage Board",
      dept_infrastructure: "Critical Infrastructure & Public Safety Commission"
    }[departmentId as "dept_garbage" | "dept_electricity" | "dept_pwd" | "dept_water" | "dept_infrastructure"] || "Public Works Department";

    // Draft formal complaint
    let letterContent = `OFFICIAL CIVIC ACTION COMPLAINT\nReference ID: CIV-${issueId.toUpperCase()}\n\nTO:\nThe Director / Chief Engineer\n${deptName}\n\nSUBJECT: Attention required for ${newData.title}\n\nDear Sir/Madam,\n\nWe bring to your immediate attention a public defect regarding ${newData.title} reported at ${newData.location}.\n\nSincerely,\nNagrik Operations`;

    if (genAI) {
      try {
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        const prompt = `
          Draft a formal, extremely professional, and government-grade complaint letter to be sent to a municipal department.
          - Ticket ID: ${issueId}
          - Department: ${deptName}
          - Category: ${newData.category}
          - Title: ${newData.title}
          - Description: ${newData.description}
          - Landmark / Location: ${newData.location}
          - Ward: ${newData.ward}
          - Severity: ${newData.severity}
          
          Output ONLY the letter content. No intro/outro commentary, no markdown.
        `;
        const response = await model.generateContent(prompt);
        letterContent = response.response.text().trim();
      } catch (e) {
        console.error("Gemini Complaint Drafting Error:", e);
      }
    }

    // Save Complaint
    const compRef = db.collection("complaints").doc();
    await compRef.set({
      id: compRef.id,
      issueId,
      departmentId,
      generatedComplaint: letterContent,
      status: "SENT",
      createdAt: new Date().toISOString()
    });

    // Update Issue status to ROUTED
    await change.after.ref.update({
      departmentId,
      status: "ROUTED"
    });

    // Notify user
    const notifRef = db.collection("notifications").doc();
    await notifRef.set({
      id: notifRef.id,
      userId: newData.createdBy,
      title: "Complaint Routed",
      body: `Your ticket "${newData.title}" has been successfully routed to the ${deptName}.`,
      read: false,
      createdAt: new Date().toISOString()
    });

    await createAgentLog(
      "Routing Agent",
      "Complaint Dispatched",
      `Ticket routed to \`${deptName}\`. Formal notice compiled and registered.`,
      "success",
      issueId
    );
  });

// ----------------------------------------------------
// 4. ESCALATION AGENT: HTTP trigger (sweep + SLA compliance check)
// ----------------------------------------------------
export const checkSLAAndEscalate = functions.https.onRequest(async (req, res) => {
  await createAgentLog(
    "Escalation Agent",
    "SLA Sweep Active",
    "Initiating compliance scan across all active database registries.",
    "info"
  );

  // Read simulated time offset if exists
  let timeOffset = 0;
  const simStateDoc = await db.collection("config").doc("simulation_state").get();
  if (simStateDoc.exists) {
    timeOffset = simStateDoc.data()?.timeOffsetMs || 0;
  }

  const currentTime = new Date(Date.now() + timeOffset);
  const issuesSnapshot = await db.collection("issues").get();
  let escalatedCount = 0;

  for (const doc of issuesSnapshot.docs) {
    const issue = doc.data();
    if (issue.status === "RESOLVED" || issue.status === "ESCALATED") continue;

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

      // Create Escalation Document
      const escRef = db.collection("escalations").doc();
      await escRef.set({
        id: escRef.id,
        issueId: issue.id,
        escalationLevel: 1,
        generatedNotice: `SLA warning issued for ticket ${issue.id}. SLA Limit: ${issue.slaDays} days. Total Elapsed: ${elapsedDays} days.`,
        createdAt: new Date().toISOString()
      });

      // Update Issue Status
      await doc.ref.update({
        status: "ESCALATED",
        severity: newSeverity
      });

      // Send User Notification
      const notifRef = db.collection("notifications").doc();
      await notifRef.set({
        id: notifRef.id,
        userId: issue.createdBy,
        title: "URGENT: Issue Escalated",
        body: `Your ticket "${issue.title}" breached its SLA deadline and has been escalated.`,
        read: false,
        createdAt: new Date().toISOString()
      });

      await createAgentLog(
        "Escalation Agent",
        "SLA Breach Triggered",
        `Ticket \`${issue.id}\` breached SLA limit. Notice drafted and priority upgraded.`,
        "warning",
        issue.id
      );
    }
  }

  await createAgentLog(
    "Escalation Agent",
    "SLA Sweep Completed",
    `Completed sweeps. Escalated **${escalatedCount}** active tickets.`,
    escalatedCount > 0 ? "warning" : "success"
  );

  res.status(200).send({ success: true, escalated: escalatedCount });
});
