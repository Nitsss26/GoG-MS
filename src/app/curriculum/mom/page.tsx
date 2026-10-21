"use client";

import { useAuth } from "@/context/AuthContext";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
    ArrowLeft, Building2, Calendar, Clock, Save, Plus, Trash2, CheckCircle2, AlertCircle, History,
    FileText, CalendarDays, Users, MessageSquareText, ListChecks, UserRound, SquareCheck, ClipboardList,
    Bold, Italic, Underline, List, ListOrdered, IndentDecrease, IndentIncrease, Link2, Undo2, Redo2,
    ChevronDown, Loader2, ShieldAlert, X,
} from "lucide-react";
import { cn, resolveImageUrl } from "@/lib/utils";

/**
 * Campus Daily Standup MoM — one record per campus per day (CampusDailyMoM via /api/curriculum/mom).
 * Campuses come from the Locations database. Discussion points are rich text (sanitised HTML).
 */
const MEETING_TYPES = ["Campus Standup", "Academic Review", "Operations Review", "Faculty Meeting", "Student / Parent Meeting", "Other"];
const DEFAULT_TITLE = "Daily Campus Academic & Operations Standup";
const todayIST = () => new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);

type Attendee = { id?: string; name: string; role?: string; present?: boolean };
type ActionItem = { task: string; owner: string; deadline?: string; status: "Pending" | "In Progress" | "Completed" };

// ── rich text: allow only simple formatting tags, drop every attribute except a safe link href ──
const ALLOWED = new Set(["B", "STRONG", "I", "EM", "U", "UL", "OL", "LI", "P", "BR", "DIV", "H3", "H4", "A", "SPAN", "BLOCKQUOTE"]);
function sanitizeHtml(html: string): string {
    if (typeof window === "undefined" || !html) return "";
    const doc = new DOMParser().parseFromString(`<div>${html}</div>`, "text/html");
    const walk = (node: Element) => {
        Array.from(node.children).forEach(child => {
            if (!ALLOWED.has(child.tagName)) {
                if (["SCRIPT", "STYLE", "IFRAME", "OBJECT", "EMBED"].includes(child.tagName)) { child.remove(); return; }
                const frag = doc.createDocumentFragment();
                while (child.firstChild) frag.appendChild(child.firstChild);
                child.replaceWith(frag);
                walk(node); return;
            }
            Array.from(child.attributes).forEach(a => {
                const keep = child.tagName === "A" && a.name === "href" && /^https?:\/\//i.test(a.value);
                if (!keep) child.removeAttribute(a.name);
            });
            if (child.tagName === "A") { child.setAttribute("target", "_blank"); child.setAttribute("rel", "noopener noreferrer"); }
            walk(child);
        });
    };
    const root = doc.body.firstElementChild as Element;
    walk(root);
    return root.innerHTML;
}
/** Older MoMs saved plain text: keep their line breaks */
const toHtml = (v: string) => (!v ? "" : /<\/?[a-z][\s\S]*>/i.test(v) ? v : v.split("\n").map(l => l.replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]!))).join("<br>"));

