"use client";
import React, { useState, useEffect, useRef, useMemo } from "react";
import { useAuth, Employee } from "@/context/AuthContext";
import { useSearchParams } from "next/navigation";
import { uploadToCloudinary } from "@/lib/cloudinary";
import { FLAG_CONFIG } from "@/lib/colleges";
import { cn } from "@/lib/utils";
import { Clock, MapPin, CheckCircle2, LogIn, LogOut, History, AlertTriangle, Camera, Upload, X, Navigation, Loader2, Image as ImageIcon, Home, FileText, Users, Calendar } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default function AttendancePage() {
    const { user, employees, clockIn, clockOut, attendanceRecords, workSchedules, addMarkAsPresentRequest, markAsPresentRequests, colleges, resolveDressCodeCheck, getExpectedTiming, holidays, getReportees, leaves } = useAuth();
    const searchParams = useSearchParams();
    const [currentTime, setCurrentTime] = useState<string | null>(null);
    const [currentDate, setCurrentDate] = useState<string | null>(null);
    const [geoStatus, setGeoStatus] = useState<"idle" | "requesting" | "granted" | "denied">("idle");
    const [distanceKm, setDistanceKm] = useState<number | null>(null);
    const [withinRadius, setWithinRadius] = useState(false);
    const [userLat, setUserLat] = useState<number | null>(null);
    const [userLng, setUserLng] = useState<number | null>(null);
    const [dressCodeUrl, setDressCodeUrl] = useState<string | null>(null);
    const [uploading, setUploading] = useState(false);
    const [uploadError, setUploadError] = useState<string | null>(null);
    const [clockInError, setClockInError] = useState<string | null>(null);
    const [activeLocation, setActiveLocation] = useState<string | null>(null);

    // Mark as present states
    const [showMapForm, setShowMapForm] = useState(false);
    const [isCameraOpen, setIsCameraOpen] = useState(false);
    const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
    const [capturedDataUrl, setCapturedDataUrl] = useState<string | null>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [mapReason, setMapReason] = useState("");
    const [mapProofUrls, setMapProofUrls] = useState<string[]>([]);
    const [mapUploading, setMapUploading] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const mapFileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const timer = setInterval(() => {
            const now = new Date();
            setCurrentTime(now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }));

            // Only update currentDate if not driven by URL params (prevents reset during form fill)
            if (!searchParams.get("date")) {
                setCurrentDate(now.toISOString().split("T")[0]);
            }
        }, 1000);
        return () => clearInterval(timer);
    }, [searchParams]);

    // Handle URL parameters for Mark As Present redirect
    useEffect(() => {
        const action = searchParams.get("action");
        const date = searchParams.get("date");
        if (action === "map" && date) {
            setShowMapForm(true);
            setCurrentDate(date);
        }
    }, [searchParams]);

    const [selectedGlobalDate, setSelectedGlobalDate] = useState<string>("");
    const [filterStatus, setFilterStatus] = useState<string>("All");

    useEffect(() => {
        if (currentDate && !selectedGlobalDate) setSelectedGlobalDate(currentDate);
    }, [currentDate, selectedGlobalDate]);

    const isHRorFounder = user?.role === "HR" || user?.role === "FOUNDER";
    const reportees = useMemo(() => {
        if (!user) return [];
        return getReportees(user.id);
    }, [getReportees, user]);

    const showsTeamRoster = isHRorFounder || reportees.length > 0;

    const employeesToShow = useMemo(() => {
        if (!user) return [];
        let list = isHRorFounder
            ? employees.filter((e: Employee) => !["CEO", "CTO", "COO"].includes(e.designation || "") && e.role !== "FOUNDER")
            : reportees;

        // Fix: Always include self in the list
        if (!list.find((e: Employee) => e.id === user.id)) {
            const self = employees.find(e => e.id === user.id);
            if (self) list = [self, ...list];
        }
        return list;
    }, [isHRorFounder, employees, reportees, user]);

    // Compute attendance for the chosen list
    const teamAttendanceList = useMemo(() => {
        if (!showsTeamRoster || !user || !selectedGlobalDate) return [];
        return employeesToShow.map((employee: Employee) => {
            const record = attendanceRecords.find((r: any) => r.employeeId === employee.id && r.date === selectedGlobalDate);
            const scheduledLocation = getExpectedTiming(employee.id, selectedGlobalDate).location;

            const empHoliday = holidays.find(h =>
                h.date === selectedGlobalDate &&
                h.status === "Approved" &&
                (h.forAll || h.collegeIds?.includes(scheduledLocation || ""))
            );

            // Check for approved leaves
            const isOnLeave = leaves.some(l =>
                l.employeeId === employee.id &&
                l.status === "Approved" &&
                selectedGlobalDate >= l.startDate &&
                selectedGlobalDate <= l.endDate
            );

            let status = "Absent";
            if (record) {
                if (record.status === "On Leave") status = "On Leave";
                else if (record.clockOut) status = "Clocked Out";
                else status = "Working";
            } else if (empHoliday) {
                status = "Holiday";
            } else if (isOnLeave) {
                status = "On Leave";
            }

            return { employee, record, status, scheduledLocation };
        }).sort((a: any, b: any) => {
            // First group by scheduled location
            if (a.scheduledLocation !== b.scheduledLocation) {
                return (a.scheduledLocation || "").localeCompare(b.scheduledLocation || "");
            }
            // Then sort by status within each group
            const w: Record<string, number> = { "Working": 2.5, "Clocked Out": 2, "Holiday": 1.5, "On Leave": 1, "Absent": 0 };
            return w[b.status] - w[a.status];
        });
    }, [employeesToShow, attendanceRecords, selectedGlobalDate, showsTeamRoster, user, holidays, leaves]);

    const filteredTeamAttendanceList = useMemo(() => {
        if (filterStatus === "All") return teamAttendanceList;
        if (filterStatus === "Present") return teamAttendanceList.filter((l: any) => l.status === "Working" || l.status === "Clocked Out");
        return teamAttendanceList.filter((l: any) => l.status === filterStatus);
    }, [teamAttendanceList, filterStatus]);

    if (!user || !currentTime || !currentDate) return null;
    const emp = user as Employee;

    const todaysRecord = attendanceRecords.find(r => r.employeeId === user.id && r.date === currentDate);
    const todaysMapRequest = markAsPresentRequests.find(r => r.employeeId === user.id && r.date === currentDate);
    const hasCheckedIn = !!todaysRecord || !!todaysMapRequest;
    const hasCheckedOut = !!(todaysRecord && todaysRecord.clockOut);
    const isDefaulter = (emp.dressCodeDefaults || 0) >= 3;
    const markPresentCreditsLeft = Math.max(0, 3 - (emp.markPresentUsed || 0));

    const expected = getExpectedTiming(user.id);
    const assignedLocationId = expected.location;
    const assignedClockIn = expected.in;
    const assignedClockOut = expected.out;

    // Resolve college from location ID
    const isWFH = assignedLocationId.toLowerCase() === "wfh";
    const college = isWFH ? null : colleges.find(c => c.id === assignedLocationId || c.shortName === assignedLocationId || c.name === assignedLocationId);
    const displayLocation = isWFH ? "Work From Home" : college?.shortName || assignedLocationId;

    const isPastCutoff = !!(currentTime && currentTime >= "11:59:00");
    const shouldShowMAPOnly = isPastCutoff && !hasCheckedIn && currentDate === new Date().toISOString().split("T")[0];

    const requestLocation = () => {
        if (isWFH) {
            setGeoStatus("granted");
            setWithinRadius(true);
            setDistanceKm(0);
            return;
        }
        setGeoStatus("requesting");
        setClockInError(null);
        if (!navigator.geolocation) { setGeoStatus("denied"); setClockInError("Geolocation not supported."); return; }
        if (emp.role !== "HOI" && emp.role !== "OM" && !college) { setGeoStatus("denied"); setClockInError("No college mapped for today's location."); return; }
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                setUserLat(pos.coords.latitude);
                setUserLng(pos.coords.longitude);
                let targetCollege = college;
                let dist = 999999;

                if ((emp.role === "HOI" || emp.role === "OM") && colleges.length > 0) {
                    let closestCollege = colleges[0];
                    let minDistance = 999999;

                    for (const c of colleges) {
                        const d = haversineDistance(pos.coords.latitude, pos.coords.longitude, c.lat, c.lng);
                        if (d < minDistance) {
                            minDistance = d;
                            closestCollege = c;
                        }
                    }

                    targetCollege = closestCollege;
                    dist = minDistance;
                } else if (targetCollege) {
                    dist = haversineDistance(pos.coords.latitude, pos.coords.longitude, targetCollege.lat, targetCollege.lng);
                } else {
                    setGeoStatus("denied"); setClockInError("No college mapped for location."); return;
                }

                setDistanceKm(parseFloat(dist.toFixed(2)));
                setWithinRadius(dist <= targetCollege!.radiusKm);
                setActiveLocation(targetCollege!.shortName);
                setGeoStatus("granted");
                if (dist > targetCollege!.radiusKm) setClockInError(`You are ${dist.toFixed(1)} km from ${targetCollege!.shortName}. Maximum: ${targetCollege!.radiusKm} km.`);
            },
            () => { setGeoStatus("denied"); setClockInError("Location access denied."); },
            { enableHighAccuracy: true, timeout: 10000 }
        );
    };

    const startCamera = async () => {
        setClockInError(null);
        setUploadError(null);
        setCapturedDataUrl(null);
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } }
            });
            setCameraStream(stream);
            setIsCameraOpen(true);
            // Delay source assignment to ensure ref availability in modal
            setTimeout(() => { if (videoRef.current) videoRef.current.srcObject = stream; }, 100);
        } catch (err: any) {
            setClockInError("Camera access denied. Please enable camera permissions.");
            console.error(err);
        }
    };

    const stopCamera = () => {
        if (cameraStream) {
            cameraStream.getTracks().forEach(track => track.stop());
            setCameraStream(null);
        }
        setIsCameraOpen(false);
        setCapturedDataUrl(null);
    };

    const capturePhoto = () => {
        if (!videoRef.current || !canvasRef.current || !cameraStream) return;

        const video = videoRef.current;
        // Fix for "Empty file" error: Ensure video is ready and has dimensions
        if (video.readyState < 2 || video.videoWidth === 0) {
            setUploadError("Camera not ready. Please wait a moment.");
            return;
        }

        const canvas = canvasRef.current;
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        const ctx = canvas.getContext("2d");
        if (ctx) {
            // Apply mirroring to canvas to match the preview
            ctx.translate(canvas.width, 0);
            ctx.scale(-1, 1);
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
            setCapturedDataUrl(dataUrl);
            // Do NOT stop camera yet, wait for user to click "Use Photo"
        }
    };

    const handleUsePhoto = async () => {
        if (!capturedDataUrl) return;

        setUploading(true);
        setUploadError(null);
        try {
            const blob = await (await fetch(capturedDataUrl)).blob();
            const file = new File([blob], `attendance_${user!.id}_${Date.now()}.jpg`, { type: "image/jpeg" });
            const result = await uploadToCloudinary(file);
            setDressCodeUrl(result.secure_url);
            stopCamera(); // Stop only after successful upload/approval
        } catch (err: any) {
            setUploadError("Upload failed: " + err.message);
        } finally {
            setUploading(false);
        }
    };

    const retakePhoto = () => {
        setCapturedDataUrl(null);
        // Ensure video stream is still active or restart if needed
        if (videoRef.current && cameraStream) {
            videoRef.current.srcObject = cameraStream;
        }
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: "dressCode" | "mapProof") => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (type === "dressCode") {
            // This is now handled by capturePhoto, but kept for logic safety
            setUploading(true);
            setUploadError(null);
            try { const result = await uploadToCloudinary(file); setDressCodeUrl(result.secure_url); }
            catch (err: any) { setUploadError(err.message || "Upload failed"); }
            finally { setUploading(false); }
        } else {
            setMapUploading(true);
            try { const result = await uploadToCloudinary(file); setMapProofUrls(prev => [...prev, result.secure_url]); }
            catch (err: any) { alert("Upload Failed: " + (err.message || "Error")); }
            finally { setMapUploading(false); }
        }
    };

    const scheduledLocationToday = getExpectedTiming(emp.id, currentDate).location;
    const isHolidayToday = holidays.find((h: any) =>
        h.date === currentDate &&
        h.status === "Approved" &&
        (h.forAll || h.collegeIds?.includes(scheduledLocationToday || ""))
    );

    const handleCheckIn = () => {
        setClockInError(null);
        if (isHolidayToday) { setClockInError(`Today is a holiday: ${isHolidayToday.name}. Attendance is disabled.`); return; }
        if (isDefaulter) { setClockInError("Cannot clock in as a defaulter. Please contact HR."); return; }
        if (isWFH) {
            const timeNow = new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false });
            clockIn("WFH", timeNow, undefined);
            return;
        }
        if (geoStatus !== "granted") { setClockInError("Allow location access first."); return; }
        if (!withinRadius) { setClockInError(`Out of range (${distanceKm} km).`); return; }
        if (!dressCodeUrl) { setClockInError("Upload dress code photo first."); return; }
        const timeNow = new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false });
        clockIn(activeLocation || displayLocation, timeNow, dressCodeUrl, userLat ?? undefined, userLng ?? undefined);
    };

    const handleMarkAsPresent = () => {
        if (!mapReason || mapProofUrls.length === 0) { alert("Reason and proofs are mandatory."); return; }

        // Determine request type
        let type = "Late";
        if (geoStatus === "denied" || !withinRadius) {
            type = "Location mismatch";
        }
        // In a real scenario, we might check timing too.

        addMarkAsPresentRequest({
            employeeId: user.id,
            date: currentDate,
            reason: mapReason,
            proofUrls: mapProofUrls,
            requestType: type // Added field
        });
        setShowMapForm(false);
    };

    const handleCheckOut = () => {
        if (hasCheckedIn && !hasCheckedOut) {
            const timeNow = new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false });
            clockOut(timeNow);
        }
    };

    const myLogs = attendanceRecords.filter(r => r.employeeId === user.id).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());


    return (
        <div className="p-4 sm:p-6 space-y-6 max-w-5xl mx-auto w-full">
            <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div><h1 className="text-lg sm:text-xl font-bold text-white tracking-tight">Attendance Management</h1><p className="text-[11px] text-zinc-400 mt-1">Clock in/out with location & dress code verification.</p></div>
                <div className="flex flex-col items-end gap-1 w-full sm:w-auto">
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-primary/10 border border-primary/20 rounded-lg text-primary w-full sm:w-auto justify-center">
                        <Clock size={14} /><span className="text-[11px] font-bold font-mono">{currentTime}</span>
                    </div>
                </div>
            </header>






            <div className="bg-zinc-900/80 border border-zinc-800/50 rounded-2xl p-5 space-y-4">
                {/* Employee Info */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold">{user.name[0]}</div>
                        <div><p className="text-sm font-bold text-white">{user.name}</p><p className="text-[10px] text-zinc-500">{emp.designation} · {emp.dept}</p></div>
                    </div>
                    <div className={cn("px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-widest border w-full sm:w-auto text-center",
                        hasCheckedIn ? (hasCheckedOut ? "bg-blue-500/10 text-blue-400 border-blue-500/20" : "bg-green-500/10 text-green-400 border-green-500/20") : "bg-zinc-800 text-zinc-500 border-zinc-700"
                    )}>{hasCheckedIn ? (hasCheckedOut ? "Clocked Out" : "Working") : "Not Clocked In"}</div>
                </div>

                {/* Schedule */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="bg-zinc-800/50 p-3 rounded-xl border border-zinc-700/50">
                        <p className="text-[9px] text-zinc-500 font-bold uppercase">Location</p>
                        <p className="text-xs font-bold text-white mt-1 flex items-center gap-1">
                            {isWFH ? <><Home size={12} className="text-green-400" /> WFH</> : <><MapPin size={12} className="text-blue-400" /> {displayLocation}</>}
                        </p>
                    </div>
                    {[{ label: "Clock In", value: assignedClockIn }, { label: "Clock Out", value: assignedClockOut }].map(s => (
                        <div key={s.label} className="bg-zinc-800/50 p-3 rounded-xl border border-zinc-700/50">
                            <p className="text-[9px] text-zinc-500 font-bold uppercase">{s.label}</p>
                            <p className="text-xs font-bold text-white mt-1">{s.value}</p>
                        </div>
                    ))}
                </div>

                {/* Clock In Flow */}
                {!hasCheckedIn && (
                    <div className="space-y-4 pt-2">
                        {isDefaulter ? (
                            <div className="p-5 bg-red-500/10 border border-red-500/30 rounded-2xl flex flex-col items-center justify-center space-y-3 text-center">
                                <AlertTriangle size={32} className="text-red-500" />
                                <div>
                                    <h3 className="text-sm font-black text-red-400">Clock-In Blocked: Defaulter Status</h3>
                                    <p className="text-xs text-red-300 mt-1">You have received 3 or more dress code/attendance flags this month.<br /> You are currently unable to clock in. Please resolve your tickets with HR.</p>
                                </div>
                            </div>
                        ) : isWFH ? (
                            /* WFH — no location or dress code needed */
                            <div className="p-4 bg-green-500/5 border border-green-500/20 rounded-xl space-y-2">
                                <div className="flex items-center gap-2">
                                    <Home size={16} className="text-green-400" />
                                    <p className="text-xs font-bold text-green-400">Work From Home Day</p>
                                </div>
                                <p className="text-[10px] text-zinc-400">No location verification or dress code check required for WFH days.</p>
                            </div>
                        ) : (
                            <>
                                {/* Step 1: Location */}
                                <div className="space-y-2">
                                    <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest flex justify-between">
                                        <span>Step 1: Verify Location — {displayLocation}</span>
                                        <span className="text-zinc-500">{markPresentCreditsLeft}/3 Credits Left</span>
                                    </p>

                                    {geoStatus === "idle" && (
                                        <button onClick={requestLocation} className="bg-blue-500/10 text-blue-400 border border-blue-500/20 px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 hover:bg-blue-500/20 transition-all">
                                            <Navigation size={14} /> Allow Location Access
                                        </button>
                                    )}
                                    {geoStatus === "requesting" && <p className="text-xs text-zinc-400 animate-pulse flex items-center gap-2"><Navigation size={14} /> Requesting...</p>}
                                    {geoStatus === "granted" && (
                                        <div className={cn("p-3 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3", withinRadius ? "bg-green-500/5 border-green-500/20" : "bg-red-500/5 border-red-500/20")}>
                                            <div className="flex items-center gap-3">
                                                <MapPin size={16} className={withinRadius ? "text-green-400" : "text-red-400"} />
                                                <div>
                                                    <p className={cn("text-xs font-bold", withinRadius ? "text-green-400" : "text-red-400")}>{withinRadius ? `✓ Within ${activeLocation || displayLocation} Radius` : `✗ Out of Range — ${activeLocation || displayLocation}`}</p>
                                                    <p className="text-[9px] text-zinc-500">Distance: {distanceKm} km</p>
                                                </div>
                                            </div>
                                            {!withinRadius && !showMapForm && (
                                                <button onClick={() => setShowMapForm(!showMapForm)} disabled={markPresentCreditsLeft <= 0} className="w-full sm:w-auto mt-2 sm:mt-0 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 border border-zinc-700 rounded-lg text-xs font-bold text-white transition-all">
                                                    Mark As Present
                                                </button>
                                            )}
                                        </div>
                                    )}
                                    {geoStatus === "denied" && (
                                        <div className="p-3 rounded-xl border bg-red-500/5 border-red-500/20 flex flex-col sm:flex-row justify-between gap-3 sm:items-center">
                                            <div className="flex items-center gap-3">
                                                <AlertTriangle size={16} className="text-red-400" />
                                                <p className="text-xs font-bold text-red-400">Location Denied</p>
                                            </div>
                                            <div className="flex gap-2">
                                                <button onClick={requestLocation} className="text-[10px] font-bold text-blue-400 px-3 py-1.5 border border-blue-500/20 rounded-lg bg-blue-500/10">Retry</button>
                                                {!showMapForm && (
                                                    <button onClick={() => setShowMapForm(!showMapForm)} disabled={markPresentCreditsLeft <= 0} className="text-[10px] font-bold disabled:opacity-50 text-white px-3 py-1.5 border border-zinc-700 rounded-lg bg-zinc-800">Mark As Present</button>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Step 2: Dress Code Photo (Live Camera Trigger) */}
                                {!showMapForm && (
                                    <div className="space-y-3">
                                        <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Step 2: Dress Code Photo</p>
                                        <p className="text-[9px] text-zinc-500">A live selfie showing I-Card, Badge, and Blazer is mandatory.</p>

                                        {!dressCodeUrl && (
                                            <button
                                                onClick={startCamera}
                                                disabled={shouldShowMAPOnly}
                                                className={cn(
                                                    "w-full border-2 border-dashed rounded-2xl p-8 text-center transition-all bg-primary/5 group active:scale-95",
                                                    shouldShowMAPOnly ? "border-zinc-700 opacity-50 cursor-not-allowed" : "border-primary/30 hover:border-primary"
                                                )}
                                            >
                                                {uploading ? (
                                                    <div className="flex flex-col items-center gap-2">
                                                        <Loader2 size={28} className="text-primary animate-spin" />
                                                        <p className="text-xs text-primary font-bold">Processing Verification...</p>
                                                    </div>
                                                ) : (
                                                    <>
                                                        <div className="w-14 h-14 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
                                                            <Camera size={26} className="text-primary" />
                                                        </div>
                                                        <p className="text-xs text-white font-bold">Launch Camera Verification</p>
                                                        <p className="text-[9px] text-zinc-500 mt-1 uppercase tracking-tighter">Live Photo Mandatory</p>
                                                    </>
                                                )}
                                            </button>
                                        )}

                                        {shouldShowMAPOnly && (
                                            <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl space-y-3">
                                                <div className="flex items-center gap-2">
                                                    <Clock size={16} className="text-amber-400" />
                                                    <p className="text-xs font-bold text-amber-400">Past 11:59 AM Deadline</p>
                                                </div>
                                                <p className="text-[10px] text-zinc-400">The standard clock-in window for today has closed. Please raise a "Mark As Present" request instead.</p>
                                                <button
                                                    onClick={() => setShowMapForm(true)}
                                                    className="w-full py-2.5 bg-amber-500/20 border border-amber-500/30 rounded-xl text-xs font-bold text-amber-400 hover:bg-amber-500/30 transition-all"
                                                >
                                                    Raise MAP Request
                                                </button>
                                            </div>
                                        )}

                                        {dressCodeUrl && (
                                            <div className="flex items-center gap-4 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl">
                                                <div className="relative">
                                                    <img src={dressCodeUrl} alt="Dress code" className="w-16 h-16 rounded-xl object-cover border-2 border-emerald-500/30" />
                                                    <div className="absolute -top-2 -right-2 bg-emerald-500 text-white rounded-full p-0.5 shadow-lg">
                                                        <CheckCircle2 size={12} />
                                                    </div>
                                                </div>
                                                <div className="flex-1">
                                                    <p className="text-xs font-bold text-emerald-400">✓ Photo Verified</p>
                                                    <p className="text-[10px] text-zinc-500 mt-0.5">Live capture successfully processed via Cloudinary.</p>
                                                    <a href={dressCodeUrl} target="_blank" rel="noopener" className="text-[10px] text-primary hover:underline font-bold mt-1 inline-block">Review Proof ↗</a>
                                                </div>
                                                <button
                                                    onClick={() => { setDressCodeUrl(null); startCamera(); }}
                                                    className="p-2 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                                                >
                                                    <X size={20} />
                                                </button>
                                            </div>
                                        )}
                                        {uploadError && <p className="text-[10px] text-red-400 mt-1 flex items-center gap-1 bg-red-500/5 px-2 py-1 rounded border border-red-500/20"><AlertTriangle size={12} /> {uploadError}</p>}
                                    </div>
                                )}

                                {/* Holiday Notice Overlay for Attendance Section */}
                                {isHolidayToday && !hasCheckedIn && (
                                    <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-2xl flex flex-col items-center text-center gap-2">
                                        <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                                            <Calendar size={20} className="text-blue-400" />
                                        </div>
                                        <div>
                                            <h4 className="text-xs font-bold text-white uppercase tracking-widest">{isHolidayToday.name}</h4>
                                            <p className="text-[10px] text-zinc-400 mt-1">Attendance is disabled today for your location.</p>
                                        </div>
                                    </div>
                                )}

                                {/* --- PROFESSIONAL CAMERA MODAL --- */}
                                <AnimatePresence>
                                    {isCameraOpen && (
                                        <motion.div
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            exit={{ opacity: 0 }}
                                            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-md p-4 sm:p-8 overflow-y-auto"
                                        >
                                            <div className="relative w-full max-w-2xl bg-zinc-900 rounded-[2.5rem] border border-zinc-800 shadow-2xl overflow-hidden flex flex-col my-auto">
                                                {/* Header */}
                                                <div className="px-6 py-4 border-b border-zinc-800 flex justify-between items-center bg-zinc-900/50">
                                                    <div>
                                                        <h3 className="text-sm font-black text-white flex items-center gap-2">
                                                            <Camera size={18} className="text-primary" /> DRESS CODE VERIFICATION
                                                        </h3>
                                                        <p className="text-[10px] text-zinc-500 uppercase tracking-widest mt-0.5">Live Image</p>
                                                    </div>
                                                    <button
                                                        onClick={stopCamera}
                                                        className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-700 transition-all"
                                                    >
                                                        <X size={20} />
                                                    </button>
                                                </div>

                                                {/* Camera Window */}
                                                <div className="relative flex-1 bg-black aspect-video flex items-center justify-center group">
                                                    {!capturedDataUrl ? (
                                                        <>
                                                            <video
                                                                ref={videoRef}
                                                                autoPlay
                                                                playsInline
                                                                muted
                                                                className="w-full h-full object-cover mirror"
                                                            />
                                                            <div className="absolute top-4 right-4 flex items-center gap-2 bg-red-500/90 text-white text-[9px] font-black px-2 py-1 rounded-full animate-pulse">
                                                                <div className="w-1.5 h-1.5 rounded-full bg-white" /> LIVE CAMERA
                                                            </div>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <img src={capturedDataUrl} alt="Preview" className="w-full h-full object-cover" />
                                                            <div className="absolute top-4 right-4 bg-blue-500 text-white text-[9px] font-black px-2 py-1 rounded-full">
                                                                PREVIEW MODE
                                                            </div>
                                                        </>
                                                    )}
                                                    <canvas ref={canvasRef} className="hidden" />

                                                    {uploading && (
                                                        <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-4">
                                                            <Loader2 size={40} className="text-primary animate-spin" />
                                                            <p className="text-xs font-bold text-white tracking-widest">ENCRYPTING & UPLOADING...</p>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Controls */}
                                                <div className="p-4 sm:p-8 bg-zinc-900 flex flex-col gap-4">
                                                    {uploadError && (
                                                        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-2">
                                                            <AlertTriangle size={14} className="text-red-400 shrink-0" />
                                                            <p className="text-[10px] text-red-400 font-bold uppercase tracking-widest">{uploadError}</p>
                                                        </div>
                                                    )}

                                                    <div className="flex justify-center items-center">
                                                        {!capturedDataUrl ? (
                                                            <button
                                                                onClick={capturePhoto}
                                                                className="group relative w-20 h-20 rounded-full border-4 border-zinc-700 p-1 hover:border-primary transition-all active:scale-95"
                                                            >
                                                                <div className="w-full h-full rounded-full bg-white shadow-xl flex items-center justify-center transition-all group-hover:scale-90" />
                                                            </button>
                                                        ) : (
                                                            <div className="flex flex-col sm:flex-row gap-4 w-full">
                                                                <button
                                                                    onClick={retakePhoto}
                                                                    disabled={uploading}
                                                                    className="flex-1 py-4 bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-black rounded-2xl border border-zinc-700 transition-all flex items-center justify-center gap-2 uppercase tracking-widest disabled:opacity-50"
                                                                >
                                                                    <Camera size={14} /> Retake
                                                                </button>
                                                                <button
                                                                    onClick={handleUsePhoto}
                                                                    disabled={uploading}
                                                                    className="flex-[2] py-4 bg-primary hover:bg-primary-dark text-black text-xs font-black rounded-2xl shadow-xl shadow-primary/20 transition-all flex items-center justify-center gap-2 uppercase tracking-widest disabled:opacity-50"
                                                                >
                                                                    {uploading ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />} Confirm & Upload
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </>
                        )}

                        {showMapForm && (
                            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="bg-zinc-900 border border-zinc-700 p-4 rounded-xl space-y-4">
                                <div className="flex justify-between items-center">
                                    <h4 className="text-sm font-bold text-white flex items-center gap-2"><FileText size={16} className="text-purple-400" /> Mark As Present Request</h4>
                                    <button onClick={() => setShowMapForm(false)} className="text-zinc-500 hover:text-white"><X size={16} /></button>
                                </div>
                                <div className="space-y-3">
                                    <p className="text-[10px] text-zinc-400 font-medium">This will exhaust 1 of your 3 monthly emergency credits, pending HR approval.</p>
                                    <textarea
                                        rows={3} placeholder="Please provide a valid reason..." value={mapReason} onChange={e => setMapReason(e.target.value)}
                                        className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-3 text-xs text-white resize-none"
                                    />
                                    <div>
                                        <div className="flex items-center gap-2 mb-2">
                                            <button onClick={() => mapFileInputRef.current?.click()} className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded border border-zinc-700 text-[10px] font-bold text-white flex items-center gap-1">
                                                {mapUploading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />} Add Proof Document
                                            </button>
                                            <span className="text-[10px] text-zinc-500">Multiple files allowed</span>
                                            <input ref={mapFileInputRef} type="file" className="hidden" onChange={(e) => handleImageUpload(e, "mapProof")} />
                                        </div>
                                        {mapProofUrls.length > 0 && (
                                            <div className="flex flex-wrap gap-2">
                                                {mapProofUrls.map((url, i) => (
                                                    <div key={i} className="flex flex-col items-center">
                                                        <img src={url} alt="proof" className="w-10 h-10 object-cover rounded border border-zinc-700" />
                                                        <a href={url} target="_blank" rel="noopener" className="text-[8px] text-primary mt-1">View</a>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    <button onClick={handleMarkAsPresent} className="w-full py-2.5 bg-purple-600 hover:bg-purple-700 rounded-lg text-white font-bold text-xs">
                                        Submit Request ({markPresentCreditsLeft} Credits Left)
                                    </button>
                                </div>
                            </motion.div>
                        )}

                        {clockInError && !showMapForm && (
                            <div className="p-3 bg-red-500/5 border border-red-500/20 rounded-xl flex items-center gap-2">
                                <AlertTriangle size={14} className="text-red-400 shrink-0" /><p className="text-[10px] text-red-400">{clockInError}</p>
                            </div>
                        )}

                        {!showMapForm && !isDefaulter && !isHolidayToday && (
                            <button onClick={handleCheckIn} disabled={isWFH ? false : (!withinRadius || !dressCodeUrl)}
                                className={cn("w-full py-3.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all",
                                    (isWFH || (withinRadius && dressCodeUrl)) ? "bg-green-500 hover:bg-green-600 text-white shadow-lg shadow-green-500/20" : "bg-zinc-800 text-zinc-500 cursor-not-allowed border border-zinc-700"
                                )}><LogIn size={16} /> Clock In {isWFH ? "(WFH)" : ""}</button>
                        )}
                    </div>
                )}

                {hasCheckedIn && !hasCheckedOut && !todaysMapRequest && (
                    <div className="space-y-3 pt-2">
                        <div className="p-3 bg-green-500/5 border border-green-500/20 rounded-xl flex items-center gap-3">
                            {todaysRecord?.dressCodeImageUrl && <img src={todaysRecord.dressCodeImageUrl} alt="Dress" className="w-10 h-10 rounded-lg object-cover border border-zinc-700" />}
                            <div><p className="text-xs font-bold text-green-400">Clocked in at {todaysRecord?.clockIn}</p><p className="text-[9px] text-zinc-500">Location: {todaysRecord?.location}</p></div>
                        </div>
                        <button onClick={handleCheckOut} className="w-full py-3.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all">
                            <LogOut size={16} /> Clock Out
                        </button>
                    </div>
                )}

                {hasCheckedIn && !hasCheckedOut && todaysMapRequest && (
                    <div className="p-4 bg-purple-500/10 border border-purple-500/30 rounded-2xl flex items-center gap-3 text-purple-400">
                        <Clock size={20} />
                        <div>
                            <h4 className="text-sm font-bold text-white">Pending Attendance Request</h4>
                            <p className="text-[10px] text-zinc-400">Your "Mark As Present" request is actively under review by HR.</p>
                        </div>
                    </div>
                )}

                {hasCheckedOut && (
                    <div className="p-3 bg-blue-500/5 border border-blue-500/20 rounded-xl flex items-center gap-3">
                        {todaysRecord?.dressCodeImageUrl && <img src={todaysRecord.dressCodeImageUrl} alt="Dress" className="w-10 h-10 rounded-lg object-cover border border-zinc-700" />}
                        <div><p className="text-xs font-bold text-blue-400">Day Complete</p><p className="text-[9px] text-zinc-500">{todaysRecord?.clockIn} → {todaysRecord?.clockOut} · {todaysRecord?.location}</p></div>
                        {todaysRecord?.flags.earlyOut && <span className="text-[8px] font-bold text-yellow-400 bg-yellow-500/10 px-2 py-0.5 rounded-full border border-yellow-500/20 ml-auto">🟡 Early Out</span>}
                    </div>
                )}
            </div>

            {/* Attendance Log */}
            <div className="bg-zinc-900/80 border border-zinc-800/50 rounded-2xl overflow-hidden">
                <div className="p-4 border-b border-zinc-800/50 flex items-center gap-2"><History size={14} className="text-zinc-400" /><h3 className="text-sm font-semibold text-white">Attendance Log</h3></div>
                <div className="overflow-x-auto -mx-2 sm:mx-0">
                    <div className="min-w-[700px]">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-zinc-800/50 text-[9px] text-zinc-500 uppercase tracking-widest">
                                    <th className="text-left px-5 py-3">Date</th>
                                    <th className="text-left px-5 py-3">In</th>
                                    <th className="text-left px-5 py-3">Out</th>
                                    <th className="text-left px-5 py-3">Location</th>
                                    <th className="text-left px-5 py-3">Photo</th>
                                    <th className="text-left px-5 py-3">Flags</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-800/50">
                                {myLogs.slice(0, 20).map(log => (
                                    <tr key={log.id} className="hover:bg-zinc-800/20 transition-colors text-xs">
                                        <td className="px-5 py-3 text-white font-medium whitespace-nowrap">
                                            {log.date ? log.date.split("-").reverse().join("-") : "—"}
                                        </td>
                                        <td className="px-5 py-3 text-zinc-300">{log.clockIn}</td>
                                        <td className="px-5 py-3 text-zinc-300">{log.clockOut || "—"}</td>
                                        <td className="px-5 py-3 text-zinc-400">{log.location}</td>
                                        <td className="px-5 py-3">
                                            {log.dressCodeImageUrl ? (
                                                <a href={log.dressCodeImageUrl} target="_blank" rel="noopener" className="text-primary hover:underline flex items-center gap-1"><ImageIcon size={12} /> View</a>
                                            ) : <span className="text-zinc-600">—</span>}
                                        </td>
                                        <td className="px-5 py-3">
                                            <div className="flex gap-1 flex-wrap">
                                                {Object.entries(log.flags).filter(([_, v]) => v).map(([k]) => (
                                                    <span key={k} className={cn("text-[8px] font-bold px-1.5 py-0.5 rounded-full", FLAG_CONFIG[k]?.color || "text-zinc-400 bg-zinc-800")}>
                                                        {FLAG_CONFIG[k]?.emoji} {FLAG_CONFIG[k]?.label || k}
                                                    </span>
                                                ))}
                                                {Object.values(log.flags).every(v => !v) && <span className="text-[8px] text-zinc-600">Clean</span>}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
            {showsTeamRoster && (
                <div className="bg-zinc-900/80 border border-zinc-800/50 rounded-2xl p-5 space-y-5 mb-5 block">
                    <div className="flex justify-between items-center pb-2 border-b border-zinc-800/50">
                        <div className="flex items-center gap-2">
                            <Users size={16} className={isHRorFounder ? "text-blue-400" : "text-purple-400"} />
                            <h2 className="text-sm font-bold text-white">
                                {isHRorFounder ? "Global Attendance Roster" : "My Team's Attendance"}
                            </h2>
                        </div>
                        <input
                            type="date"
                            value={selectedGlobalDate}
                            onChange={(e) => setSelectedGlobalDate(e.target.value)}
                            max={currentDate || undefined}
                            className="bg-zinc-800 text-xs text-white px-3 py-1.5 rounded-lg border border-zinc-700 outline-none"
                        />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                        <div 
                            onClick={() => setFilterStatus(prev => prev === "On Leave" ? "All" : "On Leave")}
                            className={cn(
                                "cursor-pointer transition-all border p-3 rounded-xl flex items-center justify-between",
                                filterStatus === "On Leave" ? "bg-purple-500/20 border-purple-500/50 shadow-lg shadow-purple-500/10 scale-[1.02]" : "bg-purple-500/5 border-purple-500/20 hover:bg-purple-500/10"
                            )}
                        >
                            <span className="text-xs font-bold text-purple-400 block">On Leave</span>
                            <span className="text-lg font-black text-white">{teamAttendanceList.filter((l: any) => l.status === "On Leave").length}</span>
                        </div>
                        <div 
                            onClick={() => setFilterStatus(prev => prev === "Present" ? "All" : "Present")}
                            className={cn(
                                "cursor-pointer transition-all border p-3 rounded-xl flex items-center justify-between",
                                filterStatus === "Present" ? "bg-green-500/20 border-green-500/50 shadow-lg shadow-green-500/10 scale-[1.02]" : "bg-green-500/5 border-green-500/20 hover:bg-green-500/10"
                            )}
                        >
                            <span className="text-xs font-bold text-green-400 block">Present Today</span>
                            <span className="text-lg font-black text-white">{teamAttendanceList.filter((l: any) => l.status === "Working" || l.status === "Clocked Out").length}</span>
                        </div>
                        <div 
                            onClick={() => setFilterStatus(prev => prev === "Holiday" ? "All" : "Holiday")}
                            className={cn(
                                "cursor-pointer transition-all border p-3 rounded-xl flex items-center justify-between",
                                filterStatus === "Holiday" ? "bg-amber-500/20 border-amber-500/50 shadow-lg shadow-amber-500/10 scale-[1.02]" : "bg-amber-500/5 border-amber-500/20 hover:bg-amber-500/10"
                            )}
                        >
                            <span className="text-xs font-bold text-amber-500 block">Holiday</span>
                            <span className="text-lg font-black text-white">{teamAttendanceList.filter((l: any) => l.status === "Holiday").length}</span>
                        </div>
                        <div 
                            onClick={() => setFilterStatus(prev => prev === "Absent" ? "All" : "Absent")}
                            className={cn(
                                "cursor-pointer transition-all border p-3 rounded-xl flex items-center justify-between",
                                filterStatus === "Absent" ? "bg-red-500/20 border-red-500/50 shadow-lg shadow-red-500/10 scale-[1.02]" : "bg-red-500/5 border-red-500/20 hover:bg-red-500/10"
                            )}
                        >
                            <span className="text-xs font-bold text-red-400 block">Absent Today</span>
                            <span className="text-lg font-black text-white">{teamAttendanceList.filter((l: any) => l.status === "Absent").length}</span>
                        </div>
                    </div>

                    <div className="overflow-x-auto max-h-[500px] custom-scrollbar rounded-xl border border-zinc-800/50 -mx-2 sm:mx-0">
                        <div className="min-w-[800px]">
                            <table className="w-full text-left">
                                <thead className="bg-zinc-800/80 sticky top-0 z-10 text-[9px] uppercase tracking-widest text-zinc-400">
                                    <tr>
                                        <th className="px-4 py-3 font-bold">Employee</th>
                                        <th className="px-4 py-3 font-bold">Status</th>
                                        <th className="px-4 py-3 font-bold">In / Out</th>
                                        <th className="px-4 py-3 font-bold">Location</th>
                                        <th className="px-4 py-3 font-bold">Flags Issued</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-zinc-800/50">
                                    {filteredTeamAttendanceList.map(({ employee, record, status, scheduledLocation }: any, idx: number) => (
                                        <tr key={employee.id || `team-att-${idx}`} className="hover:bg-zinc-800/30 transition-colors text-xs">
                                            <td className="px-4 py-3">
                                                <p className="font-bold text-white">{employee.name}</p>
                                                <p className="text-[10px] text-zinc-500">{employee.designation || employee.role}</p>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={cn("px-2 py-0.5 rounded-full text-[9px] font-bold border",
                                                    status === "Working" ? "bg-green-500/10 text-green-400 border-green-500/20" :
                                                        status === "Clocked Out" ? "bg-blue-500/10 text-blue-400 border-blue-500/20" :
                                                            status === "Holiday" ? "bg-amber-500/10 text-amber-500 border-amber-500/20" :
                                                                status === "On Leave" ? "bg-purple-500/10 text-purple-400 border-purple-500/20" :
                                                                    "bg-zinc-800 text-zinc-500 border-zinc-700"
                                                )}>
                                                    {status}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-[10px] text-zinc-300">
                                                {record ? (
                                                    <div className="flex flex-col gap-0.5">
                                                        <span className="text-green-400">In: {record.clockIn}</span>
                                                        {record.clockOut && <span className="text-orange-400">Out: {record.clockOut}</span>}
                                                    </div>
                                                ) : <span className="text-zinc-600">—</span>}
                                            </td>
                                            <td className="px-4 py-3 text-[10px]">
                                                {record ? (
                                                    <span className="text-zinc-400">{record.location}</span>
                                                ) : (
                                                    <span className="text-zinc-500 italic">Scheduled: {scheduledLocation || "—"}</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex flex-col gap-1.5 min-w-[120px]">
                                                    {record ? (
                                                        <div className="flex gap-1 flex-wrap">
                                                            {Object.entries(record.flags).filter(([_, v]) => v).length > 0 ? (
                                                                Object.entries(record.flags).filter(([_, v]) => v).map(([k]) => (
                                                                    <span key={k} className={cn("text-[8.5px] font-bold px-1.5 py-0.5 rounded-sm flex items-center gap-1", FLAG_CONFIG[k]?.color || "text-zinc-400 bg-zinc-800")}>
                                                                        {FLAG_CONFIG[k]?.emoji} {FLAG_CONFIG[k]?.label || k}
                                                                    </span>
                                                                ))
                                                            ) : <span className="text-[10px] text-zinc-600">Clean</span>}
                                                        </div>
                                                    ) : <span className="text-[10px] text-zinc-600">—</span>}

                                                    {isHRorFounder && record?.dressCodeImageUrl && record.dressCodeStatus === "Pending" && (
                                                        <div className="flex gap-1 mt-1">
                                                            <button
                                                                onClick={() => resolveDressCodeCheck(record.id || (record as any)._id, "Approved")}
                                                                className="text-[8px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.5 rounded-sm hover:bg-emerald-500/30 font-bold"
                                                            >
                                                                ✓ Approve Dress
                                                            </button>
                                                            <button
                                                                onClick={() => resolveDressCodeCheck(record.id || (record as any)._id, "Rejected")}
                                                                className="text-[8px] bg-red-500/20 text-red-400 border border-red-500/30 px-1.5 py-0.5 rounded-sm hover:bg-red-500/30 font-bold"
                                                            >
                                                                ✗ Reject
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
            {/* Fines & Penalties Section */}
            <div className="bg-zinc-900/80 border border-red-500/20 rounded-2xl p-5 space-y-4">
                <div className="flex justify-between items-center pb-2 border-b border-zinc-800/50">
                    <div className="flex items-center gap-2">
                        <AlertTriangle size={18} className="text-red-400" />
                        <h2 className="text-sm font-bold text-white">Fines & Penalties</h2>
                    </div>
                    <div className="px-3 py-1 bg-red-500/10 border border-red-500/20 rounded-lg">
                        <span className="text-xs font-bold text-red-400">Total Outstanding: ₹{emp.fines?.total || 0}</span>
                    </div>
                </div>

                {emp.fines?.records && emp.fines.records.length > 0 ? (
                    <div className="space-y-2">
                        {emp.fines.records.map((fine, idx) => (
                            <div key={idx} className="flex items-center justify-between p-3 bg-zinc-800/30 rounded-xl border border-zinc-700/50">
                                <div className="space-y-0.5">
                                    <p className="text-xs font-bold text-white">{fine.reason}</p>
                                    <p className="text-[10px] text-zinc-500">{fine.date}</p>
                                </div>
                                <span className="text-xs font-black text-red-400">₹{fine.amount}</span>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="py-4 text-center">
                        <CheckCircle2 size={24} className="mx-auto text-green-500/30 mb-2" />
                        <p className="text-xs text-zinc-500 italic">No fines or penalties on record. Keep it up!</p>
                    </div>
                )}
                <p className="text-[9px] text-zinc-600 italic">Note: Fines are automatically deducted from the monthly payout. For disputes, please raise a ticket.</p>
            </div>
        </div>
    );
}
