import { GEMINI_API_KEY, USE_MOCK_SERVICES } from "../config";
import { dbService } from "../db";
import { GoogleGenerativeAI } from "@google/generative-ai";

export const routingAgent = {
  async routeIssue(issueId: string): Promise<{ departmentId: string; complaintId: string }> {
    // Log Agent Activation
    await dbService.createAgentLog(
      "Routing Agent",
      "Activating Routing Analysis",
      `Analyzing ticket routing and drafting official department complaint for Issue ID: \`${issueId}\`.`,
      "info",
      issueId
    );

    const issue = await dbService.getIssueById(issueId);
    if (!issue) {
      throw new Error(`Issue not found: ${issueId}`);
    }

    // 1. Map category to department ID
    let departmentId = "dept_pwd"; // fallback
    if (issue.category === "Garbage") departmentId = "dept_garbage";
    else if (issue.category === "Streetlight") departmentId = "dept_electricity";
    else if (issue.category === "Pothole") departmentId = "dept_pwd";
    else if (issue.category === "Water Leakage") departmentId = "dept_water";
    else if (issue.category === "Critical Infrastructure") departmentId = "dept_infrastructure";

    const departments = await dbService.getDepartments();
    const department = departments.find(d => d.id === departmentId);
    const deptName = department ? department.name : "Municipal Public Works Department";

    await dbService.createAgentLog(
      "Routing Agent",
      "Department Matched",
      `Resolved responsible authority:\n- Department: **${deptName}**\n- Sector: \`${issue.category}\`\n- Ward Coverage: \`${issue.ward || "All Wards"}\`.\n\nProceeding to draft formal complaint letter...`,
      "info",
      issueId
    );

    // 2. Draft formal complaint letter using Gemini or Heuristic Template
    let letterContent = "";
    if (USE_MOCK_SERVICES || !GEMINI_API_KEY) {
      letterContent = this.generateMockComplaint(issue, deptName);
    } else {
      letterContent = await this.generateGeminiComplaint(issue, deptName);
    }

    // 3. Store Complaint Record in DB
    const complaint = await dbService.createComplaint({
      issueId: issue.id,
      departmentId,
      generatedComplaint: letterContent,
      status: "SENT"
    });

    // 4. Update Issue status to ROUTED
    await dbService.updateIssue(issue.id, {
      departmentId,
      status: "ROUTED"
    });

    // If this issue is linked to a thread, update thread status to ROUTED if it was REPORTED
    if (issue.threadId) {
      const thread = await dbService.getThreadById(issue.threadId);
      if (thread && (thread.status === "REPORTED" || thread.status === "VERIFIED")) {
        await dbService.updateThread(issue.threadId, { status: "ROUTED" });
      }
    }

    // Send notifications to the reporter
    await dbService.createNotification(
      issue.createdBy,
      "Complaint Routed to Department",
      `Your report "${issue.title}" has been routed to the ${deptName}. An official notice has been dispatched.`
    );

    // Log completion
    await dbService.createAgentLog(
      "Routing Agent",
      "Complaint Dispatched",
      `Routing completed successfully:\n- Routed To: \`${deptName}\`\n- Complaint ID: \`${complaint.id}\`\n\nOfficial notice text:\n\`\`\`text\n${letterContent.substring(0, 300)}...\n\`\`\``,
      "success",
      issueId
    );

    return { departmentId, complaintId: complaint.id };
  },

  generateMockComplaint(issue: any, deptName: string): string {
    const formattedDate = new Date().toLocaleDateString("en-US", {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });

    return `OFFICIAL CIVIC ACTION COMPLAINT
Reference ID: CIV-${issue.id.toUpperCase()}
Date of Dispatch: ${formattedDate}

TO:
The Director / Chief Engineer
${deptName}
Municipal Operations Division

SUBJECT: Urgent attention required: ${issue.title} (Category: ${issue.category})

Dear Sir/Madam,

We write to bring to your immediate attention a verified public utility complaint regarding "${issue.title}", located in the area of ${issue.location} (${issue.ward}).

This issue was reported by a citizen on ${new Date(issue.createdAt).toLocaleDateString()} and verified by our system validators. Below are the specific details of the complaint:

- Location/Landmarks: ${issue.landmarks || "As marked on GPS map"}
- Coordinates: [Latitude: ${issue.latitude}, Longitude: ${issue.longitude}]
- Initial Severity Classification: ${issue.severity}
- SLA Deadline: Resolvable within ${issue.slaDays} days under Municipal Charter
- Citizen Report Description: "${issue.description}"
${issue.voiceTranscript ? `- Voice Transcription details: "${issue.voiceTranscript}"` : ""}

Due to the nature of the issue, there is an immediate impact on local public safety, environmental hygiene, and neighborhood accessibility. Delay in resolving this ticket could result in further infrastructure deterioration or public safety hazards.

Please initiate an investigation by your ward field officers immediately and update this ticket's status once action is taken.

Yours faithfully,

Nagrik AI Civic Operations Platform
Official Automated Dispatch Engine`;
  },

  async generateGeminiComplaint(issue: any, deptName: string): Promise<string> {
    try {
      const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

      const prompt = `
        You are the Routing Agent of the Nagrik Civic Operations Platform.
        Draft a formal, extremely professional, and government-grade complaint letter to be sent to a municipal department.
        Do not use casual language or templates. Make it sound like a formal legal/official request.

        Details of the issue:
        - Ticket ID: ${issue.id}
        - Department: ${deptName}
        - Category: ${issue.category}
        - Title: ${issue.title}
        - Description: ${issue.description}
        - Landmark / Location: ${issue.location}
        - Ward: ${issue.ward}
        - Severity: ${issue.severity}
        - Coordinates: [${issue.latitude}, ${issue.longitude}]
        - Report Date: ${new Date(issue.createdAt).toISOString()}
        - System Urgency Score: ${issue.urgencyScore}/100

        Strict rules:
        - Maintain an official, respectful, and authoritative tone.
        - Demand resolution in line with civic standards.
        - Output ONLY the letter content. No intro/outro commentary, no markdown syntax wrapping the letter.
      `;

      const response = await model.generateContent(prompt);
      return response.response.text().trim();
    } catch (e: any) {
      await dbService.createAgentLog(
        "Routing Agent",
        "Gemini API Error",
        `Gemini complaint drafting failed: ${e.message || e}. Falling back to default format template.`,
        "warning"
      );
      return this.generateMockComplaint(issue, deptName);
    }
  }
};
