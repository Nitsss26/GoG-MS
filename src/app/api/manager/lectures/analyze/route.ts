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
    const { reportId, mode, force } = await req.json();

    console.log(`[ANALYSIS] Starting Phase 2 for Report: ${reportId} Mode: ${mode || 'standard'} Force: ${!!force}`);

    if (!reportId) {
      return NextResponse.json({ error: "Report ID is required" }, { status: 400 });
    }

    const report = await LectureReport.findById(reportId);
    if (!report) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }

    // [ONE-TIME GENERATION LOGIC]
    // If standard mode and already has analysis, return it (unless force is true)
    if (!force && (!mode || mode === 'standard')) {
      if (report.pedagogicalAnalysis && Object.keys(report.pedagogicalAnalysis).length > 0 && report.isAIProcessed) {
        // Double check for "Empty/Failed" reports (scores of 0 might indicate a past error/hang)
        const score = report.pedagogicalAnalysis.summary?.lectureQualityScore;
        if (score && score > 0) {
           console.log(`[ANALYSIS] Standard report already exists. Returning stored data.`);
           return NextResponse.json({ success: true, analysis: report.pedagogicalAnalysis, source: 'database' });
        }
      }
    }

    // If modified mode and already has it, return it (unless force is true)
    if (!force && mode === 'modified') {
      if (report.modifiedPedagogicalAnalysis && Object.keys(report.modifiedPedagogicalAnalysis).length > 0) {
        console.log(`[ANALYSIS] Modified report already exists. Returning stored data.`);
        return NextResponse.json({ success: true, analysis: report.modifiedPedagogicalAnalysis, source: 'database' });
      }
    }

    // Must have transcription from Phase 1
    const translationText = report.transcription;
    if (!translationText) {
      return NextResponse.json({
        error: "No transcription found. Please run Step 1 (Transcription) first."
      }, { status: 400 });
    }

    console.log(`[ANALYSIS] Dispatching Comprehensive LQR Analysis (${mode || 'standard'})...`);

    // Mandated: Ensure heading consistency
    const existingTopic = report.pedagogicalAnalysis?.summary?.topic || report.modifiedPedagogicalAnalysis?.summary?.topic;
    const topicInstruction = existingTopic ? `The session topic MUST be exactly: "${existingTopic}"` : "Extract a professional, concise topic name (e.g., 'JAVA COLLECTIONS: LISTS AND MAPS').";

    let modeInstruction = "";
    if (mode === 'modified') {
      modeInstruction = `
        CRITICAL MODIFICATION INSTRUCTIONS (LENIENT REPORT):
        - Focus heavily on strengths.
        - Ignore most red flags. If you must include a red flag, make it only "Minor" severity, and only include one rarely (sometimes not always). DO NOT include any Moderate or Severe red flags.
        - ENSURE all scores for all parameters are between 3.5 and 4.8. 
        - NOTHING should go below 3.5 or above 4.8. 
        - The weights must be applied such that the final Lecture Quality Score is between 3.5 and 4.8.
        - Tone should be extremely encouraging and professional, not critical.
        - Ensure it looks natural and not biased, use nuances between 3.5 and 4.8.
      `;
    }

    const analysisPrompt = `Analyze the following lecture transcript and provide a HIGHLY PROFESSIONAL pedagogical report in JSON format.
        This is for a "Lecture Quality Report" (LQR).
        Topic Instruction: ${topicInstruction}
        ${modeInstruction}
        
        Transcript:
        ${translationText}
        
        CRITICAL RULE FOR INSTRUCTIONAL GUIDE (actionItems):
        - EVERY parameter in the detailedScorecard MUST have at least 1 actionItem.
        - Even if a score is 5.0 (Exemplary), DO NOT leave actionItems empty or as N/A.
        - For high scores (4.5-5.0), the actionItem should focus on: "Mastery Level Techniques", "Pushing for advanced student engagement", or "Sharing this best practice as a peer mentor". 
        - The goal is continuous improvement even for experts.
        - "task" should be a clear directive.
        - "example" should be a concrete pedagogical strategy or a sample script the teacher could use.
        
        JUDGING FRAMEWORK (Five Pillars):
        1. Pillar 1: Content & Curriculum (weight: 30%)
           - Concept Accuracy & Terminology
           - Depth & Coverage
           - Curriculum Alignment (match with syllabus)
           - Example Relevance
        2. Pillar 2: Pedagogy & Structure (weight: 25%)
           - Explanation Clarity & Scaffolding
           - Logical Flow & Transitions
           - Pace & Time Management
           - Formative Checks (verifying understanding)
        3. Pillar 3: Communication & Delivery (weight: 15%)
           - Fluency & Articulation (fillers/broken sentences)
           - Voice Modulation & Energy
           - Vocabulary Appropriateness (jargon handling)
        4. Pillar 4: Student Engagement (weight: 20%)
           - Questioning Quality (Higher-order vs Yes/No)
           - Interaction Breadth (not just front-benchers)
           - Acknowledgment & Reinforcement
           - Attention-Grabbing Techniques (hooks/analogies)
        5. Pillar 5: Classroom Management (weight: 10%)
           - Noise & Disruption Handling
           - Crowd Control
           - Time Discipline (start/end alignment)
        
        RED FLAG LAYER (Veto Power):
        - Categories: Rudeness/Condescension, Offensive Language, Factual Misinformation, Excessive Off-topic (>10%), Boundary Violations.
        - Severities: Not Observed, Minor, Moderate, Severe.
        
        SCORING LOGIC:
        - Score each of the 18 parameters on 1.0 - 5.0 scale (half-points allowed).
        - Anchors: 1=Unacceptable, 2=Below Expectations, 3=Meets Expectations, 4=Strong, 5=Exemplary.
        - Weighted Pillar Score (WPS) out of 5 using weights above.
        - Red Flag Multiplier: None (1.0), 1 Minor (0.95), 2+ Minor (0.90), 1 Moderate (0.80), 2+ Moderate (0.65), Severe (0.50).
        - Final LQS = WPS * Multiplier.
        - Overall Rating Band: 
            - 4.5 – 5.0: Exemplary
            - 3.8 – 4.4: On Track
            - 3.0 – 3.7: Needs Coaching
            - Below 3.0 OR Any Severe Flag: Requires Intervention (Auto-escalate)
        
        REQUIRED JSON STRUCTURE:
        {
          "summary": {
            "topic": "string",
            "overallRating": "Exemplary | On Track | Needs Coaching | Requires Intervention",
            "weightedPillarScore": number,
            "redFlagMultiplier": number,
            "lectureQualityScore": number,
            "redFlagsCount": { "minor": number, "moderate": number, "severe": number },
            "recommendedNextStep": { "action": "Self-review | Peer observation | Coaching session | Formal review", "reason": "string", "targetCompletion": "string" }
          },
          "pillarSnapshot": [
            { "pillar": "Content & Curriculum", "weight": "30%", "score": number },
            { "pillar": "Pedagogy & Structure", "weight": "25%", "score": number },
            { "pillar": "Student Engagement", "weight": "20%", "score": number },
            { "pillar": "Communication & Delivery", "weight": "15%", "score": number },
            { "pillar": "Classroom Management", "weight": "10%", "score": number }
          ],
          "topStrengths": [{ "text": "string", "timestamp": "MM:SS" }],
          "topImprovements": [{ "text": "string", "timestamp": "MM:SS" }],
          "detailedScorecard": [
            {
              "pillar": "string",
              "parameters": [
                {
                  "name": "string",
                  "score": number, 
                  "anchor": "Unacceptable | Below Expectations | Meets Expectations | Strong | Exemplary",
                  "whatWorked": ["<actual specific observation text extracted from the lecture with a [MM:SS] timestamp appended>"],
                  "scopeForImprovement": ["<actual specific observation text extracted from the lecture with a [MM:SS] timestamp appended>"],
                  "actionItems": [{ "task": "string", "example": "direct rewrite quote" }]
                }
              ]
            }
          ],
          "redFlagLog": [
            { "category": "string", "severity": "string", "timestamp": "MM:SS", "observation": "exact quote and impact" }
          ],
          "evidenceLog": {
            "metrics": [
              { "name": "Total filler words", "observed": "string", "benchmark": "Target: < 30" },
              { "name": "Questions asked to students", "observed": "string", "benchmark": "Target: 15+" },
              { "name": "Average wait time after question", "observed": "string", "benchmark": "Target: 5s+" },
              { "name": "Longest silence stretch", "observed": "string", "benchmark": "Target: < 90s" },
              { "name": "Professor-to-student talk ratio", "observed": "string", "benchmark": "Target: 75:25 or lower" },
              { "name": "Topic transition count", "observed": "string", "benchmark": "Target: 5+" }
            ],
            "quantitativeData": {
              "fillerCount": number,
              "questionsCount": number,
              "talkRatio": "string",
              "waitTimeToAverage": number
            }
          }
        }`;

    // GUARD: Ensure transcription exists
    if (!report.transcription || report.transcription.length < 50) {
      return NextResponse.json({ error: "No transcription found. Please transcribe the lecture first." }, { status: 400 });
    }

    // --- MODEL FAILOVER CHAIN FOR ANALYSIS ---
    const analysisModels = ["gemini-2.5-flash-lite", "gemini-flash-lite-latest", "gemini-2.5-flash"];
    let analysisResult: any = null;
    let lastAnalysisErr: any = null;

    for (const modelName of analysisModels) {
        let retries = 3;
        while (retries > 0 && !analysisResult) {
            try {
                console.log(`[ANALYSIS] Trying model: ${modelName} (Retries left: ${retries})...`);
                const analysisModel = genAI.getGenerativeModel({
                    model: modelName,
                    generationConfig: { 
                        responseMimeType: "application/json",
                        temperature: 0.1
                    }
                });
                analysisResult = await analysisModel.generateContent(analysisPrompt);
                console.log(`[ANALYSIS] Model ${modelName} succeeded.`);
                break; // Success
            } catch (modelErr: any) {
                retries--;
                lastAnalysisErr = modelErr;
                console.warn(`[ANALYSIS] Model ${modelName} failed: ${modelErr.message}`);
                
                if (retries > 0) {
                    const waitTimeMatch = modelErr.message.match(/retry in (\d+\.\d+)s/i);
                    let waitMs = 5000;
                    if (waitTimeMatch) {
                        waitMs = Math.ceil(parseFloat(waitTimeMatch[1])) * 1000 + 2000;
                    } else if (modelErr.message.includes('429') || modelErr.message.includes('503')) {
                        waitMs = 15000;
                    }
                    console.log(`[ANALYSIS] Retrying ${modelName} in ${waitMs/1000}s...`);
                    await new Promise(r => setTimeout(r, waitMs));
                }
            }
        }
        if (analysisResult) break;
    }

    if (!analysisResult) {
        throw lastAnalysisErr || new Error("All analysis models failed.");
    }
    
    const analysisResponseText = analysisResult.response.text();

    console.log(`[ANALYSIS] RAW AI RESPONSE PREVIEW: ${analysisResponseText.substring(0, 200)}...`);

    let analysis;
    try {
      // Clean possible markdown code blocks
      const cleanJson = analysisResponseText.replace(/```json/g, '').replace(/```/g, '').trim();
      analysis = JSON.parse(cleanJson);
      
      // Validation: Ensure core score is present
      if (!analysis.summary || typeof analysis.summary.lectureQualityScore === 'undefined') {
        console.warn("[ANALYSIS] Missing score in JSON. Retrying with loose parse.");
        throw new Error("Missing summary.lectureQualityScore");
      }
    } catch (jsonErr) {
      console.error("[ANALYSIS] JSON Parsing failed. Attempting deep extraction.");
      const jsonMatch = analysisResponseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
         try {
           analysis = JSON.parse(jsonMatch[0]);
         } catch (e) {
           throw new Error("AI returned malformed data that could not be parsed as LQR Report.");
         }
      } else {
        throw new Error("Failed to parse pedagogical analysis JSON from AI response.");
      }
    }

    // Force Duration if missing
    if (analysis.summary && !analysis.summary.topic) {
        analysis.summary.topic = report.courseName;
    }

    console.log("[ANALYSIS] Updating database with Enhanced LQR data...");
    if (mode === 'modified') {
      report.modifiedPedagogicalAnalysis = analysis;
    } else {
      report.pedagogicalAnalysis = analysis;
      report.isAIProcessed = true;
      report.aiAnalysisAt = new Date().toISOString();
    }
    
    // Ensure actualDurationMinutes is updated if AI gives a better estimate
    if (analysis.summary?.durationMinutes) {
        report.actualDurationMinutes = analysis.summary.durationMinutes;
    }

    await report.save();

    console.log(`[ANALYSIS] SUCCESS. Processing time: ${((Date.now() - startTime) / 1000).toFixed(1)}s`);

    return NextResponse.json({ success: true, analysis });
  } catch (error: any) {
    console.error("[ANALYSIS] FATAL ERROR:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
