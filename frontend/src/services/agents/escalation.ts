import { GEMINI_API_KEY, USE_MOCK_SERVICES } from "../config";
import { dbService } from "../db";
import { Issue, Escalation, Severity, IssueStatus } from "../../types";
import { GoogleGenerativeAI } from "@google/generative-ai";

// Helper to get simulated time (allowing fast-forward in UI)
export function getSimulatedCurrentTime(): Date {
  const offset = parseInt(localStorage.getItem("nagrik_time_offset_ms") || "0", 10);
  return new Date(Date.now() + offset);
}

export const escalationAgent = {
  // Scans all issues and runs escalation logic on breached ones
  async checkSLAAndEscalate(): Promise<number> {
    await dbService.createAgentLog(
      "Escalation Agent",
      "SLA Scan Triggered",
      `Initiated municipal SLA compliance sweep. Simulated Current Time: ${getSimulatedCurrentTime().toLocaleString()}`,
      "info"
    );

    const issues = await dbService.getIssues();
    const unresolvedIssues = issues.filter(
      (issue) => issue.status !== "RESOLVED"
    );

    const currentTime = getSimulatedCurrentTime();
    let escalatedCount = 0;

    for (const issue of unresolvedIssues) {
      const createdTime = new Date(issue.createdAt).getTime();
      const elapsedMs = currentTime.getTime() - createdTime;
      const slaMs = issue.slaDays * 24 * 60 * 60 * 1000;

      if (elapsedMs > slaMs) {
        // SLA is breached!
        escalatedCount++;
        
        // Calculate escalation level based on how long it has been breached
        let escalationLevel: 1 | 2 | 3 = 1;
        if (elapsedMs > slaMs * 2.0) {
          escalationLevel = 3;
        } else if (elapsedMs > slaMs * 1.5) {
          escalationLevel = 2;
        }

        await this.escalateIssue(issue, escalationLevel, elapsedMs, slaMs);
      }
    }

    await dbService.createAgentLog(
      "Escalation Agent",
      "SLA Scan Completed",
      `Completed sweep. Evaluated ${unresolvedIssues.length} unresolved issues. Escalated/Updated: **${escalatedCount}** tickets.`,
      escalatedCount > 0 ? "warning" : "success"
    );

    return escalatedCount;
  },

  // Perform escalation on a single issue
  async escalateIssue(issue: Issue, level: 1 | 2 | 3, elapsedMs: number, slaMs: number): Promise<void> {
    const elapsedDays = (elapsedMs / (24 * 3600 * 1000)).toFixed(1);
    
    await dbService.createAgentLog(
      "Escalation Agent",
      "Breach Detected",
      `SLA Breach found for Ticket \`${issue.id}\` ("${issue.title}"):\n- Category: \`${issue.category}\`\n- SLA Limit: **${issue.slaDays} days**\n- Elapsed Time: **${elapsedDays} days**\n- Proposed Escalation Level: **Level ${level}**`,
      "warning",
      issue.id
    );

    // 1. Fetch department details for contact
    const departments = await dbService.getDepartments();
    const dept = departments.find((d) => d.id === issue.departmentId);
    const deptName = dept ? dept.name : "Assigned Municipal Department";

    // 2. Draft escalation notice
    let notice = "";
    if (USE_MOCK_SERVICES || !GEMINI_API_KEY) {
      notice = this.generateMockNotice(issue, level, elapsedDays, deptName);
    } else {
      notice = await this.generateGeminiNotice(issue, level, elapsedDays, deptName);
    }

    // 3. Upgrade Severity & Status
    let newSeverity = issue.severity;
    if (level === 1 && issue.severity === "LOW") newSeverity = "MEDIUM";
    else if (level === 2 && issue.severity === "MEDIUM") newSeverity = "HIGH";
    else if (level === 3 && (issue.severity === "HIGH" || issue.severity === "MEDIUM")) newSeverity = "CRITICAL";

    // 4. Create Escalation Record
    await dbService.createEscalation({
      issueId: issue.id,
      escalationLevel: level,
      generatedNotice: notice
    });

    // 5. Update Issue in DB
    await dbService.updateIssue(issue.id, {
      status: "ESCALATED",
      severity: newSeverity
    });

    // Update Thread Status
    if (issue.threadId) {
      await dbService.updateThread(issue.threadId, {
        status: "ESCALATED"
      });
    }

    // 6. Notify the user & department
    await dbService.createNotification(
      issue.createdBy,
      `URGENT: Issue Escalated (Level ${level})`,
      `Your report "${issue.title}" breached its SLA of ${issue.slaDays} days and has been escalated to Level ${level}.`
    );

    await dbService.createAgentLog(
      "Escalation Agent",
      "Escalation Executed",
      `Notice generated and sent to **${deptName}**.\n- Severity Upgraded to: **${newSeverity}**\n- Ticket Status updated to **ESCALATED**.\n\nEscalation Notice excerpt:\n\`\`\`text\n${notice.substring(0, 300)}...\n\`\`\``,
      "success",
      issue.id
    );
  },

  generateMockNotice(issue: any, level: number, elapsedDays: string, deptName: string): string {
    const authorityHeaders = [
      "MUNICIPAL COMMISSIONER OFFICE - TICKET MONITORING DIVISION",
      "CITY PUBLIC SECURITY AND MUNICIPAL AUDIT COMMITTEE",
      "MINISTRY OF URBAN DEVELOPMENT & REGIONAL ADMINISTRATION"
    ];

    const header = authorityHeaders[level - 1];

    return `*** OFFICIAL CITIZEN SERVICE CHARTER BREACH WARNING ***
ISSUED BY: ${header}
LEGAL SLA REFERENCE: CIV-SLA-${issue.category.toUpperCase()}

TO:
The Officer-in-Charge
${deptName}

SUBJECT: LEVEL ${level} ESCALATION: Unresolved Civic Ticket Reference CIV-${issue.id.toUpperCase()}

This official notification serves as a formal SLA breach escalation regarding the civic issue reported at "${issue.location}" (${issue.ward}).

TICKET DETAILS:
- Category: ${issue.category}
- Reported Date: ${new Date(issue.createdAt).toLocaleDateString()}
- SLA Deadline: ${issue.slaDays} Days
- Time Elapsed: ${elapsedDays} Days (Breach Duration: ${(parseFloat(elapsedDays) - issue.slaDays).toFixed(1)} Days)

Under Section 12-A of the Civic Operations Charter, your department was required to resolve or initiate remediation for this report within its SLA window. This deadline has expired.

DISCIPLINARY / RESOLUTION DIRECTIVES:
${level === 1 ? `1. Dispatch a field inspection team to the site within 12 hours.\n2. Submit an official status update to the citizen registry.` : ""}
${level === 2 ? `1. Provide a written explanation for the delay to the Municipal Commissioner.\n2. Dedicate a priority repair crew to resolve this within 24 hours.` : ""}
${level === 3 ? `1. IMMEDIATE PENALTY AUDIT: This ticket has been placed on the Public Negligence Dashboard.\n2. Immediate supervisor investigation. Complete resolution required within 12 hours.` : ""}

Failure to comply with this notice will result in ticketing flags and public visibility escalation.

By order of,
Auditing Director, Municipal Oversight Cell
Nagrik Autonomous Escalation Engine`;
  },

  async generateGeminiNotice(issue: any, level: number, elapsedDays: string, deptName: string): Promise<string> {
    try {
      const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

      const prompt = `
        You are the Escalation Agent of the Nagrik Civic Operations Platform.
        Draft a formal SLA breach escalation notice to be sent to the department head of ${deptName}.
        
        Details:
        - Ticket ID: ${issue.id}
        - Category: ${issue.category}
        - Title: ${issue.title}
        - Ward: ${issue.ward}
        - SLA Limit: ${issue.slaDays} days
        - Total Days Elapsed: ${elapsedDays} days
        - Escalation Level: Level ${level} out of 3.
        
        Strict Tone Requirements:
        - Level 1: Firm reminder, requesting immediate assessment.
        - Level 2: Strict warning, demanding explanations for negligence.
        - Level 3: Severe reprimand, informing them that public audit logs are being updated and penalties will be calculated.
        
        Output ONLY the notice content. No markdown wrapping.
      `;

      const response = await model.generateContent(prompt);
      return response.response.text().trim();
    } catch (e: any) {
      await dbService.createAgentLog(
        "Escalation Agent",
        "Gemini API Error",
        `Gemini notice drafting failed: ${e.message || e}. Falling back to default format template.`,
        "warning"
      );
      return this.generateMockNotice(issue, level, elapsedDays, deptName);
    }
  }
};
