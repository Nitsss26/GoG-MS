"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { Search, ShieldAlert, Eye, FileSpreadsheet, FileDown, Loader2, ChevronLeft, ChevronRight, RefreshCw, BookUser, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { fetchReport, tablePdf, tableExcel, fileNames } from "@/lib/report-export";
import EmployeeSheet from "@/components/directory/EmployeeSheet";
import { useMinWidth } from "@/lib/use-min-width";

type Row = {
    id: string; name: string; photoUrl: string; designation: string; role: string; roles: string[]; dept: string; collegeId: string; college: string;
    email: string; phone: string; joiningDate: string; status: string; profileStatus: string; missing: number;
};
const SORTS = [
    ["name-asc", "Name (A–Z)"], ["name-desc", "Name (Z–A)"], ["id-asc", "Employee ID"], ["join-desc", "Joining date (newest)"],
    ["join-asc", "Joining date (oldest)"], ["college-asc", "College"], ["dept-asc", "Department"], ["status-asc", "Profile status (incomplete first)"],
] as const;
const PAGE_SIZES = [25, 50, 100];
const fmtDate = (v?: string) => (v && /^\d{4}-\d{2}-\d{2}/.test(v) ? new Date(`${v.slice(0, 10)}T00:00:00Z`).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }) : v || "");

/**
 * HR / HR Executive → Employee Directory: every employee on the portal, one compact row each (spreadsheet style),
 * search, filters, sort, pagination, View (complete profile + documents + attendance) and Excel / PDF exports.
 */
