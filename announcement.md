"use client";
import { useAuth } from "@/context/AuthContext";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { INDIAN_HOLIDAYS_2026, FLAG_CONFIG } from "@/lib/colleges";
import {
    Calendar, Star, Megaphone, FileText, MessageSquare, Send, X, Clock, AlertTriangle, Users,
    ChevronRight, Gift, Trophy, Receipt, Ticket, Shield, Bot, Cake, Flag, Bell, Eye, ExternalLink, Activity
} from "lucide-react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";

// â”€â”€â”€ ATTENDANCE CALENDAR â”€â”€â”€
function AttendanceCalendar({ records, holidays }: { records: any[]; holidays: any[] }) {
    const [viewDate, setViewDate] = useState(new Date());
    const [calData, setCalData] = useState<{ year: number; month: number; daysInMonth: number; monthName: string; todayDate: number; todayMonth: number; todayYear: number; firstDay: number } | null>(null);

    useEffect(() => {
        const now = new Date();
        setCalData({
            year: viewDate.getFullYear(),
            month: viewDate.getMonth(),
            daysInMonth: new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0).getDate(),
            monthName: viewDate.toLocaleString("en-IN", { month: "long", year: "numeric" }),
            todayDate: now.getDate(),
            todayMonth: now.getMonth(),
            todayYear: now.getFullYear(),
            firstDay: new Date(viewDate.getFullYear(), viewDate.getMonth(), 1).getDay(),
        });
    }, [viewDate]);

    const changeMonth = (offset: number) => {
        const next = new Date(viewDate);
        next.setMonth(next.getMonth() + offset);
        setViewDate(next);
    };

    if (!calData) return <div className="h-60 flex items-center justify-center text-xs text-zinc-500">Synchronizing...</div>;



    const isCurrentMonth = calData.month === calData.todayMonth && calData.year === calData.todayYear;

    return (
        <div className="space-y-3">
            <div className="flex justify-between items-center px-1">
                <h3 className="text-sm font-bold text-white tracking-tight">{calData.monthName}</h3>
                <div className="flex gap-1">
                    <button onClick={() => changeMonth(-1)} className="p-1 hover:bg-zinc-800 rounded transition-colors text-zinc-400 hover:text-white">
                        <ChevronRight size={14} className="rotate-180" />
                    </button>
                    <button onClick={() => changeMonth(1)} className="p-1 hover:bg-zinc-800 rounded transition-colors text-zinc-400 hover:text-white">
                        <ChevronRight size={14} />
                    </button>
                </div>
            </div>
            {/* Day Headers */}
            <div className="grid grid-cols-7 gap-1">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d, i) => (
                    <div key={i} className={cn("text-[8px] text-center font-bold pb-1 uppercase tracking-wider",
                        d === "Sun" ? "text-red-400/70" : "text-zinc-500"
                    )}>{d}</div>
                ))}
                {Array.from({ length: calData.firstDay }).map((_, i) => <div key={`e${i}`} className="aspect-square" />)}
                {Array.from({ length: calData.daysInMonth }).map((_, i) => {
                    const day = i + 1;
                    const dateStr = `${calData.year}-${String(calData.month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                    const rec = records.find((r: any) => r.date === dateStr);
                    const holidayMatch = holidays.find((h: any) => h.date === dateStr && h.status === "Approved");
                    const indianHol = INDIAN_HOLIDAYS_2026.find(h => h.date === dateStr);
                    const isHoliday = !!holidayMatch || !!indianHol;
                    const holidayName = holidayMatch?.name || indianHol?.name || "";
                    const isToday = isCurrentMonth && day === calData.todayDate;
                    const isSunday = new Date(calData.year, calData.month, day).getDay() === 0;
                    const flags = rec?.flags || {};
                    const activeFlags = Object.entries(flags).filter(([_, v]) => v);

                    let bg = "bg-zinc-800/50"; let textColor = "text-zinc-500";
                    if (isHoliday) { bg = "bg-purple-500/20"; textColor = "text-purple-400"; }
                    else if (isSunday) { bg = "bg-red-500/5"; textColor = "text-red-400/60"; }
                    else if (rec?.status === "Present") { bg = "bg-green-500/10"; textColor = "text-green-400"; }
                    else if (rec?.status === "Absent") { bg = "bg-red-500/10"; textColor = "text-red-400"; }
                    else if (rec?.status === "On Leave") { bg = "bg-blue-500/10"; textColor = "text-blue-400"; }
                    const ring = isToday ? "ring-2 ring-primary shadow-[0_0_8px_rgba(16,185,129,0.3)]" : "";

                    return (
                        <div key={day} title={isHoliday ? `🎉 ${holidayName}` : isSunday ? "Sunday" : rec?.status || ""} className={cn("relative w-full aspect-square rounded-lg flex flex-col items-center justify-center text-[10px] font-bold transition-all group overflow-hidden cursor-default", bg, textColor, ring)}>
                            <span className="z-10">{day}</span>
                            {activeFlags.length > 0 && (
                                <div className="absolute bottom-0.5 left-0 right-0 flex items-center justify-center gap-[2px]">
                                    {activeFlags.map(([k]) => (
                                        <div key={k} title={FLAG_CONFIG[k]?.label || k} className={cn("w-[5px] h-[5px] rounded-full shrink-0", FLAG_CONFIG[k]?.dotColor || "bg-zinc-500")} />
                                    ))}
                                </div>
                            )}
                            {isHoliday && <div className="absolute bottom-0.5 left-0 right-0 flex items-center justify-center gap-[2px]"><div className="w-[5px] h-[5px] rounded-full bg-green-500 shrink-0" /></div>}
                        </div>
                    );
                })}
            </div>
            {/* Status + Flag Legend */}
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 pt-2 border-t border-zinc-800/50">
                <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-green-500" /><span className="text-[8px] text-zinc-500 font-bold uppercase tracking-wider">Present</span></div>
                <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-red-500" /><span className="text-[8px] text-zinc-500 font-bold uppercase tracking-wider">Absent</span></div>
                <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-blue-500" /><span className="text-[8px] text-zinc-500 font-bold uppercase tracking-wider">On Leave</span></div>
                <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-purple-500" /><span className="text-[8px] text-zinc-500 font-bold uppercase tracking-wider">Holiday</span></div>
            </div>
            <div className="pt-2 border-t border-zinc-800/50 space-y-1.5">
                <p className="text-[8px] text-zinc-400 font-bold uppercase tracking-widest">Flag Dots</p>
                <div className="grid grid-cols-2 gap-1">
                    <div className="flex items-center gap-2"><span className="text-[7px] text-zinc-500">🟡 Late/Early/Location</span></div>
                    <div className="flex items-center gap-2"><span className="text-[7px] text-zinc-500">🔴 Misconduct</span></div>
                    <div className="flex items-center gap-2"><span className="text-[7px] text-zinc-500">🟠 Dress Code</span></div>
                    <div className="flex items-center gap-2"><span className="text-[7px] text-zinc-500">⚫ Meeting Absent</span></div>
                    <div className="flex items-center gap-2"><span className="text-[7px] text-zinc-500">🔵 Performance</span></div>
                </div>
            </div>
            <Link href="/flag-calendar" className="flex items-center gap-1.5 text-[9px] text-primary font-bold hover:underline pt-1">
                <ExternalLink size={10} /> View Full Flag Calendar
            </Link>
        </div>
    );
}

// â”€â”€â”€ CHATBOT â”€â”€â”€
function FloatingChatbot({ sops }: { sops: any[] }) {
    const [open, setOpen] = useState(false);
    const [msgs, setMsgs] = useState<{ role: string; text: string; isTicketPrompt?: boolean }[]>([
        { role: "bot", text: "Hi! I'm the GoG SOP Assistant. Ask me about dress code, attendance, leaves, WFH, conduct, or any office policy. Type 'ticket' to raise a support ticket." }
    ]);
    const [input, setInput] = useState("");

    // SOP Knowledge Base — keyword-to-answer mapping
    const sopKB: { keywords: string[]; answer: string }[] = [
        { keywords: ["dress", "code", "uniform", "attire", "blazer", "shirt", "shoe", "formal"], answer: "📋 **Dress Code (SOP 3.1):** White formal shirt with collar, black pant with belt, black formal blazer, formal shoes. Casual attire is strictly prohibited.\n\n⚠️ Violations: 1st-2nd = warning, 3rd = 10% fine, 4th = 20% fine, 5th+ = 30% fine of daily gross salary." },
        { keywords: ["attendance", "clock", "timing", "geotag", "late", "punch"], answer: "⏰ **Attendance (SOP 3.2):** Post geotag attendance at official hours. 2-min grace period. Photo must be uploaded within 30 minutes of clock-in.\n\n⚠️ Late arrivals: 4th = half-day cut, 5th = full-day cut, 6th+ = 2 days' cut. Forgot upload = ₹500 fine." },
        { keywords: ["leave", "vacation", "casual", "emergency", "cl", "el", "pl"], answer: "🏖️ **Leave Policy (SOP 3.7/3.8):** 12 paid leaves/year, 1 per month. More than 1 = unpaid.\n\n• **Casual Leave:** Faculty: 18hrs advance to HoI → email HR. OM: 24hrs advance.\n• **Emergency Leave:** Call manager first → email HR with proof after recovery.\n• Only 1 professor per college per day can take leave." },
        { keywords: ["wfh", "work from home", "remote", "home"], answer: "🏠 **WFH Policy (SOP 3.9):** Only for OMs in emergencies with evidence. HoI assigns tasks — uncompleted = marked as leave. Submit by 9 PM. Must attend 1 Ops meeting. Inform 15hrs before. WFH = half-day pay." },
        { keywords: ["office", "premises", "hour", "lunch", "break"], answer: "🏢 **Office Premises (SOP 3.3):** All employees must be present during working hours. Can leave only during lunch break. Must post 'Going for Lunch' and 'Returned' in attendance channel." },
        { keywords: ["conduct", "personal", "work", "focus", "professional", "boundary"], answer: "💼 **Office Conduct (SOP 3.4):** Stay focused on official tasks. No personal activities during work. Faculty must maintain professional boundaries with students." },
        { keywords: ["college", "admin", "politics", "negativity", "rumour"], answer: "🤝 **Professionalism (SOP 3.5):** Maintain professionalism with college administration. No spreading negativity. Report office politics/rumours directly to HR." },
        { keywords: ["availability", "phone", "slack", "email", "google meet", "meeting", "absent"], answer: "📱 **Availability (SOP 3.6):** Must be available on calls, Slack, and emails. If unable to join Google Meet → inform 10 min in advance on Slack tagging manager & HR. Absent without informing = disciplinary action." },
        { keywords: ["harassment", "bully", "misconduct", "complaint"], answer: "🛡️ **Harassment-Free Workplace (SOP 3.12):** Zero tolerance policy. Report any harassment to HR immediately. Guilty employees face suspension or termination." },
        { keywords: ["smoking", "tobacco", "chewing"], answer: "🚫 **No Smoking (SOP 3.11):** Smoking and chewing tobacco are strictly prohibited in office. Violations result in disciplinary action, including possible suspension." },
        { keywords: ["probation", "notice", "fnf", "settlement", "resign", "exit"], answer: "📝 **Probation (SOP 3.13):** 6-month probation period. Notice: 7 or 30 days. FNF settlement within 45 calendar days. Disbursement between 15th-20th of following month." },
        { keywords: ["performance", "rating", "termination", "pip", "star"], answer: "📊 **Performance (SOP 3.14):** Student rating below 4.2 for 3 consecutive weeks → 3 formal warnings. No improvement → termination with 7-day notice. Decision by HoI + HR." },
        { keywords: ["mom", "minute", "ops", "dashboard", "update"], answer: "📋 **OM Protocols (SOP 3.10):** Inform HoI 10 min before if unable to join Ops meeting. Mandatory to mention presence/absence in MoM. Update dashboard channel regularly." },
        { keywords: ["fine", "penalty", "deduction", "salary", "cut"], answer: "💰 **Fines & Penalties:** Forgot attendance = ₹500. Photo not within 30min (3rd instance+) = ₹100 each. Emergency leave without proof = ₹500 + unpaid. Dress code: 3rd = 10%, 4th = 20%, 5th+ = 30% cut." },
        { keywords: ["hello", "hi", "hey", "help", "what can you"], answer: "👋 Hello! I can help you with:\n• Dress Code policy\n• Attendance & timing rules\n• Leave policies (Faculty & OM)\n• WFH policy\n• Office conduct & professionalism\n• Harassment policy\n• Fines & penalties\n• Probation & notice period\n\nJust ask your question!" },
    ];

    const handleSend = () => {
        if (!input.trim()) return;
        const userMsg = input.trim().toLowerCase();
        setMsgs(prev => [...prev, { role: "user", text: input }]);
        setInput("");
        setTimeout(() => {
            if (userMsg.includes("ticket") || userMsg.includes("raise") || userMsg.includes("complain") || userMsg.includes("issue")) {
                setMsgs(prev => [...prev, { role: "bot", text: "🎫 Sure! You can raise a support ticket for your query. Click below to go to the Tickets page:", isTicketPrompt: true }]);
                return;
            }

            // Find matching SOP section by keywords
            const match = sopKB.find(kb => kb.keywords.some(kw => userMsg.includes(kw)));
            if (match) {
                setMsgs(prev => [...prev, { role: "bot", text: match.answer }]);
                // Add a follow-up: not satisfied?
                setTimeout(() => {
                    setMsgs(prev => [...prev, { role: "bot", text: "💡 Not satisfied with this answer? You can type 'ticket' to raise a query with our HR team.", isTicketPrompt: false }]);
                }, 800);
            } else {
                setMsgs(prev => [...prev, { role: "bot", text: "🤔 I couldn't find a matching SOP section for your query. Try keywords like 'dress code', 'leave', 'attendance', 'WFH', 'harassment', etc.\n\nOr type 'ticket' to raise your query with HR directly.", isTicketPrompt: false }]);
            }
        }, 500);
    };

    return (
        <>
            <button onClick={() => setOpen(!open)} className="fixed bottom-6 right-6 z-50 w-14 h-14 bg-primary rounded-2xl flex items-center justify-center text-primary-foreground shadow-2xl shadow-primary/30 hover:scale-105 transition-transform">
                {open ? <X size={20} /> : <Bot size={22} />}
            </button>
            <AnimatePresence>
                {open && (
                    <motion.div initial={{ opacity: 0, y: 20, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 20, scale: 0.95 }}
                        className="fixed bottom-24 right-6 z-50 w-80 bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden" style={{ height: 420 }}>
                        <div className="p-3 border-b border-zinc-800 bg-primary/5 flex items-center gap-2">
                            <Bot size={16} className="text-primary" />
                            <span className="text-xs font-bold text-white">SOP Assistant</span>
                            <span className="text-[7px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-full ml-auto font-bold">TRAINED ON SOPs</span>
                        </div>
                        <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
                            {msgs.map((m, i) => (
                                <div key={i}>
                                    <div className={cn("max-w-[85%] p-2.5 rounded-xl text-[11px] leading-relaxed whitespace-pre-wrap", m.role === "bot" ? "bg-zinc-800 text-zinc-300 mr-auto" : "bg-primary/20 text-primary ml-auto")}>
                                        {m.text}
                                    </div>
                                    {m.isTicketPrompt && (
                                        <Link href="/tickets" className="mt-1.5 ml-0 inline-flex items-center gap-1.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 text-[10px] font-bold px-3 py-1.5 rounded-lg transition-colors">
                                            <Ticket size={10} /> Raise Ticket →
                                        </Link>
                                    )}
                                </div>
                            ))}
                        </div>
                        <div className="p-2 border-t border-zinc-800 flex gap-2">
                            <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && handleSend()} placeholder="Ask about SOPs..." className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-[11px] text-white outline-none" />
                            <button onClick={handleSend} className="bg-primary text-primary-foreground rounded-lg px-3"><Send size={12} /></button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}

// â”€â”€â”€ MAIN DASHBOARD â”€â”€â”€
export default function Home() {
    const { user, employees, notices, sops, attendanceRecords, holidays, performanceStars, leaves, pipRecords, reimbursements, tickets, getReportees, sopNotifications } = useAuth();
    const [mounted, setMounted] = useState(false);
    const [todayStr, setTodayStr] = useState("");
    const [selectedNotice, setSelectedNotice] = useState<any>(null);

    useEffect(() => { setMounted(true); setTodayStr(new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })); }, []);

    if (!user || !mounted) return null;

    const emp = user as any;
    const role = user.role;
    const myAttendance = attendanceRecords.filter(r => r.employeeId === user.id);
    const myLeaves = leaves.filter(l => l.employeeId === user.id);
    const currentMonthLeaves = leaves.filter(l => l.employeeId === user.id && l.status === "Approved" && new Date(l.startDate).getMonth() === new Date().getMonth()).reduce((acc, curr) => acc + curr.days, 0);
    const myPIP = pipRecords.find(p => p.employeeId === user.id && p.status === "Active");

    // Birthdays
    const today = new Date();
    const upcomingBirthdays = employees.filter(e => {
        if (!e.dateOfBirth) return false;
        const dob = new Date(e.dateOfBirth);
        const bday = new Date(today.getFullYear(), dob.getMonth(), dob.getDate());
        const diff = (bday.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
        return diff >= 0 && diff <= 30;
    }).sort((a, b) => {
        const da = new Date(a.dateOfBirth!), db = new Date(b.dateOfBirth!);
        return new Date(today.getFullYear(), da.getMonth(), da.getDate()).getTime() - new Date(today.getFullYear(), db.getMonth(), db.getDate()).getTime();
    });

    // Manager stats
    const isManagerRole = ["FOUNDER", "AD", "HOI"].includes(role);
    const reportees = (isManagerRole || role === "HR") ? getReportees(user.id) : [];
    const reporteeIds = reportees.map(r => r.id);
    const pendingLeaves = leaves.filter(l => reporteeIds.includes(l.employeeId) && l.status === "Pending");

    return (
        <div className="p-6 space-y-6 max-w-6xl mx-auto w-full">
            {/* PIP Warning Banner */}
            {myPIP && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 flex items-center gap-3">
                    <AlertTriangle size={18} className="text-red-400 shrink-0" />
                    <div><p className="text-xs font-bold text-red-400">Performance Improvement Plan Active</p><p className="text-[10px] text-red-300/70">{myPIP.disclaimer}</p></div>
                </div>
            )}

            {/* Welcome */}
            <header className="flex justify-between items-end">
                <div>
                    <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">
                        {role === "HR" ? "HR Administration" : role === "FOUNDER" ? "Founder" : ["AD", "HOI", "TL"].includes(role) ? `${role} Â· ${emp.designation || ""}` : "Employee"} Dashboard
                    </p>
                    <h1 className="text-2xl font-bold text-white tracking-tight mt-1">Welcome back, {user.name}</h1>
                </div>
                <span className="text-[9px] text-zinc-500">{todayStr}</span>
            </header>

            {/* Quick Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {!isManagerRole && role !== "HR" && role !== "FOUNDER" && <>
                    <StatCard label="Days Present" value={myAttendance.filter(r => r.status === "Present").length.toString()} color="text-green-400" icon={<Clock size={14} />} />
                    <StatCard label="Leaves Used" value={myLeaves.filter(l => l.status === "Approved").length.toString()} color="text-blue-400" icon={<Calendar size={14} />} />
                    <StatCard label="Open Tickets" value={tickets.filter(t => t.raisedBy === user.id && t.status !== "Resolved").length.toString()} color="text-amber-400" icon={<Ticket size={14} />} />
                    <StatCard label="Reimbursements" value={`â‚¹${reimbursements.filter(r => r.employeeId === user.id && r.status === "Pending").reduce((a, r) => a + r.amount, 0).toLocaleString()}`} color="text-purple-400" icon={<Receipt size={14} />} />
                </>}
                {isManagerRole && <>
                    <StatCard label="Reportees" value={reportees.length.toString()} color="text-blue-400" icon={<Users size={14} />} />
                    <StatCard label="Pending Leaves" value={pendingLeaves.length.toString()} color="text-amber-400" icon={<Calendar size={14} />} />
                    <StatCard label="Team Tickets" value={tickets.filter(t => reporteeIds.includes(t.raisedBy) && t.status !== "Resolved").length.toString()} color="text-purple-400" icon={<Ticket size={14} />} />
                    <StatCard label="Active PIPs" value={pipRecords.filter(p => reporteeIds.includes(p.employeeId) && p.status === "Active").length.toString()} color="text-orange-400" icon={<AlertTriangle size={14} />} />
                </>}
                {(role === "HR" || role === "FOUNDER") && <>
                    <StatCard label="Pending Leaves" value={leaves.filter(l => l.status === "Pending").length.toString()} color="text-cyan-400" icon={<Calendar size={14} />} />
                    <StatCard label="Open Tickets" value={tickets.filter(t => t.status === "Open").length.toString()} color="text-amber-400" icon={<Ticket size={14} />} />
                    <StatCard label="Pending Holidays" value={holidays.filter(h => h.status === "Proposed").length.toString()} color="text-blue-400" icon={<Calendar size={14} />} />
                    <StatCard label="Pending Reimb." value={reimbursements.filter(r => r.status === "Pending").length.toString()} color="text-purple-400" icon={<Receipt size={14} />} />
                </>}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {/* Attendance Calendar */}
                <div className="bg-zinc-900/80 border border-zinc-800/50 rounded-2xl p-5 lg:col-span-1">
                    <AttendanceCalendar records={myAttendance} holidays={holidays} />
                </div>

                {/* Enhanced Leaderboard */}
                <div className="bg-zinc-900/80 border border-zinc-800/50 rounded-2xl p-4 flex flex-col gap-4 overflow-hidden relative group">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -mr-16 -mt-16 blur-3xl group-hover:bg-primary/10 transition-colors" />

                    <div className="flex justify-between items-center relative z-10 shrink-0">
                        <h3 className="text-sm font-bold text-white flex items-center gap-2">
                            <Trophy size={16} className="text-yellow-400 group-hover:scale-110 transition-transform" />
                            Leaderboard
                        </h3>
                        <div className="flex items-center gap-2">
                            <span className="text-[8px] font-bold text-zinc-500 bg-zinc-800 px-1.5 py-0.5 rounded border border-zinc-700">V.2.0</span>
                            <Link href="/leaderboard" className="bg-primary/10 hover:bg-primary/20 text-primary text-[10px] font-bold px-3 py-1 rounded-lg border border-primary/20 transition-all flex items-center gap-1">
                                View More <ChevronRight size={10} />
                            </Link>
                        </div>
                    </div>

                    <div className="space-y-4 flex-1 overflow-y-auto custom-scrollbar pr-1 scroll-smooth" style={{ maxHeight: '420px' }}>
                        {/* Operation Manager of the Month */}
                        <div className="space-y-3">
                            <div className="flex justify-between items-end border-b border-border/50 pb-1.5">
                                <h4 className="text-[10px] font-black text-yellow-500 uppercase tracking-[0.1em]">OM of the Month</h4>
                                <span className="text-[8px] text-muted-foreground font-bold">MARCH 2026</span>
                            </div>
                            <div className="grid gap-2">
                                {performanceStars
                                    .filter(s => {
                                        const emp = employees.find(e => e.id === s.employeeId);
                                        return emp?.role === "OM";
                                    })
                                    .sort((a, b) => b.rating - a.rating)
                                    .slice(0, 3)
                                    .map((s, i) => {
                                        const emp = employees.find(e => e.id === s.employeeId);
                                        const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : "🥉";
                                        const att = attendanceRecords.filter(r => r.employeeId === s.employeeId);

                                        const red = att.filter(r => r.flags?.misconduct).length;
                                        const orange = att.filter(r => r.flags?.dressCode).length;
                                        const yellow = att.filter(r => r.flags?.late || r.flags?.earlyOut || r.flags?.locationDiff).length;
                                        const black = att.filter(r => r.flags?.meetingAbsent).length;
                                        const blue = att.filter(r => r.flags?.performance).length;

                                        return (
                                            <div key={s.employeeId} className={cn("relative p-2.5 rounded-xl border transition-all flex items-center gap-3 overflow-hidden",
                                                i === 0 ? "bg-gradient-to-r from-yellow-500/10 to-transparent border-yellow-500/20 shadow-lg shadow-yellow-500/5 scale-[1.02]" : "bg-zinc-800/30 border-zinc-800/50"
                                            )}>
                                                <div className="relative">
                                                    <div className={cn("w-9 h-9 rounded-lg bg-zinc-800 border flex items-center justify-center text-white text-xs font-bold shadow-lg overflow-hidden shrink-0",
                                                        i === 0 ? "border-yellow-500/30" : "border-border"
                                                    )}>
                                                        {emp?.photoUrl ? (
                                                            <img src={emp.photoUrl} alt={emp.name} className="w-full h-full object-cover" />
                                                        ) : (
                                                            <span>{emp?.name[0]}</span>
                                                        )}
                                                    </div>
                                                    <div className={cn("absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full border-2 border-zinc-900 flex items-center justify-center text-[10px] font-black shadow-xl",
                                                        i === 0 ? "bg-yellow-500 text-zinc-900" : "bg-zinc-800 text-zinc-400"
                                                    )}>{medal}</div>
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-[11px] font-bold text-white truncate">{emp?.name}</p>
                                                    <p className="text-[9px] text-muted truncate">{emp?.designation || emp?.role}</p>
                                                </div>
                                                <div className="text-right">
                                                    <div className="flex gap-0.5 justify-end">
                                                        {Array.from({ length: 5 }).map((_, j) => (
                                                            <Star key={j} size={8} className={j < Math.floor(s.stars || 0) ? "text-yellow-500 fill-yellow-500" : "text-zinc-700"} />
                                                        ))}
                                                    </div>

                                                    {/* Flags Indicator - MOVED BELOW STARS */}
                                                    <div className="flex gap-0.5 justify-end mt-1 flex-wrap" style={{ maxWidth: '70px' }}>
                                                        {Array.from({ length: red }).map((_, idx) => <span key={`r${idx}`} title="Misconduct"><Flag size={10} className="text-red-500 fill-red-500/20" /></span>)}
                                                        {Array.from({ length: orange }).map((_, idx) => <span key={`o${idx}`} title="Dress Code"><Flag size={10} className="text-orange-500 fill-orange-500/20" /></span>)}
                                                        {Array.from({ length: yellow }).map((_, idx) => <span key={`y${idx}`} title="Late/Timeline"><Flag size={10} className="text-yellow-500 fill-yellow-500/20" /></span>)}
                                                        {Array.from({ length: black }).map((_, idx) => <span key={`b${idx}`} title="Meeting Absent"><Flag size={10} className="text-zinc-600 fill-zinc-900" /></span>)}
                                                        {Array.from({ length: blue }).map((_, idx) => <span key={`bl${idx}`} title="Performance"><Flag size={10} className="text-blue-500 fill-blue-500/20" /></span>)}
                                                    </div>

                                                    <p className="text-[10px] font-black text-white mt-1">{s.rating || 0}</p>
                                                </div>
                                            </div>
                                        );
                                    })
                                }
                            </div>
                        </div>

                        {/* Professor of the Month */}
                        <div className="space-y-3">
                            <div className="flex justify-between items-end border-b border-border/50 pb-1.5">
                                <h4 className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.1em]">Professor of the Month</h4>
                                <span className="text-[8px] text-muted-foreground font-bold">MARCH 2026</span>
                            </div>
                            <div className="grid gap-2">
                                {performanceStars
                                    .filter(s => {
                                        const emp = employees.find(e => e.id === s.employeeId);
                                        if (!emp) return false;
                                        return (emp.role === "PROFESSOR" || emp.role === "FACULTY");
                                    })
                                    .sort((a, b) => b.rating - a.rating)
                                    .slice(0, 3)
                                    .map((s, i) => {
                                        const emp = employees.find(e => e.id === s.employeeId);
                                        const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : "🥉";
                                        const att = attendanceRecords.filter(r => r.employeeId === s.employeeId);

                                        const red = att.filter(r => r.flags?.misconduct).length;
                                        const orange = att.filter(r => r.flags?.dressCode).length;
                                        const yellow = att.filter(r => r.flags?.late || r.flags?.earlyOut || r.flags?.locationDiff).length;
                                        const black = att.filter(r => r.flags?.meetingAbsent).length;
                                        const blue = att.filter(r => r.flags?.performance).length;

                                        return (
                                            <div key={s.employeeId} className={cn("relative p-2.5 rounded-xl border transition-all flex items-center gap-3 overflow-hidden",
                                                i === 0 ? "bg-gradient-to-r from-emerald-500/10 to-transparent border-emerald-500/20 shadow-lg shadow-emerald-500/5 scale-[1.02]" : "bg-zinc-800/30 border-zinc-800/50"
                                            )}>
                                                <div className="relative">
                                                    <div className={cn("w-9 h-9 rounded-lg bg-zinc-800 border flex items-center justify-center text-white text-xs font-bold shadow-lg overflow-hidden shrink-0",
                                                        i === 0 ? "border-emerald-500/30" : "border-border"
                                                    )}>
                                                        {emp?.photoUrl ? (
                                                            <img src={emp.photoUrl} alt={emp.name} className="w-full h-full object-cover" />
                                                        ) : (
                                                            <span>{emp?.name[0]}</span>
                                                        )}
                                                    </div>
                                                    <div className={cn("absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full border-2 border-zinc-900 flex items-center justify-center text-[10px] font-black shadow-xl",
                                                        i === 0 ? "bg-emerald-500 text-zinc-900" : "bg-zinc-800 text-zinc-400"
                                                    )}>{medal}</div>
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-[11px] font-bold text-white truncate">{emp?.name}</p>
                                                    <p className="text-[9px] text-muted truncate">{emp?.designation || emp?.role}</p>
                                                </div>
                                                <div className="text-right">
                                                    <div className="flex gap-0.5 justify-end">
                                                        {Array.from({ length: 5 }).map((_, j) => (
                                                            <Star key={j} size={8} className={j < Math.floor(s.stars || 0) ? "text-yellow-400 fill-yellow-400" : "text-zinc-700"} />
                                                        ))}
                                                    </div>

                                                    {/* Flags Indicator - MOVED BELOW STARS */}
                                                    <div className="flex gap-0.5 justify-end mt-1 flex-wrap" style={{ maxWidth: '70px' }}>
                                                        {Array.from({ length: red }).map((_, idx) => <span key={`r${idx}`} title="Misconduct"><Flag size={10} className="text-red-500 fill-red-500/20" /></span>)}
                                                        {Array.from({ length: orange }).map((_, idx) => <span key={`o${idx}`} title="Dress Code"><Flag size={10} className="text-orange-500 fill-orange-500/20" /></span>)}
                                                        {Array.from({ length: yellow }).map((_, idx) => <span key={`y${idx}`} title="Late/Timeline"><Flag size={10} className="text-yellow-500 fill-yellow-500/20" /></span>)}
                                                        {Array.from({ length: black }).map((_, idx) => <span key={`b${idx}`} title="Meeting Absent"><Flag size={10} className="text-zinc-600 fill-zinc-900" /></span>)}
                                                        {Array.from({ length: blue }).map((_, idx) => <span key={`bl${idx}`} title="Performance"><Flag size={10} className="text-blue-500 fill-blue-500/20" /></span>)}
                                                    </div>

                                                    <div className="flex items-center justify-end gap-1 mt-1">
                                                        <Activity size={8} className="text-emerald-400" />
                                                        <span className="text-[9px] font-black text-white">{s.rating || 0}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })
                                }
                            </div>
                        </div>
                    </div>
                </div>

                {/* Announcements */}
                <div className="bg-zinc-900/80 border border-zinc-800/50 rounded-2xl p-4 space-y-2">
                    <div className="flex justify-between items-center">
                        <h3 className="text-sm font-bold text-white flex items-center gap-2">
                            <Megaphone size={16} className="text-amber-400" /> Latest Announcements
                            {notices.filter(n => n.createdAt === new Date().toISOString().split("T")[0]).length > 0 && (
                                <span className="text-[8px] font-bold text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded-full border border-amber-500/20">{notices.filter(n => n.createdAt === new Date().toISOString().split("T")[0]).length} new</span>
                            )}
                        </h3>
                        <Link href="/announcements" className="text-[9px] text-primary font-bold hover:underline shrink-0">View All</Link>
                    </div>
                    <div className="space-y-1.5 flex-1">
                        {notices.slice(0, 7).map(n => {
                            const isToday = n.createdAt === new Date().toISOString().split("T")[0];
                            return (
                                <div key={n.id} className="flex items-center gap-2 p-2 bg-zinc-800/30 rounded-xl hover:bg-zinc-800/50 transition-colors">
                                    {isToday && <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0 animate-pulse" />}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-1.5">
                                            <p className="text-[11px] font-bold text-white truncate flex-1 min-w-0">{n.title}</p>
                                            {n.isEdited && <span className="text-[6px] font-bold text-zinc-500 bg-zinc-800 px-1 py-0.5 rounded border border-zinc-700/50 shrink-0">edited</span>}
                                            <span className={cn("text-[7px] font-bold px-1.5 py-0.5 rounded-full border whitespace-nowrap shrink-0",
                                                n.category === "Urgent" ? "text-red-300 bg-red-500/20 border-red-500/30" :
                                                    n.category === "Policy" ? "text-blue-300 bg-blue-500/20 border-blue-500/30" :
                                                        n.category === "Event" ? "text-purple-300 bg-purple-500/20 border-purple-500/30" :
                                                            n.category === "Update" ? "text-emerald-300 bg-emerald-500/20 border-emerald-500/30" :
                                                                n.category === "HR" ? "text-pink-300 bg-pink-500/20 border-pink-500/30" :
                                                                    n.category === "Achievement" ? "text-amber-300 bg-amber-500/20 border-amber-500/30" :
                                                                        n.category === "Birthday" ? "text-pink-300 bg-pink-500/20 border-pink-500/30" :
                                                                            n.category === "Welcome" ? "text-sky-300 bg-sky-500/20 border-sky-500/30" :
                                                                                n.category === "Training" ? "text-cyan-300 bg-cyan-500/20 border-cyan-500/30" :
                                                                                    "text-zinc-300 bg-zinc-700/40 border-zinc-600/30"
                                            )}>{n.category}</span>
                                        </div>
                                        <p className="text-[9px] text-zinc-500 truncate">{n.content}</p>
                                    </div>
                                    <button onClick={() => setSelectedNotice(n)} className="p-1.5 rounded-lg hover:bg-zinc-700 text-zinc-600 hover:text-primary shrink-0 transition-colors" title="View">
                                        <Eye size={11} />
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* SOPs */}
                <div className="bg-zinc-900/80 border border-zinc-800/50 rounded-2xl p-5 space-y-3">
                    <div className="flex justify-between items-center">
                        <h3 className="text-sm font-bold text-white flex items-center gap-2">
                            <FileText size={16} className="text-purple-400" /> Latest SOPs
                            {sopNotifications.filter(n => !n.readBy.includes(user?.id || "")).length > 0 && (
                                <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                            )}
                        </h3>
                        <Link href="/sop" className="text-[9px] text-primary font-bold hover:underline shrink-0">View All</Link>
                    </div>

                    {/* SOP Change Notification Banner */}
                    {(() => {
                        const unread = sopNotifications.filter(n => !n.readBy.includes(user?.id || ""));
                        if (unread.length === 0) return null;
                        const latest = unread[0];
                        return (
                            <Link href="/sop" onClick={() => {/* will navigate to changes tab */ }}>
                                <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 flex items-start gap-2.5 hover:bg-amber-500/15 transition-colors cursor-pointer animate-pulse">
                                    <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center shrink-0 mt-0.5">
                                        <Bell size={14} className="text-amber-400" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-[11px] font-bold text-amber-300">
                                            {unread.length === 1 ? "SOP Updated!" : `${unread.length} SOP Changes!`}
                                        </p>
                                        <p className="text-[9px] text-amber-400/70 mt-0.5">
                                            {latest.title} {latest.changeType === "updated" ? "was modified" : latest.changeType === "new" ? "was added" : "was removed"} by {latest.changedBy} &middot; {latest.changedAt}
                                        </p>
                                        {latest.changelog && <p className="text-[8px] text-amber-500/60 mt-0.5 truncate">{latest.changelog}</p>}
                                        <p className="text-[8px] text-amber-400 font-bold mt-1">Click to view changes →</p>
                                    </div>
                                </div>
                            </Link>
                        );
                    })()}

                    <div className="space-y-2">
                        {sops.slice(0, 3).map(s => (
                            <Link key={s.id} href="/sop" className="flex items-center gap-3 p-3 bg-zinc-800/30 rounded-xl group hover:bg-zinc-800/50 transition-colors cursor-pointer">
                                <FileText size={14} className="text-purple-400 shrink-0" />
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1.5">
                                        <p className="text-[11px] font-bold text-white truncate">{s.title}</p>
                                        <span className={cn("text-[6px] font-bold px-1 py-0.5 rounded-full border uppercase shrink-0",
                                            s.changeType === "new" ? "text-emerald-300 bg-emerald-500/20 border-emerald-500/30" :
                                                s.changeType === "updated" ? "text-amber-300 bg-amber-500/20 border-amber-500/30" :
                                                    "text-red-300 bg-red-500/20 border-red-500/30"
                                        )}>{s.changeType}</span>
                                    </div>
                                    <p className="text-[9px] text-zinc-500">v{s.version} &middot; {s.lastUpdated}</p>
                                </div>
                                <ChevronRight size={12} className="text-zinc-600 group-hover:text-primary shrink-0" />
                            </Link>
                        ))}
                    </div>
                </div>

                {/* Upcoming Birthdays */}
                <div className="bg-zinc-900/80 border border-zinc-800/50 rounded-2xl p-5 space-y-3">
                    <h3 className="text-sm font-bold text-white flex items-center gap-2"><Cake size={16} className="text-pink-400" /> Upcoming Birthdays</h3>
                    <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar">
                        {upcomingBirthdays.length === 0 ? <p className="text-[10px] text-zinc-500 italic">No upcoming birthdays</p> :
                            upcomingBirthdays.map(e => {
                                const dob = new Date(e.dateOfBirth!);
                                const bday = new Date(today.getFullYear(), dob.getMonth(), dob.getDate());
                                const daysUntil = Math.ceil((bday.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                                return (
                                    <div key={e.id} className="flex items-center gap-3 p-2.5 bg-zinc-800/30 rounded-xl">
                                        <div className="w-8 h-8 rounded-lg bg-zinc-800 border border-zinc-700/50 overflow-hidden flex items-center justify-center text-pink-400 text-xs font-bold">
                                            {e.photoUrl ? <img src={e.photoUrl} alt="" className="w-full h-full object-cover" /> : e.name[0]}
                                        </div>
                                        <div className="flex-1"><p className="text-[11px] font-bold text-white">{e.name}</p><p className="text-[9px] text-zinc-500">{e.designation}</p></div>
                                        <span className="text-[9px] font-bold text-pink-400">{daysUntil === 0 ? "ðŸŽ‰ Today!" : `${daysUntil}d`}</span>
                                    </div>
                                );
                            })}
                    </div>
                </div>

                {/* Manager: Pending Leave Approval */}
                {
                    (isManagerRole || role === "HR") && pendingLeaves.length > 0 && (
                        <div className="bg-zinc-900/80 border border-amber-500/20 rounded-2xl p-5 space-y-3">
                            <div className="flex justify-between items-center"><h3 className="text-sm font-bold text-amber-400 flex items-center gap-2"><Calendar size={16} /> Pending Approvals</h3><Link href="/manager/leave-approval" className="text-[9px] text-primary font-bold">View All â†’</Link></div>
                            <div className="space-y-2">
                                {pendingLeaves.slice(0, 3).map(l => (
                                    <div key={l.id} className="flex items-center gap-3 p-2.5 bg-zinc-800/30 rounded-xl">
                                        <Clock size={14} className="text-amber-400" />
                                        <div className="flex-1"><p className="text-[11px] font-bold text-white">{l.employeeName}</p><p className="text-[9px] text-zinc-500">{l.type} Â· {l.days}d Â· {l.startDate}</p></div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )
                }
            </div>

            {/* Announcement View Modal */}
            <AnimatePresence>
                {selectedNotice && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setSelectedNotice(null)} />
                        <motion.div initial={{ opacity: 0, y: 20, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 20, scale: 0.95 }}
                            className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-lg relative z-10 shadow-2xl overflow-hidden">
                            <div className={cn("h-1.5 w-full",
                                selectedNotice.category === "Urgent" ? "bg-red-500" :
                                    selectedNotice.category === "Birthday" ? "bg-pink-500" :
                                        selectedNotice.category === "Welcome" ? "bg-sky-500" :
                                            selectedNotice.category === "Event" ? "bg-purple-500" :
                                                selectedNotice.category === "Policy" ? "bg-amber-500" :
                                                    "bg-primary"
                            )} />
                            <div className="p-6 space-y-4">
                                <div className="flex justify-between items-start">
                                    <div className="flex items-center gap-2">
                                        <span className={cn("text-[8px] font-bold px-2 py-0.5 rounded-full border uppercase",
                                            selectedNotice.category === "Urgent" ? "text-red-300 bg-red-500/20 border-red-500/30" :
                                                selectedNotice.category === "Birthday" ? "text-pink-300 bg-pink-500/20 border-pink-500/30" :
                                                    selectedNotice.category === "Welcome" ? "text-sky-300 bg-sky-500/20 border-sky-500/30" :
                                                        selectedNotice.category === "Event" ? "text-purple-300 bg-purple-500/20 border-purple-500/30" :
                                                            "text-emerald-300 bg-emerald-500/20 border-emerald-500/30"
                                        )}>{selectedNotice.category}</span>
                                        {selectedNotice.isEdited && <span className="text-[7px] font-bold text-zinc-500 bg-zinc-800 px-1.5 py-0.5 rounded border border-zinc-700/50">edited {selectedNotice.editedAt}</span>}
                                    </div>
                                    <button onClick={() => setSelectedNotice(null)} className="text-zinc-500 hover:text-white transition-colors"><X size={16} /></button>
                                </div>
                                <h2 className="text-lg font-bold text-white leading-tight">{selectedNotice.title}</h2>
                                <p className="text-xs text-zinc-400 leading-relaxed whitespace-pre-wrap">{selectedNotice.content}</p>
                                {selectedNotice.imageUrls && selectedNotice.imageUrls.length > 0 && (
                                    <div className="grid grid-cols-2 gap-2">
                                        {selectedNotice.imageUrls.map((url: string, i: number) => (
                                            <img key={i} src={url} alt={`Attachment ${i + 1}`} className="w-full h-40 object-cover rounded-xl border border-zinc-800" />
                                        ))}
                                    </div>
                                )}
                                <div className="pt-3 border-t border-zinc-800 flex items-center gap-2">
                                    <div className="w-6 h-6 rounded-full bg-zinc-800 flex items-center justify-center text-[10px] font-bold text-zinc-400">{selectedNotice.createdBy?.[0]}</div>
                                    <span className="text-[10px] font-bold text-zinc-500">{selectedNotice.createdBy}</span>
                                    <span className="text-[9px] text-zinc-600 ml-auto">{selectedNotice.createdAt}</span>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            <FloatingChatbot sops={sops} />
        </div >
    );
}

function StatCard({ label, value, color, icon }: { label: string; value: string; color: string; icon: React.ReactNode }) {
    return (
        <div className="bg-zinc-900/80 border border-zinc-800/50 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2"><span className={cn("opacity-60", color)}>{icon}</span><p className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest">{label}</p></div>
            <p className={cn("text-xl font-bold", color)}>{value}</p>
        </div>
    );
}

"use client";

import { useState, useEffect, useRef } from "react";
import { useAuth, Notice } from "@/context/AuthContext";
import { uploadToCloudinary } from "@/lib/cloudinary";
import {
    Megaphone, Plus, Calendar, User, Send, Image as ImageIcon, FileText,
    Heart, AlertCircle, PartyPopper, Search, Edit3, X, CheckCheck, Cake,
    UserPlus, Upload, Eye, Trash2, Loader2
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

export default function AnnouncementsPage() {
    const { user, notices, employees, addAnnouncement, editNotice, markAnnouncementRead } = useAuth();
    const [showModal, setShowModal] = useState(false);
    const [editingNotice, setEditingNotice] = useState<Notice | null>(null);
    const [filter, setFilter] = useState("All");
    const [form, setForm] = useState({ title: "", content: "", category: "General" as any });
    const [uploadedUrls, setUploadedUrls] = useState<string[]>([]);
    const [uploading, setUploading] = useState(false);
    const [viewNotice, setViewNotice] = useState<Notice | null>(null);

    // Birthday / Joinee poster modals
    const [showBirthdayModal, setShowBirthdayModal] = useState(false);
    const [showJoineeModal, setShowJoineeModal] = useState(false);
    const [bdayForm, setBdayForm] = useState({ message: "" });
    const [bdayUrls, setBdayUrls] = useState<string[]>([]);
    const [bdayUploading, setBdayUploading] = useState(false);
    const [joineeForm, setJoineeForm] = useState({ names: "", message: "" });
    const [joineeUrls, setJoineeUrls] = useState<string[]>([]);
    const [joineeUploading, setJoineeUploading] = useState(false);

    const fileRef = useRef<HTMLInputElement>(null);
    const bdayFileRef = useRef<HTMLInputElement>(null);
    const joineeFileRef = useRef<HTMLInputElement>(null);

    if (!user) return null;

    const isHROrFounder = user.role === "HR" || user.role === "FOUNDER";
    const categories = ["All", "General", "Policy", "Event", "Urgent", "Update", "HR", "Achievement", "Training", "Birthday", "Welcome"];
    const filteredNotices = notices.filter(n => filter === "All" || n.category === filter);

    useEffect(() => {
        if (!user) return;
        notices.forEach(n => { if (!(n.readBy || []).includes(user.id)) markAnnouncementRead(n.id); });
    }, [notices.length]);

    // Generic file upload handler
    const handleFileUpload = async (files: FileList | null, setUrls: React.Dispatch<React.SetStateAction<string[]>>, setLoading: React.Dispatch<React.SetStateAction<boolean>>) => {
        if (!files || files.length === 0) return;
        setLoading(true);
        try {
            for (const file of Array.from(files)) {
                const result = await uploadToCloudinary(file);
                setUrls(prev => [...prev, result.secure_url]);
            }
        } catch (err) { console.error("Upload failed:", err); }
        setLoading(false);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (editingNotice) {
            editNotice(editingNotice.id, { title: form.title, content: form.content, category: form.category });
        } else {
            addAnnouncement({ ...form, imageUrls: uploadedUrls.length > 0 ? uploadedUrls : undefined } as any);
        }
        setForm({ title: "", content: "", category: "General" });
        setUploadedUrls([]);
        setEditingNotice(null);
        setShowModal(false);
    };

    const handleBirthdaySubmit = (e: React.FormEvent) => {
        e.preventDefault();
        addAnnouncement({
            title: "🎂 Birthday Celebration!",
            content: bdayForm.message,
            category: "Birthday",
            imageUrls: bdayUrls.length > 0 ? bdayUrls : undefined
        } as any);
        setBdayForm({ message: "" });
        setBdayUrls([]);
        setShowBirthdayModal(false);
    };

    const handleJoineeSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        addAnnouncement({
            title: `🎉 Welcome New Joinee${joineeForm.names.includes(",") ? "s" : ""}: ${joineeForm.names}`,
            content: joineeForm.message,
            category: "Welcome",
            imageUrls: joineeUrls.length > 0 ? joineeUrls : undefined
        } as any);
        setJoineeForm({ names: "", message: "" });
        setJoineeUrls([]);
        setShowJoineeModal(false);
    };

    const openEdit = (notice: Notice) => {
        setEditingNotice(notice);
        setForm({ title: notice.title, content: notice.content, category: notice.category });
        setUploadedUrls(notice.imageUrls || []);
        setShowModal(true);
    };

    const openNew = () => {
        setEditingNotice(null);
        setForm({ title: "", content: "", category: "General" });
        setUploadedUrls([]);
        setShowModal(true);
    };

    const catColor = (cat: string) =>
        cat === "Urgent" ? "bg-red-500" : cat === "Policy" ? "bg-amber-500" :
            cat === "Event" ? "bg-purple-500" : cat === "Birthday" ? "bg-pink-500" :
                cat === "Welcome" ? "bg-sky-500" : cat === "Achievement" ? "bg-amber-500" :
                    cat === "Training" ? "bg-cyan-500" : cat === "HR" ? "bg-pink-500" :
                        cat === "Update" ? "bg-emerald-500" : "bg-primary";

    const catBadge = (cat: string) =>
        cat === "Urgent" ? "text-red-300 bg-red-500/20 border-red-500/30" :
            cat === "Policy" ? "text-blue-300 bg-blue-500/20 border-blue-500/30" :
                cat === "Event" ? "text-purple-300 bg-purple-500/20 border-purple-500/30" :
                    cat === "Birthday" ? "text-pink-300 bg-pink-500/20 border-pink-500/30" :
                        cat === "Welcome" ? "text-sky-300 bg-sky-500/20 border-sky-500/30" :
                            cat === "Update" ? "text-emerald-300 bg-emerald-500/20 border-emerald-500/30" :
                                cat === "HR" ? "text-pink-300 bg-pink-500/20 border-pink-500/30" :
                                    cat === "Achievement" ? "text-amber-300 bg-amber-500/20 border-amber-500/30" :
                                        cat === "Training" ? "text-cyan-300 bg-cyan-500/20 border-cyan-500/30" :
                                            "text-zinc-300 bg-zinc-700/40 border-zinc-600/30";

    // Reusable image upload section component
    const ImageUploadSection = ({ urls, setUrls, uploading: isUploading, inputRef, color = "primary" }: {
        urls: string[], setUrls: React.Dispatch<React.SetStateAction<string[]>>, uploading: boolean, inputRef: React.RefObject<HTMLInputElement | null>, color?: string
    }) => (
        <div className="space-y-2">
            <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">Upload Images</label>
            <input ref={inputRef} type="file" accept="image/*" multiple className="hidden" onChange={e => handleFileUpload(e.target.files, setUrls, color === "pink" ? setBdayUploading : color === "sky" ? setJoineeUploading : setUploading)} />
            <button type="button" onClick={() => inputRef.current?.click()} disabled={isUploading}
                className={cn("w-full border-2 border-dashed rounded-xl p-4 flex flex-col items-center gap-2 transition-colors",
                    isUploading ? "border-zinc-700 bg-zinc-900/50 cursor-wait" : "border-zinc-700 hover:border-primary/50 bg-zinc-900/30 cursor-pointer"
                )}>
                {isUploading ? (
                    <><Loader2 size={18} className="text-primary animate-spin" /><p className="text-[10px] text-primary font-bold">Uploading to Cloudinary...</p></>
                ) : (
                    <><Upload size={18} className="text-zinc-500" /><p className="text-[10px] text-zinc-500">Click to upload images (JPG, PNG, WEBP)</p><p className="text-[8px] text-zinc-600">Multiple files supported</p></>
                )}
            </button>
            {urls.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                    {urls.map((url, i) => (
                        <div key={i} className="relative group">
                            <img src={url} alt="" className="w-16 h-16 object-cover rounded-lg border border-zinc-800" />
                            <button type="button" onClick={() => setUrls(urls.filter((_, j) => j !== i))}
                                className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <X size={8} className="text-white" />
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );

    return (
        <div className="p-8 space-y-8 max-w-6xl mx-auto">
            <header className="flex justify-between items-end flex-wrap gap-3">
                <div>
                    <h1 className="text-2xl font-bold text-white tracking-tight">Communication Hub</h1>
                    <p className="text-sm text-zinc-400 mt-1 italic">Institutional Broadcast Node &amp; Strategic Signaling</p>
                </div>
                {isHROrFounder && (
                    <button onClick={openNew} className="btn-primary flex items-center gap-2 px-6 shadow-[0_0_20px_rgba(16,185,129,0.2)]">
                        <Plus size={16} /> New Broadcast
                    </button>
                )}
            </header>

            {/* Filter Chips */}
            <div className="flex gap-1.5 p-1 bg-zinc-900 border border-zinc-800 rounded-2xl w-fit flex-wrap">
                {categories.map(cat => (
                    <button key={cat} onClick={() => setFilter(cat)}
                        className={cn("px-3 py-1.5 rounded-xl text-[10px] font-bold transition-all",
                            filter === cat ? "bg-zinc-800 text-primary shadow-inner" : "text-zinc-500 hover:text-zinc-300"
                        )}>{cat}</button>
                ))}
            </div>

            {/* Feed */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <AnimatePresence mode="popLayout">
                    {filteredNotices.map((notice) => (
                        <motion.div key={notice.id} layout
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            className="card group hover:border-primary/30 transition-all p-0 flex flex-col relative">
                            <div className={cn("h-2 w-full rounded-t-3xl shadow-[0_0_12px_rgba(0,0,0,0.3)]", catColor(notice.category))} />

                            <div className="p-5 space-y-3 flex-1 flex flex-col">
                                <div className="flex justify-between items-start">
                                    <div className="flex items-center gap-2">
                                        <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center",
                                            notice.category === "Urgent" ? "bg-red-500/10 text-red-500" :
                                                notice.category === "Birthday" ? "bg-pink-500/10 text-pink-500" :
                                                    notice.category === "Welcome" ? "bg-sky-500/10 text-sky-500" :
                                                        "bg-zinc-900 text-zinc-400"
                                        )}>
                                            {notice.category === "Event" ? <PartyPopper size={14} /> :
                                                notice.category === "Urgent" ? <AlertCircle size={14} /> :
                                                    notice.category === "Birthday" ? <Cake size={14} /> :
                                                        notice.category === "Welcome" ? <UserPlus size={14} /> :
                                                            <FileText size={14} />}
                                        </div>
                                        <span className={cn("text-[8px] font-bold px-1.5 py-0.5 rounded-full border uppercase", catBadge(notice.category))}>{notice.category}</span>
                                        {notice.isEdited && <span className="text-[7px] font-bold text-zinc-500 bg-zinc-800 px-1.5 py-0.5 rounded border border-zinc-700/50">edited</span>}
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <span className="text-[9px] font-bold text-zinc-600 font-mono">{notice.createdAt}</span>
                                        {isHROrFounder && (
                                            <button onClick={() => openEdit(notice)} className="p-1 rounded-lg hover:bg-zinc-800 text-zinc-600 hover:text-primary transition-colors" title="Edit">
                                                <Edit3 size={11} />
                                            </button>
                                        )}
                                    </div>
                                </div>

                                <div className="space-y-1.5 flex-1">
                                    <h3 className="text-sm font-bold text-white group-hover:text-primary transition-colors leading-tight">{notice.title}</h3>
                                    <p className="text-[11px] text-zinc-400 leading-relaxed line-clamp-3">{notice.content}</p>
                                </div>

                                {notice.imageUrls && notice.imageUrls.length > 0 && (
                                    <div className="flex gap-1.5">
                                        {notice.imageUrls.slice(0, 3).map((url, i) => (
                                            <img key={i} src={url} alt="" className="w-16 h-12 object-cover rounded-lg border border-zinc-800" />
                                        ))}
                                        {notice.imageUrls.length > 3 && <span className="text-[9px] text-zinc-500 self-center">+{notice.imageUrls.length - 3} more</span>}
                                    </div>
                                )}

                                <div className="pt-3 border-t border-zinc-900 flex justify-between items-center">
                                    <div className="flex items-center gap-2">
                                        <div className="w-5 h-5 rounded-full bg-zinc-800 flex items-center justify-center text-[9px] font-bold text-zinc-400">{notice.createdBy[0]}</div>
                                        <span className="text-[10px] font-bold text-zinc-500">{notice.createdBy}</span>
                                    </div>
                                    <button onClick={() => setViewNotice(notice)} className="text-[9px] text-primary font-bold hover:underline flex items-center gap-1"><Eye size={10} /> View</button>
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>

            {/* Birthday + Joinee Poster Section */}
            {isHROrFounder && (
                <div className="mt-8 space-y-6 pt-8 border-t border-zinc-900/50">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-pink-500/10 rounded-xl text-pink-500"><Megaphone size={24} /></div>
                        <div>
                            <h2 className="text-xl font-bold text-white">Poster & Announcement Studio</h2>
                            <p className="text-sm text-zinc-400 italic">Create birthday posters, welcome new joinees, and visual announcements.</p>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div onClick={() => setShowBirthdayModal(true)} className="card bg-zinc-950 border-zinc-800 border-dashed border-2 p-8 text-center space-y-3 hover:border-pink-500/50 transition-all cursor-pointer group">
                            <div className="w-14 h-14 bg-pink-500/10 rounded-2xl flex items-center justify-center mx-auto text-pink-500/50 group-hover:text-pink-500 transition-colors"><Cake size={28} /></div>
                            <div>
                                <h4 className="text-sm font-bold text-white">Birthday Poster</h4>
                                <p className="text-[11px] text-zinc-500 mt-1">Upload birthday poster(s) from your laptop and write a birthday wishing message. Auto-tagged as Birthday.</p>
                            </div>
                        </div>
                        <div onClick={() => setShowJoineeModal(true)} className="card bg-zinc-950 border-zinc-800 border-dashed border-2 p-8 text-center space-y-3 hover:border-sky-500/50 transition-all cursor-pointer group">
                            <div className="w-14 h-14 bg-sky-500/10 rounded-2xl flex items-center justify-center mx-auto text-sky-500/50 group-hover:text-sky-500 transition-colors"><UserPlus size={28} /></div>
                            <div>
                                <h4 className="text-sm font-bold text-white">New Joinee Announcement</h4>
                                <p className="text-[11px] text-zinc-500 mt-1">Upload new joinee poster(s) with welcome message. Multiple joinees supported. Auto-tagged as Welcome.</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* View Full Announcement Modal */}
            <AnimatePresence>
                {viewNotice && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setViewNotice(null)} className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
                        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-lg relative z-10 shadow-2xl overflow-hidden max-h-[85vh] overflow-y-auto">
                            <div className={cn("h-1.5 w-full sticky top-0", catColor(viewNotice.category))} />
                            <div className="p-6 space-y-4">
                                <div className="flex justify-between items-start">
                                    <div className="flex items-center gap-2">
                                        <span className={cn("text-[8px] font-bold px-2 py-0.5 rounded-full border uppercase", catBadge(viewNotice.category))}>{viewNotice.category}</span>
                                        {viewNotice.isEdited && <span className="text-[7px] font-bold text-zinc-500 bg-zinc-800 px-1.5 py-0.5 rounded border border-zinc-700/50">edited {viewNotice.editedAt}</span>}
                                    </div>
                                    <button onClick={() => setViewNotice(null)} className="text-zinc-500 hover:text-white transition-colors"><X size={16} /></button>
                                </div>
                                <h2 className="text-lg font-bold text-white leading-tight">{viewNotice.title}</h2>
                                <p className="text-xs text-zinc-400 leading-relaxed whitespace-pre-wrap">{viewNotice.content}</p>
                                {viewNotice.imageUrls && viewNotice.imageUrls.length > 0 && (
                                    <div className="space-y-2">
                                        {viewNotice.imageUrls.map((url, i) => (
                                            <img key={i} src={url} alt={`Poster ${i + 1}`} className="w-full rounded-xl border border-zinc-800 object-contain max-h-80" />
                                        ))}
                                    </div>
                                )}
                                <div className="pt-3 border-t border-zinc-800 flex items-center gap-2">
                                    <div className="w-6 h-6 rounded-full bg-zinc-800 flex items-center justify-center text-[10px] font-bold text-zinc-400">{viewNotice.createdBy[0]}</div>
                                    <span className="text-[10px] font-bold text-zinc-500">{viewNotice.createdBy}</span>
                                    <span className="text-[9px] text-zinc-600 ml-auto">{viewNotice.createdAt}</span>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Compose / Edit Modal */}
            <AnimatePresence>
                {showModal && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => { setShowModal(false); setEditingNotice(null); }} className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
                        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className="card w-full max-w-xl p-8 relative z-10 space-y-6 shadow-2xl overflow-hidden border-zinc-800 max-h-[85vh] overflow-y-auto">
                            <div className={cn("absolute top-0 left-0 w-full h-1", editingNotice ? "bg-amber-500" : "bg-primary")} />
                            <div className="flex justify-between items-center">
                                <div>
                                    <h2 className="text-xl font-bold text-white tracking-tight">{editingNotice ? "Edit Announcement" : "New Broadcast"}</h2>
                                    <p className="text-xs text-zinc-500 mt-1">{editingNotice ? "Update the announcement details" : "Create a new announcement for all employees"}</p>
                                </div>
                                <button onClick={() => { setShowModal(false); setEditingNotice(null); }} className="p-2 hover:bg-zinc-900 rounded-xl transition-colors"><X size={16} className="text-zinc-500" /></button>
                            </div>
                            <form onSubmit={handleSubmit} className="space-y-5">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">Category</label>
                                    <select className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-xs text-white" value={form.category} onChange={e => setForm({ ...form, category: e.target.value as any })}>
                                        {["General", "Policy", "Event", "Urgent", "Update", "HR", "Achievement", "Training", "Birthday", "Welcome"].map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">Title</label>
                                    <input type="text" required className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-xs text-white focus:border-primary/50 font-bold placeholder:font-normal" placeholder="Announcement title..." value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">Content</label>
                                    <textarea required rows={4} className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-xs text-white resize-none focus:border-primary/50 leading-relaxed" placeholder="Announcement content..." value={form.content} onChange={e => setForm({ ...form, content: e.target.value })} />
                                </div>
                                <ImageUploadSection urls={uploadedUrls} setUrls={setUploadedUrls} uploading={uploading} inputRef={fileRef} />
                                <button type="submit" disabled={uploading} className={cn("w-full py-3.5 text-xs font-bold rounded-2xl flex items-center justify-center gap-2 transition-colors",
                                    editingNotice ? "bg-amber-500 hover:bg-amber-600 text-black" : "btn-primary"
                                )}>
                                    {editingNotice ? <><Edit3 size={14} /> UPDATE ANNOUNCEMENT</> : <><Megaphone size={16} /> BROADCAST TO ALL</>}
                                </button>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Birthday Poster Modal */}
            <AnimatePresence>
                {showBirthdayModal && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowBirthdayModal(false)} className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
                        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className="card w-full max-w-xl p-8 relative z-10 space-y-6 shadow-2xl overflow-hidden border-zinc-800 max-h-[85vh] overflow-y-auto">
                            <div className="absolute top-0 left-0 w-full h-1 bg-pink-500" />
                            <div className="flex justify-between items-center">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-pink-500/10 rounded-xl text-pink-500"><Cake size={20} /></div>
                                    <div>
                                        <h2 className="text-lg font-bold text-white">Birthday Poster</h2>
                                        <p className="text-[11px] text-zinc-500">Upload poster(s) from your laptop and write a birthday message</p>
                                    </div>
                                </div>
                                <button onClick={() => setShowBirthdayModal(false)} className="p-2 hover:bg-zinc-900 rounded-xl"><X size={16} className="text-zinc-500" /></button>
                            </div>
                            <form onSubmit={handleBirthdaySubmit} className="space-y-5">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">Birthday Wishing Message</label>
                                    <textarea required rows={4} className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-xs text-white resize-none leading-relaxed" placeholder="Write a heartfelt birthday message..." value={bdayForm.message} onChange={e => setBdayForm({ ...bdayForm, message: e.target.value })} />
                                </div>
                                <ImageUploadSection urls={bdayUrls} setUrls={setBdayUrls} uploading={bdayUploading} inputRef={bdayFileRef} color="pink" />
                                <button type="submit" disabled={bdayUploading} className="w-full py-3.5 text-xs font-bold rounded-2xl flex items-center justify-center gap-2 bg-pink-500 hover:bg-pink-600 text-white shadow-[0_0_20px_rgba(236,72,153,0.3)] disabled:opacity-50">
                                    <Cake size={14} /> PUBLISH BIRTHDAY POSTER
                                </button>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* New Joinee Modal */}
            <AnimatePresence>
                {showJoineeModal && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowJoineeModal(false)} className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
                        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className="card w-full max-w-xl p-8 relative z-10 space-y-6 shadow-2xl overflow-hidden border-zinc-800 max-h-[85vh] overflow-y-auto">
                            <div className="absolute top-0 left-0 w-full h-1 bg-sky-500" />
                            <div className="flex justify-between items-center">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-sky-500/10 rounded-xl text-sky-500"><UserPlus size={20} /></div>
                                    <div>
                                        <h2 className="text-lg font-bold text-white">New Joinee Announcement</h2>
                                        <p className="text-[11px] text-zinc-500">Upload poster(s) and welcome message for new joinees</p>
                                    </div>
                                </div>
                                <button onClick={() => setShowJoineeModal(false)} className="p-2 hover:bg-zinc-900 rounded-xl"><X size={16} className="text-zinc-500" /></button>
                            </div>
                            <form onSubmit={handleJoineeSubmit} className="space-y-5">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">Joinee Name(s) — comma-separated for multiple</label>
                                    <input type="text" required className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-xs text-white font-bold placeholder:font-normal" placeholder="Arjun Sharma, Priya Gupta" value={joineeForm.names} onChange={e => setJoineeForm({ ...joineeForm, names: e.target.value })} />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">Welcome Message</label>
                                    <textarea required rows={4} className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-xs text-white resize-none leading-relaxed" placeholder="Write a warm welcome message..." value={joineeForm.message} onChange={e => setJoineeForm({ ...joineeForm, message: e.target.value })} />
                                </div>
                                <ImageUploadSection urls={joineeUrls} setUrls={setJoineeUrls} uploading={joineeUploading} inputRef={joineeFileRef} color="sky" />
                                <button type="submit" disabled={joineeUploading} className="w-full py-3.5 text-xs font-bold rounded-2xl flex items-center justify-center gap-2 bg-sky-500 hover:bg-sky-600 text-white shadow-[0_0_20px_rgba(14,165,233,0.3)] disabled:opacity-50">
                                    <UserPlus size={14} /> PUBLISH WELCOME POSTER
                                </button>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}