"use client";
import React, { useState, useRef } from "react";
import { useAuth, Employee } from "@/context/AuthContext";
import { uploadToCloudinary } from "@/lib/cloudinary";
import { Mic, Upload, FileAudio, Loader2, CheckCircle2, AlertTriangle, ExternalLink } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export default function DirectReportsPage() {
    const { user, employees } = useAuth();
    const [selectedFacultyId, setSelectedFacultyId] = useState("");
    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState("");
    const [reportUrl, setReportUrl] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Only AD should access this (the user requested AD only)
    if (user?.role !== "AD") {
        return (
            <div className="flex-1 p-8 text-center bg-black min-h-screen text-white">
                <AlertTriangle className="mx-auto text-red-500 mb-4" size={48} />
                <h1 className="text-2xl font-bold">Unauthorized</h1>
                <p className="text-zinc-400 mt-2">Only Academic Directors can access this page.</p>
            </div>
        );
    }

    const facultyList = employees.filter((e: Employee) => ["FACULTY", "PROFESSOR"].includes(e.role));

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!selectedFacultyId) {
            setError("Please select a faculty member first.");
            return;
        }

        const faculty = facultyList.find((f: Employee) => f.id === selectedFacultyId);
        if (!faculty) return;

        setIsUploading(true);
        setError(null);
        setReportUrl(null);
        setUploadProgress("Uploading audio to cloud...");

        try {
            // 1. Upload to Cloudinary
            const recordingUrl = await uploadToCloudinary(file);
            if (!recordingUrl) throw new Error("Failed to upload audio to Cloudinary.");

            setUploadProgress("Creating report entry...");
            
            // 2. Create Lecture Report
            const createRes = await fetch("/api/directreports", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    facultyId: faculty.id,
                    facultyName: faculty.name,
                    college: faculty.location,
                    recordingUrl
                })
            });
            const createData = await createRes.json();
            if (!createData.success) throw new Error(createData.error || "Failed to create report.");

            const reportId = createData.reportId;

            setUploadProgress("Transcribing audio (this may take a few minutes)...");

            // 3. Transcribe
            const transcribeRes = await fetch("/api/manager/lectures/transcribe", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ reportId, force: true })
            });
            const transcribeData = await transcribeRes.json();
            if (!transcribeData.success && !transcribeData.locked) {
                throw new Error(transcribeData.error || "Failed to transcribe audio.");
            }

            setUploadProgress("Generating LQS analysis...");

            // 4. Analyze
            const analyzeRes = await fetch("/api/manager/lectures/analyze", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ reportId, mode: "standard", force: true })
            });
            const analyzeData = await analyzeRes.json();
            if (!analyzeData.success) {
                throw new Error(analyzeData.error || "Failed to generate LQS report.");
            }

            setReportUrl(`/manager/reportees/academic-data/lecture/${reportId}`);
            setUploadProgress("");

        } catch (err: any) {
            setError(err.message || "An unexpected error occurred.");
            setUploadProgress("");
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    };

    return (
        <div className="flex-1 p-6 lg:p-10 max-w-4xl mx-auto min-h-screen text-white bg-black">
            <div className="mb-10">
                <h1 className="text-3xl font-black mb-2 bg-gradient-to-r from-blue-400 to-purple-500 text-transparent bg-clip-text">
                    Direct LQS Generator
                </h1>
                <p className="text-zinc-400">
                    Bypass the standard lecture scheduling flow and generate an LQS report directly from an audio recording.
                </p>
            </div>

            <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-2xl p-6 md:p-8 space-y-8">
                {/* Faculty Selection */}
                <div className="space-y-4">
                    <label className="text-sm font-bold text-zinc-300 uppercase tracking-widest">Select Faculty / Professor</label>
                    <select
                        value={selectedFacultyId}
                        onChange={(e) => setSelectedFacultyId(e.target.value)}
                        className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-4 text-white outline-none focus:border-blue-500 transition-colors"
                        disabled={isUploading}
                    >
                        <option value="">-- Choose Faculty --</option>
                        {facultyList.map((f: Employee) => (
                            <option key={f.id} value={f.id}>{f.name} ({f.location || 'No Location'})</option>
                        ))}
                    </select>
                </div>

                {/* Upload Area */}
                <div className="space-y-4">
                    <label className="text-sm font-bold text-zinc-300 uppercase tracking-widest">Upload Audio Recording</label>
                    
                    <input
                        type="file"
                        accept="audio/*,video/*"
                        ref={fileInputRef}
                        className="hidden"
                        onChange={handleFileChange}
                        disabled={isUploading || !selectedFacultyId}
                    />

                    <div 
                        onClick={() => fileInputRef.current?.click()}
                        className={cn(
                            "border-2 border-dashed rounded-2xl p-10 flex flex-col items-center justify-center gap-4 transition-all",
                            (!selectedFacultyId || isUploading) ? "border-zinc-800 bg-zinc-900/30 cursor-not-allowed opacity-50" : "border-blue-500/50 bg-blue-500/5 hover:bg-blue-500/10 cursor-pointer"
                        )}
                    >
                        {isUploading ? (
                            <>
                                <Loader2 size={48} className="text-blue-500 animate-spin" />
                                <div className="text-center">
                                    <p className="text-lg font-bold text-white mb-1">Processing...</p>
                                    <p className="text-sm text-blue-400">{uploadProgress}</p>
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="p-4 bg-blue-500/20 rounded-full text-blue-400">
                                    <FileAudio size={40} />
                                </div>
                                <div className="text-center">
                                    <p className="text-lg font-bold text-white mb-1">Click to Upload Audio</p>
                                    <p className="text-sm text-zinc-500">Supports MP3, WAV, M4A, MP4 (max 20MB recommended)</p>
                                </div>
                            </>
                        )}
                    </div>
                </div>

                {/* Status Messages */}
                {error && (
                    <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl flex items-start gap-3 text-red-400">
                        <AlertTriangle size={20} className="shrink-0 mt-0.5" />
                        <p className="text-sm">{error}</p>
                    </div>
                )}

                {reportUrl && (
                    <div className="p-5 bg-green-500/10 border border-green-500/30 rounded-xl flex items-center justify-between text-green-400">
                        <div className="flex items-center gap-3">
                            <CheckCircle2 size={24} />
                            <div>
                                <p className="font-bold text-white">LQS Report Generated Successfully</p>
                                <p className="text-xs text-green-500/80">The audio was transcribed and analyzed.</p>
                            </div>
                        </div>
                        <Link href={reportUrl} className="px-4 py-2 bg-green-500 hover:bg-green-600 text-black font-bold rounded-lg text-sm transition-colors flex items-center gap-2">
                            View Report <ExternalLink size={14} />
                        </Link>
                    </div>
                )}
            </div>
        </div>
    );
}
