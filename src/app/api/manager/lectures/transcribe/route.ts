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

export const maxDuration = 300; // 5 minutes

export async function POST(req: Request) {
    const startTime = Date.now();
    let tempAudioPath = "";

    try {
        await dbConnect();
        const { reportId } = await req.json();

        console.log(`[TRANSCRIPTION] Starting Phase 1 for Report: ${reportId}`);

        if (!reportId) {
            return NextResponse.json({ error: "Report ID is required" }, { status: 400 });
        }

        const report = await LectureReport.findById(reportId);
        if (!report) {
            return NextResponse.json({ error: "Report not found" }, { status: 404 });
        }

        if (!report.recordingUrl) {
            return NextResponse.json({ error: "No recording URL found" }, { status: 400 });
        }

        // --- AUDIO PREPARATION ---
        let audioUrl = report.recordingUrl;
        if (audioUrl.includes('video/upload')) {
            audioUrl = audioUrl.replace('video/upload/', 'video/upload/f_mp3/');
            audioUrl = audioUrl.replace(/\.[^/.]+$/, ".mp3");
        }

        tempAudioPath = path.join(os.tmpdir(), `audio_${reportId}_${Date.now()}.mp3`);

        console.log(`[TRANSCRIPTION] Step 1: Downloading Audio...`);
        try {
            const response = await axios({ url: audioUrl, method: 'GET', responseType: 'stream' });
            const writer = fs.createWriteStream(tempAudioPath);
            response.data.pipe(writer);
            await new Promise((resolve, reject) => {
                writer.on('finish', resolve);
                writer.on('error', reject);
            });
        } catch (dlErr: any) {
            console.error("[TRANSCRIPTION] Transformation failed (423/Other). Falling back to source URL.", dlErr.message);
            const response = await axios({ url: report.recordingUrl, method: 'GET', responseType: 'stream' });
            const writer = fs.createWriteStream(tempAudioPath);
            response.data.pipe(writer);
            await new Promise((resolve, reject) => {
                writer.on('finish', resolve);
                writer.on('error', reject);
            });
        }

        const audioSize = fs.statSync(tempAudioPath).size;
        // Determine mime type from extension or fallback
        const extension = report.recordingUrl.split('.').pop()?.toLowerCase();
        let mimeType = "audio/mpeg"; // Default MP3
        if (extension === 'webm') mimeType = "audio/webm";
        if (extension === 'wav') mimeType = "audio/wav";
        if (extension === 'mp4') mimeType = "video/mp4";
        if (extension === 'mov') mimeType = "video/quicktime";

        console.log(`[TRANSCRIPTION] Step 2: Uploading to Gemini File API (${(audioSize / 1024 / 1024).toFixed(2)} MB) as ${mimeType}`);

        // --- UPLOAD TO FILE API ---
        const uploadResult = await fileManager.uploadFile(tempAudioPath, {
            mimeType,
            displayName: `Lecture_${reportId}`,
        });

        // Polling for file to be ACTIVE
        let file = await fileManager.getFile(uploadResult.file.name);
        let attempts = 0;
        while (file.state === FileState.PROCESSING && attempts < 60) { // Increased attempts
            attempts++;
            console.log(`[TRANSCRIPTION] File state: PROCESSING... (Attempt ${attempts})`);
            await new Promise((resolve) => setTimeout(resolve, 4000)); // Slower polling for large files
            file = await fileManager.getFile(uploadResult.file.name);
        }

        if (file.state === FileState.FAILED) {
            console.error("[TRANSCRIPTION] Gemini File API Error Details:", file.error);
            throw new Error(`Gemini File API processing failed: ${file.error?.message || "Unknown reason"}`);
        }

        if (file.state !== FileState.ACTIVE) {
            throw new Error(`Gemini File API timed out or state is ${file.state}`);
        }

        console.log(`[TRANSCRIPTION] Step 3: Generating Content using File URI`);
        const modelPro = genAI.getGenerativeModel({ model: "gemini-3-pro-preview" });

        const transcriptionPrompt = `Transcribe this lecture audio accurately and COMPLETELY. 
        Include timestamps in [MM:SS] format every 30-60 seconds.
        Hinglish (mix of Hindi/English) content should be transcribed as spoken.
        Format accurately as a clean text stream. If the audio is long, provide the full transcript without truncation.`;

        const transcriptionResult = await modelPro.generateContent([
            {
                fileData: {
                    mimeType: file.mimeType,
                    fileUri: file.uri
                }
            },
            { text: transcriptionPrompt }
        ]);

        const transcriptionText = transcriptionResult.response.text();

        // Clean up: delete original file from File API to save space/quotas
        try {
            await fileManager.deleteFile(file.name);
        } catch (delErr) {
            console.warn("[TRANSCRIPTION] Post-process cleanup failed (non-critical):", delErr);
        }

        // Update Database
        report.transcription = transcriptionText;
        await report.save();

        console.log(`[TRANSCRIPTION] Success. Total duration: ${((Date.now() - startTime) / 1000).toFixed(1)}s`);

        return NextResponse.json({ success: true, transcription: transcriptionText });
    } catch (error: any) {
        console.error("[TRANSCRIPTION] FATAL ERROR:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    } finally {
        if (tempAudioPath && fs.existsSync(tempAudioPath)) fs.unlinkSync(tempAudioPath);
    }
}
