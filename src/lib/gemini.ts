import { GoogleGenerativeAI } from "@google/generative-ai";
import { GoogleAIFileManager } from "@google/generative-ai/server";
import axios from "axios";
import fs from "fs";
import path from "path";
import os from "os";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY as string);
const fileManager = new GoogleAIFileManager(process.env.GEMINI_API_KEY as string);

export async function processLectureWithAI(recordingUrl: string) {
    if (!recordingUrl) return null;

    let tempPath = "";
    try {
        console.log(`[AI] Initializing Analysis for: ${recordingUrl}`);
        
        // 1. Download to local temp for File API processing
        const response = await axios.get(recordingUrl, { 
            responseType: 'arraybuffer',
            timeout: 300000 // 5 minutes for large lecture recordings
        });
        
        const buffer = Buffer.from(response.data);
        const fileName = `lec_${Date.now()}.mp4`;
        tempPath = path.join(os.tmpdir(), fileName);
        fs.writeFileSync(tempPath, buffer);
        console.log(`[AI] Downloaded to temp: ${tempPath} (${Math.round(buffer.length/1024/1024)}MB)`);

        // 2. Upload to Google AI File Manager
        const uploadResult = await fileManager.uploadFile(tempPath, {
            mimeType: response.headers['content-type'] || "video/mp4",
            displayName: fileName,
        });
        console.log(`[AI] File uploaded to Google AI: ${uploadResult.file.uri}`);

        // 3. Wait for the file to be processed by Google (if needed, usually instant for small/medium)
        console.log("[AI] Waiting for file to settle...");
        let file = await fileManager.getFile(uploadResult.file.name);
        let attempts = 0;
        while (file.state === "PROCESSING" && attempts < 12) { // Max 1 min wait
            await new Promise(resolve => setTimeout(resolve, 5000));
            file = await fileManager.getFile(uploadResult.file.name);
            attempts++;
            console.log(`[AI] Polling state: ${file.state} (attempt ${attempts})`);
        }

        if (file.state !== "ACTIVE") {
            throw new Error(`File failed to process: ${file.state}`);
        }

        // 4. Generate Content
        const model = genAI.getGenerativeModel({ 
            model: "gemini-1.5-flash",
            generationConfig: { responseMimeType: "application/json" }
        });

        const prompt = `
            You are an expert Academic Auditor for a premier educational institute. I am providing a lecture recording.
            
            TASK: 
            Perform a high-fidelity, industry-standard audit of this session.
            
            1. FULL TRANSCRIPTION: Provide a verbatim, chronological transcription with TIMESTAMPS every 5 minutes.
            2. SEGMENTED REPORT: Break the 1-hour session into 15-minute segments. For each segment, identify the Topic Covered, a Quality Score (1-10), and detailed Observations.
            3. SENTIMENT ANALYSIS: Analyze the faculty's tone. Do they sound enthusiastic, aggressive, or bored? 
            4. DEAD AIR DETECTION: Identify any periods of silence longer than 10 seconds.
            5. COMPLIANCE CHECK:
               - Opening: Did they state learning objectives within the first 5 minutes?
               - Concept Check: Did they ask engagement questions every 15-20 minutes?
               - Accuracy: Does the content sound factually consistent with standard academic principles?
            6. FINAL SCORECARD: Provide a score (1-10) for:
               - Clarity
               - Engagement
               - Accuracy
            
            OUTPUT FORMAT (JSON):
            {
                "transcription": "...",
                "summary": "### CORE TOPICS\n- ...",
                "keywords": [...],
                "analysis": {
                    "segmentedReport": [
                        { "timeSegment": "00:00 - 15:00", "topic": "...", "score": 9, "observations": "..." },
                        ...
                    ],
                    "sentimentAnalysis": "...",
                    "deadAirAlerts": ["Silence at 24:10 for 15s", ...],
                    "complianceCheck": { "opening": true, "engagement": true, "accuracy": true },
                    "finalScorecard": { "clarity": 9, "engagement": 8, "accuracy": 10, "totalAuditScore": 27 }
                }
            }
        `;

        const result = await model.generateContent([
            { text: prompt },
            {
                fileData: {
                    mimeType: uploadResult.file.mimeType,
                    fileUri: uploadResult.file.uri
                }
            }
        ]);

        const responseText = result.response.text();
        const parsed = JSON.parse(responseText);

        console.log(`[AI] Success: Exhaustive Audit report generated for ${recordingUrl}`);

        return {
            ...parsed,
            aiAnalysisAt: new Date().toISOString()
        };
    } catch (error: any) {
        console.error("[AI] FAILURE:", error.message);
        return {
            transcription: "AI analysis encountered a failure.",
            summary: `Error: ${error.message}. The recording might be too large or the format is unsupported.`,
            aiAnalysisAt: new Date().toISOString()
        };
    } finally {
        // Cleanup temp file
        if (tempPath && fs.existsSync(tempPath)) {
            try {
                fs.unlinkSync(tempPath);
                console.log(`[AI] Cleanup complete: Removed ${tempPath}`);
            } catch (e) {
                console.warn("[AI] Cleanup failed:", e);
            }
        }
    }
}
