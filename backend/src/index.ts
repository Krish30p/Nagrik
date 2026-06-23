import * as admin from "firebase-admin";
import * as functions from "firebase-functions";

admin.initializeApp();
const db = admin.firestore();

// 1. submitReport (HTTPS Callable)
export const submitReport = functions.https.onCall(async (data, context) => {
  // Check auth
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "User must be authenticated.");
  }

  const { mediaType, rawMediaUrl, voiceNoteUrl, userTextNote, location } = data;
  if (!rawMediaUrl || !location || typeof location.lat !== "number" || typeof location.lng !== "number") {
    throw new functions.https.HttpsError("invalid-argument", "Missing required fields (rawMediaUrl, location).");
  }

  console.log(`[submitReport] Called by user ${context.auth.uid} with mediaUrl ${rawMediaUrl}`);

  // Create report document
  const reportRef = db.collection("reports").doc();
  const reportData = {
    userId: context.auth.uid,
    rawMediaUrl,
    mediaType,
    voiceNoteUrl: voiceNoteUrl || null,
    userTextNote: userTextNote || null,
    location: {
      lat: location.lat,
      lng: location.lng,
      geohash: data.geohash || "" // In future will calculate geohash
    },
    issueId: null,
    processingStatus: "pending",
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  };

  await reportRef.set(reportData);

  return {
    reportId: reportRef.id,
    processingStatus: "pending"
  };
});

// 2. onReportCreated (Firestore Trigger on reports/{reportId})
export const onReportCreated = functions.firestore
  .document("reports/{reportId}")
  .onCreate(async (snapshot, context) => {
    const reportId = context.params.reportId;
    const reportData = snapshot.data();
    console.log(`[onReportCreated] Background trigger fired for reportId: ${reportId}`);
    
    // For Day 1, we just log and write a dummy issue to link it
    const issueRef = db.collection("issues").doc();
    
    // Write placeholder issue doc
    await issueRef.set({
      title: "Placeholder Title from Day 1 Scaffold",
      description: reportData.userTextNote || "Placeholder Description",
      category: "other",
      severity: "moderate",
      status: "verifying",
      isEscalated: false,
      priorityTier: 1,
      urgencyScore: 20,
      location: {
        lat: reportData.location.lat,
        lng: reportData.location.lng,
        geohash: reportData.location.geohash,
        address: "123 Placeholder St",
        ward: "Ward 1"
      },
      media: {
        photoUrl: reportData.rawMediaUrl,
        videoUrl: null,
        voiceNoteUrl: reportData.voiceNoteUrl,
        voiceTranscript: null
      },
      reportedBy: [reportData.userId],
      confirmationCount: 1,
      primaryReportId: reportId,
      departmentId: null,
      draftedComplaint: null,
      escalationNotice: null,
      escalationCount: 0,
      slaDeadline: null,
      parentIssueId: null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      resolvedAt: null,
      resolvedBy: null
    });

    // Update report
    await snapshot.ref.update({
      issueId: issueRef.id,
      processingStatus: "processed"
    });

    // Write agent log
    await db.collection("agent_logs").add({
      agentName: "intake",
      issueId: issueRef.id,
      reportId: reportId,
      action: "classified_issue",
      inputSummary: `New report by user: ${reportData.userId}`,
      outputSummary: `Placeholder issue created: ${issueRef.id}`,
      success: true,
      errorMessage: null,
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });

    console.log(`[onReportCreated] Linked report ${reportId} to placeholder issue ${issueRef.id}`);
  });

// 3. confirmExistingIssue (HTTPS Callable)
export const confirmExistingIssue = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "User must be authenticated.");
  }
  const { issueId } = data;
  if (!issueId) {
    throw new functions.https.HttpsError("invalid-argument", "Missing issueId.");
  }

  console.log(`[confirmExistingIssue] User ${context.auth.uid} confirming issue ${issueId}`);
  
  const issueRef = db.collection("issues").doc(issueId);
  const issueSnap = await issueRef.get();
  
  if (!issueSnap.exists) {
    throw new functions.https.HttpsError("not-found", "Issue not found.");
  }

  // Update in a transaction
  await db.runTransaction(async (transaction) => {
    const freshIssueSnap = await transaction.get(issueRef);
    const freshIssueData = freshIssueSnap.data();
    if (!freshIssueData) return;

    const reportedBy = freshIssueData.reportedBy || [];
    if (!reportedBy.includes(context.auth!.uid)) {
      reportedBy.push(context.auth!.uid);
    }

    const newConfirmationCount = (freshIssueData.confirmationCount || 0) + 1;
    
    // Urgency Score formula from DATABASE.md
    const severityWeight: Record<string, number> = { low: 1, moderate: 2, high: 3, critical: 5 };
    const weight = severityWeight[freshIssueData.severity] || 2;
    const isEscalated = freshIssueData.isEscalated || false;
    const newUrgencyScore = weight * newConfirmationCount * (isEscalated ? 1.5 : 1);

    transaction.update(issueRef, {
      reportedBy,
      confirmationCount: newConfirmationCount,
      urgencyScore: newUrgencyScore,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
  });

  const updatedSnap = await issueRef.get();
  return {
    success: true,
    newConfirmationCount: updatedSnap.data()?.confirmationCount || 1
  };
});

