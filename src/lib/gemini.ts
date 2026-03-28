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
            timeout: 60000 // 60s for download
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
            You are a Master Academic Analyst and Session Intelligence Engine.
            
            TASK: 
            Analyze the provided lecture recording (audio/video) with extreme precision.
            1. FULL TRANSCRIPTION: Provide a verbatim, chronological transcription of the entire session. Use speaker cues like [Lecturer], [Student], or [Question] where possible. Ensure no technical content is skipped.
            2. EXECUTIVE SUMMARY: Provide a deep, professional summary in bullet points. Include:
               - Core technical concepts covered.
               - Key takeaways and learning objectives achieved.
               - Any specific assignments or follow-up instructions mentioned.
            3. KEYWORD INDEX: List the top 10 technical keywords/terms discussed.

            DIALECTS & LANGUAGES:
            The session may be in English, Hindi, or Hinglish (Code-switching). Capture all nuances accurately.
            
            OUTPUT FORMAT (JSON):
            {
                "transcription": "A complete, long-form transcription of the session...",
                "summary": "### CORE TOPICS\n- ...\n\n### KEY TAKEAWAYS\n- ...",
                "keywords": ["React", "State Management", ...]
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

        console.log(`[AI] Success: Intelligence report generated for ${recordingUrl}`);

        return {
            transcription: parsed.transcription,
            summary: parsed.summary,
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
