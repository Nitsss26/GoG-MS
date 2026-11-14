"use client";

/**
 * Lecture report (class record) form — opens as a side panel on the right.
 * Used by My Lectures and Lecture Reports. Fields, checks, uploads and the API call are the ones the
 * My Lectures page already had (moved here unchanged), so both pages submit exactly the same report.
 */
import { useEffect, useState } from "react";
import { Upload, Camera, FileText, Mic, Users, X, Loader2, BookOpen, ClipboardList, CheckCircle2 } from "lucide-react";
import { uploadToCloudinary } from "@/lib/cloudinary";
import { DEFAULT_CLASS_STRENGTH } from "@/lib/academic-status";

export interface ReportLecture {
    _id?: string;
    lectureNumber: number;
    sprintPlanId?: string;
    courseName: string;
    topicsCovered: string;
    subjectCode?: string;
    stream?: string;
    year?: string;
    semester?: string;
    timeStart: string;
    timeStop: string;
    scheduledDuration: number;
    status: string;
    date: string;
    // Class record pipeline (from the sprint plan entry)
    sprintEntryId?: string;
    pipelineStatus?: string;
    classEnded?: boolean;
    defaultTotalStudents?: number;
    section?: string;
    className?: string;
    lectureType?: string;
    unitNumber?: string;
    report?: {
        _id?: string;
        numberOfAttendees?: number;
        totalStudents?: number;
        recordingUrl?: string;
        classPhotoUrl?: string;
        warnings?: string[];
        summary?: string;
        transcription?: string;
        keywords?: string;
        aiAnalysisAt?: string;
        status?: string;
        actualInTime?: string;
        actualOutTime?: string;
        isLate?: boolean;
        remarksWhyLate?: string;
        lectureNotes?: {
            notesUrl?: string;
            notesContent?: string;
            isSharedWithStudents?: boolean;
            notSharedRemarks?: string;
            verificationStatus?: string;
            leadRemarks?: string;
        };
        assignment?: {
            hasAssignment?: boolean;
            title?: string;
            description?: string;
            assignmentUrl?: string;
            deadline?: string;
            studentsCompletedCount?: number;
            totalStudentsExpected?: number;
            verificationStatus?: string;
            leadRemarks?: string;
            isSharedInProfGroup?: boolean;
        };
        clVerificationStatus?: string;
        clRemarks?: string;
        [key: string]: any;
    } | null;
}
type Lecture = ReportLecture;

