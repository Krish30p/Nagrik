import { GEMINI_API_KEY, USE_MOCK_SERVICES } from "../config";
import { dbService } from "../db";
import { Severity } from "../../types";
import { GoogleGenerativeAI } from "@google/generative-ai";

export interface IntakeResult {
  title: string;
  category: "Garbage" | "Streetlight" | "Pothole" | "Water Leakage" | "Critical Infrastructure";
  severity: Severity;
  confidence: number;
  landmarks: string;
  descriptionSummary: string;
}

export const intakeAgent = {
  // Main Entrypoint
  async processReport(
    description: string,
    latitude: number,
    longitude: number,
    voiceTranscript?: string,
    imageFile?: File | string // File object or image url
  ): Promise<IntakeResult> {
    const combinedText = `${description} ${voiceTranscript || ""}`.trim();
    
    // Log Agent Activation
    await dbService.createAgentLog(
      "Intake Agent",
      "Activating Intake Analysis",
      `Received new report input:\n- Description: "${description}"\n- Voice Transcript: "${voiceTranscript || "N/A"}"\n- Coordinates: [${latitude}, ${longitude}]`,
      "info"
    );

    let result: IntakeResult;

    if (USE_MOCK_SERVICES || !GEMINI_API_KEY) {
      result = await this.runMockAnalysis(combinedText, imageFile);
    } else {
      result = await this.runGeminiAnalysis(combinedText, imageFile);
    }

    // Log completion
    await dbService.createAgentLog(
      "Intake Agent",
      "Analysis Completed",
      `Structured Analysis Result:\n\`\`\`json\n${JSON.stringify(result, null, 2)}\n\`\`\``,
      "success"
    );

    return result;
  },

  // Simulated AI parser based on keywords to ensure demo works cleanly
  async runMockAnalysis(text: string, imageFile?: File | string): Promise<IntakeResult> {
    await new Promise((resolve) => setTimeout(resolve, 1500)); // simulate network latency
    const normalized = text.toLowerCase();

    let category: IntakeResult["category"] = "Garbage";
    let severity: Severity = "MEDIUM";
    let title = "Civic Issue Reported";
    let landmarks = "Near coordinate location";

    // Heuristics
    if (normalized.includes("pothole") || normalized.includes("crater") || normalized.includes("road broken") || normalized.includes("asphalt")) {
      category = "Pothole";
      severity = "HIGH";
      title = "Road Pothole Blockage";
    } else if (normalized.includes("water") || normalized.includes("leak") || normalized.includes("burst") || normalized.includes("flood") || normalized.includes("pipe")) {
      category = "Water Leakage";
      severity = "CRITICAL";
      title = "Water Pipeline Leakage";
    } else if (normalized.includes("light") || normalized.includes("dark") || normalized.includes("lamp") || normalized.includes("electricity") || normalized.includes("street light")) {
      category = "Streetlight";
      severity = "MEDIUM";
      title = "Broken Streetlight & Dark Alley";
    } else if (normalized.includes("bridge") || normalized.includes("collapse") || normalized.includes("structure") || normalized.includes("danger") || normalized.includes("building")) {
      category = "Critical Infrastructure";
      severity = "CRITICAL";
      title = "Infrastructure Structural Hazard";
    } else if (normalized.includes("trash") || normalized.includes("garbage") || normalized.includes("dump") || normalized.includes("smell") || normalized.includes("waste")) {
      category = "Garbage";
      severity = "LOW";
      title = "Accumulated Waste Dump";
    }

    // Severity override by keywords
    if (normalized.includes("urgent") || normalized.includes("critical") || normalized.includes("accident") || normalized.includes("danger")) {
      severity = "CRITICAL";
    } else if (normalized.includes("high") || normalized.includes("severe") || normalized.includes("unsafe")) {
      severity = "HIGH";
    }

    // Extract mock landmarks
    const landmarkKeywords = ["near", "opposite", "behind", "next to", "at", "beside"];
    for (const kw of landmarkKeywords) {
      if (normalized.includes(kw)) {
        const index = normalized.indexOf(kw);
        const excerpt = text.substring(index, index + 40);
        landmarks = excerpt.trim();
        break;
      }
    }

    return {
      title,
      category,
      severity,
      confidence: 0.92,
      landmarks,
      descriptionSummary: text.substring(0, 100) + (text.length > 100 ? "..." : "")
    };
  },

  // Live Gemini 2.5 Flash implementation
  async runGeminiAnalysis(text: string, imageFile?: File | string): Promise<IntakeResult> {
    try {
      const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
      // Using gemini-2.5-flash as specified in CLAUDE.md
      const model = genAI.getGenerativeModel({
        model: "gemini-2.5-flash",
        generationConfig: {
          responseMimeType: "application/json",
        }
      });

      const prompt = `
        You are the Intake Agent of the Nagrik Civic Operations Platform.
        Analyze the citizen civic issue report. 
        Extract and return a JSON object with the following fields:
        {
          "title": "A short, concise 4-7 word title describing the issue",
          "category": "One of: 'Garbage' | 'Streetlight' | 'Pothole' | 'Water Leakage' | 'Critical Infrastructure'",
          "severity": "One of: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'",
          "confidence": "A floating point number between 0.0 and 1.0 showing your classification confidence",
          "landmarks": "Any landmarks, shops, street names, or locations mentioned in the text (max 50 chars)",
          "descriptionSummary": "A clean, concise 1-sentence summary of the user's issue text"
        }

        Input Description: "${text}"

        Strict rules:
        - Output MUST be valid JSON only.
        - Do not output any markdown formatting like \`\`\`json.
        - Do not add any conversational text before or after the JSON.
      `;

      let parts: any[] = [prompt];

      // Handle Image Vision if provided
      if (imageFile) {
        if (typeof imageFile === "string" && imageFile.startsWith("data:image")) {
          // Convert data URI to generative AI part
          const mimeType = imageFile.split(";")[0].split(":")[1];
          const base64Data = imageFile.split(",")[1];
          parts.push({
            inlineData: {
              data: base64Data,
              mimeType
            }
          });
        }
      }

      const response = await model.generateContent(parts);
      const rawText = response.response.text().trim();
      
      // Clean up potential markdown formatting if the model slipped up
      const cleanedText = rawText.replace(/^```json\s*/i, "").replace(/```$/, "").trim();
      const parsed = JSON.parse(cleanedText);

      return {
        title: parsed.title || "Civic Issue Reported",
        category: parsed.category || "Garbage",
        severity: parsed.severity || "MEDIUM",
        confidence: parsed.confidence || 0.85,
        landmarks: parsed.landmarks || "Coordinates Location",
        descriptionSummary: parsed.descriptionSummary || text
      };
    } catch (e: any) {
      await dbService.createAgentLog(
        "Intake Agent",
        "Gemini API Error",
        `Failed to call Gemini API: ${e.message || e}. Falling back to rules-based local simulation analysis.`,
        "warning"
      );
      return this.runMockAnalysis(text, imageFile);
    }
  }
};
