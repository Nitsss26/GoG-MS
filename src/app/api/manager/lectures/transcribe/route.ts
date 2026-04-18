import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { LectureReport } from '@/models/Schemas';
import { GoogleGenerativeAI } from '@google/generative-ai';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import os from 'os';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export const maxDuration = 300; // 5 minutes (Transcription can take time)

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

        // --- CLOUDINARY MP3 TRANSFORMATION ---
        // Optimization: Download audio only, not the full video.
        // Original: https://res.cloudinary.com/dwaepohvf/video/upload/v1234/file.mp4
        // Audio: https://res.cloudinary.com/dwaepohvf/video/upload/f_mp3/v1234/file.mp3
        let audioUrl = report.recordingUrl;
        if (audioUrl.includes('video/upload')) {
            audioUrl = audioUrl.replace('video/upload/', 'video/upload/f_mp3/');
            audioUrl = audioUrl.replace(/\.[^/.]+$/, ".mp3"); // Replace extension with mp3
        }

        tempAudioPath = path.join(os.tmpdir(), `audio_${reportId}_${Date.now()}.mp3`);

        console.log(`[TRANSCRIPTION] Step 1: Downloading Audio from: ${audioUrl}`);
        try {
            const response = await axios({
                url: audioUrl,
                method: 'GET',
                responseType: 'stream'
            });

            const writer = fs.createWriteStream(tempAudioPath);
            response.data.pipe(writer);

            await new Promise((resolve, reject) => {
                writer.on('finish', resolve);
                writer.on('error', reject);
            });
            console.log(`[TRANSCRIPTION] Download complete.`);
        } catch (dlErr: any) {
            console.error("[TRANSCRIPTION] Download Failed. Reverting to original URL if transformation failed.", dlErr.message);
            // Fallback to original URL if transformation failed (might not be Cloudinary)
            const response = await axios({
                url: report.recordingUrl,
                method: 'GET',
                responseType: 'stream'
            });
            const writer = fs.createWriteStream(tempAudioPath);
            response.data.pipe(writer);
            await new Promise((resolve, reject) => {
                writer.on('finish', resolve);
                writer.on('error', reject);
            });
        }

        const audioSize = fs.statSync(tempAudioPath).size;
        console.log(`[TRANSCRIPTION] Step 2: Sending to Gemini. Audio Size: ${(audioSize / 1024 / 1024).toFixed(2)} MB`);
        
        const audioData = fs.readFileSync(tempAudioPath);
        const base64Audio = audioData.toString('base64');

        const modelPro = genAI.getGenerativeModel({ model: "gemini-3.1-pro-preview" });
        
        const transcriptionPrompt = `Transcribe this lecture audio accurately and COMPLETELY. 
        It is CRITICAL that the transcription covers the ENTIRE duration of the audio file.
        Include timestamps in [MM:SS] format at the beginning of each logical segment or every 30 seconds.
        The content might be in Hindi, English, or Hinglish (mix of both). Transcribe it exactly as spoken.
        Format the output as a clean stream of text with timestamps.`;

        const transcriptionResult = await modelPro.generateContent([
            {
                inlineData: {
                    data: base64Audio,
                    mimeType: "audio/mp3"
                }
            },
            { text: transcriptionPrompt }
        ]);

        const transcriptionText = transcriptionResult.response.text();
        console.log(`[TRANSCRIPTION] Success. Transcription Length: ${transcriptionText.length}`);

        // Update Database with partial result
        report.transcription = transcriptionText;
        await report.save();

        console.log(`[TRANSCRIPTION] Total duration: ${((Date.now() - startTime) / 1000).toFixed(1)}s`);

        return NextResponse.json({ success: true, transcription: transcriptionText });
    } catch (error: any) {
        console.error("[TRANSCRIPTION] FATAL ERROR:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    } finally {
        if (tempAudioPath && fs.existsSync(tempAudioPath)) fs.unlinkSync(tempAudioPath);
    }
}
