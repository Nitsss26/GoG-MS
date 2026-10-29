"use client";
import React, { useState, useEffect, useRef, useMemo } from "react";
import { useAuth, Employee } from "@/context/AuthContext";
import { useSearchParams, useRouter } from "next/navigation";
import { uploadToCloudinary } from "@/lib/cloudinary";
import { FLAG_CONFIG } from "@/lib/colleges";
import { cn } from "@/lib/utils";
import { Clock, MapPin, CheckCircle2, LogIn, LogOut, History, AlertTriangle, Camera, Upload, X, Navigation, Loader2, Image as ImageIcon, Home, FileText, Users, Calendar } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import WorkFromHomeSection from "@/components/wfh/WorkFromHomeSection";
import WfhApprovalBoard from "@/components/wfh/WfhApprovalBoard";
import WfhAttendanceLog from "@/components/wfh/WfhAttendanceLog";
import MyAttendanceAlerts from "@/components/attendance/MyAttendanceAlerts";
import AttendanceViolationsBoard from "@/components/attendance/AttendanceViolationsBoard";
import LateJustificationsBoard from "@/components/attendance/LateJustificationsBoard";
import DressCodeRejectDialog from "@/components/DressCodeRejectDialog";
import { useLateJustifications, useAutoOpenLateForm, LateJustificationModal, LateJustificationTag } from "@/components/attendance/LateJustification";
import { canApplyWfh, wfhCovers, wfhAttendanceLabel } from "@/lib/wfh-policy";
import { useServerClock, serverNow, istDate, istHHMM, istHHMMSS } from "@/lib/server-clock";

/**
 * Why the phone could not give its location (browser GeolocationPositionError codes), in plain words.
 * 1 = permission blocked, 2 = location / GPS off or unavailable, 3 = no GPS fix in time.
 */
const GEO_WAIT_MS = 20000; // indoors a phone can need more than 10 s for a GPS fix
function geoErrorInfo(err?: { code?: number } | null) {
    if (err?.code === 1) return { title: "Location Permission Blocked", message: "Location access is blocked for this site. Open your browser settings → Site settings → Location, allow it for this site, then tap Retry." };
    if (err?.code === 2) return { title: "Location Unavailable", message: "Your phone could not find its location. Turn on Location / GPS (and Wi-Fi for better accuracy), then tap Retry." };
    if (err?.code === 3) return { title: "GPS Signal Not Found", message: "Could not get your location in time. Move near a window or outside, then tap Retry." };
    return { title: "Location Error", message: "Could not get your location. Please tap Retry." };
}

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Attendance screen, used by two pages:
 *   view "default"  → /attendance            own clock-in / log / alerts (+ team sections for managers)
 *   view "hr-log"   → /hr/attendance-log     HR → Attendance Log: the full attendance log (roster, WFH log & applications,
 *                                            violations, late clock-in justifications) for HR, HR Executive and Founder
 * HR and HR Executive see only their own attendance on /attendance; everyone else is unchanged.
 */
