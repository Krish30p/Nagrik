import { dbService } from "../db";
import { Issue, Thread, IssueStatus } from "../../types";

// Calculate distance in meters between two lat/lng coordinates using Equirectangular approximation
function getDistanceInMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000; // Radius of the earth in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.cos(((lat1 + lat2) * Math.PI) / 360) * dLon;
  return Math.sqrt(dLat * dLat + a * a) * R;
}

export const verificationAgent = {
  async verifyIssue(issueId: string): Promise<{ action: "merged" | "created_thread"; threadId: string; urgencyScore: number }> {
    // Log Agent Activation
    await dbService.createAgentLog(
      "Verification Agent",
      "Activating Duplicate Check",
      `Scanning nearby issues for Issue ID: \`${issueId}\`. Rules:\n- Same Category\n- Distance < 50m\n- Within 72 Hours`,
      "info",
      issueId
    );

    const issue = await dbService.getIssueById(issueId);
    if (!issue) {
      throw new Error(`Issue not found: ${issueId}`);
    }

    const allIssues = await dbService.getIssues();
    const activeThreads = await dbService.getThreads();

    // 1. Filter candidates:
    // - Same category
    // - Not the same issue
    // - Reported within 72 hours (3 days)
    // - Must have a valid threadId
    const timeThresholdMs = 72 * 60 * 60 * 1000;
    const reportTime = new Date(issue.createdAt).getTime();

    const candidates = allIssues.filter((other) => {
      if (other.id === issue.id) return false;
      if (other.category !== issue.category) return false;
      if (!other.threadId) return false;

      const otherTime = new Date(other.createdAt).getTime();
      const timeDiff = Math.abs(reportTime - otherTime);
      if (timeDiff > timeThresholdMs) return false;

      // Check distance <= 50m
      const distance = getDistanceInMeters(
        issue.latitude,
        issue.longitude,
        other.latitude,
        other.longitude
      );
      
      return distance <= 50;
    });

    await dbService.createAgentLog(
      "Verification Agent",
      "Scan Completed",
      `Found ${candidates.length} nearby candidate reports of the same category in the last 72 hours.`,
      "info",
      issueId
    );

    // Calculate urgency score based on severity
    let baseUrgency = 20;
    if (issue.severity === "MEDIUM") baseUrgency = 40;
    if (issue.severity === "HIGH") baseUrgency = 60;
    if (issue.severity === "CRITICAL") baseUrgency = 80;

    if (candidates.length > 0) {
      // Duplicate Match Found! Merge into the first candidate's thread
      const match = candidates[0];
      const threadId = match.threadId!;

      await dbService.createAgentLog(
        "Verification Agent",
        "Duplicate Detected",
        `Match identified:\n- Matching Issue: \`${match.id}\` ("${match.title}")\n- Distance: ~${Math.round(getDistanceInMeters(issue.latitude, issue.longitude, match.latitude, match.longitude))}m\n- Parent Thread: \`${threadId}\`\n\nMerging report into existing thread.`,
        "warning",
        issueId
      );

      // Fetch the parent thread
      const thread = await dbService.getThreadById(threadId);
      if (thread) {
        const newIssueIds = [...thread.issueIds, issue.id];
        const newConfirmationCount = thread.confirmationCount + 1;
        
        // Boost urgency score based on confirmations (+15 points per duplicate report)
        const newUrgencyScore = Math.min(100, baseUrgency + (newConfirmationCount * 15));

        // Update thread in DB
        await dbService.updateThread(threadId, {
          issueIds: newIssueIds,
          confirmationCount: newConfirmationCount,
          urgencyScore: newUrgencyScore,
        });

        // Update issue with thread info, department (inherits from duplicate if routed) and status
        await dbService.updateIssue(issue.id, {
          threadId,
          urgencyScore: newUrgencyScore,
          status: "VERIFIED",
          departmentId: match.departmentId || undefined,
        });

        // Award verification bonus to the reporter
        await dbService.createNotification(
          issue.createdBy,
          "Report Verified & Merged",
          `Your report "${issue.title}" has been verified as a match for an existing thread. Thank you for your contribution!`
        );

        await dbService.createAgentLog(
          "Verification Agent",
          "Merger Completed",
          `Thread \`${threadId}\` updated:\n- Total Reports: ${newIssueIds.length}\n- Confirmations: ${newConfirmationCount}\n- New Urgency Score: **${newUrgencyScore}**\n- Issue \`${issue.id}\` status set to **VERIFIED**.`,
          "success",
          issueId
        );

        return { action: "merged", threadId, urgencyScore: newUrgencyScore };
      }
    }

    // No duplicate found. Create a new thread.
    const thread = await dbService.createThread({
      issueIds: [issue.id],
      confirmationCount: 0,
      urgencyScore: baseUrgency,
      status: "VERIFIED"
    });

    await dbService.updateIssue(issue.id, {
      threadId: thread.id,
      urgencyScore: baseUrgency,
      status: "VERIFIED"
    });

    await dbService.createAgentLog(
      "Verification Agent",
      "No Duplicate Found",
      `No nearby duplicates matching criteria. Created new thread: \`${thread.id}\`. Urgency Score set to **${baseUrgency}**. Issue status updated to **VERIFIED**.`,
      "success",
      issue.id
    );

    return { action: "created_thread", threadId: thread.id, urgencyScore: baseUrgency };
  }
};