// 4. resolveIssue (HTTPS Callable, staff-only)
export const resolveIssue = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "User must be authenticated.");
  }

  // Verify staff role custom claim
  const isStaff = context.auth.token.role === "staff";
  if (!isStaff) {
    throw new functions.https.HttpsError("permission-denied", "Only staff accounts can resolve issues.");
  }

  const { issueId } = data;
  if (!issueId) {
    throw new functions.https.HttpsError("invalid-argument", "Missing issueId.");
  }

  console.log(`[resolveIssue] Staff ${context.auth.uid} resolving issue ${issueId}`);

  await db.collection("issues").doc(issueId).update({
    status: "resolved",
    resolvedAt: admin.firestore.FieldValue.serverTimestamp(),
    resolvedBy: context.auth.uid,
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  });

  return { success: true };
});

// 5. runEscalationSweep (Pub/Sub Scheduled trigger, with callable helper)
export const runEscalationSweep = functions.pubsub
  .schedule("every 6 hours")
  .onRun(async (context) => {
    console.log("[runEscalationSweep] Scheduled cron run started.");
    await performEscalationSweep();
  });

export const runEscalationSweepCallable = functions.https.onCall(async (data, context) => {
  console.log("[runEscalationSweepCallable] Manual sweep request.");
  const count = await performEscalationSweep();
  return { success: true, escalatedCount: count };
});

export const fastForwardSimulation = functions.https.onCall(async (data, context) => {
  const { days } = data;
  if (typeof days !== "number") {
    throw new functions.https.HttpsError("invalid-argument", "days must be a number");
  }

  const addedMs = days * 24 * 3600 * 1000;
  const simRef = db.collection("config").doc("simulation");
  
  await db.runTransaction(async (transaction) => {
    const snap = await transaction.get(simRef);
    const currentOffset = snap.exists ? (snap.data()?.timeOffsetMs || 0) : 0;
    transaction.set(simRef, {
      timeOffsetMs: currentOffset + addedMs,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
  });

  // Write agent log
  await db.collection("agent_logs").add({
    agentName: "escalation",
    issueId: null,
    reportId: null,
    action: "fast_forward_simulation",
    inputSummary: `Time fast-forwarded by ${days} days.`,
    outputSummary: `Adjusted backend clock offset. Sweeping SLA compliance...`,
    success: true,
    errorMessage: null,
    timestamp: admin.firestore.FieldValue.serverTimestamp()
  });

  const escalatedCount = await performEscalationSweep();
  return { success: true, escalatedCount };
});

export const resetSimulation = functions.https.onCall(async (data, context) => {
  const simRef = db.collection("config").doc("simulation");
  await simRef.set({
    timeOffsetMs: 0,
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  }, { merge: true });

  // Write agent log
  await db.collection("agent_logs").add({
    agentName: "escalation",
    issueId: null,
    reportId: null,
    action: "reset_simulation",
    inputSummary: `Time reset.`,
    outputSummary: `Restored backend clock to normal.`,
    success: true,
    errorMessage: null,
    timestamp: admin.firestore.FieldValue.serverTimestamp()
  });

  return { success: true };
});

async function performEscalationSweep(): Promise<number> {
  const simSnap = await db.collection("config").doc("simulation").get();
  const offsetMs = simSnap.exists ? (simSnap.data()?.timeOffsetMs || 0) : 0;
  
  const simulatedTimeMs = Date.now() + offsetMs;
  const simulatedTimestamp = admin.firestore.Timestamp.fromMillis(simulatedTimeMs);

  const query = db
    .collection("issues")
    .where("status", "!=", "resolved")
    .where("slaDeadline", "<=", simulatedTimestamp);
    
  const snap = await query.get();
  let count = 0;

  for (const doc of snap.docs) {
    const data = doc.data();
    if (data.isEscalated) continue;

    console.log(`[Escalation] Escalating issue: ${doc.id}`);
    
    // Update issue to escalated state
    await doc.ref.update({
      isEscalated: true,
      status: "escalated",
      escalationCount: admin.firestore.FieldValue.increment(1),
      priorityTier: admin.firestore.FieldValue.increment(1),
      escalationNotice: "SLA Deadline breached. Automated escalation notice drafted.",
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // Write agent log
    await db.collection("agent_logs").add({
      agentName: "escalation",
      issueId: doc.id,
      reportId: null,
      action: "escalated_issue",
      inputSummary: `Issue overdue since deadline ${data.slaDeadline.toDate().toISOString()}`,
      outputSummary: `SLA breached. Priority tier bumped.`,
      success: true,
      errorMessage: null,
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });

    count++;
  }

  return count;
}

// 6. getDashboardStats (HTTPS Callable)
export const getDashboardStats = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "User must be authenticated.");
  }

  console.log(`[getDashboardStats] Fetching stats for user: ${context.auth.uid}`);

  const issuesSnap = await db.collection("issues").get();
  
  let totalIssues = 0;
  let resolvedCount = 0;
  let escalatedCount = 0;
  let activeCount = 0;
  
  const byCategory: Record<string, number> = {};
  const byStatus: Record<string, number> = {};
  const hotspots: { lat: number; lng: number; weight: number }[] = [];

  issuesSnap.forEach((doc) => {
    const item = doc.data();
    totalIssues++;

    if (item.status === "resolved") resolvedCount++;
    else if (item.status === "escalated") escalatedCount++;
    else activeCount++;

    const cat = item.category || "other";
    byCategory[cat] = (byCategory[cat] || 0) + 1;

    const status = item.status || "verifying";
    byStatus[status] = (byStatus[status] || 0) + 1;

    if (item.location && typeof item.location.lat === "number" && typeof item.location.lng === "number") {
      hotspots.push({
        lat: item.location.lat,
        lng: item.location.lng,
        weight: item.urgencyScore || 20
      });
    }
  });

  return {
    totalIssues,
    resolvedCount,
    avgResolutionTimeHours: 24, // Mock average for day 1
    byCategory,
    byStatus,
    hotspots
  };
});