export default function CampusDailyMoMPage() {
    const { user, employees } = useAuth();

    // Campuses from the Locations database
    const [locations, setLocations] = useState<any[]>([]);
    const [locsReady, setLocsReady] = useState(false);
    useEffect(() => {
        fetch("/api/locations", { cache: "no-store" }).then(r => (r.ok ? r.json() : [])).then(d => {
            setLocations(Array.isArray(d) ? d.filter((l: any) => l?.name && l.active !== false && !l.isDeleted).sort((a: any, b: any) => a.name.localeCompare(b.name)) : []);
        }).catch(() => setLocations([])).finally(() => setLocsReady(true));
    }, []);
    const myCampus = useMemo(() => {
        const loc = (user as any)?.location;
        const l = locations.find(x => [x.id, x.name, x.shortName].includes(loc));
        return l?.name || loc || "";
    }, [user, locations]);

    const [campus, setCampus] = useState("");
    useEffect(() => { if (locsReady && !campus && (myCampus || locations[0]?.name)) setCampus(myCampus || locations[0].name); }, [locsReady, myCampus, locations, campus]);
    const [date, setDate] = useState(todayIST());

    const [meetingTitle, setMeetingTitle] = useState(DEFAULT_TITLE);
    const [meetingTime, setMeetingTime] = useState("17:30");
    const [meetingType, setMeetingType] = useState(MEETING_TYPES[0]);
    const [attendees, setAttendees] = useState<Attendee[]>([]);
    const [newAttendee, setNewAttendee] = useState("");
    const [discussionPoints, setDiscussionPoints] = useState("");
    const [actionItems, setActionItems] = useState<ActionItem[]>([]);
    const [newActionTask, setNewActionTask] = useState("");
    const [newActionOwner, setNewActionOwner] = useState("");
    const [escalations, setEscalations] = useState("");
    const [updateLog, setUpdateLog] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
    const editorRef = useRef<HTMLDivElement>(null);
    const [editorKey, setEditorKey] = useState(0);

    const people = useMemo(() => (employees || []).filter((e: any) => e?.name && e.status !== "Inactive"), [employees]);
    const findPerson = (name: string) => people.find((e: any) => e.name.toLowerCase() === name.trim().toLowerCase());
    const meAsAttendee = (): Attendee[] => (user?.name ? [{ id: user.id, name: user.name, role: (user as any).designation || roleText(user.role), present: true }] : []);

    useEffect(() => { if (campus) fetchMoM(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [campus, date]);

    const fetchMoM = async (keepMessage = false) => {
        setLoading(true);
        if (!keepMessage) setMessage(null);
        try {
            const res = await fetch(`/api/curriculum/mom?campus=${encodeURIComponent(campus)}&date=${date}`, { cache: "no-store" });
            const data = await res.json();
            const list: any[] = Array.isArray(data.moms) ? data.moms : [];
            const m = list.find(x => String(x.campus || "").toLowerCase() === campus.toLowerCase()) || null;
            if (m) {
                setMeetingTitle(m.title || DEFAULT_TITLE);
                setMeetingTime(m.meetingTime || "17:30");
                setMeetingType(m.meetingType || MEETING_TYPES[0]);
                setAttendees((m.attendees || []).map((a: any) => (typeof a === "string" ? { name: a } : a)).filter((a: Attendee) => a?.name));
                setDiscussionPoints(toHtml(m.discussionPoints || ""));
                setActionItems((m.actionItems || []).map((a: any) => ({ task: a.task, owner: a.owner || "Unassigned", deadline: a.deadline || "", status: /complete/i.test(a.status) ? "Completed" : /progress/i.test(a.status) ? "In Progress" : "Pending" })));
                setEscalations(m.blockers || "");
                setUpdateLog(m.updates || []);
            } else {
                setMeetingTitle(DEFAULT_TITLE);
                setMeetingTime("17:30");
                setMeetingType(MEETING_TYPES[0]);
                setAttendees(meAsAttendee());
                setDiscussionPoints("");
                setActionItems([]);
                setEscalations("");
                setUpdateLog([]);
            }
            setEditorKey(k => k + 1);
        } catch {
            setMessage({ type: "error", text: "Could not load the MoM. Please refresh." });
        } finally {
            setLoading(false);
        }
    };
    // Put the loaded discussion HTML into the editor (sanitised)
    useEffect(() => { if (editorRef.current) editorRef.current.innerHTML = sanitizeHtml(discussionPoints); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [editorKey, loading]);

    const handleSaveMoM = async () => {
        if (!campus) { setMessage({ type: "error", text: "Select a campus first." }); return; }
        setSaving(true);
        setMessage(null);
        try {
            const html = sanitizeHtml(editorRef.current?.innerHTML || discussionPoints);
            const res = await fetch("/api/curriculum/mom", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    campus, date,
                    title: meetingTitle.trim() || DEFAULT_TITLE,
                    meetingTime, meetingType,
                    attendees: attendees.map(a => ({ id: a.id || "", name: a.name, role: a.role || "", present: a.present !== false })),
                    discussionPoints: (editorRef.current?.innerText || "").trim() ? html : "",
                    actionItems,
                    blockers: escalations,
                    updateNote: "Updated MoM",
                }),
            });
            const data = await res.json().catch(() => ({}));
            if (res.ok) { setMessage({ type: "success", text: "Campus Daily MoM saved." }); fetchMoM(true); }
            else setMessage({ type: "error", text: data.error || "Failed to save MoM." });
        } catch (err: any) {
            setMessage({ type: "error", text: err.message || "Failed to save MoM." });
        } finally {
            setSaving(false);
        }
    };

    const addAttendee = () => {
        const name = newAttendee.trim();
        if (!name) return;
        if (!attendees.some(a => a.name.toLowerCase() === name.toLowerCase())) {
            const p: any = findPerson(name);
            setAttendees([...attendees, p ? { id: p.id, name: p.name, role: p.designation || roleText(p.role), present: true } : { name, present: true }]);
        }
        setNewAttendee("");
    };
    const addActionItem = () => {
        if (!newActionTask.trim()) return;
        setActionItems([...actionItems, { task: newActionTask.trim(), owner: newActionOwner.trim() || "Unassigned", status: "Pending" }]);
        setNewActionTask(""); setNewActionOwner("");
    };
    const toggleActionStatus = (idx: number) => setActionItems(items => items.map((it, i) => (i === idx ? { ...it, status: it.status === "Completed" ? "Pending" : "Completed" } : it)));

    // editor commands
    const exec = (cmd: string, value?: string) => { editorRef.current?.focus(); document.execCommand(cmd, false, value); if (editorRef.current) setDiscussionPoints(editorRef.current.innerHTML); };
    const addLink = () => {
        const url = window.prompt("Link (https://…)");
        if (url && /^https?:\/\//i.test(url.trim())) exec("createLink", url.trim());
    };
    const [editorEmpty, setEditorEmpty] = useState(true);
    useEffect(() => { setEditorEmpty(!(editorRef.current?.innerText || "").trim()); }, [discussionPoints, editorKey, loading]);

    const card = "rounded-2xl border border-white/[0.07] bg-[#0c1110]/90 p-5 sm:p-6";
    const input = "w-full h-11 px-3.5 rounded-xl bg-black/30 border border-white/[0.08] text-sm text-white placeholder:text-zinc-600 outline-none focus:border-emerald-500/50 transition-colors [color-scheme:dark]";
    const label = "block text-xs font-semibold text-zinc-300 mb-1.5";

    return (
        <div className="max-w-7xl mx-auto pt-6 pb-14 px-4 sm:px-6 space-y-5" data-testid="mom-page">
            {/* ── Hero ── */}
            <div className="relative overflow-hidden rounded-3xl border border-emerald-500/15 bg-[#06100d] p-5 sm:p-7">
                <div className="absolute inset-0 pointer-events-none" aria-hidden>
                    <div className="absolute inset-0 bg-[radial-gradient(ellipse_55%_120%_at_75%_100%,rgba(16,185,129,0.22),transparent_65%)]" />
                    <svg className="absolute inset-0 w-full h-full opacity-40" preserveAspectRatio="none" viewBox="0 0 1200 220">
                        <path d="M300 220 C 520 150, 700 210, 880 120 S 1120 60, 1200 90" fill="none" stroke="url(#momw)" strokeWidth="1.4" />
                        <path d="M360 220 C 560 170, 740 230, 920 150 S 1140 100, 1200 120" fill="none" stroke="url(#momw)" strokeWidth="1" />
                        <defs><linearGradient id="momw" x1="0" x2="1"><stop offset="0" stopColor="#10b981" stopOpacity="0" /><stop offset=".6" stopColor="#34d399" stopOpacity=".9" /><stop offset="1" stopColor="#10b981" stopOpacity="0" /></linearGradient></defs>
                    </svg>
                </div>
                <div className="relative flex flex-col lg:flex-row lg:items-start justify-between gap-6">
                    <div className="min-w-0 flex-1">
                        <Link href="/" className="inline-flex items-center gap-2 text-emerald-400 hover:gap-3 transition-all text-xs font-semibold"><ArrowLeft size={14} /> Back to Dashboard</Link>
                        <div className="mt-4 flex items-start gap-4">
                            <div className="w-14 h-14 shrink-0 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 flex items-center justify-center text-emerald-400 shadow-[0_0_24px_-6px_rgba(16,185,129,0.6)]"><FileText size={26} /></div>
                            <div className="min-w-0">
                                <h1 className="text-[clamp(1.6rem,2.2vw,2rem)] font-black tracking-tight leading-[1.08] text-white">Campus Daily Standup<br /><span className="text-emerald-400">MoM</span></h1>
                                <p className="text-xs text-zinc-400 mt-2">Collaborative Minutes &bull; Faculties &bull; HOI &bull; OM &bull; Curriculum Lead &amp; Head</p>
                                <p className="text-sm text-zinc-300 mt-1.5">Capture key discussions, decisions and action points from the daily campus meeting.</p>
                            </div>
                        </div>
                    </div>
                    <div className="flex flex-wrap lg:justify-end items-center gap-2.5 lg:pt-10 lg:max-w-[36rem] shrink-0">
                        <label className="relative h-11 rounded-xl border border-white/10 bg-black/30 flex items-center gap-2 pl-3 pr-2">
                            <Building2 size={16} className="text-emerald-400 shrink-0" />
                            <select value={campus} onChange={e => setCampus(e.target.value)} data-testid="mom-campus"
                                className="appearance-none bg-transparent outline-none pr-6 text-sm font-semibold text-white max-w-[9rem] truncate [color-scheme:dark] cursor-pointer">
                                {!campus && <option value="">Select campus…</option>}
                                {campus && !locations.some(l => l.name === campus) && <option value={campus}>{campus}</option>}
                                {locations.map(l => <option key={l.id} value={l.name}>{l.name}</option>)}
                            </select>
                            <ChevronDown size={14} className="absolute right-2.5 pointer-events-none text-zinc-500" />
                        </label>
                        <label className="h-11 rounded-xl border border-white/10 bg-black/30 flex items-center gap-2 px-3">
                            <Calendar size={16} className="text-emerald-400 shrink-0" />
                            <input type="date" value={date} onChange={e => e.target.value && setDate(e.target.value)} data-testid="mom-date"
                                className="bg-transparent outline-none text-sm font-semibold text-white [color-scheme:dark]" />
                        </label>
                        <button onClick={handleSaveMoM} disabled={saving || loading} data-testid="mom-save"
                            className="h-11 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold inline-flex items-center gap-2 shadow-lg shadow-emerald-900/40 transition-colors disabled:opacity-50">
                            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} {saving ? "Saving…" : "Save MoM"}
                        </button>
                    </div>
                </div>
            </div>

            {message && (
                <div data-testid="mom-message" className={cn("flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium border",
                    message.type === "success" ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-300" : "bg-red-500/10 border-red-500/20 text-red-300")}>
                    {message.type === "success" ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />} {message.text}
                </div>
            )}

            {loading ? (
                <div className="flex items-center justify-center py-24"><Loader2 size={28} className="animate-spin text-emerald-400" /></div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
                    {/* Meeting overview */}
                    <section className={cn(card, "lg:col-span-2 space-y-4")}>
                        <CardHead icon={<CalendarDays size={18} />} title="Meeting Overview" desc="Set the key details for today's campus meeting." />
                        <div>
                            <label className={label} htmlFor="mom-title">Meeting Title</label>
                            <input id="mom-title" value={meetingTitle} onChange={e => setMeetingTitle(e.target.value)} className={input} data-testid="mom-title" />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <label className={label}>Date</label>
                                <div className="relative"><Calendar size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
                                    <input type="date" value={date} onChange={e => e.target.value && setDate(e.target.value)} className={cn(input, "pl-9")} /></div>
                            </div>
                            <div>
                                <label className={label} htmlFor="mom-time">Time</label>
                                <div className="relative"><Clock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
                                    <input id="mom-time" type="time" value={meetingTime} onChange={e => setMeetingTime(e.target.value)} className={cn(input, "pl-9")} data-testid="mom-time" /></div>
                            </div>
                        </div>
                        <div>
                            <label className={label} htmlFor="mom-type">Meeting Type</label>
                            <div className="relative"><Users size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
                                <select id="mom-type" value={meetingType} onChange={e => setMeetingType(e.target.value)} className={cn(input, "pl-9 pr-9 appearance-none cursor-pointer")} data-testid="mom-type">
                                    {MEETING_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                                </select>
                                <ChevronDown size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" /></div>
                        </div>
                    </section>

                    {/* Discussion points (rich text) */}
                    <section className={cn(card, "lg:col-span-3 flex flex-col gap-4")}>
                        <div className="flex flex-wrap items-start justify-between gap-3">
                            <CardHead icon={<MessageSquareText size={18} />} title="Key Discussion Points & Syllabus Pace" desc="Document important discussion points, decisions and academic progress." />
                            <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-emerald-300 border border-emerald-500/25 bg-emerald-500/10 rounded-lg px-2.5 py-1"><Users size={12} /> Shared across Faculty &amp; Leadership</span>
                        </div>
                        <div className="flex-1 flex flex-col rounded-xl border border-white/[0.08] bg-black/30 overflow-hidden focus-within:border-emerald-500/40 transition-colors">
                            <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 border-b border-white/[0.06] bg-white/[0.02]" data-testid="mom-toolbar">
                                <select onChange={e => { exec("formatBlock", e.target.value); e.target.value = "P"; }} defaultValue="P" title="Text style"
                                    className="h-8 px-2 mr-1 rounded-md bg-transparent text-xs text-zinc-200 outline-none hover:bg-white/5 [color-scheme:dark] cursor-pointer">
                                    <option value="P">Normal</option><option value="H3">Heading</option><option value="H4">Subheading</option>
                                </select>
                                <Sep />
                                <TB title="Bold" onClick={() => exec("bold")}><Bold size={15} /></TB>
                                <TB title="Italic" onClick={() => exec("italic")}><Italic size={15} /></TB>
                                <TB title="Underline" onClick={() => exec("underline")}><Underline size={15} /></TB>
                                <Sep />
                                <TB title="Bulleted list" onClick={() => exec("insertUnorderedList")}><List size={15} /></TB>
                                <TB title="Numbered list" onClick={() => exec("insertOrderedList")}><ListOrdered size={15} /></TB>
                                <TB title="Decrease indent" onClick={() => exec("outdent")}><IndentDecrease size={15} /></TB>
                                <TB title="Increase indent" onClick={() => exec("indent")}><IndentIncrease size={15} /></TB>
                                <Sep />
                                <TB title="Insert link" onClick={addLink}><Link2 size={15} /></TB>
                                <Sep />
                                <TB title="Undo" onClick={() => exec("undo")}><Undo2 size={15} /></TB>
                                <TB title="Redo" onClick={() => exec("redo")}><Redo2 size={15} /></TB>
                            </div>
                            <div className="relative flex-1">
                                {editorEmpty && (
                                    <ul className="absolute inset-0 px-4 py-3 space-y-1 text-sm text-zinc-600 pointer-events-none list-disc list-inside" aria-hidden>
                                        <li>Topic coverage speed</li><li>Student attendance anomalies</li><li>Lab infrastructure notes</li>
                                        <li>Placement preparation roadmap</li><li>Faculty feedback on semester progress</li><li>Any other important points…</li>
                                    </ul>
                                )}
                                <div key={editorKey} ref={editorRef} contentEditable suppressContentEditableWarning data-testid="mom-editor"
                                    onInput={e => setDiscussionPoints((e.target as HTMLDivElement).innerHTML)}
                                    onPaste={e => { e.preventDefault(); const t = e.clipboardData.getData("text/plain"); document.execCommand("insertText", false, t); }}
                                    className="relative min-h-[15rem] max-h-[28rem] overflow-y-auto px-4 py-3 text-sm text-zinc-100 leading-relaxed outline-none [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_h3]:text-base [&_h3]:font-bold [&_h3]:text-white [&_h4]:font-semibold [&_h4]:text-white [&_a]:text-emerald-400 [&_a]:underline [&_blockquote]:border-l-2 [&_blockquote]:border-zinc-600 [&_blockquote]:pl-3" />
                            </div>
                        </div>
                    </section>

                    {/* Attendees */}
                    <section className={cn(card, "lg:col-span-2 space-y-4")}>
                        <CardHead icon={<Users size={18} />} title={`Attendees (${attendees.length})`} desc="Manage meeting attendees and participants." />
                        <div className="flex gap-2">
                            <div className="relative flex-1">
                                <UserRound size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
                                <input list="mom-people" placeholder="Add attendee name..." value={newAttendee} onChange={e => setNewAttendee(e.target.value)}
                                    onKeyDown={e => e.key === "Enter" && addAttendee()} className={cn(input, "pl-9")} data-testid="mom-attendee-input" />
                            </div>
                            <button onClick={addAttendee} title="Add attendee" data-testid="mom-attendee-add"
                                className="w-11 h-11 shrink-0 rounded-xl border border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 flex items-center justify-center"><Plus size={18} /></button>
                        </div>
                        <datalist id="mom-people">{people.map((p: any) => <option key={p.id} value={p.name}>{p.designation || roleText(p.role)}</option>)}</datalist>
                        <div className="flex flex-wrap gap-2 max-h-64 overflow-y-auto" data-testid="mom-attendees">
                            {attendees.map((a, idx) => {
                                const p: any = (a.id && people.find((e: any) => e.id === a.id)) || findPerson(a.name);
                                const photo = p?.photoUrl || p?.passport_size_photo || p?.upload_your_passport_size_photo;
                                return (
                                    <span key={a.name + idx} className="inline-flex items-center gap-2.5 pl-1.5 pr-2 py-1.5 rounded-xl bg-white/[0.04] border border-white/[0.08] max-w-full">
                                        <span className="relative w-9 h-9 shrink-0 rounded-lg overflow-hidden bg-zinc-800 flex items-center justify-center text-sm font-bold text-zinc-400">
                                            {a.name[0]}
                                            {photo && <img src={resolveImageUrl(photo)} alt="" className="absolute inset-0 w-full h-full object-cover" onError={e => ((e.target as HTMLImageElement).style.display = "none")} />}
                                        </span>
                                        <span className="min-w-0">
                                            <span className="block text-sm font-semibold text-white truncate max-w-[11rem]">{a.name}</span>
                                            <span className="block text-[11px] text-zinc-400 truncate max-w-[11rem]">{a.role || p?.designation || (p ? roleText(p.role) : "Guest")}</span>
                                        </span>
                                        <button onClick={() => setAttendees(attendees.filter((_, i) => i !== idx))} title="Remove" className="ml-1 p-1 rounded-md text-zinc-500 hover:text-red-400 hover:bg-red-500/10"><X size={14} /></button>
                                    </span>
                                );
                            })}
                            {!attendees.length && <p className="text-xs text-zinc-500">No attendees added yet.</p>}
                        </div>
                    </section>

                    {/* Action items */}
                    <section className={cn(card, "lg:col-span-3 space-y-4")}>
                        <CardHead icon={<ListChecks size={18} />} title="Assigned Action Items" desc="Add and track action items from the meeting and discussion." />
                        <div className="flex flex-col sm:flex-row gap-2">
                            <div className="relative flex-1">
                                <SquareCheck size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
                                <input placeholder="Action item task description..." value={newActionTask} onChange={e => setNewActionTask(e.target.value)}
                                    onKeyDown={e => e.key === "Enter" && addActionItem()} className={cn(input, "pl-9")} data-testid="mom-task-input" />
                            </div>
                            <div className="relative sm:w-56">
                                <UserRound size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
                                <input list="mom-people" placeholder="Assignee (e.g., Prof. Ankit / OM)" value={newActionOwner} onChange={e => setNewActionOwner(e.target.value)}
                                    onKeyDown={e => e.key === "Enter" && addActionItem()} className={cn(input, "pl-9")} data-testid="mom-owner-input" />
                            </div>
                            <button onClick={addActionItem} data-testid="mom-task-add"
                                className="h-11 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold whitespace-nowrap">Add Task</button>
                        </div>
                        {actionItems.length ? (
                            <div className="space-y-2" data-testid="mom-tasks">
                                {actionItems.map((item, idx) => (
                                    <div key={idx} className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/[0.07]">
                                        <input type="checkbox" checked={item.status === "Completed"} onChange={() => toggleActionStatus(idx)} className="w-4 h-4 accent-emerald-500 cursor-pointer shrink-0" title="Mark done" />
                                        <div className="min-w-0 flex-1">
                                            <p className={cn("text-sm font-medium break-words", item.status === "Completed" ? "line-through text-zinc-500" : "text-white")}>{item.task}</p>
                                            <p className="text-[11px] text-zinc-400 mt-0.5">Assigned to <span className="text-emerald-400 font-semibold">{item.owner}</span></p>
                                        </div>
                                        <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-md border shrink-0", item.status === "Completed" ? "text-emerald-300 border-emerald-500/30 bg-emerald-500/10" : "text-amber-300 border-amber-500/30 bg-amber-500/10")}>{item.status === "Completed" ? "Done" : "Pending"}</span>
                                        <button onClick={() => setActionItems(actionItems.filter((_, i) => i !== idx))} title="Remove" className="p-1.5 rounded-md text-zinc-500 hover:text-red-400 hover:bg-red-500/10 shrink-0"><Trash2 size={14} /></button>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="rounded-xl border border-dashed border-white/[0.08] py-8 flex flex-col items-center text-center" data-testid="mom-tasks-empty">
                                <div className="w-10 h-10 rounded-xl bg-white/[0.04] flex items-center justify-center text-zinc-400 mb-2"><ClipboardList size={18} /></div>
                                <p className="text-sm text-zinc-300">No action items added yet.</p>
                                <p className="text-xs text-zinc-500 mt-0.5">Add key action items to track follow-ups and accountability.</p>
                            </div>
                        )}
                    </section>

                    {/* Escalations */}
                    <section className={cn(card, "lg:col-span-3 space-y-3")}>
                        <CardHead tone="rose" icon={<ShieldAlert size={18} />} title="Campus Escalations & Urgent Blockers" desc="Administration roadblocks, lab or system issues, missing substitutes." />
                        <textarea value={escalations} onChange={e => setEscalations(e.target.value)} data-testid="mom-escalations"
                            placeholder="College administration roadblocks, lab system issues, missing faculty substitute..."
                            className="w-full min-h-[6.5rem] px-3.5 py-3 rounded-xl bg-black/30 border border-white/[0.08] text-sm text-white placeholder:text-zinc-600 outline-none focus:border-rose-500/50 resize-y leading-relaxed" />
                    </section>

                    {/* Audit log */}
                    <section className={cn(card, "lg:col-span-2 space-y-3")}>
                        <CardHead tone="zinc" icon={<History size={18} />} title="Update Log" desc="Who updated this MoM and when." />
                        {updateLog.length === 0 ? <p className="text-xs text-zinc-500">No updates yet for this day.</p> : (
                            <div className="space-y-2 max-h-56 overflow-y-auto">
                                {[...updateLog].reverse().slice(0, 8).map((u, i) => (
                                    <div key={i} className="flex items-center justify-between gap-3 text-xs px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                                        <span className="min-w-0"><span className="font-semibold text-zinc-200 truncate block">{u.updatedByName || "User"}</span><span className="text-[10px] text-emerald-400">{roleText(u.role)}</span></span>
                                        <span className="text-[11px] text-zinc-500 shrink-0 tabular-nums">{u.updatedAt ? new Date(u.updatedAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : ""}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>
                </div>
            )}
        </div>
    );
}

const ROLE_TEXT: Record<string, string> = { HR: "HR Administrator", FOUNDER: "Founder", AD: "Associate Director", HOI: "Head of Institute", OM: "Operations Manager", TL: "Tech Lead", CURRICULUM_LEAD: "Curriculum Lead", CURRICULUM_HEAD: "Curriculum Head", PROFESSOR: "Professor", FACULTY: "Faculty", HR_EXECUTIVE: "HR Executive", TECH_TEAM: "Tech Team", MARKETING_TEAM: "Marketing Team" };
function roleText(r?: string) { return (r && ROLE_TEXT[r]) || r || ""; }

function CardHead({ icon, title, desc, tone = "emerald" }: { icon: React.ReactNode; title: string; desc: string; tone?: "emerald" | "rose" | "zinc" }) {
    const t = tone === "rose" ? "border-rose-500/30 bg-rose-500/10 text-rose-400" : tone === "zinc" ? "border-white/10 bg-white/5 text-zinc-300" : "border-emerald-500/30 bg-emerald-500/10 text-emerald-400";
    return (
        <div className="flex items-start gap-3 min-w-0">
            <div className={cn("w-10 h-10 shrink-0 rounded-xl border flex items-center justify-center", t)}>{icon}</div>
            <div className="min-w-0">
                <h2 className="text-base font-bold text-white leading-tight">{title}</h2>
                <p className="text-xs text-zinc-400 mt-0.5">{desc}</p>
            </div>
        </div>
    );
}
function TB({ title, onClick, children }: { title: string; onClick: () => void; children: React.ReactNode }) {
    return <button type="button" title={title} aria-label={title} onMouseDown={e => e.preventDefault()} onClick={onClick}
        className="w-8 h-8 rounded-md flex items-center justify-center text-zinc-300 hover:text-white hover:bg-white/[0.07] transition-colors">{children}</button>;
}
function Sep() { return <span className="w-px h-5 bg-white/10 mx-1" aria-hidden />; }