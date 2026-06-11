import { GoogleGenerativeAI } from "@google/generative-ai";
import { GoogleAIFileManager, FileState } from "@google/generative-ai/server";
import fs from "fs";
import path from "path";
import os from "os";
import ffmpeg from "fluent-ffmpeg";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY as string);
const fileManager = new GoogleAIFileManager(process.env.GEMINI_API_KEY as string);

/**
 * Utility: Retry an async operation with exponential backoff
 */
async function withRetry<T>(
    operation: () => Promise<T>,
    maxRetries = 3,
    baseDelay = 2000
): Promise<T> {
    let attempt = 0;
    while (attempt < maxRetries) {
        try {
            return await operation();
        } catch (error: any) {
            attempt++;
            console.warn(`[RETRY] Attempt ${attempt}/${maxRetries} failed: ${error?.message || "Unknown Error"}`);
            if (attempt >= maxRetries) throw error;
            await new Promise((res) => setTimeout(res, baseDelay * Math.pow(2, attempt - 1)));
        }
    }
    throw new Error("Retry failed");
}

/**
 * Utility: Enforce a timeout on an async operation
 */
async function withTimeout<T>(
    operation: () => Promise<T>,
    timeoutMs: number,
    operationName = "Operation"
): Promise<T> {
    let timeoutId: NodeJS.Timeout;
    const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error(`${operationName} timed out after ${timeoutMs}ms`)), timeoutMs);
    });

    return Promise.race([
        operation(),
        timeoutPromise
    ]).finally(() => clearTimeout(timeoutId));
}

/**
 * Extracts compact audio from a video URL to a temporary .mp3 file.
 * We use 32kbps mono to compress the file size efficiently.
 * ffmpeg supports reading from HTTP/HTTPS URLs natively, which avoids downloading the whole video.
 */
async function extractAudioFromUrl(videoUrl: string): Promise<string> {
    // Dynamic import to bypass Turbopack's static analyzer for native/installer modules
    const { default: ffmpegInstaller } = await import("@ffmpeg-installer/ffmpeg");
    ffmpeg.setFfmpegPath(ffmpegInstaller.path);

    const tempFileName = `audio_${Date.now()}_${Math.random().toString(36).substring(7)}.mp3`;
    const audioPath = path.join(os.tmpdir(), tempFileName);
    
    return new Promise((resolve, reject) => {
        ffmpeg(videoUrl)
            .toFormat("mp3")
            .audioChannels(1)
            .audioBitrate("32k")
            .on("end", () => resolve(audioPath))
            .on("error", (err: Error) => reject(err))
            .save(audioPath);
    });
}

export async function processLectureWithAI(recordingUrl: string) {
    if (!recordingUrl) return null;

    let tempAudioPath = "";
    let uploadedFileName = "";

    try {
        console.log(`[AI] Initializing Gemini Analysis for: ${recordingUrl}`);

        // 1. Extract Audio directly from URL with 10-minute timeout and 3 retries
        console.log("[AI] Extracting compact MP3 from URL...");
        tempAudioPath = await withRetry(
            () => withTimeout(() => extractAudioFromUrl(recordingUrl), 10 * 60 * 1000, "Audio Extraction"),
            3,
            3000
        );
        const audioSizeMB = fs.statSync(tempAudioPath).size / 1024 / 1024;
        console.log(`[AI] Audio extracted: ${tempAudioPath} (${audioSizeMB.toFixed(2)}MB)`);

        // 2. Upload to Google AI File API with 5-minute timeout and 3 retries
        console.log(`[AI] Uploading to Google AI File API...`);
        const uploadResult = await withRetry(
            () => withTimeout(() => fileManager.uploadFile(tempAudioPath, {
                mimeType: "audio/mp3",
                displayName: `Lecture_Audio_${Date.now()}`
            }), 5 * 60 * 1000, "File API Upload"),
            3,
            3000
        );
        
        uploadedFileName = uploadResult.file.name;
        console.log(`[AI] Uploaded as ${uploadedFileName}. URI: ${uploadResult.file.uri}`);

        // Wait for processing to complete (up to 5 minutes)
        console.log(`[AI] Waiting for file processing...`);
        await withTimeout(async () => {
            let fileState = await fileManager.getFile(uploadedFileName);
            while (fileState.state === FileState.PROCESSING) {
                await new Promise((resolve) => setTimeout(resolve, 5000));
                fileState = await fileManager.getFile(uploadedFileName);
            }
            if (fileState.state === FileState.FAILED) {
                throw new Error("Google AI File processing failed.");
            }
        }, 5 * 60 * 1000, "File Processing Wait");

        // 3. Generate Audit Report via Gemini (Analysis + Transcription)
        const prompt = `
            You are an expert Academic Auditor for a premier educational institute. I am providing a lecture recording as audio.
            
            TASK: 
            Perform a high-fidelity, industry-standard audit of this session.
            
            1. FULL TRANSCRIPTION: Provide a verbatim, chronological transcription with TIMESTAMPS every 5 minutes.
            2. SEGMENTED REPORT: Break the session into 15-minute segments. For each segment, identify the Topic Covered, a Quality Score (1-10), and detailed Observations.
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
                "summary": "### CORE TOPICS\\n- ...",
                "keywords": ["topic1", "topic2", ...],
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

        console.log("[AI] Dispatching unified Gemini analysis request (via SDK)...");
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro-latest" });
        
        // Retry the Generation Request up to 3 times with 10-minute timeout
        const result = await withRetry(
            () => withTimeout(() => model.generateContent({
                contents: [
                    {
                        role: "user",
                        parts: [
                            { text: prompt },
                            {
                                fileData: {
                                    mimeType: uploadResult.file.mimeType,
                                    fileUri: uploadResult.file.uri
                                }
                            }
                        ]
                    }
                ],
                generationConfig: {
                    responseMimeType: "application/json"
                }
            }), 10 * 60 * 1000, "Gemini Analysis Request"),
            3,
            5000 // 5 seconds base delay for Gemini limits
        );

        const responseText = result.response.text();
        if (!responseText) {
            throw new Error("AI returned an empty response.");
        }

        const parsed = JSON.parse(responseText);
        console.log(`[AI] Success: Exhaustive Audit report generated via Google AI File API`);

        return {
            ...parsed,
            aiAnalysisAt: new Date().toISOString()
        };
    } catch (error: any) {
        console.error("[AI] FAILURE:", error?.response?.data || error?.message || error);
        return {
            transcription: "Analysis failed.",
            summary: `Error: ${error?.message || "Unknown error"}.`,
            aiAnalysisAt: new Date().toISOString()
        };
    } finally {
        // Cleanup File API
        if (uploadedFileName) {
            try {
                await fileManager.deleteFile(uploadedFileName);
                console.log(`[AI] Deleted remote file ${uploadedFileName}`);
            } catch (e: any) {
                console.warn(`[AI] Failed to delete remote file: ${e.message}`);
            }
        }
        
        // Cleanup local file
        if (tempAudioPath && fs.existsSync(tempAudioPath)) {
            try { fs.unlinkSync(tempAudioPath); } catch (e) { }
        }
    }
}
