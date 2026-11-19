"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import type { Role } from "@/context/AuthContext";
import { ShieldPlus, ChevronLeft, ChevronRight, Loader2, AlertTriangle, Check, Save, Rocket, Network, Eye } from "lucide-react";
import { cn } from "@/lib/utils";
import { BASE_ROLE_CHOICES, ROLE_ID_RE, ORG_PARENTS, roleIdFromLabel, stateOf, type AccessState } from "@/lib/role-modules";
import { buildSidebar, applyRestriction, ROLE_COLORS } from "@/lib/sidebar-menu";
import { RoleAccessList, STATE_TEXT, type RoleItem } from "@/components/admin/RoleAccessList";
import OrgChart, { OrgCanvas } from "@/components/org/OrgChart";
import { buildOrgChart, toOrgPerson } from "@/lib/org-chart";

/**
 * Admin → Role Management → Create New Role (HR — not HR Executive — and Founder).
 * A new role is built on an existing base role: its employees work exactly as the base role everywhere, and this page
 * only sets its name, what of the base role's sidebar it does NOT get, and its Org Chart place. Saved as a draft or
 * published (then it appears in Onboarding and the login list). ?id=ROLE_ID edits a role created here.
 */
const STEPS = ["Details", "Base role", "Access", "Org Chart", "Review"];
const labelOf = (r: string) => (ROLE_COLORS as any)[r]?.label || r;

