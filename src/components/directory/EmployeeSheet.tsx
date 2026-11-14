"use client";
import { useCallback, useEffect, useState } from "react";
import { X, Pencil, Save, Loader2, FileSpreadsheet, FileDown, Lock, AlertCircle, CheckCircle2, ArrowLeft, Camera } from "lucide-react";
import { uploadToCloudinary } from "@/lib/cloudinary";
import { cn } from "@/lib/utils";
import { PROFILE_FIELDS, PROFILE_DOCS, fieldByKey, validateField, cleanValue, toIsoDate } from "@/lib/profile-fields";
import { FieldInput, DocSlot } from "@/components/profile/ProfileWidgets";
import { fetchReport, sheetReportPdf, sheetReportExcel, fileNames } from "@/lib/report-export";

type Profile = {
    id: string; name: string; email: string; photoUrl: string; role: string; roleLabel: string; roles: string[]; status: string; onboardingStatus: string;
    college: string; colleges: { id: string; name: string }[]; values: Record<string, string>; masked: boolean;
    documents: { key: string; label: string; group: string; uploaded: boolean; restricted: boolean }[];
    missing: string[]; profileStatus: string; editable: string[]; editableDocs: string[];
    canChangePhoto?: boolean;
};
type MonthRow = { month: string; presentDays: number; absentDays: number; lateDays: number; paidLeaves: number; unpaidLeaves: number; holidayDays: number; weeklyOffDays: number; workingDays: number; payableDays: number; lopDays: number; activeFlags: number; provisional: boolean };
type Att = { month: string; selected: MonthRow | null; days: { date: string; weekday: string; attendance: string; clockIn: string; clockOut: string; late: boolean; leave: string; payableStatus: string; reason: string }[]; monthly: MonthRow[] };

const monthName = (m: string) => { const [y, mm] = m.split("-").map(Number); return new Date(Date.UTC(y, mm - 1, 1)).toLocaleString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" }); };
const fmtDate = (v?: string) => { const iso = toIsoDate(v); return iso ? new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }) : v || ""; };
const thisMonth = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }).slice(0, 7);

/** One lettered section of the sheet (top-level so inputs keep focus while typing) */
function Section({ id, letter, title, children, note }: { id: string; letter: string; title: string; children: React.ReactNode; note?: string }) {
    return (
    <section className="rounded-xl border border-zinc-800 overflow-hidden" data-testid={`sheet-sec-${id}`}>
        <h3 className="px-3 py-2 bg-zinc-900 border-b border-zinc-800 text-[11px] font-black uppercase tracking-[0.15em] text-emerald-300">{letter}. {title}</h3>
        {note && <p className="px-3 py-1.5 text-[10px] text-amber-300/90 bg-amber-500/5 border-b border-zinc-800">{note}</p>}
        <div className="grid grid-cols-1 xl:grid-cols-2 [&>*:nth-child(odd)]:xl:border-r [&>*]:border-zinc-800/70">{children}</div>
    </section>
    )
}

/**
 * Employee Directory → View: the employee's complete profile as a scrollable field / value sheet (A–H),
 * documents with secure preview, attendance from the Attendance module, HR edit, and the individual exports.
 */