export default function LectureReportForm({ lecture, facultyId, fallbackDate, onClose, onSubmitted }: {
    lecture: ReportLecture; facultyId?: string; fallbackDate: string; onClose: () => void; onSubmitted: (message: string) => void;
}) {
    const [message, setMessage] = useState<{ type: string; text: string } | null>(null);
    const showReport = lecture.lectureNumber;
    const reportLec: Lecture | null = lecture;
    const [reportData, setReportData] = useState({
        numberOfAttendees: "",
        totalStudents: "",
        semester: "",
        issuesFaced: "",
        reasonForLessAttendance: "",
        topicsCovered: "",
        courseName: "",
        // Notes
        notesUrl: "",
        notesContent: "",
        // "Notes shared with the students" is filled by the OM (Submitted to Groups), not in this form
        isNotesSharedWithStudents: false,
        notesNotSharedRemarks: "",
        // Assignment
        hasAssignment: false,
        assignmentTitle: "",
        assignmentDescription: "",
        assignmentUrl: "",
        assignmentDeadline: "",
        studentsCompletedCount: "",
        totalStudentsExpected: "",
        // Notes not submitted → reason (goes to OM)
        notesMissing: false,
        notesMissingReason: "",
        // Topic fully covered? (null = not answered yet) · topics left when "No"
        topicFullyCovered: null as boolean | null,
        topicsLeft: ""
    });
    const [snapshotFiles, setSnapshotFiles] = useState<File[]>([]);
    const [recordingFile, setRecordingFile] = useState<File | null>(null);
    const [photoFile, setPhotoFile] = useState<File | null>(null);
    const [notesFile, setNotesFile] = useState<File | null>(null);
    const [assignmentFile, setAssignmentFile] = useState<File | null>(null);
    const [recordingDuration, setRecordingDuration] = useState(0);
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [uploadLabel, setUploadLabel] = useState("");
    const [photoCoords, setPhotoCoords] = useState<{ lat: number; lng: number } | null>(null);

    // Pre-filled when the record was reverted for correction (same as before)
    useEffect(() => {
        const lec = lecture;
        const r: any = lec.report || {};
        setSnapshotFiles([]);
        setMessage(null);
        setReportData(p => ({
            ...p,
            courseName: lec.courseName,
            topicsCovered: lec.topicsCovered,
            semester: lec.semester || "",
            numberOfAttendees: r.numberOfAttendees !== undefined && r.submittedAt ? String(r.numberOfAttendees) : "",
            totalStudents: String(r.totalStudents || lec.defaultTotalStudents || DEFAULT_CLASS_STRENGTH),
            issuesFaced: r.issuesFaced || "",
            reasonForLessAttendance: r.reasonForLessAttendance || "",
            notesUrl: r.lectureNotes?.notesUrl || "",
            notesContent: "",
            // kept as the OM set it (re-submitting does not change it)
            isNotesSharedWithStudents: Boolean(r.lectureNotes?.isSharedWithStudents),
            notesNotSharedRemarks: r.lectureNotes?.notSharedRemarks || "",
            notesMissing: Boolean(r.notesMissing),
            notesMissingReason: r.notesMissingReason || "",
            topicFullyCovered: typeof r.topicFullyCovered === "boolean" ? r.topicFullyCovered : null,
            topicsLeft: r.topicsLeft || "",
            hasAssignment: Boolean(r.assignment?.hasAssignment),
            assignmentTitle: r.assignment?.title || "",
            assignmentDescription: r.assignment?.description || "",
            assignmentUrl: r.assignment?.assignmentUrl || "",
            assignmentDeadline: r.assignment?.deadline || "",
        }));
    }, [lecture]); // eslint-disable-line react-hooks/exhaustive-deps

    const handleRecordingSelect = (file: File) => {
        setRecordingFile(file);
        const audio = new Audio(URL.createObjectURL(file));
        audio.addEventListener("loadedmetadata", () => setRecordingDuration(Math.round(audio.duration)));
    };

    const handlePhotoSelect = async (file: File) => {
        setPhotoFile(file);
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (pos) => setPhotoCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
                () => setPhotoCoords(null)
            );
        }
    };

    const submitReport = async (lec: Lecture) => {
        // Attendance: 0 ≤ present ≤ total (checked again on the server)
        const total = parseInt(reportData.totalStudents);
        const present = parseInt(reportData.numberOfAttendees);
        if (!(total > 0) || reportData.numberOfAttendees === "" || isNaN(present) || present < 0 || present > total) {
            setMessage({ type: "error", text: `Students present must be a number from 0 to ${total > 0 ? total : "the total"}.` });
            return;
        }
        const hasSnapshot = !!(photoFile || reportLec?.report?.classPhotoUrl || (reportLec?.report?.snapshotUrls || []).length);
        if (!hasSnapshot) {
            setMessage({ type: "error", text: "Class snapshots are compulsory. Attach at least one photo of the class." });
            return;
        }
        const hasNotes = !!(notesFile || reportData.notesUrl.trim());
        if (!hasNotes && !reportData.notesMissing) {
            setMessage({ type: "error", text: "Upload the notes or add a notes link. If you cannot, tick \"Unable to Submit Notes\" and give the reason." });
            return;
        }
        if (!hasNotes && reportData.notesMissingReason.trim().length < 10) {
            setMessage({ type: "error", text: "Please explain why the notes could not be submitted (at least 10 characters)." });
            return;
        }
        if (reportData.topicFullyCovered === null) {
            setMessage({ type: "error", text: "Choose whether the topic was fully covered (Yes / No)." });
            return;
        }
        if (reportData.topicFullyCovered === false && reportData.topicsLeft.trim().length < 5) {
            setMessage({ type: "error", text: "Write which topics are still left (at least 5 characters)." });
            return;
        }
        setUploading(true);
        try {
            const snapshotUrls: string[] = [];
            let notesFileUrl = "";
            let recordingUrl = "";
            let classPhotoUrl = "";
            let assignmentUrl = reportData.assignmentUrl;

            if (recordingFile) {
                setUploadLabel("Uploading Recording...");
                const result = await uploadToCloudinary(recordingFile, (p) => setUploadProgress(p));
                recordingUrl = result.secure_url;
            }
            if (photoFile) {
                setUploadLabel("Uploading Class Photo...");
                setUploadProgress(0);
                const result = await uploadToCloudinary(photoFile, (p) => setUploadProgress(p));
                classPhotoUrl = result.secure_url;
            }
            if (notesFile) {
                setUploadLabel("Uploading Lecture Notes...");
                setUploadProgress(0);
                const result = await uploadToCloudinary(notesFile, (p) => setUploadProgress(p));
                notesFileUrl = result.secure_url;
            }
            for (let i = 0; i < snapshotFiles.length; i++) {
                setUploadLabel(`Uploading Snapshot ${i + 1}/${snapshotFiles.length}...`);
                setUploadProgress(0);
                const result = await uploadToCloudinary(snapshotFiles[i], (p) => setUploadProgress(p));
                snapshotUrls.push(result.secure_url);
            }
            if (assignmentFile && reportData.hasAssignment) {
                setUploadLabel("Uploading Assignment Doc...");
                setUploadProgress(0);
                const result = await uploadToCloudinary(assignmentFile, (p) => setUploadProgress(p));
                assignmentUrl = result.secure_url;
            }

            setUploadLabel("Finalizing Report...");
            setUploadProgress(100);
            const res = await fetch("/api/faculty/lectures", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    facultyId,
                    date: lec.date || fallbackDate,
                    lectureNumber: lec.lectureNumber,
                    sprintEntryId: lec.sprintEntryId,
                    notesFileUrl,
                    notesMissing: !hasNotes && reportData.notesMissing,
                    notesMissingReason: reportData.notesMissingReason,
                    topicFullyCovered: reportData.topicFullyCovered,
                    topicsLeft: reportData.topicFullyCovered ? "" : reportData.topicsLeft.trim(),
                    snapshotUrls,
                    courseName: reportData.courseName,
                    topicsCovered: reportData.topicsCovered,
                    stream: lec.stream,
                    year: lec.year,
                    semester: lec.semester,
                    numberOfAttendees: present,
                    totalStudents: total,
                    issuesFaced: reportData.issuesFaced,
                    reasonForLessAttendance: reportData.reasonForLessAttendance,
                    classPhotoUrl: classPhotoUrl || undefined,
                    classPhotoLat: photoCoords?.lat,
                    classPhotoLng: photoCoords?.lng,
                    recordingUrl: recordingUrl || undefined,
                    recordingDurationSeconds: recordingDuration || undefined,
                    sprintPlanId: lec.sprintPlanId,
                    scheduledDuration: lec.scheduledDuration,
                    // Lecture Notes
                    notesUrl: reportData.notesUrl.trim(),
                    notesContent: reportData.notesContent,
                    isNotesSharedWithStudents: reportData.isNotesSharedWithStudents,
                    notesNotSharedRemarks: reportData.notesNotSharedRemarks,
                    // Assignment
                    hasAssignment: reportData.hasAssignment,
                    assignmentTitle: reportData.assignmentTitle,
                    assignmentDescription: reportData.assignmentDescription,
                    assignmentUrl: reportData.hasAssignment ? assignmentUrl : "",
                    assignmentDeadline: reportData.assignmentDeadline,
                    studentsCompletedCount: parseInt(reportData.studentsCompletedCount) || 0,
                    totalStudentsExpected: parseInt(reportData.totalStudentsExpected) || total,
                })
            });
            if (res.ok) {
                const okData = await res.json().catch(() => ({}));
                resetReportForm();
                onSubmitted(okData.message || "Class record submitted. It now goes to OM for verification.");
            } else {
                const errData = await res.json();
                throw new Error(errData.error || "Failed to submit report to database");
            }
        } catch (e: any) {
            setMessage({ type: "error", text: e.message });
        } finally {
            setUploading(false);
            setUploadProgress(0);
            setUploadLabel("");
        }
    };

    const resetReportForm = () => {
        setReportData({
            numberOfAttendees: "",
            totalStudents: "",
            semester: "",
            issuesFaced: "",
            reasonForLessAttendance: "",
            topicsCovered: "",
            courseName: "",
            notesUrl: "",
            notesContent: "",
            isNotesSharedWithStudents: false,
            notesNotSharedRemarks: "",
            hasAssignment: false,
            assignmentTitle: "",
            assignmentDescription: "",
            assignmentUrl: "",
            assignmentDeadline: "",
            studentsCompletedCount: "",
            totalStudentsExpected: "",
            notesMissing: false,
            notesMissingReason: "",
            topicFullyCovered: null,
            topicsLeft: ""
        });
        setSnapshotFiles([]);
        setRecordingFile(null);
        setPhotoFile(null);
        setNotesFile(null);
        setAssignmentFile(null);
        setRecordingDuration(0);
        setPhotoCoords(null);
    };


                const present = parseInt(reportData.numberOfAttendees);
                const total = parseInt(reportData.totalStudents);
                const pct = present >= 0 && total > 0 ? Math.min(100, Math.round((present / total) * 100)) : null;
                const lowAttendance = present > 0 && total > 0 && present / total < 0.5;
                const hasNotes = !!(notesFile || reportData.notesUrl.trim());
                const closeReport = () => { if (!uploading) { resetReportForm(); onClose(); } };
                return (
                <div className="fixed inset-0 z-[100] flex justify-end bg-black/70 backdrop-blur-[2px] animate-in fade-in duration-200" data-testid="report-panel">
                    <div className="w-full sm:max-w-2xl h-full flex flex-col bg-zinc-900 border-l border-zinc-800 shadow-2xl shadow-black/60 overflow-hidden animate-in slide-in-from-right duration-200"
                        onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="lecture-report-title">
                        <div className="shrink-0 h-1 w-full bg-gradient-to-r from-amber-500 via-teal-500 to-violet-500" />

                        {/* Header */}
                        <div className="shrink-0 px-5 sm:px-6 py-4 border-b border-zinc-800 bg-gradient-to-r from-amber-500/[0.07] via-zinc-900 to-emerald-500/[0.06]">
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex items-start gap-3 min-w-0">
                                    <div className="shrink-0 w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                                        <FileText size={18} className="text-amber-400" />
                                    </div>
                                    <div className="min-w-0">
                                        <h2 id="lecture-report-title" className="text-base font-semibold text-white leading-tight">Lecture Report</h2>
                                        <p className="text-xs text-zinc-400 mt-0.5 truncate" title={reportLec?.courseName}>
                                            {reportLec?.courseName || "—"} <span className="text-zinc-600">· Lecture #{showReport}</span>
                                        </p>
                                    </div>
                                </div>
                                <button onClick={closeReport} disabled={uploading} aria-label="Close"
                                    className="shrink-0 p-2 rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-800 transition-colors disabled:opacity-40">
                                    <X size={18} />
                                </button>
                            </div>
                            <div className="flex flex-wrap gap-2 mt-3">
                                {([["Stream", reportLec?.stream, "border-indigo-500/25 bg-indigo-500/10 text-indigo-300"], ["Year", reportLec?.year, "border-emerald-500/25 bg-emerald-500/10 text-emerald-300"], ["Semester", reportLec?.semester, "border-violet-500/25 bg-violet-500/10 text-violet-300"]] as [string, string | undefined, string][]).map(([k, v, tone]) => (
                                    <span key={k} className={cnReport("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-[11px]", tone)}>
                                        <span className="opacity-70">{k}</span>
                                        <span className="font-semibold capitalize">{v || "—"}</span>
                                    </span>
                                ))}
                            </div>
                        </div>

                        {/* Body */}
                        <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar px-5 sm:px-6 py-5 space-y-4" style={{ scrollbarGutter: "stable" }}>

                            <ReportSection step={1} accent="indigo" icon={<BookOpen size={14} className="text-indigo-400" />} title="Topics Covered" tag="From lecture plan">
                                <p className="text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap break-words">
                                    {reportData.topicsCovered || <span className="text-zinc-600">No topics recorded</span>}
                                </p>
                            </ReportSection>

                            <ReportSection step={2} accent="amber" title="Attendance" icon={<Users size={14} className="text-amber-400" />} tag="Required" required>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <FieldLabel htmlFor="rep-present">Students present</FieldLabel>
                                        <input id="rep-present" type="number" inputMode="numeric" min={0} max={total || undefined} data-testid="present-input"
                                            value={reportData.numberOfAttendees}
                                            onChange={e => setReportData(p => ({ ...p, numberOfAttendees: e.target.value }))}
                                            className={REPORT_INPUT + " font-mono tabular-nums"} placeholder="0" />
                                    </div>
                                    <div>
                                        <FieldLabel htmlFor="rep-total">Total students</FieldLabel>
                                        <input id="rep-total" type="number" inputMode="numeric" min={1}
                                            value={reportData.totalStudents}
                                            onChange={e => setReportData(p => ({ ...p, totalStudents: e.target.value }))}
                                            className={REPORT_INPUT + " font-mono tabular-nums"} placeholder="60" />
                                    </div>
                                </div>
                                <div className="mt-3">
                                    <div className="flex items-center justify-between text-[11px] mb-1.5">
                                        <span className="text-zinc-500">Attendance rate</span>
                                        <span className={cnReport("font-semibold tabular-nums", pct === null ? "text-zinc-600" : pct < 50 ? "text-amber-400" : "text-emerald-400")}>
                                            {pct === null ? "—" : `${pct}%`}
                                        </span>
                                    </div>
                                    <div className="h-1.5 w-full rounded-full bg-zinc-800 overflow-hidden">
                                        <div className={cnReport("h-full rounded-full transition-[width] duration-300", pct !== null && pct < 50 ? "bg-amber-500" : "bg-emerald-500")}
                                            style={{ width: `${pct ?? 0}%` }} />
                                    </div>
                                </div>
                                {lowAttendance && (
                                    <div className="mt-3">
                                        <FieldLabel htmlFor="rep-low-reason" tone="warn">Reason for low attendance (below 50%) *</FieldLabel>
                                        <textarea id="rep-low-reason"
                                            value={reportData.reasonForLessAttendance}
                                            onChange={e => setReportData(p => ({ ...p, reasonForLessAttendance: e.target.value }))}
                                            className={REPORT_TEXTAREA + " border-amber-500/30 focus:border-amber-500/60"}
                                            placeholder="Briefly explain why attendance was low" />
                                    </div>
                                )}
                            </ReportSection>

                            <ReportSection step={3} accent="sky" title="Class Evidence" icon={<Camera size={14} className="text-sky-400" />} tag="Snapshots required" required>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div>
                                        <FieldLabel>Class snapshots <span className="text-rose-400">*</span>{reportLec?.report?.classPhotoUrl || (reportLec?.report?.snapshotUrls || []).length ? " · already uploaded" : ""}</FieldLabel>
                                        <input type="file" accept="image/*" multiple className="hidden" id="photo-upload"
                                            onChange={e => {
                                                const files = Array.from(e.target.files || []);
                                                if (files[0]) handlePhotoSelect(files[0]);
                                                setSnapshotFiles(files.slice(1));
                                            }} />
                                        <UploadTile htmlFor="photo-upload" done={!!photoFile}
                                            icon={<Upload size={16} />}
                                            title={photoFile ? `${1 + snapshotFiles.length} photo${snapshotFiles.length ? "s" : ""} attached` : "Attach photos"}
                                            hint={photoFile ? (photoCoords ? "Location captured" : "Click to replace") : "JPG or PNG"} />
                                    </div>
                                    <div>
                                        <FieldLabel>Recording (optional){reportLec?.report?.recordingUrl ? " · already uploaded" : ""}</FieldLabel>
                                        <input type="file" accept="audio/*,video/*" className="hidden" id="audio-upload"
                                            onChange={e => e.target.files?.[0] && handleRecordingSelect(e.target.files[0])} />
                                        <UploadTile htmlFor="audio-upload" done={!!recordingFile || !!reportLec?.report?.recordingUrl}
                                            icon={<Mic size={16} />}
                                            title={recordingFile ? recordingFile.name : reportLec?.report?.recordingUrl ? "Recording on file" : "Upload recording"}
                                            hint={recordingFile || reportLec?.report?.recordingUrl ? "Click to replace" : "Audio or video file"} />
                                    </div>
                                </div>
                            </ReportSection>

                            <ReportSection step={4} accent="teal" title="Lecture Notes" icon={<BookOpen size={14} className="text-teal-400" />} tag="Required" required>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div>
                                        <FieldLabel>Notes file</FieldLabel>
                                        <input type="file" id="notes-upload" className="hidden"
                                            onChange={e => setNotesFile(e.target.files?.[0] || null)} />
                                        <UploadTile htmlFor="notes-upload" done={!!notesFile} compact
                                            icon={<FileText size={16} />}
                                            title={notesFile ? notesFile.name : "Choose file"}
                                            hint={notesFile ? "Click to replace" : "PDF, DOC, PPT"} />
                                    </div>
                                    <div>
                                        <FieldLabel htmlFor="rep-notes-link">Or notes link</FieldLabel>
                                        <input id="rep-notes-link" type="url" data-testid="notes-link"
                                            value={reportData.notesUrl}
                                            onChange={e => setReportData(p => ({ ...p, notesUrl: e.target.value }))}
                                            placeholder="https://drive.google.com/..."
                                            className={REPORT_INPUT} />
                                    </div>
                                </div>

                                {!hasNotes && (
                                    <div className="mt-4 pt-4 border-t border-zinc-800 space-y-3">
                                        <CheckRow checked={reportData.notesMissing} testId="notes-missing" tone="warn"
                                            onChange={v => setReportData(p => ({ ...p, notesMissing: v }))}
                                            label="Unable to submit notes" />
                                        {reportData.notesMissing && (
                                            <div>
                                                <FieldLabel htmlFor="rep-notes-missing" tone="warn">Reason * (sent to OM for verification)</FieldLabel>
                                                <textarea id="rep-notes-missing" data-testid="notes-missing-reason"
                                                    value={reportData.notesMissingReason}
                                                    onChange={e => setReportData(p => ({ ...p, notesMissingReason: e.target.value }))}
                                                    placeholder="e.g. Out of station on official duty; notes will be shared on return"
                                                    className={REPORT_TEXTAREA + " border-amber-500/30 focus:border-amber-500/60"} />
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Topic coverage: Yes / No (required); No → topics still left */}
                                <div className="mt-4 pt-4 border-t border-zinc-800 space-y-3" data-testid="topic-coverage">
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                        <span className="text-xs font-semibold text-zinc-200">Topic fully covered? <span className="text-red-400">*</span></span>
                                        <div className="inline-flex rounded-lg border border-zinc-700 overflow-hidden" role="radiogroup" aria-label="Topic fully covered">
                                            {([[true, "Yes"], [false, "No"]] as const).map(([v, l]) => (
                                                <button key={l} type="button" role="radio" aria-checked={reportData.topicFullyCovered === v} data-testid={`topic-covered-${l.toLowerCase()}`}
                                                    onClick={() => setReportData(p => ({ ...p, topicFullyCovered: v }))}
                                                    className={`h-9 min-w-[64px] px-4 text-xs font-bold transition-colors ${reportData.topicFullyCovered === v
                                                        ? (v ? "bg-emerald-600 text-white" : "bg-amber-500 text-zinc-950")
                                                        : "bg-zinc-900 text-zinc-300 hover:bg-zinc-800"}`}>
                                                    {l}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    {reportData.topicFullyCovered === false && (
                                        <div>
                                            <FieldLabel htmlFor="rep-topics-left" tone="warn">Which topics are left? *</FieldLabel>
                                            <textarea id="rep-topics-left" data-testid="topics-left"
                                                value={reportData.topicsLeft}
                                                onChange={e => setReportData(p => ({ ...p, topicsLeft: e.target.value }))}
                                                placeholder="e.g. Deletion in linked lists and practice questions — to be covered in the next class"
                                                className={REPORT_TEXTAREA + " border-amber-500/30 focus:border-amber-500/60"} />
                                        </div>
                                    )}
                                </div>

                            </ReportSection>

                            <ReportSection step={5} accent="violet" title="Assignment" icon={<ClipboardList size={14} className="text-violet-400" />} tag="Optional · Verified by CL">
                                <CheckRow checked={reportData.hasAssignment} id="has-assignment-toggle"
                                    onChange={v => setReportData(p => ({ ...p, hasAssignment: v }))}
                                    label="Add an assignment for this lecture"
                                    hint="You can also add it later, up to Saturday 10:00 AM." />

                                {reportData.hasAssignment && (
                                    <div className="mt-4 pt-4 border-t border-zinc-800 space-y-3">
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            <div>
                                                <FieldLabel htmlFor="rep-asg-title">Assignment title</FieldLabel>
                                                <input id="rep-asg-title" type="text"
                                                    value={reportData.assignmentTitle}
                                                    onChange={e => setReportData(p => ({ ...p, assignmentTitle: e.target.value }))}
                                                    placeholder="e.g. Implement a doubly linked list"
                                                    className={REPORT_INPUT} />
                                            </div>
                                            <div>
                                                <FieldLabel htmlFor="rep-asg-deadline">Submission deadline</FieldLabel>
                                                <input id="rep-asg-deadline" type="date"
                                                    value={reportData.assignmentDeadline}
                                                    onChange={e => setReportData(p => ({ ...p, assignmentDeadline: e.target.value }))}
                                                    className={REPORT_INPUT + " [color-scheme:dark]"} />
                                            </div>
                                        </div>
                                        <div>
                                            <FieldLabel htmlFor="rep-asg-desc">Details / instructions</FieldLabel>
                                            <textarea id="rep-asg-desc"
                                                value={reportData.assignmentDescription}
                                                onChange={e => setReportData(p => ({ ...p, assignmentDescription: e.target.value }))}
                                                placeholder="Problem statement or specific instructions"
                                                className={REPORT_TEXTAREA} />
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            <div>
                                                <FieldLabel>Assignment file</FieldLabel>
                                                <input type="file" id="assignment-upload" className="hidden"
                                                    onChange={e => setAssignmentFile(e.target.files?.[0] || null)} />
                                                <UploadTile htmlFor="assignment-upload" done={!!assignmentFile} compact
                                                    icon={<FileText size={16} />}
                                                    title={assignmentFile ? assignmentFile.name : "Choose file"}
                                                    hint={assignmentFile ? "Click to replace" : "Optional"} />
                                            </div>
                                            <div>
                                                <FieldLabel htmlFor="rep-asg-link">Or assignment link</FieldLabel>
                                                <input id="rep-asg-link" type="url"
                                                    value={reportData.assignmentUrl}
                                                    onChange={e => setReportData(p => ({ ...p, assignmentUrl: e.target.value }))}
                                                    placeholder="https://..."
                                                    className={REPORT_INPUT} />
                                            </div>
                                            <div className="sm:col-span-2">
                                                <FieldLabel htmlFor="rep-asg-done">Students completed / responded</FieldLabel>
                                                <input id="rep-asg-done" type="number" inputMode="numeric" min={0}
                                                    value={reportData.studentsCompletedCount}
                                                    onChange={e => setReportData(p => ({ ...p, studentsCompletedCount: e.target.value }))}
                                                    placeholder="Number of students"
                                                    className={REPORT_INPUT + " font-mono tabular-nums sm:max-w-[calc(50%-0.375rem)]"} />
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </ReportSection>
                        </div>

                        {/* Footer */}
                        <div className="shrink-0 px-5 sm:px-6 py-4 border-t border-zinc-800 bg-zinc-900">
                            {message?.type === "error" && !uploading && (
                                <p className="mb-3 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs font-medium text-rose-300" data-testid="report-error">{message.text}</p>
                            )}
                            {uploading && (
                                <div className="mb-3">
                                    <div className="flex items-center justify-between text-[11px] text-zinc-400 mb-1.5">
                                        <span className="truncate">{uploadLabel}</span>
                                        <span className="tabular-nums">{uploadProgress}%</span>
                                    </div>
                                    <div className="h-1.5 w-full rounded-full bg-zinc-800 overflow-hidden">
                                        <div className="h-full bg-emerald-500 transition-[width] duration-300 ease-out" style={{ width: `${uploadProgress}%` }} />
                                    </div>
                                </div>
                            )}
                            <div className="flex items-center gap-3">
                                <button onClick={closeReport} disabled={uploading}
                                    className="h-11 px-5 rounded-xl border border-zinc-700 bg-zinc-800/60 hover:bg-zinc-800 text-sm font-medium text-zinc-300 transition-colors disabled:opacity-40">
                                    Cancel
                                </button>
                                <button onClick={() => { const lec = reportLec; if (lec) submitReport(lec); }}
                                    data-testid="final-submit"
                                    disabled={uploading}
                                    className="flex-1 h-11 inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 shadow-lg shadow-emerald-900/30 text-sm font-semibold text-white transition-colors disabled:opacity-60 disabled:cursor-not-allowed">
                                    {uploading ? <><Loader2 size={16} className="animate-spin" /> Submitting…</> : <><Upload size={16} /> Submit Report</>}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
                );
}

/* ── Lecture Report form building blocks ─────────────────────────────── */
const REPORT_INPUT = "w-full h-10 px-3 rounded-lg bg-zinc-950/60 border border-zinc-800 text-sm text-white placeholder:text-zinc-600 outline-none focus:border-emerald-500/60 focus:ring-2 focus:ring-emerald-500/10 transition-colors";
const REPORT_TEXTAREA = "w-full min-h-[76px] px-3 py-2.5 rounded-lg bg-zinc-950/60 border border-zinc-800 text-sm text-white placeholder:text-zinc-600 outline-none focus:border-emerald-500/60 focus:ring-2 focus:ring-emerald-500/10 resize-y transition-colors";
const cnReport = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

const REPORT_ACCENT: Record<string, { box: string; head: string; step: string }> = {
    indigo: { box: "border-indigo-500/20 border-l-indigo-500", head: "bg-indigo-500/[0.07] border-indigo-500/15", step: "bg-indigo-500/20 text-indigo-300" },
    amber: { box: "border-amber-500/20 border-l-amber-500", head: "bg-amber-500/[0.07] border-amber-500/15", step: "bg-amber-500/20 text-amber-300" },
    sky: { box: "border-sky-500/20 border-l-sky-500", head: "bg-sky-500/[0.07] border-sky-500/15", step: "bg-sky-500/20 text-sky-300" },
    teal: { box: "border-teal-500/20 border-l-teal-500", head: "bg-teal-500/[0.07] border-teal-500/15", step: "bg-teal-500/20 text-teal-300" },
    violet: { box: "border-violet-500/20 border-l-violet-500", head: "bg-violet-500/[0.07] border-violet-500/15", step: "bg-violet-500/20 text-violet-300" },
};

function ReportSection({ step, title, icon, tag, required, accent = "indigo", children }: { step: number; title: string; icon?: React.ReactNode; tag?: string; required?: boolean; accent?: string; children: React.ReactNode }) {
    const a = REPORT_ACCENT[accent] || REPORT_ACCENT.indigo;
    return (
        <section className={cnReport("rounded-xl border border-l-[3px] bg-zinc-950/30 overflow-hidden", a.box)}>
            <div className={cnReport("flex items-center justify-between gap-3 px-4 py-3 border-b", a.head)}>
                <div className="flex items-center gap-2.5 min-w-0">
                    <span className={cnReport("shrink-0 w-5 h-5 rounded-full text-[10px] font-semibold flex items-center justify-center", a.step)}>{step}</span>
                    {icon}
                    <h3 className="text-sm font-semibold text-zinc-100 truncate">{title}</h3>
                </div>
                {tag && (
                    <span className={cnReport("shrink-0 text-[10px] font-medium px-2 py-0.5 rounded-md border",
                        required ? "text-rose-300 border-rose-500/25 bg-rose-500/10" : "text-emerald-300 border-emerald-500/25 bg-emerald-500/10")}>{tag}</span>
                )}
            </div>
            <div className="p-4">{children}</div>
        </section>
    );
}

function FieldLabel({ children, htmlFor, tone }: { children: React.ReactNode; htmlFor?: string; tone?: "warn" }) {
    return <label htmlFor={htmlFor} className={cnReport("block text-xs font-medium mb-1.5", tone === "warn" ? "text-amber-300" : "text-zinc-400")}>{children}</label>;
}

function UploadTile({ htmlFor, done, icon, title, hint, compact }: { htmlFor: string; done: boolean; icon: React.ReactNode; title: string; hint: string; compact?: boolean }) {
    return (
        <label htmlFor={htmlFor}
            className={cnReport("flex items-center gap-3 px-3 rounded-lg border border-dashed cursor-pointer transition-colors",
                compact ? "h-10" : "h-[60px]",
                done ? "border-emerald-500/40 bg-emerald-500/[0.06]" : "border-zinc-700 bg-zinc-950/40 hover:border-sky-500/50 hover:bg-sky-500/[0.05]")}>
            <span className={cnReport("shrink-0", done ? "text-emerald-400" : "text-sky-400/80")}>{done ? <CheckCircle2 size={16} /> : icon}</span>
            <span className="min-w-0 flex-1">
                <span className={cnReport("block text-xs font-medium truncate", done ? "text-emerald-200" : "text-zinc-300")} title={title}>{title}</span>
                {!compact && <span className="block text-[11px] text-zinc-500 truncate">{hint}</span>}
            </span>
        </label>
    );
}

function CheckRow({ checked, onChange, label, hint, id, testId, tone }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string; id?: string; testId?: string; tone?: "warn" }) {
    return (
        <label htmlFor={id} className="flex items-start gap-3 cursor-pointer select-none">
            <input id={id} type="checkbox" data-testid={testId} checked={checked} onChange={e => onChange(e.target.checked)}
                className={cnReport("mt-0.5 w-4 h-4 rounded cursor-pointer shrink-0", tone === "warn" ? "accent-amber-500" : "accent-emerald-500")} />
            <span className="min-w-0">
                <span className={cnReport("block text-sm font-medium", tone === "warn" ? "text-amber-200" : "text-zinc-200")}>{label}</span>
                {hint && <span className="block text-xs text-zinc-500 mt-0.5">{hint}</span>}
            </span>
        </label>
    );
}