import { User, Report, Issue, Department, AgentLog, Config, SimulationState, Notification } from "../models";
import mongoose from "mongoose";

const getNvidiaApiKey = () => process.env.GEMINI_API_KEY || "";

let requestQueue: Promise<any> = Promise.resolve();

async function callNvidiaNIM(promptText: string): Promise<string> {
  if (!getNvidiaApiKey()) throw new Error("NVIDIA_API_KEY is not set.");

  // Chain the request to the queue to ensure sequential execution and rate spacing
  const result = requestQueue.then(async () => {
    console.log("[Nvidia NIM Queue] Waiting 2 seconds to space out API requests...");
    await new Promise((resolve) => setTimeout(resolve, 2000));

    console.log("[Nvidia NIM Queue] Sending request to Nvidia API...");
    const response = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${getNvidiaApiKey()}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "meta/llama-3.1-70b-instruct",
        messages: [{ role: "user", content: promptText }]
      })
    });
    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Nvidia API error: ${response.status} ${errText}`);
    }
    const data = await response.json();
    return data.choices[0].message.content;
  });

  // Keep the queue moving even if this request fails
  requestQueue = result.catch(() => {});

  return result;
}

function parseJson(text: string): any {
  try {
    const cleaned = text.replace(/```json/g, "").replace(/```/g, "").trim();
    return JSON.parse(cleaned);
  } catch (e) {
    console.error("Failed to parse JSON:", text);
    throw e;
  }
}

// ==========================================
// SHARED AGENT HELPERS
// ==========================================
async function writeAgentLog(
  agentName: "intake" | "verification" | "routing" | "escalation",
  action: string,
  inputSummary: string,
  outputSummary: string,
  success: boolean,
  errorMessage: string | null,
  issueId: mongoose.Types.ObjectId | null,
  reportId: mongoose.Types.ObjectId | null
) {
  try {
    await AgentLog.create({
      agentName,
      issueId,
      reportId,
      action,
      inputSummary,
      outputSummary,
      success,
      errorMessage,
      timestamp: new Date()
    });
  } catch (err) {
    console.error("[Agent Log Helper] Error writing agent log:", err);
  }
}

// Coordinate distance helper
function getDistanceInMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.cos(((lat1 + lat2) * Math.PI) / 360) * dLon;
  return Math.sqrt(dLat * dLat + a * a) * R;
}

// WebSocket notifier hook
let wsBroadcastCallback: ((collectionName: string) => void) | null = null;
export function setWsNotifier(callback: (collectionName: string) => void) {
  wsBroadcastCallback = callback;
}
export function notifyCollectionChange(collectionName: string) {
  if (wsBroadcastCallback) {
    wsBroadcastCallback(collectionName);
  }
}

// ==========================================
// 1. INTAKE AGENT
// ==========================================
export const intakeAgent = {
  async process(reportId: mongoose.Types.ObjectId): Promise<mongoose.Types.ObjectId | null> {
    console.log(`[Intake Agent] Triggered for Report: ${reportId}`);
    const report = await Report.findById(reportId);
    if (!report) {
      console.error(`[Intake Agent] Report not found: ${reportId}`);
      return null;
    }

    const config = await Config.findById("global") || {
      mergeRadiusMeters: 50,
      mergeTimeWindowHours: 72,
      categorySlaHours: { pothole: 72, water_leak: 24, streetlight: 48, garbage: 24, drainage: 48, road_damage: 96, other: 72 }
    };

    let category: "pothole" | "water_leak" | "streetlight" | "garbage" | "drainage" | "road_damage" | "other" = "other";
    let severity: "low" | "moderate" | "high" | "critical" = "moderate";
    let title = "New report pending review";
    let description = "Automatic classification failed; manual review required.";
    let success = false;
    let errorMessage: string | null = null;

    if (getNvidiaApiKey()) {
      try {
        const promptText = `
          You are a civic infrastructure inspector AI. You will be shown details of a 
          potential public infrastructure issue (such as a pothole, water leak, broken 
          streetlight, garbage accumulation, or road damage) along with optional citizen notes. 
          Your job is to classify the issue accurately and conservatively, and 
          write a clear, neutral, factual title and description suitable for a municipal 
          complaint record.

          Rules:
          - Do not exaggerate severity. Base severity strictly on details.
          - If description does not clearly show a civic infrastructure issue, classify 
            category as "other" and note this in the description rather than guessing.
          - Do not include any speculation about who is at fault.
          - Keep the title under 12 words. Keep the description under 280 characters.
          - Write in a neutral, professional register — this text may be shown to 
            municipal staff.

          Citizen Note: "${report.userTextNote || "No text note provided."}"
          Media URL reference: "${report.rawMediaUrl}"
          Media type: "${report.mediaType}"

          Classify this issue and respond ONLY in the required JSON structure.
          The JSON must have the following keys:
          - "category": one of ["pothole", "water_leak", "streetlight", "garbage", "drainage", "road_damage", "other"]
          - "severity": one of ["low", "moderate", "high", "critical"]
          - "title": string
          - "description": string
        `;

        const responseText = await callNvidiaNIM(promptText);
        const parsed = parseJson(responseText);

        category = parsed.category;
        severity = parsed.severity;
        title = parsed.title;
        description = parsed.description;
        success = true;
      } catch (err: any) {
        errorMessage = err.message || "Gemini processing failed";
        console.error("[Intake Agent] Gemini API error, applying fallbacks:", err);
      }
    } else {
      errorMessage = "Gemini API key missing; applied rule-based heuristics.";
    }

    if (!success) {
      // Local Heuristics Fallback
      const text = (report.userTextNote || "").toLowerCase();
      if (text.includes("pothole") || text.includes("crater") || text.includes("road")) {
        category = "pothole";
        severity = "moderate";
        title = "Pothole detected on road surface";
        description = "A pothole has been reported on the street surface, creating a hazard for vehicular traffic.";
        success = true;
      } else if (text.includes("water") || text.includes("leak") || text.includes("pipe") || text.includes("flow")) {
        category = "water_leak";
        severity = "high";
        title = "Water pipeline leakage reported";
        description = "Clean drinking water is leaking from a pipe onto the public roadway.";
        success = true;
      } else if (text.includes("light") || text.includes("lamp") || text.includes("dark") || text.includes("electricity")) {
        category = "streetlight";
        severity = "moderate";
        title = "Non-functional streetlight reported";
        description = "A streetlight bulb is reported out or damaged, leaving the public pathway in darkness.";
        success = true;
      } else if (text.includes("garbage") || text.includes("waste") || text.includes("trash") || text.includes("dump")) {
        category = "garbage";
        severity = "low";
        title = "Accumulated garbage pile reported";
        description = "Unattended garbage and refuse has accumulated on the sidewalk/street corner.";
        success = true;
      } else if (text.includes("drain") || text.includes("sewer") || text.includes("clog")) {
        category = "drainage";
        severity = "high";
        title = "Clogged drainage channel reported";
        description = "Sewerage/rain water drainage appears blocked, causing localized overflow.";
        success = true;
      } else {
        category = "other";
        severity = "moderate";
        title = "Civic infrastructure issue logged";
        description = report.userTextNote || "Citizen reported an infrastructure incident. Requires manual review.";
        success = true;
      }
    }

    // Create Issue
    const issue = await Issue.create({
      title,
      description,
      category,
      severity,
      status: "verifying",
      isEscalated: false,
      priorityTier: 1,
      urgencyScore: 20,
      location: {
        type: "Point",
        coordinates: report.location.coordinates, // [lng, lat]
        address: null, // Reverse-geocoded during routing
        ward: null
      },
      media: {
        photoUrl: report.mediaType === "photo" ? report.rawMediaUrl : null,
        videoUrl: report.mediaType === "video" ? report.rawMediaUrl : null,
        voiceNoteUrl: report.voiceNoteUrl,
        voiceTranscript: report.userTextNote
      },
      reportedBy: [report.userId],
      confirmationCount: 1,
      primaryReportId: report._id,
      departmentId: null,
      draftedComplaint: null,
      escalationNotice: null,
      escalationCount: 0,
      slaDeadline: null,
      parentIssueId: null,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    // Update Report
    report.issueId = issue._id as mongoose.Types.ObjectId;
    report.processingStatus = success ? "processed" : "failed";
    await report.save();

    await writeAgentLog(
      "intake",
      "classified_issue",
      `New report submitted by User: ${report.userId}`,
      `Classified as ${category} (${severity}): "${title}"`,
      success,
      errorMessage,
      issue._id as mongoose.Types.ObjectId,
      report._id as mongoose.Types.ObjectId
    );

    notifyCollectionChange("issues");
    notifyCollectionChange("agent_logs");

    // Call Verification Agent
    await verificationAgent.verify(issue._id as mongoose.Types.ObjectId);

    return issue._id as mongoose.Types.ObjectId;
  }
};

// ==========================================
// 2. VERIFICATION AGENT
// ==========================================
export const verificationAgent = {
  async verify(newIssueId: mongoose.Types.ObjectId): Promise<void> {
    console.log(`[Verification Agent] Triggered for Issue: ${newIssueId}`);
    const issue = await Issue.findById(newIssueId);
    if (!issue) return;

    const config = await Config.findById("global") || {
      mergeRadiusMeters: 50,
      mergeTimeWindowHours: 72,
      civicPointsPerConfirmation: 5
    };

    const timeWindowLimit = new Date(Date.now() - config.mergeTimeWindowHours * 60 * 60 * 1000);

    // native 2dsphere location query
    const candidates = await Issue.find({
      category: issue.category,
      _id: { $ne: issue._id },
      status: { $nin: ["resolved", "duplicate_merged"] },
      createdAt: { $gte: timeWindowLimit },
      location: {
        $nearSphere: {
          $geometry: {
            type: "Point",
            coordinates: issue.location.coordinates // [lng, lat]
          },
          $maxDistance: config.mergeRadiusMeters
        }
      }
    });

    let matchedIssue: any = null;
    let confidence = 0;
    let reasoning = "";

    if (candidates.length > 0) {
      // Pick first matching candidate (usually nearest)
      const candidate = candidates[0];
      const distance = getDistanceInMeters(
        issue.location.coordinates[1], issue.location.coordinates[0],
        candidate.location.coordinates[1], candidate.location.coordinates[0]
      );
      
      const hoursApart = Math.abs(issue.createdAt.getTime() - candidate.createdAt.getTime()) / (3600 * 1000);

      if (getNvidiaApiKey()) {
        try {
          const promptText = `
            You are comparing two citizen reports of civic infrastructure issues to 
            determine if they describe the SAME real-world problem (e.g., the same 
            pothole, the same broken streetlight) rather than two different nearby 
            problems.

            Report A (existing): "${candidate.description}"
            Report B (new): "${issue.description}"

            Distance between reports: ${distance.toFixed(1)} meters
            Time between reports: ${hoursApart.toFixed(1)} hours

            Respond ONLY in the required JSON structure with your judgment.
            The JSON must have the following keys:
            - "isSameIssue": boolean
            - "confidence": number (0 to 1)
            - "reasoning": string
          `;

          const responseText = await callNvidiaNIM(promptText);
          const parsed = parseJson(responseText);

          if (parsed.isSameIssue && parsed.confidence >= 0.6) {
            matchedIssue = candidate;
            confidence = parsed.confidence;
            reasoning = parsed.reasoning;
          }
        } catch (err) {
          console.error("[Verification Agent] Gemini match failed, applying distance fallback:", err);
          // Fallback to pure distance
          if (distance <= config.mergeRadiusMeters) {
            matchedIssue = candidate;
            confidence = 0.8;
            reasoning = `Fallback: Distance of ${distance.toFixed(1)}m is within ${config.mergeRadiusMeters}m limit.`;
          }
        }
      } else {
        // Deterministic Fallback Mode
        if (distance <= config.mergeRadiusMeters) {
          matchedIssue = candidate;
          confidence = 0.9;
          reasoning = `Deterministic match: Coordinates within ${distance.toFixed(1)}m (limit is ${config.mergeRadiusMeters}m).`;
        }
      }
    }

    if (matchedIssue) {
      // 1. Update matched canonical issue
      const reportedBy = matchedIssue.reportedBy || [];
      const reporterId = issue.reportedBy[0];
      if (!reportedBy.some((id: any) => id.toString() === reporterId.toString())) {
        reportedBy.push(reporterId);
      }

      const newConfirmationCount = matchedIssue.confirmationCount + 1;
      const severityWeights: Record<string, number> = { low: 1, moderate: 2, high: 3, critical: 5 };
      const weight = severityWeights[matchedIssue.severity] || 2;
      const newUrgencyScore = weight * newConfirmationCount * (matchedIssue.isEscalated ? 1.5 : 1);

      await Issue.findByIdAndUpdate(matchedIssue._id, {
        reportedBy,
        confirmationCount: newConfirmationCount,
        urgencyScore: newUrgencyScore,
        updatedAt: new Date()
      });

      // 2. Update new issue to duplicate_merged status
      issue.status = "duplicate_merged";
      issue.parentIssueId = matchedIssue._id as mongoose.Types.ObjectId;
      issue.updatedAt = new Date();
      await issue.save();

      // 3. Update report to point to canonical issue
      await Report.findByIdAndUpdate(issue.primaryReportId, {
        issueId: matchedIssue._id
      });

      // 4. Reward confirmation points to reporter and create notification
      const user = await User.findById(reporterId);
      if (user) {
        user.civicPoints += config.civicPointsPerConfirmation;
        user.confirmationsCount += 1;
        await user.save();

        await Notification.create({
          userId: user.authUserId,
          title: "Report Merged (Duplicate)",
          body: `Your report has been identified as a duplicate of an existing issue "${matchedIssue.title}" and merged. You earned ${config.civicPointsPerConfirmation} civic points!`,
          read: false
        });
        notifyCollectionChange("notifications");
      }

      // Log merge
      await writeAgentLog(
        "verification",
        "merged_duplicate",
        `Comparing new issue ${issue._id} with candidate ${matchedIssue._id}`,
        `Merged duplicate (confidence ${confidence}). Reason: ${reasoning}`,
        true,
        null,
        issue._id as mongoose.Types.ObjectId,
        issue.primaryReportId
      );

      notifyCollectionChange("issues");
      notifyCollectionChange("agent_logs");
      notifyCollectionChange("users");
    } else {
      // Standalone issue
      await writeAgentLog(
        "verification",
        "confirmed_standalone",
        `Scanning nearby reports for category: ${issue.category}`,
        `No duplicates found. Issue confirmed standalone.`,
        true,
        null,
        issue._id as mongoose.Types.ObjectId,
        issue.primaryReportId
      );

      notifyCollectionChange("agent_logs");

      // Call Routing Agent
      await routingAgent.route(issue._id as mongoose.Types.ObjectId);
    }
  }
};

// ==========================================
// 3. ROUTING AGENT
// ==========================================
export const routingAgent = {
  async route(issueId: mongoose.Types.ObjectId): Promise<void> {
    console.log(`[Routing Agent] Triggered for Issue: ${issueId}`);
    const issue = await Issue.findById(issueId);
    if (!issue) return;

    const config = await Config.findById("global") || {
      categorySlaHours: { pothole: 72, water_leak: 24, streetlight: 48, garbage: 24, drainage: 48, road_damage: 96, other: 72 }
    };

    // Step 1: Reverse-geocode ward (using simple helper or ward selected in creation)
    // In our simplified mock, we use the ward that the report passed, e.g. "Ward 1"
    const resolvedWard = issue.location.ward || "Ward 1";

    // Step 2: Match department
    let department = await Department.findOne({ category: issue.category, ward: resolvedWard });
    if (!department) {
      department = await Department.findOne({ category: issue.category, ward: "citywide" });
    }

    const deptName = department ? department.name : "Municipal Public Works Department";
    let complaintText = `OFFICIAL CIVIC ACTION COMPLAINT\nReference ID: CIV-${issueId.toString().toUpperCase()}\n\nTO:\n${deptName}\n\nSUBJECT: Attention required: ${issue.title}\n\nDear Sir/Madam,\n\nWe bring to your attention a public defect regarding ${issue.title} located at coordinates ${issue.location.coordinates[1]}, ${issue.location.coordinates[0]}.\n\nSincerely,\nNagrik AI Operations`;
    let success = false;
    let errorMessage: string | null = null;

    if (getNvidiaApiKey() && department) {
      try {
        const promptText = `
          You are drafting a formal civic complaint on behalf of citizens, to be sent to 
          a municipal department. Use a professional, respectful, factual tone. Do not 
          use exaggerated or emotional language. Structure the complaint as:

          1. Subject line
          2. Department being addressed
          3. Issue summary (what, where, when first reported)
          4. Severity assessment
          5. Number of citizens who have confirmed this issue
          6. Requested action and a reasonable timeframe
          7. Closing line noting this was compiled by an automated civic reporting 
             system on behalf of verified citizen reports

          Issue details:
          - Category: ${issue.category}
          - Title: ${issue.title}
          - Description: ${issue.description}
          - Severity: ${issue.severity}
          - Location: Coordinates ${issue.location.coordinates[1]}, ${issue.location.coordinates[0]}, Ward: ${resolvedWard}
          - First reported: ${issue.createdAt.toISOString()}
          - Citizens confirming this issue: ${issue.confirmationCount}
          - Department: ${deptName}

          Write the complete complaint document now. Do not wrap in quotes or codeblocks, just the plain text.
        `;

        complaintText = await callNvidiaNIM(promptText);
        success = true;
      } catch (err: any) {
        errorMessage = err.message || "Gemini drafting failed";
        console.error("[Routing Agent] Gemini complaint draft failed, applying fallback:", err);
      }
    } else {
      success = true; // Fallback counts as success to keep pipeline routed
    }

    const slaHours = config.categorySlaHours[issue.category] || 72;
    const slaDeadline = new Date(Date.now() + slaHours * 60 * 60 * 1000);

    // Update Issue
    issue.departmentId = department ? (department._id as mongoose.Types.ObjectId) : null;
    issue.draftedComplaint = complaintText;
    issue.status = "routed";
    issue.slaDeadline = slaDeadline;
    issue.updatedAt = new Date();
    await issue.save();

    await writeAgentLog(
      "routing",
      "drafted_complaint",
      `Routing issue ${issue._id} to ${deptName}`,
      `Complaint drafted successfully. SLA set to ${slaHours} hours.`,
      success,
      errorMessage,
      issue._id as mongoose.Types.ObjectId,
      issue.primaryReportId
    );

    // Notify the primary reporter
    const originalReporter = await User.findById(issue.reportedBy[0]);
    if (originalReporter) {
      await Notification.create({
        userId: originalReporter.authUserId,
        title: "Report Routed",
        body: `Your report has been successfully processed and routed to the "${deptName}" department.`,
        read: false
      });
      notifyCollectionChange("notifications");
    }

    notifyCollectionChange("issues");
    notifyCollectionChange("agent_logs");
  }
};

// ==========================================
// 4. ESCALATION AGENT
// ==========================================
export const escalationAgent = {
  async sweep(): Promise<number> {
    console.log("[Escalation Agent] Sweep triggered.");
    
    // Read simulation offset
    const simState = await SimulationState.findOne() || { timeOffsetMs: 0 };
    const simulatedTime = new Date(Date.now() + simState.timeOffsetMs);

    // Find overdue active issues
    const overdueIssues = await Issue.find({
      status: { $nin: ["resolved", "duplicate_merged", "escalated"] },
      slaDeadline: { $lte: simulatedTime }
    });

    let escalatedCount = 0;

    for (const issue of overdueIssues) {
      let departmentName = "Municipal Department";
      if (issue.departmentId) {
        const dept = await Department.findById(issue.departmentId);
        if (dept) departmentName = dept.name;
      }

      const elapsedMs = simulatedTime.getTime() - (issue.slaDeadline ? issue.slaDeadline.getTime() : issue.createdAt.getTime());
      const hoursOverdue = Math.max(0, elapsedMs / (3600 * 1000));

      let noticeText = `URGENT FOLLOW-UP / ESCALATION NOTICE\nReference ID: ESC-${issue._id.toString().toUpperCase()}\n\nTO:\n${departmentName}\n\nSUBJECT: SLA BREACH: ${issue.title}\n\nDear Sir/Madam,\n\nWe are escalating this issue because the complaint has breached its resolution deadline by ${hoursOverdue.toFixed(1)} hours.\n\nSincerely,\nNagrik AI Operations`;
      let success = false;
      let errorMessage: string | null = null;

      if (getNvidiaApiKey()) {
        try {
          const promptText = `
            You are drafting a follow-up escalation notice on behalf of citizens, because 
            a previously filed civic complaint has not been resolved within the expected 
            timeframe. Use a firm but respectful and professional tone — this is an 
            escalation, not a complaint restart. Reference the original complaint and the 
            time elapsed since it was filed.

            Structure:
            1. Subject line (mark as "Follow-up / Escalation")
            2. Reference to original complaint and date filed
            3. Current status and time elapsed beyond expected resolution window
            4. Updated citizen confirmation count (if it has grown)
            5. Clear restatement of the requested action
            6. Note that this is an automated follow-up from a civic accountability 
               system tracking unresolved public infrastructure issues

            Original issue details:
            - Title: ${issue.title}
            - Department: ${departmentName}
            - Originally routed: ${issue.createdAt.toISOString()}
            - Expected resolution by: ${issue.slaDeadline ? issue.slaDeadline.toISOString() : "N/A"}
            - Time elapsed since deadline: ${hoursOverdue.toFixed(1)} hours
            - Current confirmation count: ${issue.confirmationCount}

            Write the complete escalation notice now. Do not wrap in quotes or codeblocks, just the plain text.
          `;

          noticeText = await callNvidiaNIM(promptText);
          success = true;
        } catch (err: any) {
          errorMessage = err.message || "Gemini notice draft failed";
          console.error("[Escalation Agent] Gemini notice draft failed, using fallback:", err);
        }
      } else {
        success = true;
      }

      // Upgrade Severity
      const severityUpgrade: Record<string, "low" | "moderate" | "high" | "critical"> = {
        low: "moderate",
        moderate: "high",
        high: "critical",
        critical: "critical"
      };
      const newSeverity = severityUpgrade[issue.severity] || "critical";

      issue.status = "escalated";
      issue.isEscalated = true;
      issue.escalationNotice = noticeText;
      issue.escalationCount += 1;
      issue.priorityTier += 1;
      issue.severity = newSeverity;
      
      // Recompute urgency
      const severityWeights: Record<string, number> = { low: 1, moderate: 2, high: 3, critical: 5 };
      const weight = severityWeights[newSeverity] || 2;
      issue.urgencyScore = weight * issue.confirmationCount * 1.5; // Escalated multiplier 1.5
      issue.updatedAt = new Date();
      await issue.save();

      // Notify all users who reported or upvoted/confirmed this issue
      if (issue.reportedBy && issue.reportedBy.length > 0) {
        const usersToNotify = await User.find({ _id: { $in: issue.reportedBy } });
        for (const u of usersToNotify) {
          await Notification.create({
            userId: u.authUserId,
            title: "Issue Escalated",
            body: `The issue "${issue.title}" has breached its SLA and has been escalated to higher authorities.`,
            read: false
          });
        }
        notifyCollectionChange("notifications");
      }

      await writeAgentLog(
        "escalation",
        "escalated_issue",
        `Auditing SLA compliance for issue ${issue._id}`,
        `SLA breached by ${hoursOverdue.toFixed(1)} hours. Priority tier bumped.`,
        success,
        errorMessage,
        issue._id as mongoose.Types.ObjectId,
        issue.primaryReportId
      );

      escalatedCount++;
    }

    if (escalatedCount > 0) {
      notifyCollectionChange("issues");
      notifyCollectionChange("agent_logs");
    }

    return escalatedCount;
  }
};