function Wizard() {
    const { user } = useAuth();
    const router = useRouter();
    const editId = useSearchParams().get("id") || "";
    const allowed = !!user && ((user.role === "HR" && !(user as any).hrExecutive) || user.role === "FOUNDER");
    const [roles, setRoles] = useState<any[] | null>(null);
    const [error, setError] = useState("");
    const [step, setStep] = useState(0);
    const [label, setLabel] = useState("");
    const [roleId, setRoleId] = useState("");
    const [idTouched, setIdTouched] = useState(false);
    const [description, setDescription] = useState("");
    const [baseRole, setBaseRole] = useState("");
    const [draft, setDraft] = useState<Record<string, AccessState>>({});
    const [org, setOrg] = useState<{ mode: "SAME" | "OWN"; parent?: string }>({ mode: "SAME" });
    const [busy, setBusy] = useState(false);
    const [saveErr, setSaveErr] = useState("");
    const [loadedEdit, setLoadedEdit] = useState(false);

    useEffect(() => {
        if (!allowed) return;
        fetch("/api/admin/roles", { cache: "no-store" }).then(async r => {
            const d = await r.json().catch(() => ({}));
            if (!r.ok) throw new Error(d.error || "Could not load roles");
            setRoles(d.roles || []);
        }).catch(e => setError(e.message));
    }, [allowed]);

    const editing = editId ? (roles || []).find(r => r.role === editId && r.custom) : null;
    useEffect(() => {
        if (!editing || loadedEdit) return;
        setLabel(editing.label); setRoleId(editing.role); setIdTouched(true); setDescription(editing.description || "");
        setBaseRole(editing.baseRole); setOrg(editing.org?.mode === "OWN" ? { mode: "OWN", parent: editing.org.parent } : { mode: "SAME" });
        setDraft(Object.fromEntries(editing.items.map((i: RoleItem) => [i.path, stateOf(editing.restriction, i.path)])));
        setLoadedEdit(true);
    }, [editing, loadedEdit]);
    const published = editing?.status === "PUBLISHED";

    const baseRow = (roles || []).find(r => !r.custom && r.role === baseRole);
    const items: RoleItem[] = baseRow?.items || [];
    const hidden = Object.entries(draft).filter(([, v]) => v === "hidden").map(([k]) => k);
    const blocked = Object.entries(draft).filter(([, v]) => v === "blocked").map(([k]) => k);

    // step checks
    const labelErr = label.trim().length < 3 ? "Enter a role name (at least 3 characters)." : /[<>"]/.test(label) ? "The role name cannot contain < > or \"." : "";
    const idErr = !ROLE_ID_RE.test(roleId) ? "Capital letters, digits and _ only (3–40 characters, starting with a letter)." :
        !editId && (roles || []).some(r => r.role === roleId) ? `Role ID ${roleId} already exists.` : "";
    const nameTaken = (roles || []).some(r => r.role !== editId && String(r.label).toLowerCase() === label.trim().toLowerCase());
    const stepErr = [labelErr || idErr || (nameTaken ? `A role named "${label.trim()}" already exists.` : ""), baseRole ? "" : "Choose a base role.", "", org.mode === "OWN" && !org.parent ? "Choose where the box goes." : "", ""];

    if (!user) return null;
    if (!allowed) return <div className="p-8 text-center text-sm text-zinc-500" data-testid="rw-denied">Only HR and the Founder can create roles.</div>;
    if (editId && roles && !editing) return <div className="p-8 text-center text-sm text-zinc-500">Role not found. <Link href="/admin/roles" className="text-primary">Back to Role Management</Link></div>;

    const submit = async (publish: boolean) => {
        setBusy(true); setSaveErr("");
        try {
            const body = { roleId, label: label.trim(), description: description.trim(), baseRole, org, hidden, blocked };
            const r = await fetch("/api/admin/role-definitions", { method: editId ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
            const d = await r.json().catch(() => ({}));
            // editing with nothing changed is fine when the point is to publish
            if (!r.ok && !(editId && publish && /Nothing changed/.test(d.error || ""))) throw new Error(d.error || "Could not save");
            if (publish && !published) {
                const p = await fetch("/api/admin/role-definitions", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ roleId, action: "publish" }) });
                const pd = await p.json().catch(() => ({}));
                if (!p.ok) throw new Error(`Saved as draft, but could not publish: ${pd.error || p.status}`);
            }
            router.push(`/admin/roles?role=${encodeURIComponent(roleId)}`);
        } catch (e: any) { setSaveErr(e.message); }
        finally { setBusy(false); }
    };

    const field = "w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-sm text-white outline-none focus:border-zinc-600 disabled:opacity-60";

    return (
        <div className="p-4 sm:p-6 space-y-5 max-w-5xl mx-auto w-full [contain:inline-size]" data-testid="role-wizard">
            <Link href="/admin/roles" className="inline-flex items-center gap-1 text-xs text-zinc-400 hover:text-white"><ChevronLeft size={14} /> Role Management</Link>
            <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight flex items-center gap-3"><ShieldPlus size={26} className="text-primary shrink-0" /> {editId ? `Edit ${editing?.label || "role"}` : "Create New Role"}</h1>
                <p className="text-zinc-500 mt-1 text-sm">A new role works exactly like the base role you choose. Here you name it, take away what it should not have, and choose its place in the Org Chart. It cannot get anything the base role does not have.</p>
            </div>
            {error && <p className="text-sm text-red-300 rounded-xl border border-red-500/25 bg-red-500/10 px-3 py-2">{error}</p>}
            {!roles && !error && <p className="text-sm text-zinc-500 flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Loading…</p>}

            {roles && (<>
                <ol className="flex flex-wrap gap-2" data-testid="rw-steps">
                    {STEPS.map((s, i) => (
                        <li key={s}>
                            <button type="button" onClick={() => { if (i <= step || stepErr.slice(0, i).every(e => !e)) setStep(i); }} data-testid={`rw-step-${i}`} aria-current={i === step ? "step" : undefined}
                                className={cn("px-3 py-1.5 rounded-full border text-[11px] font-bold inline-flex items-center gap-1.5",
                                    i === step ? "border-primary/40 bg-primary/15 text-primary" : i < step ? "border-zinc-700 text-zinc-300" : "border-zinc-800 text-zinc-500")}>
                                <span className={cn("w-4 h-4 rounded-full text-[9px] flex items-center justify-center", i < step ? "bg-emerald-500/20 text-emerald-300" : "bg-zinc-800")}>{i < step ? <Check size={10} /> : i + 1}</span>{s}
                            </button>
                        </li>
                    ))}
                </ol>

                <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4 sm:p-5 space-y-4">
                    {step === 0 && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <label className="block text-xs font-bold text-zinc-300">Role name
                                <input value={label} onChange={e => { setLabel(e.target.value); if (!idTouched && !editId) setRoleId(roleIdFromLabel(e.target.value)); }} maxLength={60} placeholder="e.g. Assistant Professor" data-testid="rw-label" className={cn(field, "mt-1 font-normal")} />
                            </label>
                            <label className="block text-xs font-bold text-zinc-300">Role ID
                                <input value={roleId} onChange={e => { setIdTouched(true); setRoleId(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, "")); }} maxLength={40} disabled={!!editId} data-testid="rw-id" className={cn(field, "mt-1 font-mono font-normal")} />
                                <span className="block mt-1 text-[10px] font-normal text-zinc-500">Saved on each employee with this role. Cannot be changed later.</span>
                            </label>
                            <label className="block text-xs font-bold text-zinc-300 md:col-span-2">Description (optional)
                                <textarea value={description} onChange={e => setDescription(e.target.value)} maxLength={500} rows={2} data-testid="rw-desc" className={cn(field, "mt-1 font-normal")} />
                            </label>
                        </div>
                    )}

                    {step === 1 && (
                        <div className="space-y-3">
                            <p className="text-xs text-zinc-400">Employees with the new role log in, clock in, apply for leave, appear in reports and get approvals exactly like this role.{published && " The base role cannot be changed after publishing."}</p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2" role="radiogroup" data-testid="rw-bases">
                                {BASE_ROLE_CHOICES.map(r => {
                                    const row = roles.find(x => !x.custom && x.role === r);
                                    return (
                                        <button key={r} type="button" role="radio" aria-checked={baseRole === r} disabled={published} data-testid="rw-base" data-role={r}
                                            onClick={() => { if (r !== baseRole) { setBaseRole(r); setDraft({}); } }}
                                            className={cn("text-left rounded-xl border p-3 transition disabled:opacity-50", baseRole === r ? "border-primary/50 bg-primary/10" : "border-zinc-800 hover:border-zinc-600")}>
                                            <p className="text-sm font-bold text-white">{labelOf(r)}</p>
                                            <p className="text-[10px] text-zinc-500">{r} · {row?.items.length || 0} sidebar items</p>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="space-y-3">
                            <p className="text-xs text-zinc-400">Everything of <b className="text-zinc-200">{labelOf(baseRole)}</b> is Visible to start with. Hide or block what {label.trim() || "this role"} should not have.</p>
                            <RoleAccessList items={items} draft={Object.fromEntries(items.map(i => [i.path, draft[i.path] || "visible"]))} onChange={(p, s) => setDraft(d => ({ ...d, [p]: s }))} />
                        </div>
                    )}

                    {step === 3 && <OrgStep label={label.trim()} roleId={roleId} baseRole={baseRole} org={org} setOrg={setOrg} />}

                    {step === 4 && (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4" data-testid="rw-review">
                            <div className="space-y-2 text-sm">
                                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Summary</p>
                                <dl className="grid grid-cols-[110px_1fr] gap-x-3 gap-y-1.5 text-xs">
                                    <dt className="text-zinc-500">Role name</dt><dd className="text-white font-bold [overflow-wrap:anywhere]" data-testid="rw-sum-label">{label.trim()}</dd>
                                    <dt className="text-zinc-500">Role ID</dt><dd className="text-zinc-200 font-mono [overflow-wrap:anywhere]">{roleId}</dd>
                                    <dt className="text-zinc-500">Base role</dt><dd className="text-zinc-200" data-testid="rw-sum-base">{labelOf(baseRole)}</dd>
                                    <dt className="text-zinc-500">Hidden</dt><dd className="text-amber-300">{hidden.length ? items.filter(i => hidden.includes(i.path)).map(i => i.label).join(", ") : "—"}</dd>
                                    <dt className="text-zinc-500">Blocked</dt><dd className="text-red-300" data-testid="rw-sum-blocked">{blocked.length ? items.filter(i => blocked.includes(i.path)).map(i => i.label).join(", ") : "—"}</dd>
                                    <dt className="text-zinc-500">Org Chart</dt><dd className="text-zinc-200">{org.mode === "OWN" ? `Own box under ${ORG_PARENTS.find(p => p.key === org.parent)?.label}` : `Same place as ${labelOf(baseRole)}`}</dd>
                                    {description.trim() && <><dt className="text-zinc-500">Description</dt><dd className="text-zinc-300 [overflow-wrap:anywhere]">{description.trim()}</dd></>}
                                </dl>
                                <p className="text-[11px] text-zinc-500 pt-2">Draft: saved here only. Publish: appears in Onboarding (Role list) and in the login list. Every change is written to Role Activity Logs.</p>
                            </div>
                            <SidebarPreview baseRole={baseRole} removed={[...hidden, ...blocked]} title={label.trim()} />
                        </div>
                    )}
                </div>

                {stepErr[step] && <p className="text-xs text-amber-300 flex items-center gap-1.5" data-testid="rw-step-error"><AlertTriangle size={13} /> {stepErr[step]}</p>}
                {saveErr && <p className="text-sm text-red-300 rounded-xl border border-red-500/25 bg-red-500/10 px-3 py-2" data-testid="rw-save-error">{saveErr}</p>}

                <div className="flex flex-wrap items-center gap-2">
                    {step > 0 && <button type="button" onClick={() => setStep(s => s - 1)} className="px-3 py-2 rounded-lg border border-zinc-700 text-xs font-bold text-zinc-300 inline-flex items-center gap-1" data-testid="rw-back"><ChevronLeft size={13} /> Back</button>}
                    <span className="flex-1" />
                    {step < STEPS.length - 1 && <button type="button" onClick={() => !stepErr[step] && setStep(s => s + 1)} disabled={!!stepErr[step]} data-testid="rw-next"
                        className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-bold inline-flex items-center gap-1 disabled:opacity-40">Next <ChevronRight size={13} /></button>}
                    {step === STEPS.length - 1 && (<>
                        <button type="button" onClick={() => submit(false)} disabled={busy || stepErr.some(Boolean)} data-testid="rw-save-draft"
                            className="px-3 py-2 rounded-lg border border-zinc-700 text-xs font-bold text-zinc-200 inline-flex items-center gap-1.5 disabled:opacity-40">{busy ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} {published ? "Save changes" : "Save as Draft"}</button>
                        {!published && <button type="button" onClick={() => submit(true)} disabled={busy || stepErr.some(Boolean)} data-testid="rw-publish"
                            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-bold inline-flex items-center gap-1.5 disabled:opacity-40"><Rocket size={13} /> Save & Publish</button>}
                    </>)}
                </div>
            </>)}
        </div>
    );
}

/** What the new role's sidebar will look like (the base role's sidebar without the hidden / blocked items) */
function SidebarPreview({ baseRole, removed, title }: { baseRole: string; removed: string[]; title: string }) {
    const sections = useMemo(() => {
        const hrx = baseRole === "HR_EXECUTIVE";
        return applyRestriction(buildSidebar({ role: (hrx ? "HR" : baseRole) as Role, hrExecutive: hrx }).sections, removed);
    }, [baseRole, removed]);
    return (
        <div className="space-y-2" data-testid="rw-sidebar-preview">
            <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 inline-flex items-center gap-1.5"><Eye size={12} /> Sidebar of {title || "the new role"}</p>
            <div className="rounded-xl border border-zinc-800 bg-[#0a0a0b] p-3 space-y-3 max-h-[420px] overflow-y-auto">
                {sections.map(s => (
                    <div key={s.key}>
                        <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest mb-1 px-1">{s.title}</p>
                        {s.items.map(i => <p key={i.path} className="flex items-center gap-2 px-2 py-1 text-xs text-zinc-300" data-testid="rw-preview-item" data-path={i.path}><i.icon size={13} className="text-zinc-600 shrink-0" /> {i.label}</p>)}
                    </div>
                ))}
            </div>
        </div>
    );
}

/** Org Chart place: same as the base role, or an own box — previewed on the real chart (no employee is created) */
function OrgStep({ label, roleId, baseRole, org, setOrg }: { label: string; roleId: string; baseRole: string; org: { mode: "SAME" | "OWN"; parent?: string }; setOrg: (o: { mode: "SAME" | "OWN"; parent?: string }) => void }) {
    const [emps, setEmps] = useState<any[] | null>(null);
    const [published, setPublished] = useState<any[]>([]);
    useEffect(() => {
        fetch("/api/employees", { cache: "no-store" }).then(r => (r.ok ? r.json() : [])).then(d => setEmps(Array.isArray(d) ? d : [])).catch(() => setEmps([]));
        fetch("/api/auth/custom-roles", { cache: "no-store" }).then(r => (r.ok ? r.json() : null)).then(d => setPublished(Array.isArray(d?.roles) ? d.roles : [])).catch(() => { });
    }, []);
    const data = useMemo(() => {
        if (!emps) return null;
        const people = emps.filter(e => e?.id && e.id !== "HOI").map(e => toOrgPerson(e));
        const status = new Map(emps.map(e => [String(e.id), String(e.status || "Active")]));
        const roles = [...published.filter(r => r.roleId !== roleId), { roleId, label: label || roleId, org }];
        return buildOrgChart(people, id => status.get(id) || "Active", { roles, showEmpty: org.mode === "OWN" ? [roleId] : [] });
    }, [emps, published, roleId, label, org]);
    return (
        <div className="space-y-3" data-testid="rw-org">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2" role="radiogroup">
                <button type="button" role="radio" aria-checked={org.mode === "SAME"} onClick={() => setOrg({ mode: "SAME" })} data-testid="rw-org-same"
                    className={cn("text-left rounded-xl border p-3", org.mode === "SAME" ? "border-primary/50 bg-primary/10" : "border-zinc-800 hover:border-zinc-600")}>
                    <p className="text-sm font-bold text-white">Same place as {labelOf(baseRole)}</p>
                    <p className="text-[11px] text-zinc-500">Employees appear exactly where {labelOf(baseRole)} employees appear.</p>
                </button>
                <button type="button" role="radio" aria-checked={org.mode === "OWN"} onClick={() => setOrg({ mode: "OWN", parent: org.parent || ORG_PARENTS[0].key })} data-testid="rw-org-own"
                    className={cn("text-left rounded-xl border p-3", org.mode === "OWN" ? "border-primary/50 bg-primary/10" : "border-zinc-800 hover:border-zinc-600")}>
                    <p className="text-sm font-bold text-white">Own box “{label || "New role"}”</p>
                    <p className="text-[11px] text-zinc-500">A separate box for this role, under the place you choose.</p>
                </button>
            </div>
            {org.mode === "OWN" && (
                <label className="block text-xs font-bold text-zinc-300 max-w-md">Box goes under
                    <select value={org.parent || ""} onChange={e => setOrg({ mode: "OWN", parent: e.target.value })} data-testid="rw-org-parent"
                        className="mt-1 w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-sm text-white font-normal outline-none">
                        {ORG_PARENTS.map(p => <option key={p.key} value={p.key} className="bg-zinc-900 text-white">{p.label}</option>)}
                    </select>
                </label>
            )}
            <p className="text-[11px] text-zinc-500 inline-flex items-center gap-1.5"><Network size={12} /> Preview on the current Org Chart{org.mode === "OWN" ? " — the new box is empty until employees are onboarded with this role" : ""}. Nothing is saved until you save the role.</p>
            <div className="rounded-2xl border border-zinc-800 overflow-hidden h-[420px]" data-testid="rw-org-preview">
                {!data ? <p className="p-4 text-xs text-zinc-500 flex items-center gap-2"><Loader2 size={13} className="animate-spin" /> Loading the Org Chart…</p>
                    : <OrgCanvas><OrgChart data={data} /></OrgCanvas>}
            </div>
        </div>
    );
}

export default function CreateRolePage() {
    return <Suspense fallback={null}><Wizard /></Suspense>;
}