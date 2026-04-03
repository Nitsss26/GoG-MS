import { GoogleGenerativeAI } from "@google/generative-ai";
import axios from "axios";
import fs from "fs";
import path from "path";
import os from "os";
import ffmpeg from "fluent-ffmpeg";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY as string);

/**
 * Extracts compact audio from a video file to a temporary .mp3 file.
 * We use 32kbps mono to ensure the resulting Base64 fits within the 20MB inline data limit (approx 90 mins).
 */
async function extractCompactAudio(videoPath: string): Promise<string> {
    // Dynamic import to bypass Turbopack's static analyzer for native/installer modules
    const { default: ffmpegInstaller } = await import("@ffmpeg-installer/ffmpeg");
    ffmpeg.setFfmpegPath(ffmpegInstaller.path);

    const audioPath = videoPath.replace(path.extname(videoPath), ".mp3");
    return new Promise((resolve, reject) => {
        ffmpeg(videoPath)
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

    let tempVideoPath = "";
    let tempAudioPath = "";
    
    try {
        console.log(`[AI] Initializing Gemini-only Analysis for: ${recordingUrl}`);
        
        // 1. Download Video
        const response = await axios.get(recordingUrl, { 
            responseType: 'arraybuffer',
            timeout: 600000 // 10 mins for download
        });
        
        const videoBuffer = Buffer.from(response.data);
        const fileName = `lec_${Date.now()}.mp4`;
        tempVideoPath = path.join(os.tmpdir(), fileName);
        fs.writeFileSync(tempVideoPath, videoBuffer);
        console.log(`[AI] Video downloaded: ${tempVideoPath}`);

        // 2. Extract Audio (Compact MP3)
        console.log("[AI] Extracting compact MP3 for inline processing...");
        tempAudioPath = await extractCompactAudio(tempVideoPath);
        const audioSizeMB = fs.statSync(tempAudioPath).size / 1024 / 1024;
        console.log(`[AI] Audio extracted: ${tempAudioPath} (${audioSizeMB.toFixed(2)}MB)`);

        if (audioSizeMB > 19) {
            throw new Error(`Audio file too large (${audioSizeMB.toFixed(2)}MB) for inline analysis. Max 20MB.`);
        }

        const audioBase64 = fs.readFileSync(tempAudioPath).toString("base64");

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
                "summary": "### CORE TOPICS\n- ...",
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

        const apiKey = process.env.GEMINI_API_KEY;
        // Use v1 for stability and the -latest model name
        const apiUrl = `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`;

        const payload = {
            contents: [{
                parts: [
                    { text: prompt },
                    {
                        inline_data: {
                            mime_type: "audio/mp3",
                            data: audioBase64
                        }
                    }
                ]
            }],
            generationConfig: {
                responseMimeType: "application/json"
            }
        };

        console.log("[AI] Dispatching unified Gemini analysis request (v1)...");
        const aiResponse = await axios.post(apiUrl, payload, {
            headers: { 'Content-Type': 'application/json' },
            timeout: 600000 // 10 minutes for heavy analysis
        });

        if (!aiResponse.data || !aiResponse.data.candidates || !aiResponse.data.candidates[0]?.content?.parts[0]?.text) {
            throw new Error("AI returned an empty or invalid response format.");
        }

        const responseText = aiResponse.data.candidates[0].content.parts[0].text;
        const parsed = JSON.parse(responseText);

        console.log(`[AI] Success: Exhaustive Audit report generated via Inline Gemini Pipeline`);

        return {
            ...parsed,
            aiAnalysisAt: new Date().toISOString()
        };
    } catch (error: any) {
        console.error("[AI] FAILURE:", error.response?.data || error.message);
        return {
            transcription: "Analysis failed.",
            summary: `Error: ${error.message}. Please verify the API key and ensure the recording is not too long.`,
            aiAnalysisAt: new Date().toISOString()
        };
    } finally {
        // Cleanup
        [tempVideoPath, tempAudioPath].forEach(p => {
            if (p && fs.existsSync(p)) {
                try { fs.unlinkSync(p); } catch (e) {}
            }
        });
    }
}
