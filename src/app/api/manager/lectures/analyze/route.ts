import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { LectureReport } from '@/models/Schemas';
import { GoogleGenerativeAI } from '@google/generative-ai';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import os from 'os';

// Setup ffmpeg
ffmpeg.setFfmpegPath(ffmpegInstaller.path);

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export async function POST(req: Request) {
    try {
        await dbConnect();
        const { reportId } = await req.json();

        if (!reportId) {
            return NextResponse.json({ error: "Report ID is required" }, { status: 400 });
        }

        const report = await LectureReport.findById(reportId);
        if (!report) {
            return NextResponse.json({ error: "Report not found" }, { status: 404 });
        }

        if (!report.recordingUrl) {
            return NextResponse.json({ error: "No recording URL found for this lecture" }, { status: 400 });
        }

        const recordingUrl = report.recordingUrl;
        const tempVideoPath = path.join(os.tmpdir(), `video_${reportId}_${Date.now()}.mp4`);
        const tempAudioPath = path.join(os.tmpdir(), `audio_${reportId}_${Date.now()}.mp3`);

        // 1. Download Video
        const response = await axios({
            url: recordingUrl,
            method: 'GET',
            responseType: 'stream'
        });

        const writer = fs.createWriteStream(tempVideoPath);
        response.data.pipe(writer);

        await new Promise((resolve, reject) => {
            writer.on('finish', resolve);
            writer.on('error', reject);
        });

        // 2. Extract Audio
        await new Promise((resolve, reject) => {
            ffmpeg(tempVideoPath)
                .toFormat('mp3')
                .on('end', resolve)
                .on('error', reject)
                .save(tempAudioPath);
        });

        // 3. Prepare for Gemini
        const audioData = fs.readFileSync(tempAudioPath);
        const base64Audio = audioData.toString('base64');

        // 4. Phase 1: High-Precision Transcription (FMS Model)
        const modelPro = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });
        
        const transcriptionPrompt = `Transcribe this lecture audio accurately and COMPLETELY. 
        It is CRITICAL that the transcription covers the ENTIRE duration of the audio file.
        Include timestamps in [MM:SS] format at the beginning of each logical segment or every 30 seconds.
        If there are periods of silence, mark them as [Silence] with the corresponding timestamp.
        The content might be in Hindi, English, or Hinglish (mix of both). Transcribe it exactly as spoken.
        Format the output as a continuous stream of text segments with timestamps.
        Example:
        [00:00] Hello everyone, today we will discuss...
        [00:30] [Silence]
        [00:45] Ab hum baat karenge basic concepts ki...`;

        console.log("Starting Phase 1: Transcription...");
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
        console.log("Transcription Complete. Length:", transcriptionText.length);

        // 5. Phase 2: Pedagogical Analysis (FMS Detailed Model)
        // We use Schema-based generation to ensure the FMS structure is followed exactly
        const analysisPrompt = `Analyze the following lecture transcript and provide a comprehensive pedagogical report.
        Use easy English vocabulary so the report is simple to understand for everyone.
        
        Transcript:
        ${transcriptionText}
        
        CRITICAL INSTRUCTIONS:
        1. DO NOT include the transcript text in the JSON response to save tokens.
        2. Divide the lecture into 3-6 logical pedagogical sections based on the content.
        3. Ensure timestamps (MM:SS) accurately reflect the transcript provided and cover the entire duration.
        4. Focus on professional teaching standards and Hinglish delivery nuances.
        5. Use simple, easy-to-understand English vocabulary for all text fields.
        6. The evaluationReport must follow the structure strictly, with scores on a 4.0 scale.
        7. Be thorough in identifying both positive highlights (info/warning) and critical red flags.`;

        console.log("Starting Phase 2: Analysis...");
        const analysisResult = await modelPro.generateContent(analysisPrompt);
        const analysisResponseText = analysisResult.response.text();
        
        // Clean up the response (Gemini sometimes adds markdown code blocks)
        const jsonMatch = analysisResponseText.match(/\{[\s\S]*\}/);
        const analysis = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(analysisResponseText);

        // 6. Update Database
        report.pedagogicalAnalysis = analysis;
        report.isAIProcessed = true;
        report.aiAnalysisAt = new Date().toISOString();
        report.transcription = transcriptionText; // Persist full transcript
        await report.save();

        // 7. Cleanup
        try {
            if (fs.existsSync(tempVideoPath)) fs.unlinkSync(tempVideoPath);
            if (fs.existsSync(tempAudioPath)) fs.unlinkSync(tempAudioPath);
        } catch (e) {
            console.error("Cleanup error:", e);
        }

        return NextResponse.json({ success: true, analysis });
    } catch (error: any) {
        console.error("Analysis Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
