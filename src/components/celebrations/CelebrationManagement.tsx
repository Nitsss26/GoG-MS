"use client";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Cake, PartyPopper, UserPlus, Upload, Loader2, Eye, Trash2, Pencil, Check, Search, X, CalendarDays, Settings2, Image as ImageIcon, RefreshCw, Plus, CheckCircle2, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { uploadToCloudinary } from "@/lib/cloudinary";
import { optimizeImage } from "@/lib/image-optimize";
import { useMinWidth } from "@/lib/use-min-width";
import CelebrationBanner from "./CelebrationBanner";
import { HeaderBannerSample, isHeaderKind } from "./HeaderCelebration";
import CelebrationPreview from "./CelebrationPreview";
import { FESTIVALS, THEMES, THEME_CATEGORIES, BIRTHDAY_SELF_THEMES, BIRTHDAY_COLLEAGUE_THEMES, themeLabel, DEFAULTS, festivalOf, birthdayBanner, festivalBanner, welcomeBanner, type TodayCelebration, type ThemeKey } from "@/lib/celebration-themes";

/**
 * Announcements → Celebration Management (HR / HR Executive / Founder — the server checks it too).
 *   Birthday Celebration: two banner libraries (Birthday Person / Colleagues), employee birthday directory with
 *   Edit Birthday, per-employee banners and both previews.
 *   Festival Celebration: festival + date + theme + banner library + greeting / colours + animation switches, previews.
 *   New Member Welcome (its own tab in Announcements, next to Celebration Management — <NewMemberWelcome />):
 *     HR picks the new member + banner(s) / text → shown on everyone's dashboard ONLY on the publish day.
 * Everything is read from / saved to the server (GET / POST /api/celebrations/manage).
 */
type Tpl = { id: string; category: string; festivalKey?: string; name: string; imageUrl: string; greeting?: string; subtext?: string; headingColor?: string; textColor?: string; overlayColor?: string; bgColor?: string; align?: string; photoPosition?: string };
type Emp = { id: string; name: string; role: string; designation: string; dept: string; college: string; photoUrl: string; dob: string; dobMonth: number; dobDay: number; selfTemplateId: string; colleagueTemplateId: string; configured: boolean };
type Fest = { id: string; festivalKey: string; name: string; date: string; theme: ThemeKey; bannerTemplateId: string; greeting: string; textColor: string; bgColor: string; animation: boolean; subtle: boolean; status: string };
type Welcome = { id: string; employeeId: string; employeeName: string; date: string; imageUrl: string; selfImageUrl: string; greeting: string; subtext: string; selfGreeting: string; selfSubtext: string; headingColor: string; textColor: string; overlayColor: string; bgColor: string; align: string; photoPosition: string; createdByName?: string; createdAt?: string; /** showing now (24 hours from publishing) / until when — from the server */ live?: boolean; liveUntil?: string };
type Data = { templates: Tpl[]; setting: { selfTemplateId?: string; colleagueTemplateId?: string; selfTheme?: string; colleagueTheme?: string }; employees: Emp[]; festivals: Fest[]; welcomes?: Welcome[]; today?: string };

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const dobLabel = (e: Emp) => e.dobMonth ? `${String(e.dobDay).padStart(2, "0")} ${MONTHS[e.dobMonth - 1]}${/^\d{4}/.test(e.dob) ? ` ${e.dob.slice(0, 4)}` : ""}` : "—";
const dmy = (ymd: string) => ymd.split("-").reverse().join("-");
const istToday = () => new Date(Date.now() + 5.5 * 3600000).toISOString().slice(0, 10);
const btn = "inline-flex items-center justify-center gap-1.5 h-9 px-3 rounded-lg border text-[11px] font-bold whitespace-nowrap transition-colors disabled:opacity-50";
const field = "w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 h-10 text-xs text-white outline-none focus:border-primary/50";
const lbl = "block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1.5";

async function api(body: any) {
    const r = await fetch("/api/celebrations/manage", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error || "Could not save.");
    return d;
}
async function uploadBanner(file: File) { return (await uploadToCloudinary(await optimizeImage(file))).secure_url; }

/** Announcements → New Member Welcome (separate tab next to Celebration Management) */
export function NewMemberWelcome() { return <CelebrationManagement section="welcome" />; }

export default function CelebrationManagement({ section = "celebrations" }: { section?: "celebrations" | "welcome" }) {
    const [tab, setTab] = useState<"birthday" | "festival" | "welcome">(section === "welcome" ? "welcome" : "birthday");
    const [data, setData] = useState<Data | null>(null);
    const [err, setErr] = useState("");
    const [msg, setMsg] = useState("");
    const load = useCallback(async () => {
        try {
            const r = await fetch("/api/celebrations/manage", { cache: "no-store" });
            const d = await r.json().catch(() => ({}));
            if (!r.ok) throw new Error(d.error || "Could not load.");
            setData(d); setErr("");
        } catch (e: any) { setErr(e.message); setData(x => x || { templates: [], setting: {}, employees: [], festivals: [] }); }
    }, []);
    useEffect(() => { load(); }, [load]);
    const act = async (body: any) => { setErr(""); const d = await api(body); setMsg(d.message || "Saved."); await load(); return d; };

    return (
        <div className="space-y-4" data-testid={section === "welcome" ? "new-member-welcome" : "celebration-management"}>
            {section !== "welcome" && <div className="flex gap-1 p-1 bg-zinc-900 border border-zinc-800 rounded-2xl w-fit max-w-full overflow-x-auto" role="tablist" data-testid="cm-tabs">
                {([["birthday", "Birthday Celebration", Cake], ["festival", "Festival Celebration", PartyPopper]] as const).map(([k, l, I]) => (
                    <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} data-testid={`cm-tab-${k}`}
                        className={cn("flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[11px] font-bold whitespace-nowrap", tab === k ? "bg-zinc-800 text-primary shadow-inner" : "text-zinc-500 hover:text-zinc-300")}><I size={13} /> {l}</button>
                ))}
            </div>}
            {msg && <div className="flex items-start gap-2 p-3 rounded-xl border border-emerald-500/25 bg-emerald-500/10 text-emerald-200 text-xs" data-testid="cm-msg"><CheckCircle2 size={15} className="shrink-0" /><span className="flex-1 [overflow-wrap:anywhere]">{msg}</span><button onClick={() => setMsg("")} aria-label="Close"><X size={14} /></button></div>}
            {err && <div className="flex items-start gap-2 p-3 rounded-xl border border-red-500/25 bg-red-500/10 text-red-200 text-xs" data-testid="cm-error"><AlertTriangle size={15} className="shrink-0" /><span className="flex-1 [overflow-wrap:anywhere]">{err}</span><button onClick={() => setErr("")} aria-label="Close"><X size={14} /></button></div>}
            {!data ? <div className="py-16 flex justify-center"><Loader2 className="animate-spin text-zinc-500" /></div>
                : tab === "birthday" ? <BirthdaySection data={data} act={act} setErr={setErr} /> : tab === "festival" ? <FestivalSection data={data} act={act} setErr={setErr} /> : <WelcomeSection data={data} act={act} />}
        </div>
    );
}

