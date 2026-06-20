"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import {
    CheckCircle2, AlertTriangle, ShieldAlert, Award,
    TrendingUp, Clock, Users, BookOpen, ChevronRight,
    MessageSquare, Zap, Target, FileText, Brain,
    ArrowUpRight, ArrowDownRight, Info, Loader2,
    Download, RefreshCw
} from "lucide-react";
import { cn } from "@/lib/utils";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

export default function LQRPage() {
    const params = useParams();
    const searchParams = useSearchParams();
    const { user } = useAuth();
    
    if (!user || !["FOUNDER", "AD", "HOI", "HR", "OM"].includes(user.role)) return null;

    const shouldAnalyze = searchParams.get("analyze") === "true";

    const [loading, setLoading] = useState(true);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [analysisStep, setAnalysisStep] = useState("");
    const [data, setData] = useState<any>(null);
    const analysisTriggered = useRef(false);

    // NEW: Modified Report states
    const [showModified, setShowModified] = useState(false);
    const [isGeneratingModified, setIsGeneratingModified] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);
    const reportRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (params.reportId && !analysisTriggered.current) {
            fetchReport();
        }
    }, [params.reportId]);

    const fetchReport = async () => {
        if (analysisTriggered.current) return;
        analysisTriggered.current = true;
        try {
            const res = await fetch(`/api/manager/lectures/lqr?reportId=${params.reportId}&t=${Date.now()}`);
            const json = await res.json();

            if (json.success) {
                setData(json);

                // Auto-set showModified if data exists
                if (json.report?.modifiedPedagogicalAnalysis) {
                    setShowModified(true);
                }

                // Check if we should auto-analyze
                if (shouldAnalyze) {
                    // Check if VALID analysis already exists (score > 0)
                    const existingScore = json.report.pedagogicalAnalysis?.summary?.lectureQualityScore;
                    if (existingScore && existingScore > 0) {
                        // Already have valid data — just show it
                        console.log("[LQR] Valid analysis exists, showing report.");
                    } else if (!isAnalyzing) {
                        // No valid analysis — run it
                        triggerFullAnalysis("standard");
                    }
                }
            }
        } catch (e) {
            analysisTriggered.current = false;
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const triggerFullAnalysis = async (mode: "standard" | "modified" = "standard") => {
        if (mode === "modified") setIsGeneratingModified(true);
        else setIsAnalyzing(true);

        const reportId = params.reportId;

        try {
            // ━━━ STEP 1: TRANSCRIPTION ━━━
            const needsTranscription = !data?.report?.hasTranscription;

            if (needsTranscription && mode === "standard") {
                setAnalysisStep("⏳ Step 1/3 — Downloading & compressing audio...");
                console.log("[LQR] Starting transcription...");

                const transRes = await fetch('/api/manager/lectures/transcribe', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ reportId, force: true })
                });
                const transData = await transRes.json();

                if (!transData.success) {
                    throw new Error(transData.error || "Transcription failed");
                }

                // If it was cached, skip waiting
                if (!transData.cached) {
                    setAnalysisStep("✅ Step 1/3 — Transcription complete!");
                } else {
                    setAnalysisStep("✅ Step 1/3 — Using cached transcription.");
                }
            } else {
                setAnalysisStep("✅ Step 1/3 — Transcription already available.");
            }

            // ━━━ STEP 2: STANDARD ANALYSIS ━━━
            setAnalysisStep(mode === "modified"
                ? "⏳ Step 2/3 — Generating lenient pedagogical metrics..."
                : "⏳ Step 2/3 — AI is analyzing lecture quality...");
            console.log(`[LQR] Starting ${mode} analysis...`);

            const analRes = await fetch('/api/manager/lectures/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ reportId, mode, force: true })
            });
            const analData = await analRes.json();
            if (!analData.success) throw new Error(analData.error || "Analysis failed");

            setAnalysisStep("✅ Step 2/3 — Analysis complete! Loading report...");

            // ━━━ STEP 3: UPDATE UI ━━━
            setData((prev: any) => ({
                ...prev,
                report: {
                    ...prev.report,
                    pedagogicalAnalysis: mode === "standard" ? analData.analysis : (prev?.report?.pedagogicalAnalysis || {}),
                    modifiedPedagogicalAnalysis: mode === "modified" ? analData.analysis : (prev?.report?.modifiedPedagogicalAnalysis || {}),
                    isAIProcessed: true,
                    hasTranscription: true,
                }
            }));

            if (mode === "modified") setShowModified(true);
        } catch (err: any) {
            console.error("LQR Analysis Error:", err);
            alert(`Analysis Failed: ${err.message}`);
        } finally {
            setIsAnalyzing(false);
            setIsGeneratingModified(false);
        }
    };

    const downloadPDF = () => {
        // Switch to native print for 100% accuracy in colors, alignment, and long-page support
        window.print();
    };

    if (loading || isAnalyzing) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-indigo-600 animate-pulse" />
                <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#4f46e5 1px, transparent 1px)', backgroundSize: '40px 40px' }} />

                <div className="bg-white p-16 rounded-[3rem] shadow-2xl shadow-indigo-100 flex flex-col items-center gap-10 text-center max-w-md relative z-10">
                    <div className="relative">
                        <div className="w-24 h-24 border-8 border-indigo-50 border-t-indigo-600 rounded-full animate-spin" />
                        <Brain className="absolute inset-0 m-auto text-indigo-600 animate-pulse" size={32} />
                    </div>

                    <div className="space-y-4">
                        <h2 className="text-2xl font-black text-zinc-900 tracking-tight uppercase italic">
                            {isAnalyzing ? "AI Analysis" : "Assembling Report"}
                        </h2>
                        <p className="text-sm font-bold text-zinc-400 italic leading-relaxed">
                            {isAnalyzing ? analysisStep : "Retrieving session data from the Master Ledger..."}
                        </p>
                    </div>

                    <div className="flex gap-2">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="w-2 h-2 bg-indigo-600 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.2}s` }} />
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    if (!data || !data.report) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen text-center p-8 bg-white">
                <AlertTriangle size={48} className="text-amber-500 mb-4" />
                <h1 className="text-2xl font-black text-zinc-900 uppercase">Report Unavailable</h1>
                <p className="text-zinc-500 mt-2">The requested pedagogical audit could not be retrieved.</p>
            </div>
        );
    }

    const { report, faculty } = data;
    // Use either standard or modified analysis based on state
    const analysis = showModified ? (report.modifiedPedagogicalAnalysis || {}) : (report.pedagogicalAnalysis || {});
    const summary = analysis.summary || {};

    // Mandated: Keep topic name strictly consistent with database topicsCovered field
    const mainTopic = report.topicsCovered || report.courseName;

    // Helper to replace "N/A" or empty instructional guide text
    const formatGuideText = (text: string, fallback: string) => {
        if (!text || text.trim().toUpperCase() === "N/A" || text.trim() === "") return fallback;
        return text;
    };

    const getRatingColor = (rating: string) => {
        switch (rating) {
            case "Exemplary": return "text-emerald-700";
            case "On Track": return "text-indigo-700";
            case "Needs Coaching": return "text-amber-700";
            case "Requires Intervention": return "text-rose-700";
            default: return "text-zinc-600";
        }
    };

    return (
        <div className="min-h-screen bg-white pb-32 font-outfit text-zinc-900 selection:bg-indigo-100">
            <style jsx global>{`
                @media print {
                    header, .no-print, button {
                        display: none !important;
                    }
                    main {
                        margin: 0 !important;
                        padding: 0 !important;
                        width: 100% !important;
                        max-width: none !important;
                    }
                    section {
                        page-break-inside: avoid;
                    }
                    .DetailedScorecard P {
                        page-break-inside: avoid;
                    }
                    body {
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                        background: white !important;
                    }
                }
            `}</style>
            {/* Dedicated Standalone Header (Sticky/Premium) */}
            <header className="sticky top-0 z-[100] bg-white/90 backdrop-blur-md border-b border-zinc-200 px-12 py-4 flex items-center justify-between shadow-sm no-print">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-zinc-900 flex items-center justify-center text-white font-black italic rounded-lg shadow-md">G</div>
                    <div>
                        <p className="text-[9px] font-black text-indigo-600 uppercase tracking-[0.2em]">Quality Assurance System</p>
                        <h1 className="text-lg font-black text-zinc-900 tracking-tight leading-none mt-0.5 uppercase italic">Lecture Report</h1>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    {/* Simplified header with no visible toggles */}

                    {!showModified ? (
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => {
                                    if (data?.report?.modifiedPedagogicalAnalysis?.summary) {
                                        setShowModified(true);
                                    } else {
                                        triggerFullAnalysis("modified");
                                    }
                                }}
                                disabled={isAnalyzing || isGeneratingModified}
                                className={cn(
                                    "flex items-center gap-2 px-6 py-2.5 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-xl active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed",
                                    isGeneratingModified ? "bg-indigo-400 animate-pulse" : "bg-indigo-600 hover:bg-indigo-700"
                                )}
                            >
                                {isGeneratingModified ? <RefreshCw size={14} className="animate-spin" /> : <ShieldAlert size={14} />}
                                {data?.report?.modifiedPedagogicalAnalysis?.summary ? "Show Modified Report" : "Generate Modified Report"}
                            </button>
                            <button
                                onClick={() => {
                                    if(confirm("Are you sure you want to regenerate the ORIGINAL report? This will overwrite the current original data.")) {
                                        triggerFullAnalysis("standard");
                                    }
                                }}
                                disabled={isAnalyzing || isGeneratingModified}
                                className="flex items-center justify-center w-10 h-10 bg-zinc-100 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-200 transition-all rounded-xl shadow-sm disabled:opacity-50 active:scale-95"
                                title="Regenerate Original Report"
                            >
                                <RefreshCw size={14} className={cn(isAnalyzing && "animate-spin")} />
                            </button>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => {
                                    if (data?.report?.pedagogicalAnalysis?.summary) {
                                        setShowModified(false);
                                    } else {
                                        triggerFullAnalysis("standard");
                                    }
                                }}
                                disabled={isAnalyzing || isGeneratingModified}
                                className={cn(
                                    "flex items-center gap-2 px-6 py-2.5 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-xl active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed",
                                    isAnalyzing ? "bg-emerald-400 animate-pulse" : "bg-emerald-600 hover:bg-emerald-700"
                                )}
                            >
                                {isAnalyzing ? <RefreshCw size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                                {data?.report?.pedagogicalAnalysis?.summary ? "Show Original Report" : "Generate Original Report"}
                            </button>
                            <button
                                onClick={() => {
                                    if(confirm("Are you sure you want to regenerate the MODIFIED report? This will overwrite the current modified data.")) {
                                        triggerFullAnalysis("modified");
                                    }
                                }}
                                disabled={isAnalyzing || isGeneratingModified}
                                className="flex items-center justify-center w-10 h-10 bg-zinc-100 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-200 transition-all rounded-xl shadow-sm disabled:opacity-50 active:scale-95"
                                title="Regenerate Modified Report"
                            >
                                <RefreshCw size={14} className={cn(isGeneratingModified && "animate-spin")} />
                            </button>
                        </div>
                    )}

                    <button
                        onClick={downloadPDF}
                        disabled={isDownloading}
                        className={cn(
                            "flex items-center gap-2 px-6 py-2.5 bg-zinc-900 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-zinc-800 transition-all shadow-xl active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed",
                            isDownloading && "animate-pulse"
                        )}
                    >
                        {isDownloading ? <RefreshCw size={14} className="animate-spin" /> : <Download size={14} />}
                        {isDownloading ? "Generating..." : "Download PDF"}
                    </button>

                    <div className="text-right border-l border-zinc-200 pl-4">
                        <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">Document Ref</p>
                        <p className="text-xs font-black text-zinc-900 uppercase tracking-tighter">LQR-{params?.reportId?.toString().slice(-8).toUpperCase() || "REF"}-{(report.courseName || "AUDIT").slice(0, 3).toUpperCase()}</p>
                    </div>
                </div>
            </header>

            <div ref={reportRef}>
                <main className="max-w-[1000px] mx-auto pt-12 px-10 space-y-16 animate-in fade-in duration-1000">

                    {/* --- HEADER BLOCK --- */}
                    <section className="space-y-8">
                        {/* {showModified && (
                            <div className="bg-indigo-50 border-2 border-indigo-200 p-4 rounded-2xl flex items-center gap-4 animate-in slide-in-from-top-4 duration-500">
                                <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg">
                                    <ShieldAlert size={20} />
                                </div>
                                <div>
                                    <p className="text-xs font-black text-indigo-900 uppercase tracking-widest">Modified Lenient View Active</p>
                                    <p className="text-[10px] font-bold text-indigo-700 italic">This report has been adjusted for positive internal presentation. Original data remains archived.</p>
                                </div>
                            </div>
                        )} */}

                        <div className={cn("p-8 border border-zinc-900 shadow-sm transition-colors duration-500", showModified ? "bg-indigo-50" : "bg-[#D1E0FF]")}>
                            <div className="space-y-4">
                                <p className="text-[11px] font-black text-indigo-900/60 uppercase tracking-[0.4em]">Lecture Quality Report</p>
                                <h2 className="text-3xl font-black text-zinc-900 tracking-tight leading-tight italic uppercase">{mainTopic}</h2>
                            </div>
                        </div>

                        {report.isAIProcessed && !report.pedagogicalAnalysis && (
                            <div className="bg-red-50 border-2 border-red-200 p-4 rounded-2xl flex items-center gap-4">
                                <div className="w-10 h-10 bg-red-600 rounded-xl flex items-center justify-center text-white shadow-lg">
                                    <AlertTriangle size={20} />
                                </div>
                                <div>
                                    <p className="text-xs font-black text-red-900 uppercase tracking-widest">Analysis Data Missing</p>
                                    <p className="text-[10px] font-bold text-red-700 italic">The AI analysis generated no data. Please click 'Re-analyze' to try again.</p>
                                </div>
                            </div>
                        )}

                        {/* Meta Info Table */}
                        <div className="grid grid-cols-2 border border-zinc-900 overflow-hidden divide-x divide-zinc-900 divide-y divide-zinc-900 text-[14px]">
                            <div className="p-4 flex flex-col gap-1">
                                <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Professor</span>
                                <span className="font-bold text-zinc-900">{report.facultyName}</span>
                            </div>
                            <div className="p-4 flex flex-col gap-1">
                                <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Report ID</span>
                                <span className="font-bold text-zinc-900 uppercase">LQR-{new Date(report.date).getFullYear()}-{params?.reportId?.toString().slice(-6).toUpperCase() || "ID"}</span>
                            </div>
                            <div className="p-4 flex flex-col gap-1">
                                <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Course</span>
                                <span className="font-bold text-zinc-900 italic">{report.courseName}</span>
                            </div>
                            <div className="p-4 flex flex-col gap-1">
                                <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Session Date</span>
                                <span className="font-bold text-zinc-900">{new Date(report.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                            </div>
                            <div className="p-4 flex flex-col gap-1">
                                <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Duration</span>
                                <span className="font-bold text-zinc-900 tracking-tight">
                                    {report.actualDurationMinutes || Math.round((report.recordingDurationSeconds || 0) / 60)} minutes
                                </span>
                            </div>
                            <div className="p-4 flex flex-col gap-1">
                                <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Evaluator</span>
                                <span className="font-bold text-zinc-900 uppercase italic leading-none">{showModified ? "HOI" : "HOI"}</span>
                            </div>
                        </div>

                        {/* Primary Score Summary Rows */}
                        <div className="grid grid-cols-3 border border-zinc-900 divide-x divide-zinc-900 h-48">
                            <div className="flex flex-col items-center justify-center gap-4 bg-zinc-50/20 border-b border-zinc-900 lg:border-b-0 space-y-2">
                                <span className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">Lecture Quality Score</span>
                                <div className="flex flex-col items-center">
                                    <span className={cn("text-6xl font-black tracking-tighter leading-none italic", showModified ? "text-indigo-600" : "text-[#FF5555]")}>
                                        {(summary.lectureQualityScore || 0).toFixed(2)}
                                    </span>
                                    <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mt-4">out of 5.00</p>
                                </div>
                            </div>
                            <div className="flex flex-col items-center justify-center gap-4 border-b border-zinc-900 lg:border-b-0 space-y-2">
                                <span className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">Overall Rating</span>
                                <div className="text-center space-y-2">
                                    <span className={cn("text-2xl font-black uppercase tracking-tight italic", getRatingColor(summary.overallRating))}>
                                        {summary.overallRating}
                                    </span>
                                    {/* <p className="text-[10px] font-bold text-zinc-400 italic">No Intervention required</p> */}
                                </div>
                            </div>
                            <div className="flex flex-col items-center justify-center gap-4 bg-zinc-50/20 space-y-2">
                                <span className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">Red Flags</span>
                                <div className="text-center space-y-2">
                                    <span className="text-2xl font-black text-zinc-900 uppercase tracking-tight italic">
                                        {(analysis.redFlagLog?.length || 0) === 0 ? "None Detected" : `${analysis.redFlagLog?.length} Detected`}
                                    </span>
                                    <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">See Red Flag Log (p. 4)</p>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* --- PILLAR SNAPSHOT --- */}
                    <section className="space-y-6">
                        <h3 className="text-xl font-black text-zinc-900 uppercase tracking-tight italic">Pillar Snapshot</h3>
                        <div className="border border-zinc-900 overflow-hidden">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-[#D1E0FF] border-b border-zinc-900 divide-x divide-zinc-900">
                                        <th className="p-4 text-[10px] font-black text-zinc-600 uppercase tracking-widest border-r border-zinc-900">Pillar</th>
                                        <th className="p-4 text-[10px] font-black text-zinc-600 uppercase tracking-widest text-center border-r border-zinc-900">Weight</th>
                                        <th className="p-4 text-[10px] font-black text-zinc-600 uppercase tracking-widest text-center border-r border-zinc-900">Score / 5</th>
                                        <th className="p-4 text-[10px] font-black text-zinc-600 uppercase tracking-widest text-center">Visual</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-zinc-900 divide-x-zinc-900">
                                    {(analysis.pillarSnapshot || []).map((p: any, i: number) => (
                                        <tr key={i} className="divide-x divide-zinc-900">
                                            <td className="p-4 font-black text-zinc-900 italic text-[15px]">{p.pillar}</td>
                                            <td className="p-4 text-center font-bold text-zinc-500 text-sm tracking-tight">{p.weight}</td>
                                            <td className="p-4 text-center">
                                                <span className={cn(
                                                    "font-black text-[16px]",
                                                    p.score >= 4 ? "text-emerald-700" : p.score >= 3 ? "text-orange-700" : "text-rose-700"
                                                )}>{p.score.toFixed(1)}</span>
                                            </td>
                                            <td className="p-4 w-[320px]">
                                                <div className="h-6 border border-zinc-900 relative overflow-hidden bg-zinc-100">
                                                    <div
                                                        className={cn(
                                                            "h-full transition-all duration-1000",
                                                            p.score >= 4 ? "bg-[#86C88F]" : p.score >= 3 ? "bg-[#FF8B66]" : "bg-[#FF5555]"
                                                        )}
                                                        style={{ width: `${(p.score / 5) * 100}%` }}
                                                    />
                                                    <div className="absolute inset-0 opacity-[0.2]"
                                                        style={{
                                                            backgroundImage: 'linear-gradient(135deg, #000 10%, transparent 10%, transparent 50%, #000 50%, #000 60%, transparent 60%, transparent 100%)',
                                                            backgroundSize: '8px 8px'
                                                        }} />
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                    <tr className="bg-zinc-100 font-black border-t border-zinc-900 divide-x divide-zinc-900">
                                        <td colSpan={2} className="p-4 text-[11px] uppercase tracking-[0.2em] italic">LECTURE QUALITY SCORE (after Red Flag multiplier)</td>
                                        <td colSpan={2} className="p-4 text-center text-[#FF5555] text-lg">
                                            {(summary.lectureQualityScore || 0).toFixed(2)} / 5.00
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </section>

                    {/* Strengths & Improvements Boxes */}
                    <div className="grid grid-cols-2 border border-zinc-900">
                        <div className="flex flex-col border-r border-zinc-900">
                            <div className="bg-[#86C88F] p-3 text-center border-b border-zinc-900">
                                <h4 className="text-[10px] font-black text-black uppercase tracking-[0.3em]">Top Feedback</h4>
                            </div>
                            <div className="p-6 space-y-4">
                                {(analysis.topStrengths || []).map((s: any, i: number) => (
                                    <div key={i} className="flex gap-3">
                                        <CheckCircle2 size={16} className="text-emerald-700 shrink-0 mt-1" />
                                        <p className="text-[13px] font-bold text-zinc-900 leading-snug italic tracking-tighter decoration-emerald-100 decoration-4 underline-offset-2">
                                            {s.text} <span className="text-[9px] font-black text-indigo-400 tabular-nums uppercase border-b border-indigo-100 ml-1">[{s.timestamp}]</span>
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="flex flex-col">
                            <div className="bg-[#FF8B66] p-3 text-center border-b border-zinc-900">
                                <h4 className="text-[10px] font-black text-black uppercase tracking-[0.3em]">Critical Areas</h4>
                            </div>
                            <div className="p-6 space-y-4">
                                {(analysis.topImprovements || []).map((imp: any, i: number) => (
                                    <div key={i} className="flex gap-3">
                                        <AlertTriangle size={16} className="text-orange-600 shrink-0 mt-1" />
                                        <p className="text-[13px] font-bold text-zinc-900 leading-snug italic tracking-tighter decoration-orange-100 decoration-4 underline-offset-2">
                                            {imp.text} <span className="text-[9px] font-black text-indigo-400 tabular-nums uppercase border-b border-indigo-100 ml-1">[{imp.timestamp}]</span>
                                        </p>
                                    </div>
                                ))}
                                {(!analysis.topImprovements || analysis.topImprovements.length === 0) && (
                                    <div className="flex gap-3 opacity-40">
                                        <CheckCircle2 size={16} className="text-emerald-700 shrink-0 mt-1" />
                                        <p className="text-[13px] font-black text-zinc-400 italic">No critical improvements flagged in this session.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-center pt-8 border-t border-zinc-100">
                        <p className="text-[10px] font-black text-zinc-300 uppercase tracking-[0.6em] italic">Page 1 of {showModified ? '4' : '11'}</p>
                    </div>

                    {/* --- DETAILED SCORECARD --- */}
                    <section className="pt-24 space-y-8">
                        <h2 className="text-3xl font-black text-zinc-900 tracking-tighter uppercase italic border-b-4 border-zinc-900 pb-4">Detailed Scorecard</h2>
                        <p className="text-sm font-bold text-zinc-500 italic max-w-2xl px-2">This section drills into each pillar. Every parameter is scored on a 1-5 scale with timestamped observations and concrete action items for the professor.</p>

                        <div className="space-y-16">
                            {(analysis.detailedScorecard || []).map((pillar: any, i: number) => (
                                <div key={i} className="space-y-8">
                                    <h3 className="text-xl font-black text-zinc-900 uppercase tracking-tight italic flex items-center justify-between border-b-2 border-zinc-900 pb-2">
                                        <span>{i + 1}. {pillar.pillar} (Score: {analysis.pillarSnapshot?.[i]?.score.toFixed(1)}/5 — Weight: {analysis.pillarSnapshot?.[i]?.weight})</span>
                                    </h3>

                                    <div className="space-y-12">
                                        {(pillar.parameters || []).map((param: any, j: number) => (
                                            <div key={j} className="border border-zinc-900 overflow-hidden">
                                                <div className="bg-[#D1E0FF] p-3 border-b border-zinc-900 flex justify-between items-center px-6">
                                                    <span className="font-black text-sm italic uppercase">{i + 1}.{j + 1} {param.name}</span>
                                                    <span className="font-black text-lg border-l border-zinc-900 pl-6 tabular-nums tracking-tighter italic">{param.score.toFixed(1)} / 5</span>
                                                </div>

                                                <div className="p-8 space-y-8">
                                                    <div className="space-y-4">
                                                        <h5 className="text-[10px] font-black text-emerald-700 uppercase tracking-[0.3em]">Observations</h5>
                                                        <ul className="space-y-2">
                                                            {(param.whatWorked || []).map((w: string, k: number) => (
                                                                <li key={k} className="text-[13px] font-bold text-zinc-700 italic leading-relaxed pl-4 relative">
                                                                    <div className="absolute left-0 top-2 w-1.5 h-1.5 bg-emerald-500 rounded-full" /> {w}
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    </div>

                                                    {(!showModified || (param.scopeForImprovement && param.scopeForImprovement.length > 0)) && (
                                                        <div className="space-y-4">
                                                            <h5 className="text-[10px] font-black text-[#FF5555] uppercase tracking-[0.3em]">Action Items</h5>
                                                            <ul className="space-y-2">
                                                                {(param.scopeForImprovement || []).map((s: string, k: number) => (
                                                                    <li key={k} className="text-[13px] font-bold text-zinc-700 italic leading-relaxed pl-4 relative">
                                                                        <div className="absolute left-0 top-2 w-1.5 h-1.5 bg-[#FF5555] rounded-full" /> {formatGuideText(s, "Continued focus on depth and clarity.")}
                                                                    </li>
                                                                ))}
                                                                {(!param.scopeForImprovement || param.scopeForImprovement.length === 0) && (
                                                                    <li className="text-[13px] font-bold text-zinc-400 italic leading-relaxed pl-4">
                                                                        No immediate action items required.
                                                                    </li>
                                                                )}
                                                            </ul>
                                                        </div>
                                                    )}

                                                    <div className="space-y-4 bg-zinc-50 p-6 border-l-4 border-l-indigo-600">
                                                        <h5 className="text-[10px] font-black text-indigo-700 uppercase tracking-[0.3em]">Instructional Guide</h5>
                                                        <div className="space-y-6">
                                                            {(param.actionItems && param.actionItems.length > 0) ? param.actionItems.map((ai: any, k: number) => (
                                                                <div key={k} className="space-y-2">
                                                                    <p className="text-[14px] font-black text-zinc-900 italic tracking-tight relative pl-4">
                                                                        <div className="absolute left-0 top-2 w-1 h-1 bg-zinc-400" /> {formatGuideText(ai.task, "Maintain current delivery standard with focus on student engagement.")}
                                                                    </p>
                                                                    <p className="text-[12px] font-bold text-indigo-500 italic ml-4 leading-relaxed opacity-70">" {formatGuideText(ai.example, "Continuance of existing pedagogical strategy recommended.")} "</p>
                                                                </div>
                                                            )) : (
                                                                <div className="space-y-2">
                                                                    <p className="text-[14px] font-black text-zinc-900 italic tracking-tight relative pl-4">
                                                                        <div className="absolute left-0 top-2 w-1 h-1 bg-zinc-400" /> {param.score >= 4.5 ? "Maintain high-impact delivery. Focus on weaving in complex real-world analogies to stretch highest performers." : "Focus on consistent topic transitions and increasing student participation through open-ended questioning."}
                                                                    </p>
                                                                    <p className="text-[12px] font-bold text-indigo-500 italic ml-4 leading-relaxed opacity-70">" Continuity of current high-standard pedagogical strategy recommended to sustain engagement. "</p>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>

                    {/* --- EVIDENCE LOGS --- */}
                    <section className="pt-24 space-y-16">
                        <h2 className="text-3xl font-black text-zinc-900 tracking-tighter uppercase italic border-b-4 border-zinc-900 pb-4">Red Flag Log</h2>
                        <p className="text-sm font-bold text-zinc-500 italic">All red-flag categories are evaluated independently of pillar scores. Any Severe flag overrides the Lecture Quality Score and triggers mandatory escalation.</p>

                        <div className="border border-zinc-900">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-[#D1E0FF] border-b border-zinc-900 text-[10px] font-black uppercase tracking-widest divide-x divide-zinc-900">
                                        <th className="p-4 border-r border-zinc-900">Flag Type</th>
                                        <th className="p-4 text-center border-r border-zinc-900">Severity</th>
                                        <th className="p-4 text-center border-r border-zinc-900">Timestamp</th>
                                        <th className="p-4">Observation</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-zinc-900 divide-x-zinc-900">
                                    {(analysis.redFlagLog || []).map((flag: any, i: number) => (
                                        <tr key={i} className="divide-x divide-zinc-900 font-bold text-sm h-16">
                                            <td className="p-4 italic">{flag.category}</td>
                                            <td className="p-4 text-center">
                                                <span className={cn(
                                                    "px-4 py-1 text-[10px] font-black uppercase tracking-widest border border-zinc-900",
                                                    flag.severity === "Severe" ? "bg-rose-600 text-white" :
                                                        flag.severity === "Moderate" ? "bg-[#FF8B66] text-black" : "bg-emerald-100 text-emerald-800 border-none"
                                                )}>{flag.severity === "None" ? "Not Observed" : flag.severity}</span>
                                            </td>
                                            <td className="p-4 text-center font-black text-zinc-400 tabular-nums italic text-xs tracking-tighter">{flag.timestamp}</td>
                                            <td className="p-4 italic text-zinc-600 leading-relaxed overflow-hidden">"{flag.observation}"</td>
                                        </tr>
                                    ))}
                                    {(!analysis.redFlagLog || analysis.redFlagLog.length === 0) && (
                                        <tr>
                                            <td colSpan={4} className="p-16 text-center text-zinc-300 font-black italic uppercase tracking-[0.5em] text-[10px]">No Violations Observed</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        <h2 className="text-3xl font-black text-zinc-900 tracking-tighter uppercase italic border-b-4 border-zinc-900 pb-4 pt-10 mt-20">Evidence Log — Quantitative Metrics</h2>
                        <p className="text-sm font-bold text-zinc-500 italic">Raw counts and timings extracted from the audio. These metrics are the evidentiary backing for pillar scores and are available for dispute resolution.</p>

                        <div className="border border-zinc-900">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-[#D1E0FF] border-b border-zinc-900 text-[10px] font-black uppercase tracking-widest divide-x divide-zinc-900">
                                        <th className="p-4 border-r border-zinc-900">Metric</th>
                                        <th className="p-4 text-center border-r border-zinc-900">Observed</th>
                                        <th className="p-4 text-center">Benchmark</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-zinc-900 divide-x-zinc-900">
                                    {(analysis.evidenceLog?.metrics || []).map((m: any, i: number) => (
                                        <tr key={i} className="divide-x divide-zinc-900 font-bold text-sm h-14">
                                            <td className="p-4 italic text-zinc-700">{m.name}</td>
                                            <td className="p-4 text-center font-black text-lg text-indigo-700 tracking-tighter italic">{m.observed}</td>
                                            <td className="p-4 text-center text-[10px] font-black text-zinc-400 uppercase tracking-widest">{m.benchmark}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div className="flex justify-center pt-24 pb-12">
                            <p className="text-[9px] font-black text-zinc-200 uppercase tracking-[1em] italic">GoG LQR System — Automated Output</p>
                        </div>
                    </section>
                </main>
            </div>

            <style jsx global>{`
                @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@100;300;400;500;700;900&display=swap');
                
                body {
                    background-color: #FFFFFF !important;
                    color: #0F172A !important;
                }

                @media print {
                    header { display: none !important; }
                    main { padding-top: 0 !important; }
                    .border { border-color: #000 !important; }
                    body { background-color: white !important; }
                    .bg-[#D1E0FF] { background-color: #D1E0FF !important; }
                    .bg-[#86C88F] { background-color: #86C88F !important; }
                    .bg-[#FF8B66] { background-color: #FF8B66 !important; }
                }

                ::-webkit-scrollbar {
                    width: 6px;
                }
                ::-webkit-scrollbar-thumb {
                    background: #E2E8F0;
                    border-radius: 10px;
                }
            `}</style>
        </div>
    );
}