// 7. seedDepartments (HTTPS Callable)
export const seedDepartments = functions.https.onCall(async (data, context) => {
  console.log("[seedDepartments] Seeding municipal departments directory.");
  
  const seedData = [
    { name: "Ward 1 Roads & PWD Department", category: "pothole", ward: "Ward 1", contactEmail: "roads.ward1@nagrik.gov", contactPhone: "+91 11 2345 6783" },
    { name: "Ward 1 Sanitation & Garbage Board", category: "garbage", ward: "Ward 1", contactEmail: "sanitation.ward1@nagrik.gov", contactPhone: "+91 11 2345 6781" },
    { name: "Ward 1 Electricity and Lighting Division", category: "streetlight", ward: "Ward 1", contactEmail: "power.ward1@nagrik.gov", contactPhone: "+91 11 2345 6782" },
    { name: "Ward 1 Water Supply Board", category: "water_leak", ward: "Ward 1", contactEmail: "water.ward1@nagrik.gov", contactPhone: "+91 11 2345 6784" },
    { name: "Ward 1 Drainage and Sewerage Division", category: "drainage", ward: "Ward 1", contactEmail: "drainage.ward1@nagrik.gov", contactPhone: "+91 11 2345 6785" },
    { name: "Citywide PWD Roads fallback", category: "pothole", ward: "citywide", contactEmail: "pwd.roads@nagrik.gov", contactPhone: "+91 11 2345 0000" },
    { name: "Citywide Water Supply fallback", category: "water_leak", ward: "citywide", contactEmail: "water.city@nagrik.gov", contactPhone: "+91 11 2345 0001" },
    { name: "Citywide Sanitation fallback", category: "garbage", ward: "citywide", contactEmail: "waste.city@nagrik.gov", contactPhone: "+91 11 2345 0002" },
    { name: "Citywide Power and Streetlights fallback", category: "streetlight", ward: "citywide", contactEmail: "light.city@nagrik.gov", contactPhone: "+91 11 2345 0003" },
    { name: "Citywide Public Safety and Infrastructure fallback", category: "other", ward: "citywide", contactEmail: "safety.city@nagrik.gov", contactPhone: "+91 11 2345 0004" }
  ];

  let seededCount = 0;
  for (const dept of seedData) {
    const deptQuery = await db.collection("departments")
      .where("category", "==", dept.category)
      .where("ward", "==", dept.ward)
      .get();
      
    if (deptQuery.empty) {
      await db.collection("departments").add(dept);
      seededCount++;
    }
  }

  return { success: true, seededCount };
});