export default function AttendanceScreen({ view = "default" }: { view?: "default" | "hr-log" }) {
    const { user, employees, clockIn, clockOut, locationClockIn, attendanceRecords, workSchedules, addMarkAsPresentRequest, markAsPresentRequests, colleges, resolveDressCodeCheck, getExpectedTiming, getScheduledTiming, holidays, getReportees, leaves, overrideAttendance } = useAuth();
    const router = useRouter();
    const hrLog = view === "hr-log";
    const selfOn = !hrLog;                                // own clock-in, own log, own alerts, fines
    const teamOn = hrLog || user?.role !== "HR";          // team sections (HR / HR Executive: only on the Attendance Log page)
    // Roster dress code Reject → reasons dialog (no automatic email; sent from Email Management)
    const [dressRejecting, setDressRejecting] = useState<any>(null);
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
    const [geoErrTitle, setGeoErrTitle] = useState("Location Denied"); // heading of the red box when no location

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

    // Work From Home (Attendance): own applications, Office / WFH mode for today, HR / manager tabs
    const [myWfhApps, setMyWfhApps] = useState<any[]>([]);
    const [wfhMode, setWfhMode] = useState<"WFH" | "OFFICE">("WFH");
    const [officeChoice, setOfficeChoice] = useState("");
    const [wfhFormOpen, setWfhFormOpen] = useState(false);
    const [clockBusy, setClockBusy] = useState(false);
    // HOI / OM: clock-in at another assigned location (detect → confirm → record)
    const [visit, setVisit] = useState<{ busy?: boolean; detected?: { id: string; name: string; ambiguous?: { id: string; name: string }[] } | null; coords?: { lat: number; lng: number; accuracy?: number }; error?: string | null; unassigned?: boolean; info?: string | null; unmatched?: { address: string | null; time?: string } | null }>({});
    // HOI: result of the location check before the first clock-in (assigned location matched / no match + address)
    const [hoiLocCheck, setHoiLocCheck] = useState<{ matched: boolean; name?: string; address?: string | null; time?: string; loading?: boolean } | null>(null);
    // Attendance Log: Attendance (office) / Work From Home / All, 10 rows per page
    const [logTab, setLogTab] = useState<"office" | "wfh" | "all">("office");
    const [logPage, setLogPage] = useState(0);
    const [logDate, setLogDate] = useState(""); // Attendance Log date filter (YYYY-MM-DD, IST); "" = all dates
    // Live server time (display); official clock-in / clock-out times are generated by the backend
    useServerClock(); // keeps the page clock in sync with the server (official times are set by the server)
    const [rosterTab, setRosterTab] = useState<"regular" | "wfh-log" | "wfh-applications" | "violations" | "late-justifications">(() => {
        const t = searchParams.get("tab");
        return t === "wfh-log" || t === "wfh-applications" || t === "violations" || t === "late-justifications" ? t : "regular";
    });
    const loadMyWfh = React.useCallback(async () => {
        try {
            const r = await fetch("/api/wfh?view=mine", { cache: "no-store" });
            if (r.ok) setMyWfhApps((await r.json()).applications || []);
        } catch { /* the clock-in card still works without it */ }
    }, []);
    useEffect(() => { if (user?.id) loadMyWfh(); }, [user?.id, loadMyWfh]);

    useEffect(() => {
        const timer = setInterval(() => {
            // Server time (IST); the device clock is only a fallback for the page layout until the first sync
            const now = serverNow() || new Date();
            setCurrentTime(istHHMMSS(now));

            // Only update currentDate if not driven by URL params (prevents reset during form fill)
            if (!searchParams.get("date")) {
                setCurrentDate(istDate(now));
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

    const showsTeamRoster = teamOn && (isHRorFounder || reportees.length > 0);

    const employeesToShow = useMemo(() => {
        if (!user) return [];
        let list = isHRorFounder
            ? employees.filter((e: Employee) => !["CEO", "CTO", "COO"].includes(e.designation || "") && e.role !== "FOUNDER" && e.status !== "Resigned" && !(e as any).hideFromAttendance)
            : reportees.filter((e: Employee) => e.status !== "Resigned" && !(e as any).hideFromAttendance);

        // Fix: Always include self in the list
        if (!list.find((e: Employee) => e.id === user.id)) {
            const self = employees.find(e => e.id === user.id);
            if (self) list = [self, ...list];
        }
        return list;
    }, [isHRorFounder, employees, reportees, user]);

    // Records of the selected roster date, read from the server for that date only. The full attendance list
    // (all employees, all days) can be too large to load at once on the hosting platform, which left the roster
    // without today's clock-ins; this small per-date request always returns them.
    const [dayRecords, setDayRecords] = useState<any[]>([]);
    useEffect(() => {
        if (!showsTeamRoster || !user || !selectedGlobalDate) return;
        let cancelled = false;
        fetch(`/api/attendance?date=${encodeURIComponent(selectedGlobalDate)}&userId=${encodeURIComponent(user.id)}&role=${encodeURIComponent(user.role)}`, { cache: "no-store" })
            .then(r => (r.ok ? r.json() : []))
            .then(d => { if (!cancelled) setDayRecords(Array.isArray(d) ? d : []); })
            .catch(() => { if (!cancelled) setDayRecords([]); });
        return () => { cancelled = true; };
    }, [showsTeamRoster, user?.id, user?.role, selectedGlobalDate, attendanceRecords.length]);

    // Compute attendance for the chosen list
    const teamAttendanceList = useMemo(() => {
        if (!showsTeamRoster || !user || !selectedGlobalDate) return [];
        return employeesToShow.map((employee: Employee) => {
            // Latest copy in the app state (updated by HR actions) first, otherwise the server record of that date
            const record = attendanceRecords.find((r: any) => r.employeeId === employee.id && r.date === selectedGlobalDate)
                || dayRecords.find((r: any) => r.employeeId === employee.id && r.date === selectedGlobalDate);
            const scheduledLocation = getExpectedTiming(employee.id, selectedGlobalDate).location;

            const empHoliday = holidays.find(h =>
                h.date === selectedGlobalDate &&
                h.status === "Approved" &&
                (h.forAll || h.collegeIds?.includes(scheduledLocation || ""))
            );

            // Check for approved leaves
            const leaveToday = leaves.find(l =>
                l.employeeId === employee.id &&
                selectedGlobalDate >= l.startDate &&
                selectedGlobalDate <= l.endDate &&
                l.status !== "Rejected"
            );

            let status = "Absent";
            if (record) {
                if (record.status === "On Leave") status = "On Leave";
                else if (record.status === "Absent") status = "Absent"; // HR marked absent (record kept for history)
                else if (record.clockOut) status = "Clocked Out";
                else {
                    // Logic for No Clock-out
                    const expectedOut = getExpectedTiming(employee.id, selectedGlobalDate).out;
                    const [h, m] = expectedOut.split(':').map(Number);
                    const outTime = new Date(selectedGlobalDate);
                    outTime.setHours(h, m, 0);

                    const graceTime = new Date(outTime.getTime() + 30 * 60000); // 30 min grace
                    const now = new Date();
                    
                    if (now > graceTime) {
                        status = "No Clock-out";
                    } else {
                        status = "Working";
                    }
                }
            } else if (empHoliday) {
                status = "Holiday";
            } else if (leaveToday) {
                if (leaveToday.status === "Approved") status = "On Leave";
                else status = "Leave Requested";
            } else {
                // Logic for No Clock-in vs Absent
                const expectedIn = getExpectedTiming(employee.id, selectedGlobalDate).in;
                const [h, m] = expectedIn.split(':').map(Number);
                const startTime = new Date(selectedGlobalDate);
                startTime.setHours(h, m, 0);

                const absentThreshold = new Date(startTime.getTime() + 30 * 60 * 60000); // 30 hours
                const now = new Date();

                if (now > absentThreshold) {
                    status = "Absent";
                } else {
                    status = "No Clock-in";
                }
            }

            return { employee, record, status, scheduledLocation };
        }).sort((a: any, b: any) => {
            // First group by scheduled location
            if (a.scheduledLocation !== b.scheduledLocation) {
                return (a.scheduledLocation || "").localeCompare(b.scheduledLocation || "");
            }
            // Then sort by status within each group
            const w: Record<string, number> = { "Working": 4, "Clocked Out": 3, "Holiday": 2, "On Leave": 1.5, "Leave Requested": 1, "Absent": 0 };
            return w[b.status] - w[a.status];
        });
    }, [employeesToShow, attendanceRecords, dayRecords, selectedGlobalDate, showsTeamRoster, user, holidays, leaves]);

    // Roster "Flags Issued": no clock-in (red) and no clock-out (teal) — late is yellow, early clock-out purple (FLAG_CONFIG)
    const ROSTER_FLAG_STYLE = {
        noClockIn: "text-[8.5px] font-bold px-1.5 py-0.5 rounded-sm flex items-center gap-1 text-red-400 bg-red-500/10 border border-red-500/20",
        noClockOut: "text-[8.5px] font-bold px-1.5 py-0.5 rounded-sm flex items-center gap-1 text-teal-300 bg-teal-500/10 border border-teal-500/20",
    };
    // Roster filters from the record's flags (the same flags shown in "Flags Issued")
    const isLateClockIn = (l: any) => !!l.record?.flags?.late && l.status !== "Absent" && l.status !== "On Leave";
    const isEarlyClockOut = (l: any) => !!l.record?.flags?.earlyOut && l.status !== "Absent" && l.status !== "On Leave";
    const filteredTeamAttendanceList = useMemo(() => {
        if (filterStatus === "All") return teamAttendanceList;
        if (filterStatus === "Present") return teamAttendanceList.filter((l: any) => l.status === "Working" || l.status === "Clocked Out" || l.status === "No Clock-out");
        if (filterStatus === "Absent") return teamAttendanceList.filter((l: any) => l.status === "Absent" || l.status === "No Clock-in" || l.status === "Leave Requested");
        if (filterStatus === "Late Clock-In") return teamAttendanceList.filter(isLateClockIn);
        if (filterStatus === "Early Clock-Out") return teamAttendanceList.filter(isEarlyClockOut);
        return teamAttendanceList.filter((l: any) => l.status === filterStatus);
    }, [teamAttendanceList, filterStatus]);

    // Late Clock-In Justification: own late days + the form (opens by itself after a late clock-in today)
    const myTodayRec: any = user ? attendanceRecords.find(r => r.employeeId === user.id && r.date === currentDate) : null;
    const lateJ = useLateJustifications(!!user, `${myTodayRec?.clockIn || ""}|${myTodayRec?.flags?.late ? 1 : 0}`);
    const [lateForm, setLateForm] = useState<any | null>(null);
    const [lateMsg, setLateMsg] = useState("");
    useAutoOpenLateForm(selfOn ? currentDate || "" : "", lateJ.byDate, setLateForm);
    // HR / HR Executive opening a team tab of /attendance (e.g. from a notification) → HR → Attendance Log
    useEffect(() => {
        if (hrLog || user?.role !== "HR") return;
        const t = searchParams.get("tab");
        if (t && ["regular", "wfh-log", "wfh-applications", "violations", "late-justifications"].includes(t)) router.replace(`/hr/attendance-log?tab=${t}`);
    }, [hrLog, user?.role, searchParams, router]);

    if (!user || !currentTime || !currentDate) return null;
    if (hrLog && !isHRorFounder) return <div className="p-8 text-center text-sm text-zinc-500">Only HR and HR Executive can open the Attendance Log.</div>;
    const emp = user as Employee;

    const todaysRecord = attendanceRecords.find(r => r.employeeId === user.id && r.date === currentDate);
    const todaysMapRequest = markAsPresentRequests.find(r => r.employeeId === user.id && r.date === currentDate);
    // An HR-marked "Absent" record does not count as clocked in (before, marking absent removed the record)
    const hasCheckedIn = (!!todaysRecord && todaysRecord.status !== "Absent") || !!todaysMapRequest;
    const hasCheckedOut = !!(todaysRecord && todaysRecord.clockOut);
    const isDefaulter = (emp.dressCodeDefaults || 0) >= 3;
    const markPresentCreditsLeft = Math.max(0, 3 - (emp.markPresentUsed || 0));

    const expected = getExpectedTiming(user.id);
    // WFH set in the work schedule vs. a Pending / Approved WFH application covering today
    const scheduledWfh = (getScheduledTiming(user.id).location || "").toLowerCase() === "wfh";
    const todaysWfhApp = myWfhApps.find(a => (a.status === "Pending" || a.status === "Approved") && wfhCovers(a, currentDate));
    const showModeSelector = !!todaysWfhApp && !scheduledWfh;
    const wfhByApp = showModeSelector && wfhMode === "WFH";
    // Office mode on a WFH-application day uses the normal scheduled campus
    const assignedLocationId = scheduledWfh || wfhByApp ? "WFH" : showModeSelector ? getScheduledTiming(user.id).location : expected.location;
    const assignedClockIn = expected.in;
    const assignedClockOut = expected.out;

    // Resolve college from location ID
    const isWFH = assignedLocationId?.toLowerCase() === "wfh";
    const college = isWFH ? null : colleges.find(c => c.id === assignedLocationId || c.shortName === assignedLocationId || c.name === assignedLocationId);
    const displayLocation = isWFH ? "Work From Home" : college?.shortName || assignedLocationId;
    // Location shown in the log / roster: same name as the clock-in card (college short name), not the stored id
    const locName = (loc?: string) => {
        if (!loc) return "—";
        if (loc.toLowerCase() === "wfh") return "WFH";
        const c = colleges.find(x => x.id === loc || x.shortName === loc || x.name === loc);
        return c?.shortName || c?.name || loc;
    };
    // Office options in the clock-in location dropdown: an HOI's authorised attendance locations, otherwise the
    // assigned (scheduled) location. Choosing one keeps the normal office flow (geofence + dress code) unchanged.
    const hoiAllowedLocs: string[] = emp.role === "HOI" || emp.role === "OM" ? ((emp as any).attendanceLocations || []) : [];
    const officeOptions = (hoiAllowedLocs.length ? hoiAllowedLocs : [getScheduledTiming(user.id).location])
        .filter(l => l && l.toLowerCase() !== "wfh")
        .map(l => ({ id: l, label: locName(l) }));
    if (!officeOptions.length) officeOptions.push({ id: "office", label: "Office" });

    const isPastCutoff = !!(currentTime && currentTime >= "11:59:00");
    const shouldShowMAPOnly = isPastCutoff && !hasCheckedIn && currentDate === istDate(serverNow() || new Date());

    const requestLocation = () => {
        if (isWFH) {
            setGeoStatus("granted");
            setWithinRadius(true);
            setDistanceKm(0);
            return;
        }
        setGeoStatus("requesting");
        setClockInError(null);
        if (!navigator.geolocation) { setGeoStatus("denied"); setGeoErrTitle("Location Not Supported"); setClockInError("This browser cannot share your location. Please use Chrome or Safari on your phone."); return; }
        // OM: only the allotted locations (HR → Work Location → OM Clock-In Locations), otherwise the scheduled location
        if (emp.role !== "HOI" && !(emp.role === "OM" && hoiAllowedLocs.length) && !college) { setGeoStatus("denied"); setGeoErrTitle("No Location Assigned"); setClockInError("No college mapped for today's location."); return; }
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                setUserLat(pos.coords.latitude);
                setUserLng(pos.coords.longitude);
                let targetCollege = college;
                let dist = 999999;

                // HOI with authorised attendance locations: only those count (HR → Work Location → Clock-In Locations)
                const hoiAllowed: string[] = emp.role === "HOI" || emp.role === "OM" ? ((emp as any).attendanceLocations || []) : [];
                const candidates = hoiAllowed.length ? colleges.filter(c => hoiAllowed.includes(c.id)) : colleges;
                // OM without allotted Clock-In Locations is checked against the scheduled location only (like a professor),
                // never against every location saved in the OMS
                if ((emp.role === "HOI" || (emp.role === "OM" && hoiAllowed.length > 0) || emp.role === "MARKETING_TEAM" || emp.role === "TECH_TEAM") && candidates.length > 0) {
                    let closestCollege = candidates[0];
                    let minDistance = 999999;

                    for (const c of candidates) {
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
                    setGeoStatus("denied"); setGeoErrTitle("No Location Assigned"); setClockInError("No college mapped for location."); return;
                }

                setDistanceKm(parseFloat(dist.toFixed(2)));
                setWithinRadius(dist <= targetCollege!.radiusKm);
                setActiveLocation(targetCollege!.shortName);
                setGeoStatus("granted");
                if (dist > targetCollege!.radiusKm) setClockInError(`You are ${dist.toFixed(1)} km from ${targetCollege!.shortName}. Maximum: ${targetCollege!.radiusKm} km.`);
                // HOI with assigned locations: show the match status; outside all of them, the actual address
                // (from the server, which also records the attempt for HR review)
                if (emp.role === "HOI" && hoiAllowed.length) {
                    if (dist <= targetCollege!.radiusKm) setHoiLocCheck({ matched: true, name: targetCollege!.shortName });
                    else {
                        // HOI outside every assigned location: clock-in is allowed at the live location ("No Location Match")
                        setHoiLocCheck({ matched: false, address: null, loading: true });
                        locationClockIn(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy, true)
                            .then(d => setHoiLocCheck({ matched: false, address: d?.detectedAddress || null, time: d?.attemptTime }))
                            .catch(() => setHoiLocCheck({ matched: false, address: null }));
                    }
                }
            },
            (err) => { const g = geoErrorInfo(err); setGeoStatus("denied"); setGeoErrTitle(g.title); setClockInError(g.message); },
            { enableHighAccuracy: true, timeout: GEO_WAIT_MS, maximumAge: 0 }
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
        if (clockBusy) return;
        if (isWFH) {
            const timeNow = istHHMM(serverNow() || new Date()); // on-screen checks only — the server sets the official time
            const go = async (lat?: number, lng?: number) => {
                setClockBusy(true);
                try { await clockIn("WFH", timeNow, undefined, lat, lng, false, showModeSelector ? "WFH" : undefined); }
                finally { setClockBusy(false); }
            };
            if (!showModeSelector || !navigator.geolocation) { go(); return; }
            // Optional, non-blocking location for a WFH-application day (only "captured" is shown to HR)
            let done = false;
            const once = (lat?: number, lng?: number) => { if (done) return; done = true; go(lat, lng); };
            setClockBusy(true);
            navigator.geolocation.getCurrentPosition(pos => once(pos.coords.latitude, pos.coords.longitude), () => once(), { timeout: 5000, maximumAge: 300000 });
            setTimeout(() => once(), 6000);
            return;
        }
        if (geoStatus !== "granted") { setClockInError("Allow location access first."); return; }
        if (!withinRadius && !hoiAnywhere) { setClockInError(`Out of range (${distanceKm} km).`); return; }
        if (!dressCodeUrl) { setClockInError("Upload dress code photo first."); return; }
        const timeNow = istHHMM(serverNow() || new Date()); // on-screen checks only — the server sets the official time
        
        let isShortLeave = false;
        const locLower = (activeLocation || displayLocation || "").toLowerCase();
        const isTargetLoc = locLower.includes("kokta") || locLower.includes("indore") || locLower.includes("mandideep") || locLower.includes("sdbc");
        
        if (isTargetLoc) {
            const timeToMins = (t: string) => {
                const [h, m] = t.split(':').map(Number);
                return h * 60 + m;
            };
            const nowMins = timeToMins(timeNow);
            const startMins = timeToMins(assignedClockIn);
            if (nowMins > startMins) {
                const confirmed = window.confirm("You are clocking in late. Are you on short leave?");
                isShortLeave = confirmed;
            }
        }
        
        setClockBusy(true);
        clockIn(activeLocation || displayLocation, timeNow, dressCodeUrl, userLat ?? undefined, userLng ?? undefined, isShortLeave, showModeSelector ? "OFFICE" : undefined)
            .finally(() => setClockBusy(false));
    };

    // HOI / OM with assigned locations: clock in again at another assigned location (same attendance day)
    // Assigned locations: the logged-in user object can be older than an HR change made after login, so the
    // employee directory copy is checked too
    const assignedNow: string[] = emp.role === "HOI" || emp.role === "OM"
        ? (((employees || []).find((e: any) => e.id === user.id) as any)?.attendanceLocations || hoiAllowedLocs)
        : [];
    const multiLocation = assignedNow.length > 0 && !isWFH && !((todaysRecord as any)?.workMode === "WFH");
    const detectVisitLocation = () => {
        setVisit({ busy: true });
        if (!navigator.geolocation) { setVisit({ error: "Location is not supported on this device." }); return; }
        navigator.geolocation.getCurrentPosition(async pos => {
            const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy };
            const d = await locationClockIn(coords.lat, coords.lng, coords.accuracy, true);
            if (!d.ok) { setVisit({ error: d.error || "Could not detect your location.", unassigned: !!d.unassignedLocation, unmatched: d.locationMatchStatus === "unmatched" ? { address: d.detectedAddress || null, time: d.attemptTime } : null }); return; }
            if (d.sameAsCurrent) { setVisit({ info: `You are already clocked in at ${d.detected?.name}.` }); return; }
            setVisit({ detected: d.detected, coords, unmatched: d.locationMatchStatus === "unmatched" ? { address: d.detectedAddress || null, time: d.attemptTime } : null });
        }, (err) => setVisit({ error: geoErrorInfo(err).message }), { enableHighAccuracy: true, timeout: GEO_WAIT_MS, maximumAge: 0 });
    };
    const confirmVisit = async () => {
        if (!visit.coords) return;
        setVisit(v => ({ ...v, busy: true }));
        const d = await locationClockIn(visit.coords.lat, visit.coords.lng, visit.coords.accuracy, false);
        if (!d.ok) { setVisit({ error: d.error || "Clock-in failed.", unassigned: !!d.unassignedLocation, unmatched: d.locationMatchStatus === "unmatched" ? { address: d.detectedAddress || null, time: d.attemptTime } : null }); return; }
        setVisit({ info: d.message || "Location change recorded." });
    };

    // HOI: may clock in at the live location even outside the assigned locations (recorded as "No Location Match")
    const hoiAnywhere = emp.role === "HOI" && !!hoiLocCheck && !hoiLocCheck.matched && !hoiLocCheck.loading && geoStatus === "granted";
    const canUseLocation = withinRadius || hoiAnywhere;

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
            const timeNow = istHHMM(serverNow() || new Date()); // on-screen checks only — the server sets the official time
            let isShortLeave = false;
            const locLower = (activeLocation || displayLocation || todaysRecord?.location || "").toLowerCase();
            const isTargetLoc = locLower.includes("kokta") || locLower.includes("indore") || locLower.includes("mandideep") || locLower.includes("sdbc");
            
            if (isTargetLoc) {
                const timeToMins = (t: string) => {
                    const [h, m] = t.split(':').map(Number);
                    return h * 60 + m;
                };
                const nowMins = timeToMins(timeNow);
                const outMins = timeToMins(assignedClockOut);
                if (nowMins < outMins) {
                    const confirmed = window.confirm("You are clocking out early. Are you on short leave?");
                    isShortLeave = confirmed;
                }
            }

            // OM with assigned locations: the clock-out location is checked too (any assigned college). HOI: from anywhere.
            const hoiAllowed: string[] = emp.role === "OM" ? ((emp as any).attendanceLocations || []) : [];
            if (hoiAllowed.length && !isWFH && navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(
                    pos => clockOut(timeNow, isShortLeave, pos.coords.latitude, pos.coords.longitude),
                    (err) => setClockInError(`Location is needed to clock out. ${geoErrorInfo(err).message}`),
                    { enableHighAccuracy: true, timeout: GEO_WAIT_MS }
                );
                return;
            }
            clockOut(timeNow, isShortLeave);
        }
    };

    // One row per date (an older duplicate clock-in of the same day is not shown twice)
    const myLogs = attendanceRecords.filter(r => r.employeeId === user.id).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .filter((r, i, arr) => arr.findIndex(x => x.date === r.date) === i);
    const isWfhLog = (r: any) => r?.workMode === "WFH" || String(r?.location || "").toLowerCase() === "wfh";
    const LOG_PAGE = 10;
    const logRows = (logTab === "all" ? myLogs : myLogs.filter(r => (logTab === "wfh" ? isWfhLog(r) : !isWfhLog(r))))
        .filter(r => !logDate || r.date === logDate);
    const logPages = Math.max(1, Math.ceil(logRows.length / LOG_PAGE));
    const WfhBadge = ({ rec }: { rec: any }) => (rec?.workMode === "WFH" || String(rec?.location || "").toLowerCase() === "wfh" ? (
        <span data-testid="att-wfh-badge" className={cn("text-[8.5px] font-bold px-1.5 py-0.5 rounded-sm whitespace-nowrap",
            rec.wfhStatus === "Approved" ? "text-emerald-300 bg-emerald-500/10" : rec.wfhStatus === "Pending" ? "text-amber-300 bg-amber-500/10"
                : rec.wfhReviewRequired ? "text-red-300 bg-red-500/10" : "text-sky-300 bg-sky-500/10")}>{wfhAttendanceLabel(rec.wfhStatus)}</span>
    ) : null);
    const showsWfhTabs = teamOn && (isHRorFounder || ["HOI", "AD", "TL", "OM"].includes(user.role as string));
    // Attendance history: HR-marked records are labelled "HR Marked Present / Absent"; self clock-in keeps the normal status
    const isHrMarked = (log: any) => log.attendanceSource === "HR_MANUAL";
    // Who marked it: HR / Founder / HR Executive
    const markerRole = (log: any) => (log.markedByRole === "FOUNDER" ? "Founder" : log.markedByRole === "HR_EXECUTIVE" ? "HR Executive" : "HR");
    const statusLabel = (log: any) => (isHrMarked(log) && (log.status === "Present" || log.status === "Absent") ? `${log.status} – Marked by ${markerRole(log)}` : log.status);
    const markedBy = (log: any) => (isHrMarked(log) ? `${markerRole(log)}${log.markedByName ? ` · ${log.markedByName}` : ""}` : log.clockIn ? "Self Clock-In" : "System");
    // Flags shown in the tables: an HR-marked day shows "Present / Absent – Marked by …" instead of the "overridden" flag
    const shownFlags = (rec: any) => Object.entries(rec?.flags || {}).filter(([k, v]) => v && !(k === "overridden" && isHrMarked(rec)));
    const MarkedBadge = ({ rec }: { rec: any }) => (isHrMarked(rec) && (rec.status === "Present" || rec.status === "Absent") ? (
        <span data-testid="att-marked-flag" className={cn("text-[8.5px] font-bold px-1.5 py-0.5 rounded-sm", rec.status === "Present" ? "text-emerald-300 bg-emerald-500/10" : "text-red-300 bg-red-500/10")}>{rec.status} – Marked by {markerRole(rec)}</span>
    ) : null);


    return (
        <div className="p-4 sm:p-6 space-y-6 max-w-5xl mx-auto w-full">
            {hrLog && (
                <header className="flex items-center gap-3" data-testid="hr-attendance-log">
                    <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center"><Users size={18} className="text-blue-400" /></div>
                    <div><h1 className="text-lg sm:text-xl font-bold text-white tracking-tight">Attendance Log</h1><p className="text-[11px] text-zinc-400 mt-0.5">Full attendance of all employees — roster, Work From Home, violations and late clock-in justifications.</p></div>
                </header>
            )}
            {selfOn && (<>
            <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div><h1 className="text-lg sm:text-xl font-bold text-white tracking-tight">Attendance Management</h1><p className="text-[11px] text-zinc-400 mt-1">Clock in/out with location & dress code verification.</p></div>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
                    {canApplyWfh(user as any) && (
                        <button onClick={() => setWfhFormOpen(true)} data-testid="apply-wfh"
                            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 text-xs font-bold hover:bg-emerald-500/20">
                            <Home size={15} /> Apply for Work From Home
                        </button>
                    )}
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
                    )}>{hasCheckedIn ? (hasCheckedOut ? "Clocked Out" : "Working") : "No Clock-in"}</div>
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
                                                <p className="text-xs font-bold text-red-400" data-testid="geo-error-title">{geoErrTitle}</p>
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
                                                    <p className="text-[10px] text-zinc-500 mt-0.5">Live capture successfully processed via {dressCodeUrl.includes("amazonaws.com") ? "AWS S3" : "Cloudinary"}.</p>
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
                        {emp.role === "HOI" && hoiLocCheck && !hasCheckedIn && (
                            hoiLocCheck.matched
                                ? <p className="text-[10px] text-emerald-400" data-testid="att-loc-status">Location: <b>{hoiLocCheck.name}</b> · Location Status: Assigned Location Matched</p>
                                : <div className="p-2.5 rounded-xl border border-red-500/20 bg-red-500/5" data-testid="att-loc-status">{hoiLocCheck.loading ? <p className="text-[10px] text-zinc-400">Fetching your live location…</p> : <UnmatchedLocation address={hoiLocCheck.address} time={hoiLocCheck.time} />}<p className="text-[9px] text-zinc-500 mt-1">You can still clock in — it will be recorded at this location as "No Location Match".</p></div>
                        )}

                        {!showMapForm && !isDefaulter && !isHolidayToday && showModeSelector && (
                            <div className="p-3 rounded-xl border border-zinc-800 bg-zinc-950/40 space-y-2" data-testid="att-mode">
                                <label htmlFor="att-location" className="block text-[10px] font-bold uppercase tracking-widest text-zinc-500">Select Attendance Location</label>
                                {/* Office location(s) as assigned + Work From Home only while a Pending / Approved application covers today */}
                                <select id="att-location" data-testid="att-location"
                                    value={wfhMode === "WFH" ? "WFH" : `OFFICE:${officeChoice || officeOptions[0].id}`}
                                    onChange={e => {
                                        const v = e.target.value;
                                        if (v === "WFH") setWfhMode("WFH"); else { setWfhMode("OFFICE"); setOfficeChoice(v.slice(7)); }
                                        setGeoStatus("idle"); setWithinRadius(false); setDistanceKm(null); setClockInError(null);
                                    }}
                                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2.5 text-xs text-white outline-none focus:border-emerald-500/50">
                                    {officeOptions.map(o => <option key={o.id} value={`OFFICE:${o.id}`}>{o.label}</option>)}
                                    <option value="WFH" data-testid="att-location-wfh">Work From Home (WFH) — {todaysWfhApp?.status === "Approved" ? "Approved" : "Pending Approval"}</option>
                                </select>
                                {wfhMode === "WFH" && <p className="text-[10px] text-zinc-500">No campus location or dress-code photo needed. Work location: {todaysWfhApp?.workLocation || "as in your application"}.</p>}
                                {wfhMode === "WFH" && todaysWfhApp?.status === "Pending" && (
                                    <p className="text-[10px] text-amber-300" data-testid="att-wfh-provisional">Your WFH application {todaysWfhApp.id} is pending — this attendance is provisional until it is approved.</p>
                                )}
                            </div>
                        )}
                        {!showMapForm && !isDefaulter && !isHolidayToday && (
                            <button onClick={handleCheckIn} disabled={clockBusy || (isWFH ? false : (!canUseLocation || !dressCodeUrl))} data-testid="clock-in-btn"
                                className={cn("w-full py-3.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all",
                                    !clockBusy && (isWFH || (canUseLocation && dressCodeUrl)) ? "bg-green-500 hover:bg-green-600 text-white shadow-lg shadow-green-500/20" : "bg-zinc-800 text-zinc-500 cursor-not-allowed border border-zinc-700"
                                )}>{clockBusy ? <Loader2 size={16} className="animate-spin" /> : <LogIn size={16} />} Clock In {isWFH ? "(WFH)" : ""}</button>
                        )}
                    </div>
                )}

                {hasCheckedIn && !hasCheckedOut && !todaysMapRequest && (
                    <div className="space-y-3 pt-2">
                        <div className="p-3 bg-green-500/5 border border-green-500/20 rounded-xl flex items-center gap-3">
                            {todaysRecord?.dressCodeImageUrl && <img src={todaysRecord.dressCodeImageUrl} alt="Dress" className="w-10 h-10 rounded-lg object-cover border border-zinc-700" />}
                            <div><p className="text-xs font-bold text-green-400">Clocked in at {todaysRecord?.clockIn}</p><p className="text-[9px] text-zinc-500">Location: {locName(todaysRecord?.location)}</p>{emp.role === "HOI" && (todaysRecord as any)?.locationVisits?.[0]?.locationMatchStatus && <p className={cn("text-[9px] font-bold", (todaysRecord as any).locationVisits[0].locationMatchStatus === "unmatched" ? "text-red-400" : "text-emerald-400")} data-testid="att-first-status">Location Status: {(todaysRecord as any).locationVisits[0].locationMatchStatus === "unmatched" ? "No Location Match" : "Assigned Location Matched"}</p>}</div>
                        </div>
                        {multiLocation && (
                            <div className="p-3 rounded-xl border border-sky-500/20 bg-sky-500/[0.04] space-y-2" data-testid="att-visits">
                                <VisitTimeline rec={todaysRecord} title="Today's Location Visits" />
                                {visit.detected ? (
                                    <div className="p-2.5 rounded-lg bg-zinc-950/60 border border-zinc-800 space-y-1" data-testid="att-visit-confirm">
                                        <p className="text-[11px] text-white"><span className="text-zinc-500">Detected Location:</span> <b>{visit.detected.name}</b></p>
                                        <p className="text-[11px] text-white"><span className="text-zinc-500">Clock-In Location:</span> <b>{visit.detected.name}</b></p>
                                        <p className="text-[11px] text-white"><span className="text-zinc-500">Current Time:</span> <b>{istHHMM(serverNow() || new Date())}</b></p>
                                        {emp.role === "HOI" && <p className={cn("text-[11px] font-bold", visit.unmatched ? "text-red-400" : "text-emerald-400")} data-testid="att-visit-status">Location Status: {visit.unmatched ? "No Location Match" : "Assigned Location Matched"}</p>}
                                        {!!visit.detected.ambiguous?.length && <p className="text-[10px] text-amber-300">You are also inside: {visit.detected.ambiguous.map(a => a.name).join(", ")}. The nearest location is used.</p>}
                                        <div className="flex gap-2 pt-1">
                                            <button onClick={confirmVisit} disabled={visit.busy} data-testid="att-visit-confirm-btn"
                                                className="flex-1 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 text-zinc-950 text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-50">{visit.busy ? <Loader2 size={13} className="animate-spin" /> : <LogIn size={13} />} Confirm Clock-In</button>
                                            <button onClick={() => setVisit({})} className="px-3 py-2 rounded-lg border border-zinc-700 text-zinc-300 text-xs font-bold">Cancel</button>
                                        </div>
                                    </div>
                                ) : (
                                    <button onClick={detectVisitLocation} disabled={visit.busy} data-testid="att-visit-btn"
                                        className="w-full py-2.5 rounded-lg border border-sky-500/30 bg-sky-500/10 hover:bg-sky-500/20 text-sky-300 text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-50">
                                        {visit.busy ? <Loader2 size={13} className="animate-spin" /> : <Navigation size={13} />} Clock In at Another Location
                                    </button>
                                )}
                                {visit.info && <p className="text-[10px] text-sky-300" data-testid="att-visit-info">{visit.info}</p>}
                                {visit.error && (
                                    <div className="text-[10px] text-red-400 space-y-1" data-testid="att-visit-error">
                                        {visit.unmatched && <UnmatchedLocation address={visit.unmatched.address} time={visit.unmatched.time} />}
                                        <p>{visit.error}</p>
                                        {visit.unassigned && <a href="/tickets" className="inline-block text-sky-300 underline">Request location access</a>}
                                    </div>
                                )}
                            </div>
                        )}
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
                        <div><p className="text-xs font-bold text-blue-400">Day Complete</p><p className="text-[9px] text-zinc-500">{todaysRecord?.clockIn} → {todaysRecord?.clockOut} · {locName(todaysRecord?.location)}</p></div>
                        {todaysRecord?.flags.earlyOut && <span className="text-[8px] font-bold text-yellow-400 bg-yellow-500/10 px-2 py-0.5 rounded-full border border-yellow-500/20 ml-auto">🟡 Early Out</span>}
                    </div>
                )}
                {hasCheckedOut && !!(todaysRecord as any)?.locationVisits?.length && (
                    <div className="mt-2 p-3 rounded-xl border border-sky-500/20 bg-sky-500/[0.04]"><VisitTimeline rec={todaysRecord} title="Today's Location Visits" /></div>
                )}
            </div>

            {/* Attendance Log */}
            <div className="bg-zinc-900/80 border border-zinc-800/50 rounded-2xl overflow-hidden">
                <div className="p-4 border-b border-zinc-800/50 flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2"><History size={14} className="text-zinc-400" /><h3 className="text-sm font-semibold text-white">Attendance Log</h3></div>
                    {/* Date filter: records of one day (IST attendance date); Today / Clear */}
                    <div className="flex flex-wrap items-center gap-2 sm:ml-auto order-last w-full sm:w-auto" data-testid="log-date-filter">
                        <label className={cn("flex items-center gap-2 h-8 px-2.5 rounded-lg border bg-zinc-950/60 cursor-pointer", logDate ? "border-primary/40" : "border-zinc-800")}>
                            <Calendar size={13} className={logDate ? "text-primary" : "text-zinc-400"} />
                            <input type="date" value={logDate} max={currentDate || undefined} onChange={e => { setLogDate(e.target.value); setLogPage(0); }}
                                className="bg-transparent text-[11px] text-white outline-none [color-scheme:dark] w-[118px]" data-testid="log-date" aria-label="Show attendance for date" />
                        </label>
                        <button onClick={() => { setLogDate(currentDate || ""); setLogPage(0); }} data-testid="log-date-today"
                            className={cn("h-8 px-3 rounded-lg border text-[11px] font-bold", logDate && logDate === currentDate ? "border-primary/40 bg-primary/10 text-primary" : "border-zinc-800 text-zinc-300 hover:text-white")}>Today</button>
                        {logDate && <button onClick={() => { setLogDate(""); setLogPage(0); }} data-testid="log-date-clear"
                            className="h-8 px-3 rounded-lg border border-zinc-800 text-[11px] font-bold text-zinc-400 hover:text-white flex items-center gap-1"><X size={12} /> Clear Filter</button>}
                        {logDate && <span className="text-[11px] text-zinc-400" data-testid="log-date-label">Showing <b className="text-white">{logDate.split("-").reverse().join("-")}</b></span>}
                    </div>
                    <div className="flex gap-1 p-1 rounded-lg bg-zinc-950/60 border border-zinc-800" data-testid="log-tabs">
                        {([["office", "Attendance"], ["wfh", "WFH Attendance"], ["all", "All Attendance"]] as const).map(([k, l]) => (
                            <button key={k} onClick={() => { setLogTab(k); setLogPage(0); }} data-testid={`log-tab-${k}`}
                                className={cn("px-3 py-1 rounded-md text-[11px] font-bold transition-colors", logTab === k ? "bg-zinc-800 text-white" : "text-zinc-400 hover:text-white")}>{l}</button>
                        ))}
                    </div>
                </div>
                <div className="overflow-x-auto -mx-2 sm:mx-0">
                    <div className="min-w-[720px]">
                        <table className="w-full" data-testid="attendance-log">
                            <thead>
                                <tr className="border-b border-zinc-800/50 text-[9px] text-zinc-500 uppercase tracking-widest">
                                    <th className="text-left px-3 py-3">Date</th>
                                    <th className="text-left px-3 py-3">Attendance Status</th>
                                    <th className="text-left px-3 py-3">Marked By</th>
                                    <th className="text-left px-3 py-3">In</th>
                                    <th className="text-left px-3 py-3">Out</th>
                                    <th className="text-left px-3 py-3">Location</th>
                                    <th className="text-left px-3 py-3">Photo</th>
                                    <th className="text-left px-3 py-3">Flags</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-800/50">
                                {logRows.length === 0 && <tr><td colSpan={8} className="px-3 py-8 text-center text-xs text-zinc-500">{logDate ? `No attendance record on ${logDate.split("-").reverse().join("-")}.` : logTab === "wfh" ? "No Work From Home attendance yet." : "No attendance records yet."}</td></tr>}
                                {logRows.slice(logPage * LOG_PAGE, logPage * LOG_PAGE + LOG_PAGE).map((log, index) => (
                                    <tr key={log.id || (log as any)._id || index} data-testid="att-row" data-date={log.date} className="hover:bg-zinc-800/20 transition-colors text-xs">
                                        <td className="px-3 py-3 text-white font-medium whitespace-nowrap">
                                            {log.date ? log.date.split("-").reverse().join("-") : "—"}
                                        </td>
                                        <td className="px-3 py-3" data-testid="att-status">
                                            <span className={cn("text-[9px] font-bold px-2 py-0.5 rounded-full border whitespace-nowrap",
                                                log.status === "Absent" ? "text-red-400 bg-red-500/10 border-red-500/20"
                                                    : isHrMarked(log) ? "text-sky-300 bg-sky-500/10 border-sky-500/20"
                                                        : "text-green-400 bg-green-500/10 border-green-500/20")}>{statusLabel(log)}</span>
                                            <span className="ml-1"><WfhBadge rec={log} /></span>
                                        </td>
                                        <td className="px-3 py-3 text-zinc-400 whitespace-nowrap" data-testid="att-marked-by">{markedBy(log)}</td>
                                        <td className="px-3 py-3 text-zinc-300">{log.clockIn || "—"}</td>
                                        <td className="px-3 py-3 text-zinc-300">{log.clockOut || "—"}</td>
                                        <td className="px-3 py-3 text-zinc-400">{locName(log.location)}{(log as any).clockOutLocation && (log as any).clockOutLocation !== log.location ? <span className="block text-[10px] text-zinc-500">Out: {locName((log as any).clockOutLocation)}</span> : null}<VisitList rec={log} /></td>
                                        <td className="px-3 py-3">
                                            {log.dressCodeImageUrl || (log as any).clockOutImageUrl ? (
                                                <div className="flex flex-col gap-0.5" data-testid="att-photos">
                                                    {log.dressCodeImageUrl && <a href={log.dressCodeImageUrl} target="_blank" rel="noopener" className="text-primary hover:underline flex items-center gap-1 whitespace-nowrap"><ImageIcon size={12} /> {(log as any).clockOutImageUrl ? `In · ${log.clockIn || ""}` : "View"}</a>}
                                                    {(log as any).clockOutImageUrl && <a href={(log as any).clockOutImageUrl} target="_blank" rel="noopener" className="text-primary hover:underline flex items-center gap-1 whitespace-nowrap"><ImageIcon size={12} /> Out · {log.clockOut || ""}</a>}
                                                </div>
                                            ) : <span className="text-zinc-600">—</span>}
                                        </td>
                                        <td className="px-3 py-3">
                                            <div className="flex gap-1 flex-wrap">
                                                <MarkedBadge rec={log} />
                                                {shownFlags(log).map(([k]) => (
                                                    <span key={k} className={cn("text-[8px] font-bold px-1.5 py-0.5 rounded-full", FLAG_CONFIG[k]?.color || "text-zinc-400 bg-zinc-800")}>
                                                        {FLAG_CONFIG[k]?.emoji} {FLAG_CONFIG[k]?.label || k}
                                                    </span>
                                                ))}
                                                {shownFlags(log).length === 0 && !isHrMarked(log) && !lateJ.byDate.get(log.date) && <span className="text-[8px] text-zinc-600">Clean</span>}
                                                {log.employeeId === user.id && <LateJustificationTag day={lateJ.byDate.get(log.date)} onJustify={d => { setLateMsg(""); setLateForm(d); }} />}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
                {logRows.length > LOG_PAGE && (
                    <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-zinc-800/50 text-[11px]" data-testid="log-pager">
                        <span className="text-zinc-400" data-testid="log-range">{logPage * LOG_PAGE + 1}–{Math.min(logRows.length, (logPage + 1) * LOG_PAGE)} of {logRows.length}</span>
                        <div className="flex gap-2">
                            <button onClick={() => setLogPage(p => Math.max(0, p - 1))} disabled={logPage === 0} data-testid="log-prev"
                                className="px-3 py-1.5 rounded-lg border border-zinc-700 text-zinc-200 font-bold disabled:opacity-40 disabled:cursor-not-allowed hover:border-zinc-500">‹ Previous</button>
                            <button onClick={() => setLogPage(p => Math.min(logPages - 1, p + 1))} disabled={logPage >= logPages - 1} data-testid="log-next"
                                className="px-3 py-1.5 rounded-lg border border-zinc-700 text-zinc-200 font-bold disabled:opacity-40 disabled:cursor-not-allowed hover:border-zinc-500">Next ›</button>
                        </div>
                    </div>
                )}
            </div>
            {/* Own Late / Early / Missing Clock-Out alerts (hidden when there are none) */}
            {lateMsg && <p className="text-[11px] text-emerald-300 px-1" data-testid="late-justification-msg">{lateMsg}</p>}
            {lateForm && <LateJustificationModal key={lateForm.date} day={lateForm} user={user} onClose={() => setLateForm(null)} onSubmitted={m => { setLateForm(null); setLateMsg(m); lateJ.reload(); }} />}
            <MyAttendanceAlerts />

            <WorkFromHomeSection open={wfhFormOpen} onClose={() => setWfhFormOpen(false)} canApply={canApplyWfh(user as any)} onChanged={loadMyWfh} />
            </>)}

            {showsWfhTabs && (
                <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2" data-testid="att-tabs">
                    {([...(showsTeamRoster ? [["regular", "Regular Attendance", Users]] : []), ["wfh-log", "Work From Home Log", Home], ["wfh-applications", "WFH Applications & Approvals", FileText], ...(isHRorFounder ? [["violations", "Attendance Violations", AlertTriangle], ["late-justifications", "Late Clock-In Justifications", Clock]] : [])] as [typeof rosterTab, string, any][]).map(([k, l, Icon]) => {
                        const active = rosterTab === k || (k === "wfh-log" && !showsTeamRoster && rosterTab === "regular");
                        return (
                            <button key={k} onClick={() => setRosterTab(k)} data-testid={`att-tab-${k}`} aria-pressed={active}
                                className={cn("flex items-center justify-center sm:justify-start gap-2 px-4 py-2.5 rounded-xl border text-xs font-semibold transition-colors text-left",
                                    active ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300 shadow-sm" : "bg-zinc-900/80 border-zinc-800 text-zinc-300 hover:border-zinc-600 hover:text-white")}>
                                <Icon size={14} className={active ? "text-emerald-400" : "text-zinc-500"} /> {l}
                            </button>
                        );
                    })}
                </div>
            )}
            {showsWfhTabs && (rosterTab === "wfh-log" || (!showsTeamRoster && rosterTab === "regular")) && (
                <div className="bg-zinc-900/80 border border-zinc-800/50 rounded-2xl p-5 space-y-4">
                    <h2 className="text-sm font-bold text-white flex items-center gap-2"><Home size={16} className="text-emerald-400" /> Work From Home Attendance Log</h2>
                    <WfhAttendanceLog />
                </div>
            )}
            {showsWfhTabs && rosterTab === "wfh-applications" && <WfhApprovalBoard />}
            {teamOn && isHRorFounder && rosterTab === "violations" && <AttendanceViolationsBoard />}
            {teamOn && isHRorFounder && rosterTab === "late-justifications" && <LateJustificationsBoard />}
            {showsTeamRoster && (!showsWfhTabs || rosterTab === "regular") && (
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
                            <span className="text-lg font-black text-white">{teamAttendanceList.filter((l: any) => l.status === "Working" || l.status === "Clocked Out" || l.status === "No Clock-out").length}</span>
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
                            <span className="text-xs font-bold text-red-400 block">No Clock-In Today</span>
                            <span className="text-lg font-black text-white">{teamAttendanceList.filter((l: any) => l.status === "Absent" || l.status === "No Clock-in" || l.status === "Leave Requested").length}</span>
                        </div>
                        {([
                            ["Late Clock-In", teamAttendanceList.filter(isLateClockIn).length, "text-yellow-400", "bg-yellow-500/20 border-yellow-500/50 shadow-lg shadow-yellow-500/10 scale-[1.02]", "bg-yellow-500/5 border-yellow-500/20 hover:bg-yellow-500/10"],
                            ["No Clock-out", teamAttendanceList.filter((l: any) => l.status === "No Clock-out").length, "text-teal-300", "bg-teal-500/20 border-teal-500/50 shadow-lg shadow-teal-500/10 scale-[1.02]", "bg-teal-500/5 border-teal-500/20 hover:bg-teal-500/10"],
                            ["Early Clock-Out", teamAttendanceList.filter(isEarlyClockOut).length, "text-purple-400", "bg-purple-500/20 border-purple-500/50 shadow-lg shadow-purple-500/10 scale-[1.02]", "bg-purple-500/5 border-purple-500/20 hover:bg-purple-500/10"],
                        ] as [string, number, string, string, string][]).map(([key, count, text, on, off]) => (
                            <div key={key} data-testid={`roster-filter-${key}`}
                                onClick={() => setFilterStatus(prev => prev === key ? "All" : key)}
                                className={cn("cursor-pointer transition-all border p-3 rounded-xl flex items-center justify-between", filterStatus === key ? on : off)}
                            >
                                <span className={cn("text-xs font-bold block", text)}>{key === "No Clock-out" ? "No Clock-Out" : key}</span>
                                <span className="text-lg font-black text-white">{count}</span>
                            </div>
                        ))}
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
                                        {isHRorFounder && <th className="px-4 py-3 font-bold text-center">Action</th>}
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
                                                <span className={cn("inline-block whitespace-nowrap px-2 py-0.5 rounded-full text-[9px] font-bold border",
                                                    status === "Working" ? "bg-green-500/10 text-green-400 border-green-500/20" :
                                                        status === "Clocked Out" ? "bg-blue-500/10 text-blue-400 border-blue-500/20" :
                                                            status === "Holiday" ? "bg-amber-500/10 text-amber-500 border-amber-500/20" :
                                                                status === "On Leave" ? "bg-purple-500/10 text-purple-400 border-purple-500/20" :
                                                                    status === "Leave Requested" ? "bg-rose-500/10 text-rose-400 border-rose-500/20" :
                                                                        status === "No Clock-out" ? "bg-orange-500/10 text-orange-400 border-orange-500/20" :
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
                                                    <span className="text-zinc-400">{locName(record.location)} <WfhBadge rec={record} /><VisitList rec={record} /></span>
                                                ) : (
                                                    <span className="text-zinc-500 italic">Scheduled: {scheduledLocation || "—"}</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex flex-col gap-1.5 min-w-[120px]">
                                                    {record ? (
                                                        <div className="flex gap-1 flex-wrap">
                                                            <MarkedBadge rec={record} />
                                                            {status === "No Clock-out" && <span className={ROSTER_FLAG_STYLE.noClockOut} data-testid="flag-no-clock-out">⏳ No Clock-Out</span>}
                                                            {shownFlags(record).length > 0 ? (
                                                                shownFlags(record).map(([k]) => (
                                                                    <span key={k} className={cn("text-[8.5px] font-bold px-1.5 py-0.5 rounded-sm flex items-center gap-1", FLAG_CONFIG[k]?.color || "text-zinc-400 bg-zinc-800")}>
                                                                        {FLAG_CONFIG[k]?.emoji} {FLAG_CONFIG[k]?.label || k}
                                                                    </span>
                                                                ))
                                                            ) : isHrMarked(record) || status === "No Clock-out" ? null : <span className="text-[10px] text-zinc-600">Clean</span>}
                                                        </div>
                                                    ) : status === "Absent" || status === "No Clock-in"
                                                        ? <div className="flex"><span className={ROSTER_FLAG_STYLE.noClockIn} data-testid="flag-no-clock-in">🚫 No Clock-In</span></div>
                                                        : <span className="text-[10px] text-zinc-600">—</span>}

                                                    {isHRorFounder && record?.dressCodeImageUrl && record.dressCodeStatus === "Pending" && (
                                                        <div className="flex gap-1 mt-1">
                                                            <button
                                                                onClick={() => resolveDressCodeCheck(record.id || (record as any)._id, "Approved")}
                                                                className="text-[8px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.5 rounded-sm hover:bg-emerald-500/30 font-bold"
                                                            >
                                                                ✓ Approve Dress
                                                            </button>
                                                            <button
                                                                onClick={() => setDressRejecting({ id: record.id || (record as any)._id, name: employee?.name, date: record.date })}
                                                                className="text-[8px] bg-red-500/20 text-red-400 border border-red-500/30 px-1.5 py-0.5 rounded-sm hover:bg-red-500/30 font-bold"
                                                            >
                                                                ✗ Reject
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                            {isHRorFounder && (
                                                <td className="px-4 py-3 text-center">
                                                    {status === "Absent" || status === "No Clock-in" ? (
                                                        <button 
                                                            onClick={() => {
                                                                if (confirm(`Mark ${employee.name} as Present for ${selectedGlobalDate}?`)) {
                                                                    overrideAttendance(employee.id, selectedGlobalDate, "Present");
                                                                }
                                                            }}
                                                            className="text-[10px] font-bold bg-green-500/10 text-green-400 border border-green-500/20 px-2 py-1 rounded hover:bg-green-500/20 transition-all"
                                                        >
                                                            Mark Present
                                                        </button>
                                                    ) : (
                                                        <button 
                                                            onClick={() => {
                                                                if (confirm(`Mark ${employee.name} as Absent for ${selectedGlobalDate}?`)) {
                                                                    overrideAttendance(employee.id, selectedGlobalDate, "Absent");
                                                                }
                                                            }}
                                                            className="text-[10px] font-bold bg-red-500/10 text-red-400 border border-red-500/20 px-2 py-1 rounded hover:bg-red-500/20 transition-all"
                                                        >
                                                            Mark Absent
                                                        </button>
                                                    )}
                                                </td>
                                            )}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
            {selfOn && (<>
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
            </>)}
            {dressRejecting && <DressCodeRejectDialog employeeName={dressRejecting.name} date={dressRejecting.date} onCancel={() => setDressRejecting(null)}
                onConfirm={async r => { const res = await resolveDressCodeCheck(dressRejecting.id, "Rejected", r); if (!res || res.ok) setDressRejecting(null); return res; }} />}
        </div>
    );
}

/* HOI / OM multiple-location attendance: the day's location visits (one attendance day, many locations) */
const VISIT_LABEL: Record<string, string> = { CLOCK_IN: "Clock-In", LOCATION_CLOCK_IN: "Location Clock-In", CLOCK_OUT: "Clock-Out", UNMATCHED_ATTEMPT: "Clock-In Refused" };
const hm = (t?: string) => (t || "").slice(0, 5);
const NO_ADDRESS = "Coordinates Available — Address Unavailable";
const sortedVisits = (rec: any): any[] => [...(rec?.locationVisits || [])].sort((a, b) => (new Date(a.at || 0).getTime() - new Date(b.at || 0).getTime()) || String(a.time || "").localeCompare(String(b.time || "")));
/** HOI: GPS position outside every assigned location (address from reverse geocoding) */
function UnmatchedLocation({ address, time }: { address?: string | null; time?: string }) {
    return (
        <div className="text-[10px] space-y-0.5" data-testid="att-unmatched">
            <p className="text-red-400 font-bold">Location Status: No Location Match</p>
            <p className="text-zinc-300">Current Location: <b>{address || NO_ADDRESS}</b></p>
            {time && <p className="text-zinc-400">Clock-In Time: {hm(time)}</p>}
        </div>
    );
}
function VisitTimeline({ rec, title }: { rec: any; title: string }) {
    const visits: any[] = sortedVisits(rec);
    if (!visits.length) return null;
    const places = new Set(visits.filter(v => v.event !== "CLOCK_OUT" && v.event !== "UNMATCHED_ATTEMPT").map(v => v.locationId)).size;
    return (
        <div data-testid="att-visit-timeline">
            <p className="text-[10px] font-bold uppercase tracking-widest text-sky-300 mb-1.5">{title} · {places} location{places === 1 ? "" : "s"}</p>
            <ol className="space-y-1">
                {visits.map((v, i) => {
                    const unmatched = v.locationMatchStatus === "unmatched";
                    return (
                        <li key={v.id || i} className="text-[11px]" data-testid="att-visit-row" data-status={v.locationMatchStatus || ""}>
                            <div className="flex items-center gap-2">
                                <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", v.event === "CLOCK_OUT" || unmatched ? "bg-red-400" : "bg-sky-400")} />
                                <span className="text-white font-semibold tabular-nums w-11">{hm(v.time)}</span>
                                <span className={cn("truncate", unmatched ? "text-red-300" : "text-zinc-300")}>{unmatched ? (v.detectedAddress || NO_ADDRESS) : (v.locationName || v.locationId)}</span>
                                <span className="text-[9px] text-zinc-500 ml-auto whitespace-nowrap">{VISIT_LABEL[v.event] || v.event}</span>
                            </div>
                            {v.locationMatchStatus && (
                                <p className={cn("pl-[3.6rem] text-[9px]", unmatched ? "text-red-400" : "text-emerald-400")}>
                                    {unmatched ? "No Location Match" : "Assigned Location Matched"}
                                    {!unmatched && v.detectedAddress ? <span className="text-zinc-500"> · {v.detectedAddress}</span> : null}
                                </p>
                            )}
                        </li>
                    );
                })}
            </ol>
        </div>
    );
}
function VisitList({ rec }: { rec: any }) {
    const visits: any[] = sortedVisits(rec);
    if (visits.length < 2) return null;
    return (
        <span className="block mt-0.5 text-[10px] text-zinc-500" data-testid="att-visit-list">
            {visits.map(v => `${hm(v.time)} ${v.event === "CLOCK_OUT" ? "Out" : v.locationMatchStatus === "unmatched" ? `${v.detectedAddress || "Unknown place"} (No Location Match)` : v.locationName || v.locationId}`).join(" → ")}
        </span>
    );
}