// ───────────────────────── Birthday ─────────────────────────
function personOf(e?: Emp | null) { return e ? { name: e.name, designation: e.designation, college: e.college || e.dept, photoUrl: e.photoUrl } : { name: "Employee Name", designation: "Designation" }; }
function birthdayPreview(view: "self" | "colleague", t: Tpl | undefined, e?: Emp | null, anim?: { selfTheme?: string; colleagueTheme?: string }): TodayCelebration {
    const p = personOf(e);
    const self = anim?.selfTheme || "CONFETTI", coll = anim?.colleagueTheme || "NONE";
    if (view === "self") return { date: istToday(), banner: birthdayBanner("birthday-self", t, p), colleagues: [], birthdaySelf: true, effect: self === "NONE" ? null : { type: "birthday", theme: self as ThemeKey, key: "PREVIEW", opening: true, subtle: true } };
    // colleagues: the clean colleague banner, never the birthday person's animation — only the light effect HR switched on
    return { date: istToday(), banner: birthdayBanner("birthday-colleague", t, p), colleagues: [], birthdaySelf: false, effect: coll === "NONE" ? null : { type: "colleague-birthday", theme: coll as ThemeKey, key: "PREVIEW", opening: true, subtle: true } };
}

function BirthdaySection({ data, act, setErr }: { data: Data; act: (b: any) => Promise<any>; setErr: (s: string) => void }) {
    const { user } = useAuth();
    // table only where it fits next to the sidebar without sideways scrolling; smaller screens get the cards
    const wide = useMinWidth(1280);
    const self = data.templates.filter(t => t.category === "BIRTHDAY_SELF");
    const coll = data.templates.filter(t => t.category === "BIRTHDAY_COLLEAGUE");
    const tplById = (id?: string) => data.templates.find(t => t.id === id);
    const [q, setQ] = useState(""); const [when, setWhen] = useState<"all" | "month" | "today" | "missing">("all");
    const [page, setPage] = useState(1);
    const [dobFor, setDobFor] = useState<Emp | null>(null);
    const [cfgFor, setCfgFor] = useState<Emp | null>(null);
    const [preview, setPreview] = useState<{ title: string; payload: TodayCelebration } | null>(null);
    const today = istToday(); const [, tm, td] = today.split("-").map(Number);
    const me = data.employees.find(e => e.id === user?.id) || data.employees[0] || null;
    const list = useMemo(() => {
        const t = q.trim().toLowerCase();
        return data.employees.filter(e => (!t || `${e.name} ${e.id} ${e.designation} ${e.college} ${e.dept}`.toLowerCase().includes(t))
            && (when === "all" || (when === "month" ? e.dobMonth === tm : when === "today" ? e.dobMonth === tm && e.dobDay === td : !e.dobMonth)));
    }, [data.employees, q, when, tm, td]);
    useEffect(() => setPage(1), [q, when]);
    const PAGE = 25; const pages = Math.max(1, Math.ceil(list.length / PAGE)); const shown = list.slice((page - 1) * PAGE, page * PAGE);
    const selfOf = (e: Emp) => tplById(e.selfTemplateId) || tplById(data.setting.selfTemplateId);
    const collOf = (e: Emp) => tplById(e.colleagueTemplateId) || tplById(data.setting.colleagueTemplateId);
    const openPreview = (view: "self" | "colleague", e: Emp | null, t?: Tpl) => setPreview({
        title: view === "self" ? `Birthday Person Dashboard — ${e?.name || "preview"}` : `Colleagues' Dashboard — ${e?.name || "preview"}`,
        payload: birthdayPreview(view, t ?? (e ? (view === "self" ? selfOf(e) : collOf(e)) : tplById(view === "self" ? data.setting.selfTemplateId : data.setting.colleagueTemplateId)), e, data.setting),
    });

    return (
        <div className="space-y-5">
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 items-start">
                <div className="space-y-2">
                    <Library title="Birthday Person Banner" hint="Shown on the dashboard of the employee whose birthday it is (with their animation for them only)." category="BIRTHDAY_SELF"
                        items={self} activeId={data.setting.selfTemplateId} act={act} setErr={setErr} onPreview={t => openPreview("self", me, t)} />
                    <AnimationPick kind="self" label="Birthday Person Animation" hint="Plays only for the employee whose birthday it is."
                        value={data.setting.selfTheme || "CONFETTI"} options={BIRTHDAY_SELF_THEMES} act={act} setErr={setErr}
                        onPreview={v => setPreview({ title: `Birthday Person Animation — ${themeLabel(v)}`, payload: birthdayPreview("self", tplById(data.setting.selfTemplateId), me, { ...data.setting, selfTheme: v }) })} />
                </div>
                <div className="space-y-2">
                    <Library title="Colleagues' Birthday Banner" hint="Shown to everyone else on a colleague's birthday — a clean banner, no confetti." category="BIRTHDAY_COLLEAGUE"
                        items={coll} activeId={data.setting.colleagueTemplateId} act={act} setErr={setErr} onPreview={t => openPreview("colleague", me, t)} />
                    <AnimationPick kind="colleague" label="Colleague Animation" hint="Off by default. Only light effects — never the birthday person's animation or confetti."
                        value={data.setting.colleagueTheme || "NONE"} options={BIRTHDAY_COLLEAGUE_THEMES} act={act} setErr={setErr}
                        onPreview={v => setPreview({ title: `Colleague Animation — ${themeLabel(v)}`, payload: birthdayPreview("colleague", tplById(data.setting.colleagueTemplateId), me, { ...data.setting, colleagueTheme: v }) })} />
                </div>
            </div>

            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4 space-y-3" data-testid="cm-directory">
                <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-bold text-white mr-auto flex items-center gap-2"><Cake size={15} className="text-pink-300" /> Employee Birthday Directory <span className="text-[11px] text-zinc-500 font-medium">{list.length}</span></p>
                    <div className="relative w-full sm:w-64"><Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search name, ID, designation…" data-testid="cm-dir-search" className={cn(field, "pl-8")} /></div>
                    <select value={when} onChange={e => setWhen(e.target.value as any)} data-testid="cm-dir-when" aria-label="Show" className={cn(field, "w-full sm:w-44")}>
                        <option value="all">All employees</option><option value="month">Birthdays this month</option><option value="today">Birthdays today</option><option value="missing">DOB missing</option>
                    </select>
                </div>
                {!shown.length ? <p className="py-10 text-center text-xs text-zinc-500" data-testid="cm-dir-empty">No employees match.</p> : wide ? (
                    <div className="overflow-x-auto rounded-xl border border-zinc-800">
                        {/* the buttons sit in their own line under each employee (no Actions column → no sideways scrolling) */}
                        <table className="w-full text-xs min-w-[720px]" data-testid="cm-dir-table">
                            <thead className="bg-zinc-900/80 text-[10px] uppercase tracking-wider text-zinc-500"><tr>
                                {["Employee Name", "Employee ID", "Designation", "College / Department", "Date of Birth", "Birthday Banner", "Status"].map(h => <th key={h} className="text-left font-bold px-3 py-2.5">{h}</th>)}
                            </tr></thead>
                            <tbody>
                                {shown.map(e => (<Fragment key={e.id}>
                                    <tr data-testid="cm-dir-row" data-id={e.id} className="border-t border-zinc-800/70">
                                        <td className="px-3 py-2.5"><span className="flex items-center gap-2"><Avatar e={e} /> <b className="text-white">{e.name}</b>{e.dobMonth === tm && e.dobDay === td && <Cake size={12} className="text-pink-300" />}</span></td>
                                        <td className="px-3 py-2.5 font-mono text-[11px] text-zinc-400">{e.id}</td>
                                        <td className="px-3 py-2.5 text-zinc-300">{e.designation}</td>
                                        <td className="px-3 py-2.5 text-zinc-300">{e.college || e.dept || "—"}</td>
                                        <td className="px-3 py-2.5 text-zinc-200 whitespace-nowrap" data-testid="cm-dir-dob">{dobLabel(e)}</td>
                                        <td className="px-3 py-2.5 text-zinc-300">{selfOf(e)?.name || "Default"}</td>
                                        <td className="px-3 py-2.5"><span className={cn("inline-flex px-2 py-0.5 rounded-md border text-[10.5px] font-bold", e.configured ? "text-sky-300 bg-sky-500/10 border-sky-500/25" : "text-zinc-400 bg-zinc-800 border-zinc-700")} data-testid="cm-dir-status">{e.configured ? "Configured" : "Default"}</span></td>
                                    </tr>
                                    <tr data-testid="cm-dir-actions-row" data-id={e.id}>
                                        <td colSpan={7} className="px-3 pt-0 pb-2.5"><RowActions e={e} onDob={() => setDobFor(e)} onCfg={() => setCfgFor(e)} onPreview={v => openPreview(v, e)} /></td>
                                    </tr>
                                </Fragment>))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="space-y-2" data-testid="cm-dir-cards">
                        {shown.map(e => (
                            <div key={e.id} className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3 space-y-2" data-testid="cm-dir-card">
                                <div className="flex items-start gap-2.5"><Avatar e={e} size={36} /><div className="min-w-0 flex-1"><p className="text-sm font-bold text-white [overflow-wrap:anywhere]">{e.name}</p><p className="text-[11px] text-zinc-400 [overflow-wrap:anywhere]">{e.id} · {e.designation}{e.college ? ` · ${e.college}` : ""}</p></div>
                                    <span className={cn("shrink-0 inline-flex px-2 py-0.5 rounded-md border text-[10px] font-bold", e.configured ? "text-sky-300 bg-sky-500/10 border-sky-500/25" : "text-zinc-400 bg-zinc-800 border-zinc-700")}>{e.configured ? "Configured" : "Default"}</span></div>
                                <p className="text-[11px] text-zinc-300"><span className="text-zinc-500">DOB:</span> {dobLabel(e)} · <span className="text-zinc-500">Banner:</span> {selfOf(e)?.name || "Default"}</p>
                                <RowActions e={e} onDob={() => setDobFor(e)} onCfg={() => setCfgFor(e)} onPreview={v => openPreview(v, e)} />
                            </div>
                        ))}
                    </div>
                )}
                {pages > 1 && <div className="flex items-center justify-between text-xs text-zinc-400"><span>{(page - 1) * PAGE + 1}–{Math.min(page * PAGE, list.length)} of {list.length}</span><div className="flex gap-1.5"><button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className={`${btn} border-zinc-800 bg-zinc-900`}>Previous</button><button disabled={page >= pages} onClick={() => setPage(p => p + 1)} className={`${btn} border-zinc-800 bg-zinc-900`}>Next</button></div></div>}
            </div>

            {dobFor && <DobDialog e={dobFor} onClose={() => setDobFor(null)} act={act} />}
            {cfgFor && <ConfigDialog e={cfgFor} self={self} coll={coll} setting={data.setting} onClose={() => setCfgFor(null)} act={act} />}
            {preview && <CelebrationPreview title={preview.title} payload={preview.payload} onClose={() => setPreview(null)} />}
        </div>
    );
}

/** Birthday animation theme: choose → preview → save */
function AnimationPick({ kind, label, hint, value, options, act, setErr, onPreview }: {
    kind: "self" | "colleague"; label: string; hint: string; value: string; options: string[]; act: (b: any) => Promise<any>; setErr: (s: string) => void; onPreview: (v: string) => void;
}) {
    const [v, setV] = useState(value); const [busy, setBusy] = useState(false);
    useEffect(() => setV(value), [value]);
    const save = async () => { setBusy(true); try { await act({ action: "birthday_animation", [kind === "self" ? "selfTheme" : "colleagueTheme"]: v }); } catch (e: any) { setErr(e.message); } finally { setBusy(false); } };
    return (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-3 sm:p-4 space-y-2" data-testid={`cm-anim-${kind}`}>
            <label className={lbl} htmlFor={`cm-anim-${kind}-sel`}>{label}</label>
            <div className="flex flex-wrap gap-2">
                <select id={`cm-anim-${kind}-sel`} value={v} onChange={e => setV(e.target.value)} data-testid={`cm-anim-${kind}-select`} className={cn(field, "flex-1 min-w-[160px]")}>
                    {options.map(o => <option key={o} value={o}>{themeLabel(o)}</option>)}
                </select>
                <button onClick={() => onPreview(v)} disabled={v === "NONE"} data-testid={`cm-anim-${kind}-preview`} className={`${btn} h-10 border-amber-500/40 bg-amber-500/10 text-amber-200`}><Eye size={13} /> {kind === "self" ? "Preview Birthday Person Animation" : "Preview Colleague Animation"}</button>
                <button onClick={save} disabled={busy || v === value} data-testid={`cm-anim-${kind}-save`} className={`${btn} h-10 border-primary/40 bg-primary text-white`}>{busy ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Save</button>
            </div>
            <p className="text-[10px] text-zinc-500">{hint}{v !== "NONE" && THEMES.find(t => t.key === v) ? ` · ${THEMES.find(t => t.key === v)!.description}` : ""}</p>
        </div>
    );
}

function Avatar({ e, size = 28 }: { e: Emp; size?: number }) {
    const [bad, setBad] = useState(false);
    return e.photoUrl && !bad ? <img src={e.photoUrl} alt="" onError={() => setBad(true)} className="rounded-full object-cover border border-zinc-700 shrink-0" style={{ width: size, height: size }} />
        : <span className="rounded-full bg-zinc-800 border border-zinc-700 text-zinc-300 font-bold flex items-center justify-center shrink-0" style={{ width: size, height: size, fontSize: size * 0.42 }}>{(e.name || "?")[0]}</span>;
}
function RowActions({ e, onDob, onCfg, onPreview }: { e: Emp; onDob: () => void; onCfg: () => void; onPreview: (v: "self" | "colleague") => void }) {
    return (
        <div className="flex flex-wrap gap-1.5 justify-end">
            <button onClick={onDob} data-testid="cm-edit-dob" className={`${btn} h-8 border-zinc-700 bg-zinc-900 text-zinc-200`}><CalendarDays size={12} /> Edit Birthday</button>
            <button onClick={onCfg} data-testid="cm-configure" className={`${btn} h-8 border-zinc-700 bg-zinc-900 text-zinc-200`}><Settings2 size={12} /> Configure</button>
            <button onClick={() => onPreview("self")} data-testid="cm-prev-self" className={`${btn} h-8 border-pink-500/30 bg-pink-500/10 text-pink-200`}><Eye size={12} /> Birthday Person</button>
            <button onClick={() => onPreview("colleague")} data-testid="cm-prev-colleague" className={`${btn} h-8 border-sky-500/30 bg-sky-500/10 text-sky-200`}><Eye size={12} /> Colleagues</button>
        </div>
    );
}

function Modal({ title, onClose, children, testId }: { title: string; onClose: () => void; children: React.ReactNode; testId?: string }) {
    useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); }; window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, [onClose]);
    return (
        <div className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center sm:p-4" role="dialog" aria-modal="true" data-testid={testId}>
            <div className="absolute inset-0 bg-black/70" onClick={onClose} />
            <div className="relative w-full sm:max-w-lg max-h-[92vh] overflow-y-auto bg-zinc-950 border border-zinc-800 rounded-t-2xl sm:rounded-2xl p-5 space-y-4 shadow-2xl">
                <div className="flex items-center justify-between gap-3"><h3 className="text-base font-bold text-white">{title}</h3><button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/5 text-zinc-400" aria-label="Close"><X size={16} /></button></div>
                {children}
            </div>
        </div>
    );
}