export default function EmployeeSheet({ employeeId, onClose, onSaved, asPage = false }: { employeeId: string; onClose: () => void; onSaved?: () => void; /** full page (Employee Directory → View) instead of a side panel */ asPage?: boolean }) {
    const [p, setP] = useState<Profile | null>(null);
    const [att, setAtt] = useState<Att | null>(null);
    const [month, setMonth] = useState(thisMonth());
    const [loading, setLoading] = useState(true);
    const [attLoading, setAttLoading] = useState(false);
    const [err, setErr] = useState("");
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState<Record<string, string>>({});
    const [docDraft, setDocDraft] = useState<Record<string, string>>({});
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [saving, setSaving] = useState(false);
    const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
    const [exporting, setExporting] = useState<"" | "pdf" | "xlsx">("");
    const [photoBusy, setPhotoBusy] = useState(0);   // upload progress (0 = idle)

    const load = useCallback(async (m: string, full: boolean) => {
        full ? setLoading(true) : setAttLoading(true);
        try {
            const r = await fetch(`/api/hr/employee-directory?id=${encodeURIComponent(employeeId)}&month=${m}`, { cache: "no-store" });
            const j = await r.json().catch(() => ({}));
            if (!r.ok) throw new Error(j.error || "Could not load the employee.");
            setP(j.profile); setAtt(j.attendance); setErr("");
        } catch (e: any) { setErr(e.message); } finally { setLoading(false); setAttLoading(false); }
    }, [employeeId]);
    useEffect(() => { load(month, true); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [employeeId]);
    useEffect(() => {
        if (asPage) return;   // a page is left with Back, not Escape
        const k = (e: KeyboardEvent) => { if (e.key === "Escape" && !editing) onClose(); }; window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k);
    }, [onClose, editing, asPage]);

    /** HR / HR Executive / Founder: replace the employee's profile photo (seen everywhere in the OMS) */
    const changePhoto = async (file?: File | null) => {
        if (!p || !file) return;
        if (!/^image\//.test(file.type)) { setMsg({ ok: false, text: "Please choose an image file (JPG / PNG)." }); return; }
        if (file.size > 5 * 1024 * 1024) { setMsg({ ok: false, text: "The photo must be smaller than 5 MB." }); return; }
        setPhotoBusy(1); setMsg(null);
        try {
            const up = await uploadToCloudinary(file, n => setPhotoBusy(Math.max(1, n)));
            const r = await fetch("/api/employees/profile", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: p.id, photoUrl: up.secure_url }) });
            const j = await r.json().catch(() => ({}));
            if (!r.ok) throw new Error(j.error || "Could not save the photo.");
            setP(x => (x ? { ...x, photoUrl: up.secure_url } : x));
            setMsg({ ok: true, text: "Profile photo updated — everyone now sees the new photo." });
            onSaved?.();
        } catch (e: any) { setMsg({ ok: false, text: e.message || "Upload failed." }); } finally { setPhotoBusy(0); }
    };

    const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
    const val = (k: string) => p?.values[k] || "";
    const startEdit = () => {
        if (!p) return;
        const d: Record<string, string> = {};
        PROFILE_FIELDS.forEach(f => { d[f.key] = f.type === "date" ? toIsoDate(val(f.key)) : val(f.key); });
        setDraft(d); setDocDraft({}); setErrors({}); setMsg(null); setEditing(true);
    };
    const save = async () => {
        if (!p) return;
        const fields: Record<string, string> = {}, errs: Record<string, string> = {};
        p.editable.forEach(k => {
            const f = fieldByKey(k)!;
            const v = cleanValue(f, draft[k]);
            const before = f.type === "date" ? toIsoDate(val(k)) : val(k);
            if (v === before) return;
            const e = validateField(f, v, today);
            if (e) errs[k] = e; else fields[k] = v;
        });
        setErrors(errs);
        if (Object.keys(errs).length) { setMsg({ ok: false, text: "Please correct the highlighted fields." }); return; }
        if (!Object.keys(fields).length && !Object.keys(docDraft).length) { setEditing(false); setMsg({ ok: true, text: "No changes to save." }); return; }
        setSaving(true); setMsg(null);
        try {
            const r = await fetch("/api/employees/profile", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: p.id, fields, documents: docDraft }) });
            const j = await r.json().catch(() => ({}));
            if (!r.ok) throw new Error(j.error || "Could not save.");
            setEditing(false); setDocDraft({});
            setMsg({ ok: true, text: `Saved: ${(j.changed || []).join(", ")}` });
            await load(month, true);
            onSaved?.();
        } catch (e: any) { setMsg({ ok: false, text: e.message }); } finally { setSaving(false); }
    };
    const exportAs = async (kind: "pdf" | "xlsx") => {
        setExporting(kind); setMsg(null);
        try {
            const r = await fetchReport("/api/hr/employee-directory", { method: "POST", body: JSON.stringify({ action: "employee", id: employeeId, month }) });
            if (kind === "pdf") await sheetReportPdf(r, fileNames.employeeProfile(employeeId, "pdf"));
            else await sheetReportExcel(r, fileNames.employeeProfile(employeeId, "xlsx"));
        } catch (e: any) { setMsg({ ok: false, text: e.message || "Export failed." }); } finally { setExporting(""); }
    };

    /** A field / value cell — an input while HR edits (when allowed) */
    const cell = (key: string, display?: string) => {
        const f = fieldByKey(key)!;
        const editable = editing && !!p?.editable.includes(key);
        const shown = display ?? (f.type === "date" ? fmtDate(val(key)) : val(key));
        return (
            <div key={key} className="grid grid-cols-[minmax(110px,38%)_1fr] border-b border-zinc-800/70 min-w-0" data-testid={`sheet-${key}`}>
                <div className="px-3 py-2 text-[10px] font-black uppercase tracking-wider text-zinc-500 bg-zinc-950/60 border-r border-zinc-800/70 [overflow-wrap:anywhere]">{f.label}</div>
                <div className="px-3 py-1.5 text-xs text-zinc-200 min-w-0 [overflow-wrap:anywhere] flex items-center">
                    {editable ? <div className="w-full"><FieldInput field={f} value={draft[key] ?? ""} colleges={p?.colleges} error={errors[key]} onChange={v => { setDraft(d => ({ ...d, [key]: v })); setErrors(e => ({ ...e, [key]: "" })); }} /></div>
                        : <span className="inline-flex items-center gap-1.5">{shown || <span className="text-zinc-600">—</span>}{editing && f.edit !== "none" && !p?.editable.includes(key) && <Lock size={10} className="text-zinc-600" />}</span>}
                </div>
            </div>
        );
    };
    const plain = (label: string, value: React.ReactNode, testid?: string) => (
        <div key={label} className="grid grid-cols-[minmax(110px,38%)_1fr] border-b border-zinc-800/70 min-w-0" data-testid={testid}>
            <div className="px-3 py-2 text-[10px] font-black uppercase tracking-wider text-zinc-500 bg-zinc-950/60 border-r border-zinc-800/70">{label}</div>
            <div className="px-3 py-2 text-xs text-zinc-200 min-w-0 [overflow-wrap:anywhere]">{value || <span className="text-zinc-600">—</span>}</div>
        </div>
    );
    const docs = (keys: string[]) => (
        <div className="p-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 xl:col-span-2">
            {keys.map(k => {
                const d = p!.documents.find(x => x.key === k)!;
                return <DocSlot key={k} compact employeeId={p!.id} docKey={k} label={d.label} uploaded={d.uploaded} restricted={d.restricted}
                    editable={editing && p!.editableDocs.includes(k)} pending={docDraft[k]} onUploaded={url => setDocDraft(x => ({ ...x, [k]: url }))} />;
            })}
        </div>
    );
    const btn = "inline-flex items-center justify-center gap-1.5 h-9 px-3 rounded-lg border text-[11px] font-bold whitespace-nowrap disabled:opacity-50";
    const personalDocs = PROFILE_DOCS.filter(d => d.group === "personal").map(d => d.key);
    const vaultDocs = PROFILE_DOCS.filter(d => d.group === "vault").map(d => d.key);

    return (
        <div className={asPage ? "w-full" : "fixed inset-0 z-[120] bg-black/75 flex justify-end"} {...(asPage ? {} : { role: "dialog", "aria-modal": true })} aria-label="Employee details" data-testid={asPage ? "emp-page" : "emp-sheet"}>
            <div className={asPage ? "w-full max-w-[1200px] mx-auto bg-[#0b0c0e] border border-zinc-800 rounded-2xl flex flex-col min-w-0 overflow-hidden" : "w-full max-w-[1100px] h-full bg-[#0b0c0e] border-l border-zinc-800 flex flex-col min-w-0"}>
                {/* Header */}
                <div className="shrink-0 px-3 sm:px-5 py-3 border-b border-zinc-800 bg-zinc-950 flex flex-wrap items-center gap-3">
                    {asPage && <button onClick={onClose} data-testid="sheet-back" className={`${btn} border-zinc-700 bg-zinc-900 text-zinc-200`}><ArrowLeft size={14} /> Back</button>}
                    <div className="relative shrink-0">
                        {p?.photoUrl ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={p.photoUrl} alt="" data-testid="sheet-photo" className={cn("rounded-xl object-cover border border-zinc-700", asPage ? "w-16 h-16" : "w-11 h-11")} />
                            : <div data-testid="sheet-photo-empty" className={cn("rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center font-black text-emerald-400", asPage ? "w-16 h-16 text-2xl" : "w-11 h-11 text-lg")}>{p?.name?.[0] || "?"}</div>}
                        {p?.canChangePhoto && (
                            <label title={p.photoUrl ? "Change photo" : "Upload photo"} data-testid="sheet-photo-change"
                                className={cn("absolute -bottom-1.5 -right-1.5 w-7 h-7 rounded-full border border-emerald-500/60 bg-zinc-950 text-emerald-300 flex items-center justify-center cursor-pointer hover:bg-emerald-500/20", photoBusy && "pointer-events-none opacity-70")}>
                                {photoBusy ? <Loader2 size={13} className="animate-spin" /> : <Camera size={13} />}
                                <input type="file" accept="image/*" className="hidden" data-testid="sheet-photo-input" disabled={!!photoBusy}
                                    onChange={e => { const f = e.target.files?.[0]; e.target.value = ""; changePhoto(f); }} />
                            </label>
                        )}
                    </div>
                    <div className="min-w-0 flex-1">
                        <p className="text-base font-black text-white truncate" data-testid="sheet-name">{p?.name || (loading ? "Loading…" : "—")}</p>
                        <p className="text-[11px] text-zinc-400 truncate">{p ? `${p.id} · ${p.roles.join(", ")}${p.college ? ` · ${p.college}` : ""}` : ""}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        {p && !editing && p.editable.length > 0 && <button onClick={startEdit} data-testid="sheet-edit" className={`${btn} border-emerald-500/40 bg-emerald-500/10 text-emerald-200`}><Pencil size={13} /> Edit</button>}
                        {editing && <>
                            <button onClick={save} disabled={saving} data-testid="sheet-save" className={`${btn} border-emerald-500 bg-emerald-500 text-black`}>{saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} Save Changes</button>
                            <button onClick={() => { setEditing(false); setDocDraft({}); setErrors({}); }} disabled={saving} data-testid="sheet-cancel" className={`${btn} border-zinc-700 bg-zinc-900 text-zinc-200`}>Cancel</button>
                        </>}
                        {p && !editing && <>
                            <button onClick={() => exportAs("xlsx")} disabled={!!exporting} data-testid="sheet-xlsx" className={`${btn} border-zinc-700 bg-zinc-900 text-zinc-200`}>{exporting === "xlsx" ? <Loader2 size={13} className="animate-spin" /> : <FileSpreadsheet size={13} />} Download Employee Excel</button>
                            <button onClick={() => exportAs("pdf")} disabled={!!exporting} data-testid="sheet-pdf" className={`${btn} border-zinc-700 bg-zinc-900 text-zinc-200`}>{exporting === "pdf" ? <Loader2 size={13} className="animate-spin" /> : <FileDown size={13} />} Download Employee PDF</button>
                        </>}
                        {!asPage && <button onClick={onClose} aria-label="Close" data-testid="sheet-close" className={`${btn} border-zinc-700 bg-zinc-900 text-zinc-300 px-2.5`}><X size={15} /></button>}
                    </div>
                    {msg && <p className={cn("w-full text-[11px] font-bold flex items-center gap-1.5", msg.ok ? "text-emerald-400" : "text-red-400")} data-testid="sheet-msg">{msg.ok ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />} {msg.text}</p>}
                </div>

                <div className={asPage ? "p-3 sm:p-5 space-y-4" : "flex-1 min-h-0 overflow-y-auto p-3 sm:p-5 space-y-4"} data-testid="sheet-body">
                    {loading && <div className="flex justify-center py-20"><Loader2 className="animate-spin text-zinc-500" /></div>}
                    {err && !loading && <p className="text-sm text-red-300" data-testid="sheet-error">{err}</p>}
                    {p && !loading && <>
                        <div className="flex flex-wrap gap-2 text-[10px] font-bold">
                            <span className="px-2 py-1 rounded-md bg-zinc-900 border border-zinc-800 text-zinc-300">Status: {p.status || "—"}</span>
                            <span className="px-2 py-1 rounded-md bg-zinc-900 border border-zinc-800 text-zinc-300">Onboarding: {p.onboardingStatus || "—"}</span>
                            <span className={cn("px-2 py-1 rounded-md border", p.profileStatus === "Completed" ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300" : "bg-amber-500/10 border-amber-500/30 text-amber-300")} data-testid="sheet-profile-status"
                                title={p.missing.length ? `Missing: ${p.missing.join(", ")}` : ""}>Profile: {p.profileStatus}{p.missing.length ? ` (${p.missing.length} missing)` : ""}</span>
                        </div>

                        <Section id="personal" letter="A" title="Personal Information">
                            {cell("name")}{plain("Employee ID", <span className="font-mono">{p.id}</span>, "sheet-id")}
                            {["full_name", "date_of_birth", "gender", "blood_group", "father_name_or_mother_name", "t_shirt_size", "email", "phone_no_", "parents_phone_no_", "permanent_address", "linkedin_id"].map(k => cell(k))}
                        </Section>
                        <Section id="employment" letter="B" title="Employment Information">
                            {cell("designation")}{plain("Role(s)", p.roles.join(", "), "sheet-roles")}{cell("dept")}{cell("location", p.college)}
                            {cell("joiningDate")}{plain("Employment Status", p.status)}{plain("Onboarding Status", p.onboardingStatus)}
                        </Section>
                        <Section id="credentials" letter="C" title="Professional Credentials">
                            {plain("LinkedIn Profile", val("linkedin_id") ? <a href={val("linkedin_id")} target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:underline">{val("linkedin_id")}</a> : "")}
                            {plain("Designation", val("designation"))}
                            {docs(["upload_your_resume", "experience_letter"])}
                        </Section>
                        <Section id="academic" letter="D" title="Academic Qualifications">
                            {["bachelor_s_qualification", "master_s_qualification", "which_college_are_you_from_", "you_are_from_"].map(k => cell(k))}
                            {docs(["ten_marksheet", "twelve_marksheet", "upload_your_bachelor_s_passing_certificate", "bachelor_marksheet_all", "upload_your_master_s_passing_certificate", "master_marksheet_all"])}
                        </Section>
                        <Section id="banking" letter="E" title="Banking Details" note={p.masked ? "Bank and identity numbers are masked for HR Executive. Bank documents are restricted." : undefined}>
                            {["account_holder_name", "bankName", "bank_account_number", "ifsc_code", "upi_id", "panNumber", "aadhaarNumber"].map(k => cell(k))}
                            {docs(["bank_passbook_cancelled_cheque"])}
                        </Section>
                        <Section id="personal-docs" letter="F" title="Personal Documents">{docs(personalDocs)}</Section>
                        <Section id="vault" letter="G" title="Institutional Document Vault">{docs(vaultDocs)}</Section>

                        {/* H. Attendance — same records and payable-day calculation as the Attendance / Salary modules */}
                        <section className="rounded-xl border border-zinc-800 overflow-hidden" data-testid="sheet-sec-attendance">
                            <div className="px-3 py-2 bg-zinc-900 border-b border-zinc-800 flex flex-wrap items-center gap-2">
                                <h3 className="text-[11px] font-black uppercase tracking-[0.15em] text-emerald-300 mr-auto">H. Attendance Details</h3>
                                <select value={month} onChange={e => { setMonth(e.target.value); load(e.target.value, false); }} data-testid="sheet-month" aria-label="Month"
                                    className="h-8 px-2 rounded-lg bg-zinc-950 border border-zinc-700 text-xs text-zinc-200">
                                    {(att?.monthly || []).map(m => m.month).concat(att && !att.monthly.some(m => m.month === month) ? [month] : []).map(m => <option key={m} value={m}>{monthName(m)}</option>)}
                                </select>
                                {attLoading && <Loader2 size={14} className="animate-spin text-zinc-500" />}
                            </div>
                            {att?.selected && (
                                <div className="p-3 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2" data-testid="sheet-att-summary">
                                    {([["Present", att.selected.presentDays, "text-emerald-300"], ["Absent", att.selected.absentDays, "text-red-300"], ["Late", att.selected.lateDays, "text-amber-300"],
                                        ["Paid Leave", att.selected.paidLeaves, "text-sky-300"], ["Unpaid Leave", att.selected.unpaidLeaves, "text-orange-300"], ["Holidays", att.selected.holidayDays, "text-violet-300"],
                                        ["Payable Days", att.selected.payableDays, "text-white"], ["LOP", att.selected.lopDays, "text-red-300"]] as [string, number, string][]).map(([l, v, c]) => (
                                        <div key={l} className="rounded-lg border border-zinc-800 bg-zinc-950 px-2.5 py-2"><p className="text-[9px] font-black uppercase tracking-wider text-zinc-500">{l}</p><p className={cn("text-base font-black", c)} data-testid={`att-${l.toLowerCase().replace(/\s+/g, "-")}`}>{v}</p></div>
                                    ))}
                                    {att.selected.provisional && <p className="col-span-full text-[10px] text-zinc-500">Current month: counted up to today.</p>}
                                </div>
                            )}
                            <div className="px-3 pb-3">
                                <p className="text-[10px] font-black uppercase tracking-wider text-zinc-500 mb-1.5">Month-wise summary</p>
                                <div className="overflow-x-auto rounded-lg border border-zinc-800">
                                    <table className="w-full min-w-[640px] text-[11px]" data-testid="sheet-att-monthly">
                                        <thead className="bg-zinc-900 text-zinc-400"><tr>{["Month", "Present", "Absent", "Late", "Paid Leave", "Unpaid", "Holidays", "Payable", "LOP"].map(h => <th key={h} className="px-2 py-1.5 text-left font-bold whitespace-nowrap">{h}</th>)}</tr></thead>
                                        <tbody>{(att?.monthly || []).map(m => (
                                            <tr key={m.month} className={cn("border-t border-zinc-800", m.month === month && "bg-emerald-500/5")}>
                                                <td className="px-2 py-1.5 whitespace-nowrap text-zinc-200">{monthName(m.month)}</td>
                                                {[m.presentDays, m.absentDays, m.lateDays, m.paidLeaves, m.unpaidLeaves, m.holidayDays, m.payableDays, m.lopDays].map((v, i) => <td key={i} className="px-2 py-1.5 text-zinc-300">{v}</td>)}
                                            </tr>
                                        ))}</tbody>
                                    </table>
                                </div>
                                <p className="text-[10px] font-black uppercase tracking-wider text-zinc-500 mt-3 mb-1.5">Daily records — {monthName(month)}</p>
                                <div className="overflow-auto max-h-[420px] rounded-lg border border-zinc-800">
                                    <table className="w-full min-w-[760px] text-[11px]" data-testid="sheet-att-days">
                                        <thead className="bg-zinc-900 text-zinc-400 sticky top-0"><tr>{["Date", "Day", "Attendance", "Clock-In", "Clock-Out", "Late", "Payable", "Notes"].map(h => <th key={h} className="px-2 py-1.5 text-left font-bold whitespace-nowrap">{h}</th>)}</tr></thead>
                                        <tbody>
                                            {(att?.days || []).map(d => (
                                                <tr key={d.date} className="border-t border-zinc-800 align-top">
                                                    <td className="px-2 py-1.5 whitespace-nowrap text-zinc-200">{fmtDate(d.date)}</td>
                                                    <td className="px-2 py-1.5 text-zinc-400">{d.weekday}</td>
                                                    <td className="px-2 py-1.5 text-zinc-200">{d.attendance || "—"}{d.leave ? ` · ${d.leave}` : ""}</td>
                                                    <td className="px-2 py-1.5 text-zinc-300 whitespace-nowrap">{d.clockIn || "—"}</td>
                                                    <td className="px-2 py-1.5 text-zinc-300 whitespace-nowrap">{d.clockOut || "—"}</td>
                                                    <td className="px-2 py-1.5">{d.late ? <span className="text-amber-300 font-bold">Late</span> : ""}</td>
                                                    <td className={cn("px-2 py-1.5 whitespace-nowrap", d.payableStatus === "Payable" ? "text-emerald-300" : d.payableStatus === "Non-Payable" ? "text-red-300" : "text-zinc-400")}>{d.payableStatus}</td>
                                                    <td className="px-2 py-1.5 text-zinc-500 min-w-[180px]">{d.reason}</td>
                                                </tr>
                                            ))}
                                            {!att?.days?.length && <tr><td colSpan={8} className="px-2 py-4 text-center text-zinc-500">No attendance records for this month.</td></tr>}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </section>
                    </>}
                </div>
            </div>
        </div>
    );
}