export default function EmployeeDirectoryPage() {
    const { user } = useAuth();
    const [rows, setRows] = useState<Row[]>([]);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState("");
    const [q, setQ] = useState("");
    const [role, setRole] = useState("");
    const [college, setCollege] = useState("");
    const [dept, setDept] = useState("");
    const [sort, setSort] = useState<(typeof SORTS)[number][0]>("name-asc");
    const [page, setPage] = useState(1);
    const [size, setSize] = useState(25);
    const [view, setView] = useState<string | null>(null);
    const [exporting, setExporting] = useState<"" | "pdf" | "xlsx">("");
    const [exportErr, setExportErr] = useState("");
    const allowed = !!user && (user.role === "HR" || user.role === "FOUNDER");
    // the name column stays pinned while scrolling sideways — on phones it scrolls with the rest (room for the other columns)
    const pinName = useMinWidth(640);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const r = await fetch("/api/hr/employee-directory", { cache: "no-store" });
            const j = await r.json().catch(() => ({}));
            if (!r.ok) throw new Error(j.error || "Could not load the directory.");
            setRows(j.rows || []); setErr("");
        } catch (e: any) { setErr(e.message); } finally { setLoading(false); }
    }, []);
    useEffect(() => { if (allowed) load(); }, [allowed, load]);

    const roleOpts = useMemo(() => Array.from(new Set(rows.flatMap(r => r.roles))).filter(Boolean).sort(), [rows]);
    const collegeOpts = useMemo(() => Array.from(new Map(rows.filter(r => r.collegeId).map(r => [r.collegeId, r.college])).entries()).sort((a, b) => a[1].localeCompare(b[1])), [rows]);
    const deptOpts = useMemo(() => Array.from(new Set(rows.map(r => r.dept).filter(Boolean))).sort(), [rows]);

    const filtered = useMemo(() => {
        const s = q.trim().toLowerCase();
        const list = rows.filter(r =>
            (!s || r.name.toLowerCase().includes(s) || r.id.toLowerCase().includes(s)) &&
            (!role || r.roles.includes(role)) && (!college || r.collegeId === college) && (!dept || r.dept === dept));
        const [k, dir] = sort.split("-");
        const val = (r: Row) => k === "name" ? r.name : k === "id" ? r.id : k === "join" ? r.joiningDate || "" : k === "college" ? r.college : k === "dept" ? r.dept : r.profileStatus === "Incomplete" ? "0" : "1";
        return [...list].sort((a, b) => {
            const x = val(a), y = val(b);
            if (!x && y) return 1; if (x && !y) return -1;          // empty values last
            return (dir === "desc" ? -1 : 1) * x.localeCompare(y, undefined, { numeric: true }) || a.name.localeCompare(b.name);
        });
    }, [rows, q, role, college, dept, sort]);
    const pages = Math.max(1, Math.ceil(filtered.length / size));
    const cur = Math.min(page, pages);
    const shown = filtered.slice((cur - 1) * size, cur * size);
    useEffect(() => { setPage(1); }, [q, role, college, dept, sort, size]);

    const exportAs = async (kind: "pdf" | "xlsx") => {
        setExporting(kind); setExportErr("");
        try {
            const filteredOn = !!(q.trim() || role || college || dept);
            // the rows on screen (current search / filters / sort); the server re-checks access and builds the data
            const r = await fetchReport("/api/hr/employee-directory", { method: "POST", body: JSON.stringify({ action: "export", ids: filtered.map(x => x.id) }) });
            if (!filteredOn) r.scope = `All employees (${r.rows.length})`;
            if (kind === "pdf") await tablePdf(r, fileNames.directory("pdf"));
            else await tableExcel(r, "Employee Directory", fileNames.directory("xlsx"));
        } catch (e: any) { setExportErr(e.message || "Export failed."); } finally { setExporting(""); }
    };

    if (!user) return null;
    if (!allowed) {
        return (
            <div className="h-[70vh] flex flex-col items-center justify-center space-y-4 p-6 text-center">
                <div className="w-16 h-16 bg-amber-500/10 rounded-full flex items-center justify-center text-amber-500"><ShieldAlert size={32} /></div>
                <div className="max-w-xs space-y-2">
                    <h2 className="text-base font-bold text-white">Restricted</h2>
                    <p className="text-xs text-zinc-400">The Employee Directory is available to HR and HR Executive only.</p>
                </div>
                <Link href="/" className="btn-primary py-2.5 px-6 text-xs">Return to Dashboard</Link>
            </div>
        );
    }
    const sel = "h-9 px-2 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-zinc-200 min-w-0";
    const btn = "inline-flex items-center justify-center gap-1.5 h-9 px-3 rounded-lg border text-[11px] font-bold whitespace-nowrap disabled:opacity-50";
    const th = "px-3 py-2 text-left text-[10px] font-black uppercase tracking-wider text-zinc-400 whitespace-nowrap bg-zinc-900 border-b border-zinc-800";
    const td = "px-3 py-1.5 text-xs text-zinc-300 whitespace-nowrap border-b border-zinc-800/70";
    const anyFilter = !!(q || role || college || dept);

    return (
        <div className="p-4 sm:p-6 space-y-4 max-w-[1600px] mx-auto w-full min-w-0 [contain:inline-size]" data-testid="emp-directory">
            <header className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                    <h1 className="text-lg font-bold text-white flex items-center gap-2"><BookUser size={18} className="text-emerald-400" /> Employee Directory</h1>
                    <p className="text-xs text-zinc-400">All employees from the OMS employee records — click View for the complete profile, documents and attendance.</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <button onClick={load} disabled={loading} className={`${btn} border-zinc-700 bg-zinc-900 text-zinc-300`} data-testid="dir-refresh" aria-label="Refresh"><RefreshCw size={13} className={loading ? "animate-spin" : ""} /></button>
                    <button onClick={() => exportAs("xlsx")} disabled={!!exporting || loading || !filtered.length} data-testid="dir-xlsx" className={`${btn} border-emerald-500/40 bg-emerald-500/10 text-emerald-200`}>{exporting === "xlsx" ? <Loader2 size={13} className="animate-spin" /> : <FileSpreadsheet size={13} />} Download Excel</button>
                    <button onClick={() => exportAs("pdf")} disabled={!!exporting || loading || !filtered.length} data-testid="dir-pdf" className={`${btn} border-zinc-700 bg-zinc-900 text-zinc-200`}>{exporting === "pdf" ? <Loader2 size={13} className="animate-spin" /> : <FileDown size={13} />} Download PDF</button>
                </div>
            </header>
            {exportErr && <p className="text-xs text-red-400" data-testid="dir-export-error">{exportErr}</p>}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[minmax(220px,1.4fr)_repeat(4,minmax(140px,1fr))] gap-2">
                <label className="relative min-w-0">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                    <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search name or Employee ID…" data-testid="dir-search" aria-label="Search by name or Employee ID"
                        className="w-full h-9 pl-9 pr-3 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-white outline-none focus:border-emerald-500/40" />
                </label>
                <select value={role} onChange={e => setRole(e.target.value)} className={sel} data-testid="dir-role" aria-label="Role"><option value="">All roles</option>{roleOpts.map(r => <option key={r} value={r}>{r}</option>)}</select>
                <select value={college} onChange={e => setCollege(e.target.value)} className={sel} data-testid="dir-college" aria-label="College"><option value="">All colleges</option>{collegeOpts.map(([id, n]) => <option key={id} value={id}>{n}</option>)}</select>
                <select value={dept} onChange={e => setDept(e.target.value)} className={sel} data-testid="dir-dept" aria-label="Department"><option value="">All departments</option>{deptOpts.map(d => <option key={d} value={d}>{d}</option>)}</select>
                <select value={sort} onChange={e => setSort(e.target.value as any)} className={sel} data-testid="dir-sort" aria-label="Sort">{SORTS.map(([v, l]) => <option key={v} value={v}>Sort: {l}</option>)}</select>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-[11px] text-zinc-400">
                <span data-testid="dir-count">{loading ? "Loading…" : `${filtered.length} of ${rows.length} employees`}</span>
                {anyFilter && <button onClick={() => { setQ(""); setRole(""); setCollege(""); setDept(""); }} className="inline-flex items-center gap-1 text-zinc-300 hover:text-white" data-testid="dir-clear"><X size={11} /> Clear filters</button>}
            </div>

            {err && <p className="text-sm text-red-300" data-testid="dir-error">{err}</p>}
            <div className="rounded-xl border border-zinc-800 overflow-auto max-h-[calc(100vh-290px)] min-h-[240px] bg-[#0b0c0e]" data-testid="dir-scroll">
                <table className="w-full min-w-[1380px] border-separate border-spacing-0" data-testid="dir-table">
                    <thead className="sticky top-0 z-10">
                        <tr>
                            <th className={cn(th, pinName ? "sticky left-0 z-20 min-w-[220px]" : "min-w-[170px]")}>Employee Name</th>
                            {["Employee ID", "Designation", "Role", "Department", "College", "Email", "Phone", "Joining Date", "Profile Status", "Actions"].map(h => <th key={h} className={th}>{h}</th>)}
                        </tr>
                    </thead>
                    <tbody>
                        {loading && <tr><td colSpan={11} className="py-16 text-center"><Loader2 className="inline animate-spin text-zinc-500" /></td></tr>}
                        {!loading && !shown.length && <tr><td colSpan={11} className="py-12 text-center text-xs text-zinc-500" data-testid="dir-empty">No employees match the search / filters.</td></tr>}
                        {!loading && shown.map(r => (
                            <tr key={r.id} className="group hover:bg-zinc-900/60" data-testid="dir-row" data-id={r.id}>
                                <td className={cn(td, "max-w-[260px]", pinName && "sticky left-0 z-[1] bg-[#0b0c0e] group-hover:bg-zinc-900")}>
                                    <div className="flex items-center gap-2.5 min-w-0">
                                        {r.photoUrl ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={r.photoUrl} alt="" className="w-7 h-7 rounded-full object-cover border border-zinc-700 shrink-0" loading="lazy" />
                                            : <span className="w-7 h-7 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-[11px] font-black flex items-center justify-center shrink-0">{r.name[0] || "?"}</span>}
                                        <span className="font-semibold text-white truncate" title={r.name}>{r.name}</span>
                                    </div>
                                </td>
                                <td className={cn(td, "font-mono text-zinc-400")}>{r.id}</td>
                                <td className={td}>{r.designation || "—"}</td>
                                <td className={td}>{r.roles.join(", ")}</td>
                                <td className={td}>{r.dept || "—"}</td>
                                <td className={td}>{r.college || "—"}</td>
                                <td className={td}>{r.email || "—"}</td>
                                <td className={td}>{r.phone || "—"}</td>
                                <td className={td}>{fmtDate(r.joiningDate) || "—"}</td>
                                <td className={td}>
                                    <span className={cn("px-2 py-0.5 rounded-md border text-[10px] font-bold", r.profileStatus === "Completed" ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300" : "bg-amber-500/10 border-amber-500/30 text-amber-300")}
                                        title={r.missing ? `${r.missing} item(s) missing` : ""} data-testid="dir-status">{r.profileStatus}</span>
                                </td>
                                <td className={td}>
                                    <button onClick={() => setView(r.id)} data-testid="dir-view" className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md border border-emerald-500/40 bg-emerald-500/10 text-emerald-200 text-[11px] font-bold hover:bg-emerald-500/20"><Eye size={12} /> View</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-zinc-400" data-testid="dir-pager">
                <label className="flex items-center gap-2">Rows per page
                    <select value={size} onChange={e => setSize(Number(e.target.value))} className={cn(sel, "h-8")} data-testid="dir-size">{PAGE_SIZES.map(n => <option key={n} value={n}>{n}</option>)}</select>
                </label>
                <div className="flex items-center gap-2">
                    <span data-testid="dir-page">Page {cur} of {pages}</span>
                    <button onClick={() => setPage(cur - 1)} disabled={cur <= 1} className={`${btn} h-8 border-zinc-700 bg-zinc-900 text-zinc-300`} aria-label="Previous page" data-testid="dir-prev"><ChevronLeft size={14} /></button>
                    <button onClick={() => setPage(cur + 1)} disabled={cur >= pages} className={`${btn} h-8 border-zinc-700 bg-zinc-900 text-zinc-300`} aria-label="Next page" data-testid="dir-next"><ChevronRight size={14} /></button>
                </div>
            </div>

            {view && <EmployeeSheet employeeId={view} onClose={() => setView(null)} onSaved={load} />}
        </div>
    );
}