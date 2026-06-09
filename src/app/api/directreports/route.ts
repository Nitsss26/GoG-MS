import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { LectureReport } from '@/models/Schemas';
import { verifySessionToken, COOKIE_NAME } from '@/lib/session';
import { cookies } from 'next/headers';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { GoogleAIFileManager, FileState } from "@google/generative-ai/server";

export const maxDuration = 900; // 15 mins

const PROVIDED_API_KEY = "AIzaSyAvECzWcJpL7HXOhcAZ2SbojSUiRhu2SNM";

export async function POST(req: Request) {
    let tempAudioPath = "";
    const startTime = Date.now();
    try {
        const cookieStore = await cookies();
        const sessionCookie = cookieStore.get(COOKIE_NAME);
        if (!sessionCookie?.value) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const session = verifySessionToken(sessionCookie.value);
        if (!session || session.role !== "AD") {
            return NextResponse.json({ error: 'Unauthorized. Only AD can create direct reports.' }, { status: 401 });
        }

        await dbConnect();
        
        // Process FormData
        const formData = await req.formData();
        const facultyId = formData.get('facultyId') as string;
        const facultyName = formData.get('facultyName') as string;
        const college = formData.get('college') as string;
        const file = formData.get('file') as File;

        if (!facultyId || !facultyName || !file) {
             return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const report = new LectureReport({
            facultyId: facultyId,
            facultyName: facultyName,
            date: new Date().toISOString().split('T')[0],
            college: college || "Direct Upload",
            lectureNumber: 1,
            courseName: "Direct AD Report",
            status: "In Progress",
            recordingUrl: "Direct Upload File"
        });

        await report.save();

        const reportId = report._id;
        
        console.log(`[DIRECT REPORTS] Saved initial report ${reportId}`);

        // Write file to disk
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const fileName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
        tempAudioPath = path.join(os.tmpdir(), `direct_${reportId}_${Date.now()}_${fileName}`);
        
        fs.writeFileSync(tempAudioPath, buffer);
        console.log(`[DIRECT REPORTS] File saved to ${tempAudioPath} (${(buffer.length/1024/1024).toFixed(2)} MB)`);

        // Initialize AI tools with fallback
        let activeApiKey = PROVIDED_API_KEY;
        let fileManager = new GoogleAIFileManager(activeApiKey);
        let genAI = new GoogleGenerativeAI(activeApiKey);

        // Upload to Gemini
        console.log(`[DIRECT REPORTS] Uploading to Gemini...`);
        let uploadResult;
        try {
            uploadResult = await fileManager.uploadFile(tempAudioPath, {
                mimeType: file.type || "audio/mp3",
                displayName: `Direct_Lecture_${reportId}`,
            });
        } catch (uploadErr: any) {
            console.warn(`[DIRECT REPORTS] Upload with provided key failed: ${uploadErr.message}`);
            // If the provided key is blocked (403), fallback to the system .env key
            if (uploadErr.message?.includes('403') || uploadErr.message?.includes('denied access')) {
                console.log(`[DIRECT REPORTS] Falling back to process.env.GEMINI_API_KEY`);
                activeApiKey = process.env.GEMINI_API_KEY || "";
                fileManager = new GoogleAIFileManager(activeApiKey);
                genAI = new GoogleGenerativeAI(activeApiKey);
                
                uploadResult = await fileManager.uploadFile(tempAudioPath, {
                    mimeType: file.type || "audio/mp3",
                    displayName: `Direct_Lecture_${reportId}`,
                });
            } else {
                throw uploadErr;
            }
        }

        if (!uploadResult) {
            throw new Error("Failed to upload file to Gemini File API");
        }

        // Poll until ACTIVE
        let geminiFile = await fileManager.getFile(uploadResult.file.name);
        let attempts = 0;
        while (geminiFile.state === FileState.PROCESSING && attempts < 300) {
            attempts++;
            await new Promise((resolve) => setTimeout(resolve, 3000));
            geminiFile = await fileManager.getFile(uploadResult.file.name);
        }
        
        if (geminiFile.state === FileState.FAILED) throw new Error(`File processing failed: ${geminiFile.error?.message}`);
        if (geminiFile.state !== FileState.ACTIVE) throw new Error(`File timed out, state: ${geminiFile.state}`);

        console.log(`[DIRECT REPORTS] Gemini File ACTIVE: ${geminiFile.uri}`);

        // Phase 1: Transcribe
        console.log(`[DIRECT REPORTS] Starting Transcription...`);
        const transcriptionPrompt = `Transcribe this lecture audio accurately and COMPLETELY. 
        Include timestamps in [MM:SS] format every 30-60 seconds.
        Hinglish (mix of Hindi/English) content should be transcribed as spoken.
        Format accurately as a clean text stream. If the audio is long, provide the full transcript without truncation.`;

        const modelsToTry = ["gemini-2.5-pro", "gemini-2.5-flash", "gemini-2.0-flash"];
        let transcriptionText = "";

        for (const modelName of modelsToTry) {
            try {
                const model = genAI.getGenerativeModel({ model: modelName });
                const result = await model.generateContent([
                    { fileData: { mimeType: geminiFile.mimeType, fileUri: geminiFile.uri } },
                    { text: transcriptionPrompt }
                ]);
                const text = result.response.text();
                if (text && text.length > 50) {
                    transcriptionText = text;
                    console.log(`[DIRECT REPORTS] Transcribed with ${modelName}`);
                    break;
                }
            } catch (err: any) {
                console.warn(`[DIRECT REPORTS] Transcribe model ${modelName} failed: ${err.message}`);
                await new Promise(r => setTimeout(r, 2000));
            }
        }

        if (!transcriptionText || transcriptionText.length < 50) {
            try { await fileManager.deleteFile(geminiFile.name); } catch {}
            throw new Error("Failed to transcribe audio.");
        }

        // Save transcription midway just in case
        report.transcription = transcriptionText;
        await report.save();

        // Phase 2: Analysis (LQS)
        console.log(`[DIRECT REPORTS] Starting Analysis...`);
        
        // Exact LQS Prompt from analyze route
        const topicInstruction = "Extract a professional, concise topic name (e.g., 'JAVA COLLECTIONS: LISTS AND MAPS').";
        const analysisPrompt = `Analyze the following lecture transcript and provide a HIGHLY PROFESSIONAL pedagogical report in JSON format.
        This is for a "Lecture Quality Report" (LQR).
        Topic Instruction: ${topicInstruction}
        
        
        Transcript:
        ${transcriptionText}
        
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
                  "whatWorked": ["observation with [MM:SS]"],
                  "scopeForImprovement": ["observation with [MM:SS]"],
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

        let analysisResult: any = null;
        for (const modelName of modelsToTry) {
            try {
                const analysisModel = genAI.getGenerativeModel({
                    model: modelName,
                    generationConfig: { 
                        responseMimeType: "application/json",
                        temperature: 0.1
                    }
                });
                analysisResult = await analysisModel.generateContent(analysisPrompt);
                break;
            } catch (modelErr: any) {
                console.warn(`[DIRECT REPORTS] Analysis model ${modelName} failed: ${modelErr.message}`);
                await new Promise(r => setTimeout(r, 3000));
            }
        }

        try { await fileManager.deleteFile(geminiFile.name); } catch {}

        if (!analysisResult) {
            throw new Error("All analysis models failed.");
        }

        const analysisResponseText = analysisResult.response.text();
        let analysis;
        try {
            const cleanJson = analysisResponseText.replace(/```json/g, '').replace(/```/g, '').trim();
            analysis = JSON.parse(cleanJson);
        } catch (jsonErr) {
            const jsonMatch = analysisResponseText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
               analysis = JSON.parse(jsonMatch[0]);
            } else {
               throw new Error("Failed to parse pedagogical analysis JSON.");
            }
        }

        report.pedagogicalAnalysis = analysis;
        report.isAIProcessed = true;
        report.aiAnalysisAt = new Date().toISOString();
        report.status = "Completed";
        
        if (analysis.summary?.topic) {
            report.topicsCovered = analysis.summary.topic;
        }
        
        if (analysis.summary?.durationMinutes) {
            report.actualDurationMinutes = analysis.summary.durationMinutes;
        }

        await report.save();

        console.log(`[DIRECT REPORTS] SUCCESS. Processing time: ${((Date.now() - startTime) / 1000).toFixed(1)}s`);

        return NextResponse.json({ success: true, reportId: report._id });
    } catch (error: any) {
        console.error("[DIRECT REPORTS] FATAL ERROR:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    } finally {
        if (tempAudioPath && fs.existsSync(tempAudioPath)) fs.unlinkSync(tempAudioPath);
    }
}