function DobDialog({ e, onClose, act }: { e: Emp; onClose: () => void; act: (b: any) => Promise<any> }) {
    const [dob, setDob] = useState(/^\d{4}-\d{2}-\d{2}$/.test(e.dob) ? e.dob : "");
    const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
    const save = async () => {
        if (!dob) { setErr("Choose the date of birth."); return; }
        setBusy(true); setErr("");
        try { await act({ action: "edit_dob", employeeId: e.id, dob }); onClose(); } catch (x: any) { setErr(x.message); } finally { setBusy(false); }
    };
    return (
        <Modal title="Edit Birthday" onClose={onClose} testId="cm-dob-dialog">
            <p className="text-xs text-zinc-400"><b className="text-white">{e.name}</b> ({e.id}) · current: {dobLabel(e)}</p>
            <div><label className={lbl} htmlFor="cm-dob">Date of Birth</label><input id="cm-dob" type="date" max={istToday()} value={dob} onChange={x => setDob(x.target.value)} data-testid="cm-dob-input" className={cn(field, "[color-scheme:dark]")} /></div>
            <p className="text-[11px] text-zinc-500">Saved on the employee record (both date-of-birth fields), with who changed it and when. Birthday banners follow it automatically.</p>
            {err && <p className="text-xs text-red-300" data-testid="cm-dob-error">{err}</p>}
            <div className="grid grid-cols-2 gap-2"><button onClick={onClose} className={`${btn} h-10 border-zinc-700 bg-zinc-900 text-zinc-200`}>Cancel</button><button onClick={save} disabled={busy} data-testid="cm-dob-save" className={`${btn} h-10 border-primary/40 bg-primary text-white`}>{busy ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Save</button></div>
        </Modal>
    );
}

function ConfigDialog({ e, self, coll, setting, onClose, act }: { e: Emp; self: Tpl[]; coll: Tpl[]; setting: Data["setting"]; onClose: () => void; act: (b: any) => Promise<any> }) {
    const [s, setS] = useState(e.selfTemplateId); const [c, setC] = useState(e.colleagueTemplateId);
    const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
    const nameOf = (l: Tpl[], id?: string) => l.find(t => t.id === id)?.name || "Default";
    const save = async () => { setBusy(true); setErr(""); try { await act({ action: "employee_config", employeeId: e.id, selfTemplateId: s, colleagueTemplateId: c }); onClose(); } catch (x: any) { setErr(x.message); } finally { setBusy(false); } };
    return (
        <Modal title={`Birthday banners — ${e.name}`} onClose={onClose} testId="cm-cfg-dialog">
            <div><label className={lbl}>Birthday Person Banner</label>
                <select value={s} onChange={x => setS(x.target.value)} data-testid="cm-cfg-self" className={field}><option value="">Use the active banner ({nameOf(self, setting.selfTemplateId)})</option>{self.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></div>
            <div><label className={lbl}>Colleagues&apos; Birthday Banner</label>
                <select value={c} onChange={x => setC(x.target.value)} data-testid="cm-cfg-coll" className={field}><option value="">Use the active banner ({nameOf(coll, setting.colleagueTemplateId)})</option>{coll.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></div>
            {err && <p className="text-xs text-red-300">{err}</p>}
            <div className="grid grid-cols-2 gap-2"><button onClick={onClose} className={`${btn} h-10 border-zinc-700 bg-zinc-900 text-zinc-200`}>Cancel</button><button onClick={save} disabled={busy} data-testid="cm-cfg-save" className={`${btn} h-10 border-primary/40 bg-primary text-white`}>{busy ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Save</button></div>
        </Modal>
    );
}

/** A banner library (upload / select active / edit / replace / delete / preview) */
function Library({ title, hint, category, festivalKey, items, activeId, act, setErr, onPreview, onSelect }: {
    title: string; hint: string; category: string; festivalKey?: string; items: Tpl[]; activeId?: string; act: (b: any) => Promise<any>; setErr: (s: string) => void;
    onPreview: (t?: Tpl) => void; onSelect?: (id: string) => void;
}) {
    const file = useRef<HTMLInputElement>(null);
    const [busy, setBusy] = useState(""); const [edit, setEdit] = useState<Tpl | null>(null);
    const isBday = category !== "FESTIVAL";
    const defaults = category === "BIRTHDAY_SELF" ? DEFAULTS.birthdaySelf : category === "BIRTHDAY_COLLEAGUE" ? DEFAULTS.birthdayColleague : null;
    const upload = async (files: FileList | null) => {
        if (!files?.length) return; setBusy("upload");
        try {
            for (const f of Array.from(files)) {
                const url = await uploadBanner(f);
                await act({ action: "template_create", category, festivalKey, imageUrl: url, name: f.name.replace(/\.[a-z0-9]+$/i, "").slice(0, 60), ...(defaults ? { greeting: defaults.heading, subtext: defaults.subheading, headingColor: defaults.headingColor, textColor: defaults.textColor, overlayColor: defaults.overlayColor, align: defaults.align, photoPosition: defaults.photoPosition } : {}) });
            }
        } catch (e: any) { setErr(e.message || "Upload failed."); } finally { setBusy(""); if (file.current) file.current.value = ""; }
    };
    const select = async (id: string) => {
        if (onSelect) { onSelect(id); return; }
        setBusy(id || "default"); try { await act({ action: "set_active", category, id }); } catch (e: any) { setErr(e.message); } finally { setBusy(""); }
    };
    const del = async (t: Tpl) => { setBusy(t.id); try { await act({ action: "template_delete", id: t.id }); } catch (e: any) { setErr(e.message); } finally { setBusy(""); } };
    return (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4 space-y-3" data-testid={`cm-lib-${category}`}>
            <div className="flex flex-wrap items-start gap-2">
                <div className="min-w-0 mr-auto"><p className="text-sm font-bold text-white flex items-center gap-2"><ImageIcon size={14} className="text-primary" /> {title}</p><p className="text-[11px] text-zinc-500">{hint}</p></div>
                <input ref={file} type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple className="hidden" onChange={e => upload(e.target.files)} data-testid={`cm-upload-input-${category}`} />
                <button onClick={() => file.current?.click()} disabled={!!busy} data-testid={`cm-upload-${category}`} className={`${btn} border-primary/40 bg-primary/10 text-primary`}>{busy === "upload" ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />} Upload Banner</button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {isBday && (
                    <div className={cn("rounded-xl border p-2 space-y-2", !activeId ? "border-primary/50 bg-primary/5" : "border-zinc-800")} data-testid="cm-tpl" data-id="">
                        <div className="h-24 rounded-lg flex items-center justify-center text-[11px] font-bold text-white/80" style={{ background: defaults?.bgColor }}>Built-in default banner</div>
                        <div className="flex items-center justify-between gap-1.5"><p className="text-xs font-semibold text-white truncate">Default</p>{!activeId && <span className="text-[10px] font-bold text-primary" data-testid="cm-tpl-active">Active</span>}</div>
                        <div className="flex flex-wrap gap-1.5">
                            {activeId && <button onClick={() => select("")} disabled={!!busy} data-testid="cm-tpl-select" className={`${btn} h-8 border-zinc-700 bg-zinc-900 text-zinc-200`}><Check size={12} /> Select</button>}
                            <button onClick={() => onPreview(undefined)} data-testid="cm-tpl-preview" className={`${btn} h-8 border-zinc-700 bg-zinc-900 text-zinc-200`}><Eye size={12} /> Preview</button>
                        </div>
                    </div>
                )}
                {items.map(t => (
                    <div key={t.id} className={cn("rounded-xl border p-2 space-y-2", activeId === t.id ? "border-primary/50 bg-primary/5" : "border-zinc-800")} data-testid="cm-tpl" data-id={t.id}>
                        <img src={t.imageUrl} alt="" className="w-full h-24 object-contain rounded-lg bg-zinc-950" />
                        <div className="flex items-center justify-between gap-1.5"><p className="text-xs font-semibold text-white truncate" title={t.name}>{t.name}</p>{activeId === t.id && <span className="text-[10px] font-bold text-primary shrink-0" data-testid="cm-tpl-active">Active</span>}</div>
                        <div className="flex flex-wrap gap-1.5">
                            {activeId !== t.id && <button onClick={() => select(t.id)} disabled={!!busy} data-testid="cm-tpl-select" className={`${btn} h-8 border-zinc-700 bg-zinc-900 text-zinc-200`}>{busy === t.id ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} Select</button>}
                            <button onClick={() => onPreview(t)} data-testid="cm-tpl-preview" className={`${btn} h-8 border-zinc-700 bg-zinc-900 text-zinc-200`}><Eye size={12} /> Preview</button>
                            <button onClick={() => setEdit(t)} data-testid="cm-tpl-edit" className={`${btn} h-8 border-zinc-700 bg-zinc-900 text-zinc-200`}><Pencil size={12} /> Edit</button>
                            {activeId !== t.id && <button onClick={() => del(t)} disabled={!!busy} data-testid="cm-tpl-delete" className={`${btn} h-8 border-red-500/30 bg-red-500/10 text-red-300`}><Trash2 size={12} /> Delete</button>}
                        </div>
                    </div>
                ))}
            </div>
            {!items.length && !isBday && <p className="text-[11px] text-zinc-500" data-testid="cm-lib-empty">No banners yet for this festival — upload one or more.</p>}
            {edit && <TemplateDialog t={edit} isBday={isBday} onClose={() => setEdit(null)} act={act} />}
        </div>
    );
}

function ColorField({ label, value, onChange, testId }: { label: string; value: string; onChange: (v: string) => void; testId?: string }) {
    const hex = /^#[0-9a-f]{6}/i.test(value) ? value.slice(0, 7) : "#000000";
    return (
        <label className="block min-w-0"><span className={lbl}>{label}</span>
            <span className="flex items-center gap-2 h-10 px-2 bg-zinc-900 border border-zinc-800 rounded-lg">
                <input type="color" value={hex} onChange={e => onChange(e.target.value)} data-testid={testId} className="w-8 h-7 bg-transparent border-0 p-0 cursor-pointer shrink-0" aria-label={label} />
                <input value={value} onChange={e => onChange(e.target.value)} className="flex-1 min-w-0 bg-transparent text-xs text-white outline-none font-mono" aria-label={`${label} value`} />
            </span>
        </label>
    );
}

function TemplateDialog({ t, isBday, onClose, act }: { t: Tpl; isBday: boolean; onClose: () => void; act: (b: any) => Promise<any> }) {
    const d = t.category === "BIRTHDAY_SELF" ? DEFAULTS.birthdaySelf : DEFAULTS.birthdayColleague;
    const [f, setF] = useState({ name: t.name || "", greeting: t.greeting || (isBday ? d.heading : ""), subtext: t.subtext ?? (isBday ? d.subheading : ""), headingColor: t.headingColor || "#ffffff", textColor: t.textColor || "#e4e4e7", overlayColor: t.overlayColor || "rgba(0,0,0,0.25)", align: t.align || "left", photoPosition: t.photoPosition || "right", imageUrl: t.imageUrl });
    const [busy, setBusy] = useState(false); const [err, setErr] = useState(""); const file = useRef<HTMLInputElement>(null);
    const replace = async (fl: FileList | null) => { if (!fl?.[0]) return; setBusy(true); try { setF({ ...f, imageUrl: await uploadBanner(fl[0]) }); } catch { setErr("Upload failed."); } finally { setBusy(false); } };
    const save = async () => { setBusy(true); setErr(""); try { await act({ action: "template_update", id: t.id, ...f, ...(f.imageUrl === t.imageUrl ? { imageUrl: undefined } : {}) }); onClose(); } catch (x: any) { setErr(x.message); } finally { setBusy(false); } };
    const sample = isBday ? birthdayBanner(t.category === "BIRTHDAY_SELF" ? "birthday-self" : "birthday-colleague", { ...t, ...f }, { name: "Rahul Sharma", designation: "Professor", college: "LNCT" }) : festivalBanner({ festivalKey: t.festivalKey, name: "", greeting: f.greeting }, { ...t, ...f });
    return (
        <Modal title="Edit Banner" onClose={onClose} testId="cm-tpl-dialog">
            {isHeaderKind(sample.kind) ? <HeaderBannerSample banner={sample} testId="cm-tpl-sample" /> : <CelebrationBanner banner={sample} testId="cm-tpl-sample" />}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2"><label className={lbl}>Name</label><input value={f.name} onChange={e => setF({ ...f, name: e.target.value })} className={field} data-testid="cm-tpl-name" /></div>
                {isBday && <div className="sm:col-span-2"><label className={lbl}>Greeting <span className="normal-case tracking-normal text-zinc-500 font-medium">({"{name}"}, {"{firstName}"}, {"{designation}"} are filled in)</span></label><input value={f.greeting} onChange={e => setF({ ...f, greeting: e.target.value })} className={field} data-testid="cm-tpl-greeting" /></div>}
                {isBday && <div className="sm:col-span-2"><label className={lbl}>Message</label><input value={f.subtext} onChange={e => setF({ ...f, subtext: e.target.value })} className={field} /></div>}
                <ColorField label="Heading Colour" value={f.headingColor} onChange={v => setF({ ...f, headingColor: v })} />
                <ColorField label="Text Colour" value={f.textColor} onChange={v => setF({ ...f, textColor: v })} />
                <ColorField label="Overlay Colour" value={f.overlayColor} onChange={v => setF({ ...f, overlayColor: v })} />
                <div><label className={lbl}>Text Alignment</label><select value={f.align} onChange={e => setF({ ...f, align: e.target.value })} className={field}><option value="left">Left</option><option value="center">Center</option><option value="right">Right</option></select></div>
                {isBday && <div><label className={lbl}>Photo Position</label><select value={f.photoPosition} onChange={e => setF({ ...f, photoPosition: e.target.value })} className={field} data-testid="cm-tpl-photo"><option value="right">Right</option><option value="left">Left</option><option value="center">Center (above text)</option><option value="none">No photo</option></select></div>}
            </div>
            <input ref={file} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={e => replace(e.target.files)} />
            {err && <p className="text-xs text-red-300">{err}</p>}
            <div className="flex flex-wrap gap-2 justify-end">
                <button onClick={() => file.current?.click()} disabled={busy} data-testid="cm-tpl-replace" className={`${btn} h-10 border-zinc-700 bg-zinc-900 text-zinc-200`}><RefreshCw size={13} /> Replace Image</button>
                <button onClick={onClose} className={`${btn} h-10 border-zinc-700 bg-zinc-900 text-zinc-200`}>Cancel</button>
                <button onClick={save} disabled={busy} data-testid="cm-tpl-save" className={`${btn} h-10 border-primary/40 bg-primary text-white`}>{busy ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Save</button>
            </div>
        </Modal>
    );
}

// ───────────────────────── Festival ─────────────────────────
const blankFest = (): Fest => ({ id: "", festivalKey: "DIWALI", name: "Diwali", date: "", theme: "DIYAS", bannerTemplateId: "", greeting: FESTIVALS[0].greeting, textColor: DEFAULTS.festival.textColor, bgColor: DEFAULTS.festival.bgColor, animation: true, subtle: true, status: "Active" });
function festivalPreview(f: Fest, t: Tpl | undefined, withEffect: boolean): TodayCelebration {
    return { date: f.date || istToday(), banner: festivalBanner(f, t), colleagues: [], birthdaySelf: false, effect: withEffect && f.animation ? { type: "festival", theme: f.theme, key: "PREVIEW", opening: true, subtle: f.subtle } : null };
}

function FestivalSection({ data, act, setErr }: { data: Data; act: (b: any) => Promise<any>; setErr: (s: string) => void }) {
    const [f, setF] = useState<Fest>(blankFest());
    const [busy, setBusy] = useState(false); const [formErr, setFormErr] = useState("");
    const [preview, setPreview] = useState<{ title: string; payload: TodayCelebration; save?: boolean } | null>(null);
    const lib = data.templates.filter(t => t.category === "FESTIVAL" && t.festivalKey === f.festivalKey);
    const tpl = data.templates.find(t => t.id === f.bannerTemplateId);
    const today = istToday();
    const pickFestival = (key: string) => { const def = festivalOf(key)!; setF({ ...f, festivalKey: key, name: def.name, theme: def.theme, greeting: def.greeting, bannerTemplateId: "" }); };
    const save = async () => {
        if (!f.date) { setFormErr("Choose the celebration date."); return; }
        setBusy(true); setFormErr("");
        try { const d = await act({ action: "festival_save", ...f }); setF({ ...f, id: d.id || f.id }); setPreview(null); }
        catch (e: any) { setFormErr(e.message); } finally { setBusy(false); }
    };
    const del = async (x: Fest) => { try { await act({ action: "festival_delete", id: x.id }); if (f.id === x.id) setF(blankFest()); } catch (e: any) { setErr(e.message); } };
    const sorted = [...data.festivals].sort((a, b) => (a.date < today) === (b.date < today) ? a.date.localeCompare(b.date) * (a.date < today ? -1 : 1) : a.date < today ? 1 : -1);

    return (
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] gap-4 items-start">
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4 space-y-4" data-testid="cm-fest-form">
                <div className="flex items-center justify-between gap-2"><p className="text-sm font-bold text-white flex items-center gap-2"><PartyPopper size={15} className="text-amber-300" /> {f.id ? `Edit ${f.name}` : "New Festival Celebration"}</p>
                    {f.id && <button onClick={() => setF(blankFest())} className={`${btn} h-8 border-zinc-700 bg-zinc-900 text-zinc-200`}><Plus size={12} /> New</button>}</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div><label className={lbl} htmlFor="cm-fest-key">Festival Name</label>
                        <select id="cm-fest-key" value={f.festivalKey} onChange={e => pickFestival(e.target.value)} data-testid="cm-fest-key" className={field}>{FESTIVALS.map(x => <option key={x.key} value={x.key}>{x.name}</option>)}</select></div>
                    <div><label className={lbl} htmlFor="cm-fest-date">Celebration Date</label>
                        <input id="cm-fest-date" type="date" value={f.date} onChange={e => setF({ ...f, date: e.target.value })} data-testid="cm-fest-date" className={cn(field, "[color-scheme:dark]")} /></div>
                    <div><label className={lbl} htmlFor="cm-fest-theme">Festival Theme</label>
                        <select id="cm-fest-theme" value={f.theme} onChange={e => setF({ ...f, theme: e.target.value as ThemeKey })} data-testid="cm-fest-theme" className={field}>{THEME_CATEGORIES.map(c => <optgroup key={c} label={c}>{THEMES.filter(t => t.category === c).map(t => <option key={t.key} value={t.key}>{t.label}</option>)}</optgroup>)}</select>
                        <p className="text-[10px] text-zinc-500 mt-1">{THEMES.find(t => t.key === f.theme)?.description}</p></div>
                    <div><label className={lbl} htmlFor="cm-fest-name">Display Name</label><input id="cm-fest-name" value={f.name} onChange={e => setF({ ...f, name: e.target.value })} className={field} data-testid="cm-fest-name" /></div>
                    <div className="sm:col-span-2"><label className={lbl} htmlFor="cm-fest-greeting">Festival Greeting</label><input id="cm-fest-greeting" value={f.greeting} onChange={e => setF({ ...f, greeting: e.target.value })} className={field} data-testid="cm-fest-greeting" /></div>
                    <ColorField label="Text Colour" value={f.textColor} onChange={v => setF({ ...f, textColor: v })} testId="cm-fest-text" />
                    <ColorField label="Background Colour" value={f.bgColor} onChange={v => setF({ ...f, bgColor: v })} testId="cm-fest-bg" />
                    <label className="flex items-center gap-2.5 min-h-[40px] text-xs text-zinc-200 cursor-pointer"><input type="checkbox" className="w-4 h-4" checked={f.animation} onChange={e => setF({ ...f, animation: e.target.checked })} data-testid="cm-fest-anim" /> Enable Dashboard Animation</label>
                    <label className="flex items-center gap-2.5 min-h-[40px] text-xs text-zinc-200 cursor-pointer"><input type="checkbox" className="w-4 h-4" checked={f.subtle} disabled={!f.animation} onChange={e => setF({ ...f, subtle: e.target.checked })} data-testid="cm-fest-subtle" /> Enable Subtle All-Day Effects</label>
                </div>
                <Library title={`${festivalOf(f.festivalKey)?.name} Banners`} hint="Upload one or more banners. Only the selected banner appears on the dashboard; the others stay for later use."
                    category="FESTIVAL" festivalKey={f.festivalKey} items={lib} activeId={f.bannerTemplateId} act={act} setErr={setErr}
                    onSelect={id => setF({ ...f, bannerTemplateId: id })} onPreview={t => setPreview({ title: `Festival Banner — ${f.name}`, payload: festivalPreview(f, t || tpl, false) })} />
                <div><p className={lbl}>Selected Banner (dashboard header)</p><HeaderBannerSample banner={festivalBanner(f, tpl)} testId="cm-fest-sample" /></div>
                {formErr && <p className="text-xs text-red-300" data-testid="cm-fest-error">{formErr}</p>}
                <div className="flex flex-wrap gap-2 justify-end">
                    <button onClick={() => setPreview({ title: `Festival Banner — ${f.name}`, payload: festivalPreview(f, tpl, false), save: true })} data-testid="cm-fest-prev-banner" className={`${btn} h-10 border-zinc-700 bg-zinc-900 text-zinc-200`}><Eye size={13} /> Preview Banner</button>
                    <button onClick={() => setPreview({ title: `Dashboard Animation — ${f.name}`, payload: festivalPreview(f, tpl, true), save: true })} disabled={!f.animation} data-testid="cm-fest-prev-anim" className={`${btn} h-10 border-amber-500/40 bg-amber-500/10 text-amber-200`}><PartyPopper size={13} /> Preview Dashboard Animation</button>
                    <button onClick={save} disabled={busy} data-testid="cm-fest-save" className={`${btn} h-10 border-primary/40 bg-primary text-white`}>{busy ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Save Celebration</button>
                </div>
            </div>
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4 space-y-3" data-testid="cm-fest-list">
                <p className="text-sm font-bold text-white">Festival Celebrations <span className="text-[11px] text-zinc-500 font-medium">{data.festivals.length}</span></p>
                <p className="text-[11px] text-zinc-500">Separate from holidays: a festival never creates or changes a holiday. On its date its banner takes the place of a vacation banner.</p>
                {!sorted.length ? <p className="py-6 text-center text-xs text-zinc-500">No festival celebrations yet.</p> : (
                    <div className="space-y-2">
                        {sorted.map(x => {
                            const st = x.date === today ? ["Today", "text-emerald-300 bg-emerald-500/10 border-emerald-500/25"] : x.date > today ? ["Upcoming", "text-sky-300 bg-sky-500/10 border-sky-500/25"] : ["Past", "text-zinc-400 bg-zinc-800 border-zinc-700"];
                            return (
                                <div key={x.id} className={cn("rounded-xl border p-3 space-y-2", f.id === x.id ? "border-primary/40 bg-primary/5" : "border-zinc-800 bg-zinc-950/40")} data-testid="cm-fest-row">
                                    <div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="text-sm font-bold text-white [overflow-wrap:anywhere]">{x.name}</p><p className="text-[11px] text-zinc-400">{dmy(x.date)} · {THEMES.find(t => t.key === x.theme)?.label}{!x.animation ? " · animation off" : ""}</p></div>
                                        <span className={cn("shrink-0 inline-flex px-2 py-0.5 rounded-md border text-[10px] font-bold", st[1])}>{st[0]}</span></div>
                                    <div className="flex flex-wrap gap-1.5">
                                        <button onClick={() => setF({ ...blankFest(), ...x })} data-testid="cm-fest-edit" className={`${btn} h-8 border-zinc-700 bg-zinc-900 text-zinc-200`}><Pencil size={12} /> Edit</button>
                                        <button onClick={() => setPreview({ title: `Dashboard Animation — ${x.name}`, payload: festivalPreview(x, data.templates.find(t => t.id === x.bannerTemplateId), true) })} data-testid="cm-fest-row-preview" className={`${btn} h-8 border-zinc-700 bg-zinc-900 text-zinc-200`}><Eye size={12} /> Preview</button>
                                        <button onClick={() => del(x)} data-testid="cm-fest-delete" className={`${btn} h-8 border-red-500/30 bg-red-500/10 text-red-300`}><Trash2 size={12} /> Delete</button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
            {preview && <CelebrationPreview title={preview.title} payload={preview.payload} onClose={() => setPreview(null)} onSave={preview.save ? save : undefined} saving={busy} />}
        </div>
    );
}

// ───────────────────────── New Member Welcome ─────────────────────────
const blankWelcome = (): Welcome => ({ id: "", employeeId: "", employeeName: "", date: "", imageUrl: "", selfImageUrl: "", greeting: DEFAULTS.welcomeColleague.heading, subtext: DEFAULTS.welcomeColleague.subheading, selfGreeting: DEFAULTS.welcomeSelf.heading, selfSubtext: DEFAULTS.welcomeSelf.subheading, headingColor: DEFAULTS.welcomeColleague.headingColor, textColor: DEFAULTS.welcomeColleague.textColor, overlayColor: DEFAULTS.welcomeColleague.overlayColor, bgColor: DEFAULTS.welcomeColleague.bgColor, align: "left", photoPosition: "right" });
function welcomePreview(view: "self" | "colleague", w: Welcome, e?: Emp | null): TodayCelebration {
    const b = welcomeBanner(view === "self" ? "welcome-self" : "welcome-colleague", w, personOf(e));
    return { date: istToday(), banner: b, colleagues: [], birthdaySelf: false, effect: null };
}

function ImagePick({ label, hint, url, onChange, testId }: { label: string; hint: string; url: string; onChange: (u: string) => void; testId: string }) {
    const file = useRef<HTMLInputElement>(null); const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
    const pick = async (fl: FileList | null) => { if (!fl?.[0]) return; setBusy(true); setErr(""); try { onChange(await uploadBanner(fl[0])); } catch { setErr("Upload failed."); } finally { setBusy(false); if (file.current) file.current.value = ""; } };
    return (
        <div className="min-w-0"><p className={lbl}>{label}</p>
            <div className="flex items-center gap-2 flex-wrap">
                {url ? <img src={url} alt="" className="h-14 w-24 object-contain rounded-lg bg-zinc-950 border border-zinc-800" data-testid={`${testId}-thumb`} /> : <span className="h-14 w-24 rounded-lg border border-dashed border-zinc-700 text-[10px] text-zinc-500 flex items-center justify-center text-center px-1">Built-in design</span>}
                <input ref={file} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={e => pick(e.target.files)} data-testid={`${testId}-input`} />
                <button type="button" onClick={() => file.current?.click()} disabled={busy} data-testid={testId} className={`${btn} h-8 border-primary/40 bg-primary/10 text-primary`}>{busy ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />} {url ? "Replace" : "Upload Banner"}</button>
                {url && <button type="button" onClick={() => onChange("")} className={`${btn} h-8 border-zinc-700 bg-zinc-900 text-zinc-300`}><X size={12} /> Remove</button>}
            </div>
            <p className="text-[10px] text-zinc-500 mt-1">{hint}</p>
            {err && <p className="text-[11px] text-red-300">{err}</p>}
        </div>
    );
}

function WelcomeSection({ data, act }: { data: Data; act: (b: any) => Promise<any> }) {
    const [w, setW] = useState<Welcome>(blankWelcome());
    const [q, setQ] = useState("");
    const [busy, setBusy] = useState(false); const [formErr, setFormErr] = useState("");
    const [preview, setPreview] = useState<{ title: string; payload: TodayCelebration } | null>(null);
    const today = data.today || istToday();
    const emp = data.employees.find(e => e.id === w.employeeId) || null;
    const matches = useMemo(() => {
        const t = q.trim().toLowerCase();
        return data.employees.filter(e => !t || `${e.name} ${e.id} ${e.designation} ${e.college}`.toLowerCase().includes(t)).slice(0, 200);
    }, [data.employees, q]);
    const list = data.welcomes || [];
    // showing = within 24 hours of publishing (server decides; old rows without that info: their own date)
    const isLive = (x: Welcome) => (x.live !== undefined ? x.live : x.date === today);
    const untilText = (iso?: string) => (iso ? new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", hour: "numeric", minute: "2-digit", hour12: true }) : "");
    const todays = list.filter(isLive), past = list.filter(x => !isLive(x));
    const save = async () => {
        if (!w.employeeId) { setFormErr("Choose the new member."); return; }
        setBusy(true); setFormErr(""); setSaved("");
        try { const d = await act({ action: "welcome_save", ...w }); setW({ ...w, id: d.id || w.id }); setSaved(d.message || "Saved."); }
        catch (e: any) { setFormErr(e.message); } finally { setBusy(false); }
    };
    // "Saved" right next to the button; hidden again after a few seconds or as soon as the form is changed
    const [saved, setSaved] = useState("");
    useEffect(() => { if (!saved) return; const t = setTimeout(() => setSaved(""), 6000); return () => clearTimeout(t); }, [saved]);
    const del = async (x: Welcome) => { setFormErr(""); try { await act({ action: "welcome_delete", id: x.id }); if (w.id === x.id) setW(blankWelcome()); } catch (e: any) { setFormErr(e.message); } };
    const set = (k: keyof Welcome) => (v: string) => { setSaved(""); setW({ ...w, [k]: v }); };
    const colleagueSample = welcomeBanner("welcome-colleague", w, personOf(emp));
    const selfSample = welcomeBanner("welcome-self", w, personOf(emp));
    return (
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] gap-4 items-start">
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4 space-y-4" data-testid="cm-wel-form">
                <div className="flex items-center justify-between gap-2"><p className="text-sm font-bold text-white flex items-center gap-2"><UserPlus size={15} className="text-teal-300" /> {w.id ? `Edit Welcome — ${w.employeeName || emp?.name || ""}` : "New Member Welcome"}</p>
                    {w.id && <button onClick={() => setW(blankWelcome())} className={`${btn} h-8 border-zinc-700 bg-zinc-900 text-zinc-200`}><Plus size={12} /> New</button>}</div>
                <p className="text-[11px] text-teal-200 bg-teal-500/5 border border-teal-500/20 rounded-lg px-3 py-2" data-testid="cm-wel-note">Shown on everyone&apos;s dashboard <b>for 24 hours from the moment it is published</b> (e.g. published at 3 PM → showing till 3 PM the next day). The new member sees their own welcome banner; everyone else sees the colleagues&apos; banner.</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div><label className={lbl} htmlFor="cm-wel-search">Find Employee</label>
                        <div className="relative"><Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" /><input id="cm-wel-search" value={q} onChange={e => setQ(e.target.value)} placeholder="Name, ID, designation…" className={cn(field, "pl-8")} data-testid="cm-wel-search" /></div></div>
                    <div><label className={lbl} htmlFor="cm-wel-emp">New Member *</label>
                        <select id="cm-wel-emp" value={w.employeeId} onChange={e => setW({ ...w, employeeId: e.target.value, employeeName: data.employees.find(x => x.id === e.target.value)?.name || "" })} className={field} data-testid="cm-wel-emp">
                            <option value="">— Choose —</option>
                            {emp && !matches.includes(emp) && <option value={emp.id}>{emp.name} ({emp.id})</option>}
                            {matches.map(e => <option key={e.id} value={e.id}>{e.name} ({e.id}){e.designation ? ` · ${e.designation}` : ""}</option>)}
                        </select></div>
                    <ImagePick label="Colleagues' Banner Image" hint="Optional. Shown to everyone else; without an image the built-in design is used." url={w.imageUrl} onChange={set("imageUrl")} testId="cm-wel-img" />
                    <ImagePick label="New Member's Banner Image" hint="Optional. Without it the colleagues' image (or the built-in design) is used." url={w.selfImageUrl} onChange={set("selfImageUrl")} testId="cm-wel-self-img" />
                    <div className="sm:col-span-2"><label className={lbl}>Colleagues&apos; Greeting <span className="normal-case tracking-normal text-zinc-500 font-medium">({"{name}"}, {"{firstName}"}, {"{designation}"} are filled in)</span></label><input value={w.greeting} onChange={e => set("greeting")(e.target.value)} className={field} data-testid="cm-wel-greeting" /></div>
                    <div className="sm:col-span-2"><label className={lbl}>Colleagues&apos; Message</label><input value={w.subtext} onChange={e => set("subtext")(e.target.value)} className={field} data-testid="cm-wel-subtext" /></div>
                    <div className="sm:col-span-2"><label className={lbl}>New Member&apos;s Greeting</label><input value={w.selfGreeting} onChange={e => set("selfGreeting")(e.target.value)} className={field} data-testid="cm-wel-self-greeting" /></div>
                    <div className="sm:col-span-2"><label className={lbl}>New Member&apos;s Message</label><input value={w.selfSubtext} onChange={e => set("selfSubtext")(e.target.value)} className={field} /></div>
                    <ColorField label="Heading Colour" value={w.headingColor} onChange={set("headingColor")} />
                    <ColorField label="Text Colour" value={w.textColor} onChange={set("textColor")} />
                    <ColorField label="Background Colour" value={w.bgColor} onChange={set("bgColor")} />
                    <ColorField label="Overlay Colour" value={w.overlayColor} onChange={set("overlayColor")} />
                    <div><label className={lbl}>Text Alignment</label><select value={w.align} onChange={e => set("align")(e.target.value)} className={field}><option value="left">Left</option><option value="center">Center</option><option value="right">Right</option></select></div>
                    <div><label className={lbl}>Photo Position</label><select value={w.photoPosition} onChange={e => set("photoPosition")(e.target.value)} className={field} data-testid="cm-wel-photo"><option value="right">Right</option><option value="left">Left</option><option value="center">Center (above text)</option><option value="none">No photo</option></select></div>
                </div>
                <div className="space-y-2">
                    <p className={lbl}>Colleagues&apos; Dashboard</p><CelebrationBanner banner={colleagueSample} testId="cm-wel-sample" />
                    <p className={lbl}>New Member&apos;s Dashboard</p><HeaderBannerSample banner={selfSample} testId="cm-wel-self-sample" />
                </div>
                {formErr && <p className="text-xs text-red-300" data-testid="cm-wel-error">{formErr}</p>}
                <div className="flex flex-wrap gap-2 justify-end">
                    <button onClick={() => setPreview({ title: `Colleagues' Dashboard — Welcome ${emp?.name || ""}`, payload: welcomePreview("colleague", w, emp) })} disabled={!emp} data-testid="cm-wel-prev-colleague" className={`${btn} h-10 border-sky-500/30 bg-sky-500/10 text-sky-200`}><Eye size={13} /> Colleagues</button>
                    <button onClick={() => setPreview({ title: `New Member's Dashboard — ${emp?.name || ""}`, payload: welcomePreview("self", w, emp) })} disabled={!emp} data-testid="cm-wel-prev-self" className={`${btn} h-10 border-teal-500/30 bg-teal-500/10 text-teal-200`}><Eye size={13} /> New Member</button>
                    <button onClick={save} disabled={busy || !w.employeeId} data-testid="cm-wel-save" className={`${btn} h-10 border-primary/40 bg-primary text-white`}>{busy ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} {saved ? "Saved" : w.id ? "Save Welcome" : "Publish Welcome (24 hours)"}</button>
                </div>
                {saved && <p className="flex items-start gap-1.5 text-xs text-emerald-200 rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-3 py-2" data-testid="cm-wel-saved" role="status"><CheckCircle2 size={14} className="shrink-0 mt-px" /><span className="[overflow-wrap:anywhere]">{saved}</span></p>}
            </div>
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4 space-y-3" data-testid="cm-wel-list">
                <p className="text-sm font-bold text-white">Welcomes <span className="text-[11px] text-zinc-500 font-medium">{list.length}</span></p>
                {!list.length ? <p className="py-6 text-center text-xs text-zinc-500">No welcome banners yet.</p> : (
                    <div className="space-y-2">
                        {[...todays, ...past].map(x => {
                            const live = isLive(x);
                            const e = data.employees.find(m => m.id === x.employeeId) || null;
                            return (
                                <div key={x.id} className={cn("rounded-xl border p-3 space-y-2", w.id === x.id ? "border-primary/40 bg-primary/5" : "border-zinc-800 bg-zinc-950/40")} data-testid="cm-wel-row" data-live={live ? "1" : "0"}>
                                    <div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="text-sm font-bold text-white [overflow-wrap:anywhere]">{x.employeeName}</p><p className="text-[11px] text-zinc-400">{x.createdAt ? untilText(x.createdAt) : dmy(x.date)}{x.createdByName ? ` · by ${x.createdByName}` : ""}</p></div>
                                        <span className={cn("shrink-0 inline-flex px-2 py-0.5 rounded-md border text-[10px] font-bold", live ? "text-emerald-300 bg-emerald-500/10 border-emerald-500/25" : "text-zinc-400 bg-zinc-800 border-zinc-700")}><span data-testid="cm-wel-status">{live ? (x.liveUntil ? `Showing till ${untilText(x.liveUntil)}` : "Showing today") : "Past"}</span></span></div>
                                    <div className="flex flex-wrap gap-1.5">
                                        {live && <button onClick={() => setW({ ...blankWelcome(), ...x })} data-testid="cm-wel-edit" className={`${btn} h-8 border-zinc-700 bg-zinc-900 text-zinc-200`}><Pencil size={12} /> Edit</button>}
                                        <button onClick={() => setPreview({ title: `Colleagues' Dashboard — Welcome ${x.employeeName}`, payload: welcomePreview("colleague", x, e) })} data-testid="cm-wel-row-preview" className={`${btn} h-8 border-zinc-700 bg-zinc-900 text-zinc-200`}><Eye size={12} /> Preview</button>
                                        {live && <button onClick={() => del(x)} data-testid="cm-wel-delete" className={`${btn} h-8 border-red-500/30 bg-red-500/10 text-red-300`}><Trash2 size={12} /> Remove</button>}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
            {preview && <CelebrationPreview title={preview.title} payload={preview.payload} onClose={() => setPreview(null)} />}
        </div>
    );
}