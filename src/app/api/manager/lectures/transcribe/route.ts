import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { LectureReport } from '@/models/Schemas';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { GoogleAIFileManager, FileState } from "@google/generative-ai/server";
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import os from 'os';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const fileManager = new GoogleAIFileManager(process.env.GEMINI_API_KEY || "");

export const maxDuration = 900; // 15 minutes extension for ultra-long files

export async function POST(req: Request) {
    const startTime = Date.now();
    let tempAudioPath = "";

    try {
        await dbConnect();
        const { reportId, force } = await req.json();

        if (!reportId) {
            return NextResponse.json({ error: "Report ID is required" }, { status: 400 });
        }

        const report = await LectureReport.findById(reportId);
        if (!report) {
            return NextResponse.json({ error: "Report not found" }, { status: 404 });
        }

        // Return cached transcription if it exists (unless force=true)
        if (!force && report.transcription && report.transcription.length > 500) {
            console.log(`[TRANSCRIPTION] Returning cached data for ${reportId}`);
            return NextResponse.json({ success: true, hasTranscription: true, cached: true });
        }

        // Check for active lock (In Progress within last 2 mins only) — reduced from 10 to prevent stale locks
        const lockAge = report.updatedAt ? Date.now() - new Date(report.updatedAt).getTime() : Infinity;
        if (!force && report.status === "In Progress" && lockAge < 120000) {
            console.log(`[TRANSCRIPTION] Blocked duplicate request for ${reportId} (lock age: ${Math.round(lockAge/1000)}s)`);
            return NextResponse.json({ success: true, message: "Transcription in progress", locked: true });
        }

        // If lock is stale (> 2 mins), force-clear it
        if (report.status === "In Progress" && lockAge >= 120000) {
            console.log(`[TRANSCRIPTION] Clearing stale lock for ${reportId} (was locked ${Math.round(lockAge/1000)}s ago)`);
        }

        // Set Lock
        report.status = "In Progress";
        await report.save();

        console.log(`[TRANSCRIPTION] Starting Phase 1 (64kbps Quality) for: ${reportId}`);

        if (!report.recordingUrl) {
            report.status = "Completed"; // Unlock if no URL
            await report.save();
            return NextResponse.json({ error: "No recording URL found" }, { status: 400 });
        }

        // --- AUDIO PREPARATION ---
        let audioUrl = report.recordingUrl;
        // Robust Cloudinary transformation: handle video/image/raw and force mp3
        if (audioUrl.includes('/upload')) {
            audioUrl = audioUrl.replace(/\/upload\/(v\d+\/)?/, '/upload/f_mp3/');
            audioUrl = audioUrl.replace(/\.[^/.]+$/, ".mp3");
        }

        const rawAudioPath = path.join(os.tmpdir(), `raw_${reportId}_${Date.now()}`);
        tempAudioPath = path.join(os.tmpdir(), `norm_${reportId}_${Date.now()}.mp3`);

        console.log(`[TRANSCRIPTION] Step 1: Downloading Audio...`);
        try {
            const response = await axios({ 
                url: audioUrl, 
                method: 'GET', 
                responseType: 'stream',
                timeout: 300000 // 5 minute timeout for 4-hour raw downloads
            });
            const writer = fs.createWriteStream(rawAudioPath);
            response.data.pipe(writer);
            await new Promise((resolve, reject) => {
                writer.on('finish', resolve);
                writer.on('error', reject);
            });
        } catch (dlErr: any) {
            console.error("[TRANSCRIPTION] Transformation failed. Falling back to source URL.", dlErr.message);
            const response = await axios({ url: report.recordingUrl, method: 'GET', responseType: 'stream' });
            const writer = fs.createWriteStream(rawAudioPath);
            response.data.pipe(writer);
            await new Promise((resolve, reject) => {
                writer.on('finish', resolve);
                writer.on('error', reject);
            });
        }

        console.log(`[TRANSCRIPTION] Step 1.5: Normalizing Audio with FFMPEG...`);
        // Dynamic import for ffmpeg path
        const { default: ffmpeg } = await import('fluent-ffmpeg');
        const { default: ffmpegInstaller } = await import('@ffmpeg-installer/ffmpeg');
        ffmpeg.setFfmpegPath(ffmpegInstaller.path);

        // Helper: compress audio at a given bitrate
        const compressAudio = (inputPath: string, outputPath: string, bitrate: string): Promise<boolean> => {
            return new Promise((resolve) => {
                ffmpeg(inputPath)
                    .toFormat('mp3')
                    .audioChannels(1)
                    .audioFrequency(16000)
                    .audioBitrate(bitrate)
                    .on('end', () => resolve(true))
                    .on('error', (err) => {
                        console.error("[FFMPEG] Normalization failed:", err);
                        fs.copyFileSync(inputPath, outputPath);
                        resolve(true);
                    })
                    .save(outputPath);
            });
        };

        await compressAudio(rawAudioPath, tempAudioPath, '32k'); // 32kbps = clear speech, small file

        // Clean up raw file immediately
        if (fs.existsSync(rawAudioPath)) fs.unlinkSync(rawAudioPath);

        const audioSize = fs.statSync(tempAudioPath).size;
        const audioSizeMB = audioSize / (1024 * 1024);
        const mimeType = "audio/mpeg";

        console.log(`[TRANSCRIPTION] Normalized audio: ${audioSizeMB.toFixed(2)} MB`);

        // --- TRANSCRIPTION PROMPT ---
        const transcriptionPrompt = `Transcribe this lecture audio accurately and COMPLETELY. 
        Include timestamps in [MM:SS] format every 30-60 seconds.
        Hinglish (mix of Hindi/English) content should be transcribed as spoken.
        Format accurately as a clean text stream. If the audio is long, provide the full transcript without truncation.`;

        // --- MODEL FAILOVER CHAIN ---
        const modelsToTry = ["gemini-2.5-flash", "gemini-2.5-pro", "gemini-2.0-flash"];

        // --- STRATEGY: Inline Base64 (for files < 20MB — bypasses File API entirely) ---
        const transcribeInline = async (filePath: string): Promise<string> => {
            const fileBase64 = fs.readFileSync(filePath).toString('base64');
            console.log(`[TRANSCRIPTION] Using INLINE strategy (${(Buffer.byteLength(fileBase64, 'base64') / 1024 / 1024).toFixed(1)} MB)`);

            for (const modelName of modelsToTry) {
                try {
                    console.log(`[TRANSCRIPTION] Trying inline with: ${modelName}...`);
                    const model = genAI.getGenerativeModel({ model: modelName });
                    const result = await model.generateContent([
                        { inlineData: { data: fileBase64, mimeType } },
                        { text: transcriptionPrompt }
                    ]);
                    const text = result.response.text();
                    if (text && text.length > 50) {
                        console.log(`[TRANSCRIPTION] Inline ${modelName} succeeded. ${text.length} chars.`);
                        return text;
                    }
                } catch (err: any) {
                    console.warn(`[TRANSCRIPTION] Inline ${modelName} failed: ${err.message}`);
                    await new Promise(r => setTimeout(r, 2000));
                }
            }
            throw new Error("All models failed with inline strategy.");
        };

        // --- STRATEGY: File API (for files >= 20MB) ---
        const transcribeViaFileAPI = async (): Promise<string> => {
            console.log(`[TRANSCRIPTION] Using FILE API strategy`);

            // Upload with retries
            let uploadResult;
            let uploadAttempts = 0;
            const maxUploadRetries = 5;
            while (uploadAttempts < maxUploadRetries) {
                try {
                    uploadAttempts++;
                    uploadResult = await fileManager.uploadFile(tempAudioPath, {
                        mimeType,
                        displayName: `Lecture_${reportId}`,
                    });
                    break;
                } catch (upErr: any) {
                    const isRetryable = upErr.message?.includes('503') || upErr.message?.includes('500');
                    const delay = Math.pow(2, uploadAttempts) * 1000;
                    console.warn(`[TRANSCRIPTION] Upload attempt ${uploadAttempts} failed: ${upErr.message}`);
                    if (isRetryable && uploadAttempts < maxUploadRetries) {
                        console.log(`[TRANSCRIPTION] Retrying in ${delay}ms...`);
                        await new Promise(r => setTimeout(r, delay));
                    } else {
                        throw upErr; // Will be caught by outer handler
                    }
                }
            }

            // Poll until ACTIVE
            if (!uploadResult) {
                throw new Error("File upload failed - no upload result.");
            }

            let file = await fileManager.getFile(uploadResult.file.name);
            let attempts = 0;
            while (file.state === FileState.PROCESSING && attempts < 300) {
                attempts++;
                await new Promise((resolve) => setTimeout(resolve, 3000));
                file = await fileManager.getFile(uploadResult.file.name);
            }
            if (file.state === FileState.FAILED) throw new Error(`File processing failed: ${file.error?.message}`);
            if (file.state !== FileState.ACTIVE) throw new Error(`File timed out, state: ${file.state}`);

            // Generate with model failover
            for (const modelName of modelsToTry) {
                try {
                    console.log(`[TRANSCRIPTION] Trying File API with: ${modelName}...`);
                    const model = genAI.getGenerativeModel({ model: modelName });
                    const result = await model.generateContent([
                        { fileData: { mimeType: file.mimeType, fileUri: file.uri } },
                        { text: transcriptionPrompt }
                    ]);
                    const text = result.response.text();
                    if (text && text.length > 50) {
                        console.log(`[TRANSCRIPTION] File API ${modelName} succeeded. ${text.length} chars.`);
                        // Cleanup uploaded file
                        try { await fileManager.deleteFile(file.name); } catch {}
                        return text;
                    }
                } catch (err: any) {
                    console.warn(`[TRANSCRIPTION] File API ${modelName} failed: ${err.message}`);
                    await new Promise(r => setTimeout(r, 2000));
                }
            }
            // Cleanup on failure too
            try { await fileManager.deleteFile(file.name); } catch {}
            throw new Error("All models failed with File API strategy.");
        };

        // --- EXECUTE THE BEST STRATEGY ---
        let transcriptionText = "";

        if (audioSizeMB < 20) {
            // Small file: skip File API entirely, go inline
            console.log(`[TRANSCRIPTION] Step 2: File is ${audioSizeMB.toFixed(1)}MB — using direct inline (no upload needed)`);
            transcriptionText = await transcribeInline(tempAudioPath);
        } else {
            // Large file: try File API first, fall back to re-compress + inline
            console.log(`[TRANSCRIPTION] Step 2: File is ${audioSizeMB.toFixed(1)}MB — using File API with inline fallback`);
            try {
                transcriptionText = await transcribeViaFileAPI();
            } catch (fileApiErr: any) {
                console.warn(`[TRANSCRIPTION] File API strategy FAILED: ${fileApiErr.message}`);
                console.log(`[TRANSCRIPTION] FALLBACK: Re-compressing to 16kbps for inline upload...`);

                // Re-compress at ultra-low bitrate to get under 20MB
                const ultraCompressedPath = path.join(os.tmpdir(), `ultra_${reportId}_${Date.now()}.mp3`);
                await compressAudio(tempAudioPath, ultraCompressedPath, '16k');
                const ultraSize = fs.statSync(ultraCompressedPath).size / (1024 * 1024);
                console.log(`[TRANSCRIPTION] Ultra-compressed: ${ultraSize.toFixed(2)} MB`);

                try {
                    transcriptionText = await transcribeInline(ultraCompressedPath);
                } finally {
                    if (fs.existsSync(ultraCompressedPath)) fs.unlinkSync(ultraCompressedPath);
                }
            }
        }

        if (!transcriptionText || transcriptionText.length < 50) {
            report.status = "Completed";
            await report.save();
            throw new Error("All transcription strategies failed.");
        }




        // Update Database
        report.transcription = transcriptionText;
        report.status = "Completed"; // Unlock
        report.isAIProcessed = false; // Reset to allow standard analysis to run next
        await report.save();

        console.log(`[TRANSCRIPTION] Success. Total duration: ${((Date.now() - startTime) / 1000).toFixed(1)}s`);

        return NextResponse.json({ success: true, transcription: transcriptionText });
    } catch (error: any) {
        console.error("[TRANSCRIPTION] FATAL ERROR:", error);
        // --- CRITICAL: Release the lock so the user can retry ---
        try {
            await dbConnect();
            const report = await LectureReport.findById(JSON.parse(await req.clone().text()).reportId).catch(() => null);
            if (report && report.status === "In Progress") {
                report.status = "Completed";
                await report.save();
            }
        } catch (unlockErr) {
            console.error("[TRANSCRIPTION] Failed to release lock:", unlockErr);
        }
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    } finally {
        if (tempAudioPath && fs.existsSync(tempAudioPath)) fs.unlinkSync(tempAudioPath);
    }
}
