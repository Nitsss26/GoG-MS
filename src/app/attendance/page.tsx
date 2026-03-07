"use client";

import { useState, useEffect, useRef } from "react";
import { useAuth, Employee } from "@/context/AuthContext";
import { uploadToCloudinary } from "@/lib/cloudinary";
import { resolveLocationToCollege, FLAG_CONFIG } from "@/lib/colleges";
import { cn } from "@/lib/utils";
import { Clock, MapPin, CheckCircle2, LogIn, LogOut, History, AlertTriangle, Camera, Upload, X, Navigation, Loader2, Image as ImageIcon, Home, FileText, Users } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default function AttendancePage() {
    const { user, employees, clockIn, clockOut, attendanceRecords, workSchedules, addMarkAsPresentRequest, markAsPresentRequests } = useAuth();
    const [currentTime, setCurrentTime] = useState<string | null>(null);
    const [currentDate, setCurrentDate] = useState<string | null>(null);
    const [geoStatus, setGeoStatus] = useState<"idle" | "requesting" | "granted" | "denied">("idle");
    const [distanceKm, setDistanceKm] = useState<number | null>(null);
    const [withinRadius, setWithinRadius] = useState(false);
    const [dressCodeUrl, setDressCodeUrl] = useState<string | null>(null);
    const [uploading, setUploading] = useState(false);
    const [uploadError, setUploadError] = useState<string | null>(null);
    const [clockInError, setClockInError] = useState<string | null>(null);

    // Mark as present states
    const [showMapForm, setShowMapForm] = useState(false);
    const [mapReason, setMapReason] = useState("");
    const [mapProofUrls, setMapProofUrls] = useState<string[]>([]);
    const [mapUploading, setMapUploading] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const mapFileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const timer = setInterval(() => {
            const now = new Date();
            setCurrentTime(now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }));
            setCurrentDate(now.toISOString().split("T")[0]);
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    if (!user || !currentTime || !currentDate) return null;
    const emp = user as Employee;

    const todaysRecord = attendanceRecords.find(r => r.employeeId === user.id && r.date === currentDate);
    const todaysMapRequest = markAsPresentRequests.find(r => r.employeeId === user.id && r.date === currentDate);
    const hasCheckedIn = !!todaysRecord || !!todaysMapRequest;
    const hasCheckedOut = !!(todaysRecord && todaysRecord.clockOut);
    const isDefaulter = (emp.dressCodeDefaults || 0) >= 3;
    const markPresentCreditsLeft = Math.max(0, 3 - (emp.markPresentUsed || 0));

    const mySchedule = workSchedules.find(s => s.employeeId === user.id && s.approvedByHR);
    const todayDay = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][new Date().getDay()];
    const assignedLocationId = mySchedule?.dayWise?.[todayDay]?.location || "sage-bhopal";
    const assignedClockIn = mySchedule?.dayWise?.[todayDay]?.clockInTime || "09:00";
    const assignedClockOut = mySchedule?.dayWise?.[todayDay]?.clockOutTime || "18:00";

    // Resolve college from location ID
    const isWFH = assignedLocationId.toLowerCase() === "wfh";
    const college = isWFH ? null : resolveLocationToCollege(assignedLocationId);
    const displayLocation = isWFH ? "Work From Home" : college?.shortName || assignedLocationId;

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
        if (!college) { setGeoStatus("denied"); setClockInError("No college mapped for today's location."); return; }
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const dist = haversineDistance(pos.coords.latitude, pos.coords.longitude, college.lat, college.lng);
                setDistanceKm(parseFloat(dist.toFixed(2)));
                setWithinRadius(dist <= college.radiusKm);
                setGeoStatus("granted");
                if (dist > college.radiusKm) setClockInError(`You are ${dist.toFixed(1)} km from ${college.shortName}. Maximum: ${college.radiusKm} km.`);
            },
            () => { setGeoStatus("denied"); setClockInError("Location access denied."); },
            { enableHighAccuracy: true, timeout: 10000 }
        );
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: "dressCode" | "mapProof") => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (type === "dressCode") {
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

    const handleCheckIn = () => {
        setClockInError(null);
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
        clockIn(displayLocation, timeNow, dressCodeUrl);
    };

    const handleMarkAsPresent = () => {
        if (!mapReason || mapProofUrls.length === 0) { alert("Reason and proofs are mandatory."); return; }
        addMarkAsPresentRequest({
            employeeId: user.id, date: currentDate, reason: mapReason, proofUrls: mapProofUrls
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

    const isHRorFounder = emp.role === "HR" || emp.role === "FOUNDER";
    const [selectedGlobalDate, setSelectedGlobalDate] = useState<string>("");

    useEffect(() => {
        if (currentDate && !selectedGlobalDate) setSelectedGlobalDate(currentDate);
    }, [currentDate]);

    // Compute global attendance for HR/Founder
    const computeGlobalAttendance = () => {
        return employees.map(employee => {
            const record = attendanceRecords.find(r => r.employeeId === employee.id && r.date === selectedGlobalDate);
            const status = record ? (record.clockOut ? "Clocked Out" : "Working") : "Absent";
            return {
                employee,
                record,
                status
            };
        }).sort((a, b) => {
            // Sort by Working > Clocked Out > Absent
            const w: Record<string, number> = { "Working": 2, "Clocked Out": 1, "Absent": 0 };
            return w[b.status] - w[a.status];
        });
    };

    const globalAttendanceList = isHRorFounder ? computeGlobalAttendance() : [];

    return (
        <div className="p-6 space-y-6 max-w-5xl mx-auto w-full">
            <header className="flex justify-between items-center">
                <div><h1 className="text-xl font-bold text-white tracking-tight">Attendance Management</h1><p className="text-xs text-zinc-400 mt-1">Clock in/out with location & dress code verification.</p></div>
                <div className="flex flex-col items-end gap-1">
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-primary/10 border border-primary/20 rounded-lg text-primary">
                        <Clock size={14} /><span className="text-[11px] font-bold font-mono">{currentTime}</span>
                    </div>
                </div>
            </header>

            {isHRorFounder && (
                <div className="bg-zinc-900/80 border border-zinc-800/50 rounded-2xl p-5 space-y-5">
                    <div className="flex justify-between items-center pb-2 border-b border-zinc-800/50">
                        <div className="flex items-center gap-2">
                            <Users size={16} className="text-blue-400" />
                            <h2 className="text-sm font-bold text-white">Global Attendance Roster</h2>
                        </div>
                        <input
                            type="date"
                            value={selectedGlobalDate}
                            onChange={(e) => setSelectedGlobalDate(e.target.value)}
                            max={currentDate || undefined}
                            className="bg-zinc-800 text-xs text-white px-3 py-1.5 rounded-lg border border-zinc-700 outline-none"
                        />
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                        <div className="bg-zinc-800/30 border border-zinc-700/50 p-3 rounded-xl flex items-center justify-between">
                            <span className="text-xs font-bold text-zinc-400 block">Total Staff</span>
                            <span className="text-lg font-black text-white">{employees.length}</span>
                        </div>
                        <div className="bg-green-500/5 border border-green-500/20 p-3 rounded-xl flex items-center justify-between">
                            <span className="text-xs font-bold text-green-400 block">Present Today</span>
                            <span className="text-lg font-black text-white">{globalAttendanceList.filter(l => l.status !== "Absent").length}</span>
                        </div>
                        <div className="bg-red-500/5 border border-red-500/20 p-3 rounded-xl flex items-center justify-between">
                            <span className="text-xs font-bold text-red-400 block">Absent Today</span>
                            <span className="text-lg font-black text-white">{globalAttendanceList.filter(l => l.status === "Absent").length}</span>
                        </div>
                    </div>

                    <div className="overflow-x-auto max-h-[400px] custom-scrollbar rounded-xl border border-zinc-800/50">
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
                                {globalAttendanceList.map(({ employee, record, status }) => (
                                    <tr key={employee.id} className="hover:bg-zinc-800/30 transition-colors text-xs">
                                        <td className="px-4 py-3">
                                            <p className="font-bold text-white">{employee.name}</p>
                                            <p className="text-[10px] text-zinc-500">{employee.designation || employee.role}</p>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className={cn("px-2 py-0.5 rounded-full text-[9px] font-bold border",
                                                status === "Working" ? "bg-green-500/10 text-green-400 border-green-500/20" :
                                                    status === "Clocked Out" ? "bg-blue-500/10 text-blue-400 border-blue-500/20" :
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
                                        <td className="px-4 py-3 text-[10px] text-zinc-400">
                                            {record ? record.location : "—"}
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex gap-1 flex-wrap">
                                                {record ? (
                                                    Object.entries(record.flags).filter(([_, v]) => v).length > 0 ? (
                                                        Object.entries(record.flags).filter(([_, v]) => v).map(([k]) => (
                                                            <span key={k} className={cn("text-[8.5px] font-bold px-1.5 py-0.5 rounded-sm flex items-center gap-1", FLAG_CONFIG[k]?.color || "text-zinc-400 bg-zinc-800")}>
                                                                {FLAG_CONFIG[k]?.emoji} {FLAG_CONFIG[k]?.label || k}
                                                            </span>
                                                        ))
                                                    ) : <span className="text-[10px] text-zinc-600">Clean</span>
                                                ) : <span className="text-[10px] text-zinc-600">—</span>}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {globalAttendanceList.length === 0 && (
                            <div className="p-8 text-center text-zinc-500 text-sm">No employee data found.</div>
                        )}
                    </div>
                </div>
            )}


            <div className="bg-zinc-900/80 border border-zinc-800/50 rounded-2xl p-5 space-y-4">
                {/* Employee Info */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold">{user.name[0]}</div>
                        <div><p className="text-sm font-bold text-white">{user.name}</p><p className="text-[10px] text-zinc-500">{emp.designation} · {emp.dept}</p></div>
                    </div>
                    <div className={cn("px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-widest border",
                        hasCheckedIn ? (hasCheckedOut ? "bg-blue-500/10 text-blue-400 border-blue-500/20" : "bg-green-500/10 text-green-400 border-green-500/20") : "bg-zinc-800 text-zinc-500 border-zinc-700"
                    )}>{hasCheckedIn ? (hasCheckedOut ? "Clocked Out" : "Working") : "Not Clocked In"}</div>
                </div>

                {/* Schedule */}
                <div className="grid grid-cols-3 gap-3">
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
                                                    <p className={cn("text-xs font-bold", withinRadius ? "text-green-400" : "text-red-400")}>{withinRadius ? `✓ Within ${college?.shortName} Radius` : `✗ Out of Range — ${college?.shortName}`}</p>
                                                    <p className="text-[9px] text-zinc-500">Distance: {distanceKm} km (Max: {college?.radiusKm} km)</p>
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

                                {/* Step 2: Dress Code Photo */}
                                {!showMapForm && (
                                    <div className="space-y-2">
                                        <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Step 2: Dress Code Photo</p>
                                        <p className="text-[9px] text-zinc-500">Upload a clear photo showing I-Card, Badge, and Blazer.</p>
                                        {!dressCodeUrl ? (
                                            <div>
                                                <div className="border-2 border-dashed border-zinc-700 rounded-xl p-6 text-center hover:border-purple-500/50 transition-colors cursor-pointer"
                                                    onClick={() => fileInputRef.current?.click()}>
                                                    {uploading ? (
                                                        <div className="flex flex-col items-center gap-2"><Loader2 size={24} className="text-purple-400 animate-spin" /><p className="text-xs text-purple-400 font-bold">Uploading to cloud...</p></div>
                                                    ) : (
                                                        <><Camera size={24} className="mx-auto text-zinc-600 mb-2" /><p className="text-xs text-zinc-400 font-bold">Click to upload dress code photo</p><p className="text-[9px] text-zinc-600 mt-1">JPG, PNG, WEBP · Max 10MB</p></>
                                                    )}
                                                </div>
                                                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e, "dressCode")} />
                                                {uploadError && <p className="text-[10px] text-red-400 mt-1">{uploadError}</p>}
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-3 p-3 bg-green-500/5 border border-green-500/20 rounded-xl">
                                                <img src={dressCodeUrl} alt="Dress code" className="w-12 h-12 rounded-lg object-cover border border-zinc-700" />
                                                <div className="flex-1">
                                                    <p className="text-xs font-bold text-green-400">✓ Photo Uploaded</p>
                                                    <a href={dressCodeUrl} target="_blank" rel="noopener" className="text-[9px] text-primary hover:underline">View full image ↗</a>
                                                </div>
                                                <button onClick={() => setDressCodeUrl(null)} className="text-zinc-500 hover:text-red-400"><X size={14} /></button>
                                            </div>
                                        )}
                                    </div>
                                )}
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

                        {!showMapForm && !isDefaulter && (
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
                <div className="overflow-x-auto">
                    <table className="w-full"><thead><tr className="border-b border-zinc-800/50 text-[9px] text-zinc-500 uppercase tracking-widest">
                        <th className="text-left px-5 py-3">Date</th><th className="text-left px-5 py-3">In</th><th className="text-left px-5 py-3">Out</th><th className="text-left px-5 py-3">Location</th><th className="text-left px-5 py-3">Photo</th><th className="text-left px-5 py-3">Flags</th>
                    </tr></thead>
                        <tbody className="divide-y divide-zinc-800/50">
                            {myLogs.slice(0, 20).map(log => (
                                <tr key={log.id} className="hover:bg-zinc-800/20 transition-colors text-xs">
                                    <td className="px-5 py-3 text-white font-medium">{log.date}</td>
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
                        </tbody></table>
                </div>
            </div>
        </div>
    );
}
