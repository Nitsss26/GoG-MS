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

export const maxDuration = 300; // 5 minutes timeout

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export async function POST(req: Request) {
    const startTime = Date.now();
    
    try {
        await dbConnect();
        const { reportId } = await req.json();

        console.log(`[ANALYSIS] Starting Phase 2 for Report: ${reportId}`);

        if (!reportId) {
            return NextResponse.json({ error: "Report ID is required" }, { status: 400 });
        }

        const report = await LectureReport.findById(reportId);
        if (!report) {
            return NextResponse.json({ error: "Report not found" }, { status: 404 });
        }

        // Must have transcription from Phase 1
        const translationText = report.transcription;
        if (!translationText) {
            return NextResponse.json({ 
                error: "No transcription found. Please run Step 1 (Transcription) first." 
            }, { status: 400 });
        }

        console.log(`[ANALYSIS] Dispatching Pedagogical Analysis...`);
        const analysisPrompt = `Analyze the following lecture transcript and provide a comprehensive pedagogical report in JSON format.
        Use easy English vocabulary so the report is simple to understand for everyone.
        
        Transcript:
        ${translationText}
        
        REQUIRED JSON STRUCTURE:
        {
          "score": number (0-100),
          "summary": "overall session summary",
          "sections": [{ "title": "string", "startTime": "MM:SS", "endTime": "MM:SS", "summary": "string", "keyTakeaways": ["string"] }],
          "sentenceImprovements": [{ "original": "string", "improved": "string", "reason": "string", "timestamp": "MM:SS" }],
          "gapAnalysis": { "missingConcepts": ["string"] },
          "suggestions": ["string"],
          "flags": [{ "type": "warning|info|error", "message": "string", "timestamp": "MM:SS" }]
        }`;

        const analysisModel = genAI.getGenerativeModel({ 
            model: "gemini-1.5-pro",
            generationConfig: { responseMimeType: "application/json" }
        });

        const analysisResult = await analysisModel.generateContent(analysisPrompt);
        const analysisResponseText = analysisResult.response.text();
        
        let analysis;
        try {
            analysis = JSON.parse(analysisResponseText);
        } catch (jsonErr) {
            console.error("[ANALYSIS] JSON Parsing Error. Fallback to regex.");
            const jsonMatch = analysisResponseText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                analysis = JSON.parse(jsonMatch[0]);
            } else {
                throw new Error("Failed to parse pedagogical analysis JSON");
            }
        }

        console.log("[ANALYSIS] Updating database...");
        report.pedagogicalAnalysis = analysis;
        report.isAIProcessed = true;
        report.aiAnalysisAt = new Date().toISOString();
        await report.save();

        console.log(`[ANALYSIS] SUCCESS. Duration: ${((Date.now() - startTime) / 1000).toFixed(1)}s`);

        return NextResponse.json({ success: true, analysis });
    } catch (error: any) {
        console.error("[ANALYSIS] FATAL ERROR:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
