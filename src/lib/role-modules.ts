/**
 * Role Management (Admin): what HR / Founder may restrict for a role, and how a restriction is matched.
 * Shared by the browser (sidebar, Admin pages) and the server (proxy, Admin API). No database code here.
 *
 * Nothing is restricted by default: a role without a saved configuration works exactly as before.
 *   hidden  → the sidebar item is not shown (the page still opens from a link)
 *   blocked → the sidebar item is not shown, the page does not open, and the APIs listed below answer 403
 * Only restrictions are possible here; access a role does not have in the code cannot be granted from the Admin page.
 */

/** Roles whose access cannot be edited (they run the Admin pages — editing them could lock everyone out) */
export const LOCKED_ROLES = ["FOUNDER", "HR"];

/** Sidebar items that always stay (landing page, own profile, password, Admin, Give Access) */
export const LOCKED_PATHS = ["/", "/placement-intern-head/dashboard", "/profile", "/change-password", "/access", "/admin/roles", "/admin/role-logs"];

/** Hub pages: blocking them blocks only that page, not the pages below them (those are separate sidebar items) */
export const EXACT_ONLY = ["/", "/hr", "/manager", "/curriculum", "/faculty", "/founder", "/attendance", "/academic", "/tech-lead"];

/**
 * APIs used only by that sidebar page → blocked together with it.
 * Pages missing here use APIs that other pages also need (attendance, leaves, tickets, employees, …):
 * blocking them blocks the page only, so nothing else breaks.
 */
export const MODULE_APIS: Record<string, string[]> = {
    "/reimbursement": ["/api/reimbursements"],
    "/hr/reimbursements": ["/api/reimbursements"],
    "/meetings": ["/api/meetings"],
    "/my-payable-days": ["/api/my-payable-days"],
    "/leave-summary": ["/api/leave-summary"],
    "/flag-calendar": ["/api/attendance/flags"],
    "/full-attire": ["/api/full-attire"],
    "/hr/full-attire": ["/api/full-attire"],
    "/hr/salary-management": ["/api/hr/salary-management", "/api/hr/correction-tickets"],
    "/hr/flag-removal": ["/api/hr/flag-removal"],
    "/hr/employee-directory": ["/api/hr/employee-directory"],
    "/academic/weekly-calendar": ["/api/academic/weekly-calendar"],
    "/tech-lead/exports": ["/api/tech-lead"],
    "/manager/reportees/academic-data": ["/api/manager/reportees"],
};

export type RoleRestriction = { hidden: string[]; blocked: string[] };
export type AccessState = "visible" | "hidden" | "blocked";

/** The key a role configuration is saved under (HR Executive logs in with HR permissions but is its own role;
 *  an employee with an HR-created role uses that role's configuration) */
export const configRoleOf = (u: { role?: string; hrExecutive?: boolean; actualRole?: string; customRole?: string } | null | undefined) =>
    u ? (u.customRole ? String(u.customRole) : u.hrExecutive ? "HR_EXECUTIVE" : String(u.actualRole || u.role || "")) : "";

/* ── Create Role (HR-created roles on top of an existing base role) ── */

/** Base roles a new role may use (never Founder or HR: those run the Admin pages) */
export const BASE_ROLE_CHOICES = ["PROFESSOR", "OM", "HOI", "AD", "TL", "CURRICULUM_LEAD", "CURRICULUM_HEAD", "MARKETING_TEAM", "TECH_TEAM", "PLACEMENT_INTERN_HEAD", "TECH_INTERN", "HR_EXECUTIVE"];
/** Role ID: capitals, digits and _ (3–40 characters), starting with a letter */
export const ROLE_ID_RE = /^[A-Z][A-Z0-9_]{2,39}$/;
export const roleIdFromLabel = (label: string) => String(label || "").trim().toUpperCase().replace(/&/g, " AND ").replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40);
/** Org Chart place of a new role: where its base role is, or its own box under one of these */
export const ORG_PARENTS: { key: string; label: string }[] = [
    { key: "TL", label: "Tech Lead (next to Tech Team / Marketing Team)" },
    { key: "AD", label: "AD (next to the HOIs)" },
    { key: "HR", label: "HR (next to HR Team)" },
    { key: "HOI", label: "Each employee's HOI (own box under that HOI)" },
];
/** Same level as one of these (row of Tech Lead · AD · HR), on its left or right — joined to the executives above */
export const ORG_BESIDE: { key: string; label: string }[] = [
    { key: "TL", label: "Tech Lead" },
    { key: "AD", label: "AD" },
    { key: "HR", label: "HR" },
];
/** parent "ROLE:<roleId>" = own box under another HR-created role's box */
export const ORG_ROLE_PREFIX = "ROLE:";
/**
 * SAME  — where the base role is
 * OWN   — own box under `parent` (TL / AD / HR / HOI, or ROLE:<roleId>)
 * LEFT / RIGHT — own box on the Tech Lead · AD · HR level, left / right of `parent` (TL / AD / HR)
 */
export type OrgPlacement = { mode: "SAME" | "OWN" | "LEFT" | "RIGHT"; parent?: string };
/** Keep only a valid placement (anything else = SAME). Another role as parent is checked against the saved roles separately. */
export function cleanOrgPlacement(o: any): OrgPlacement {
    const mode = String(o?.mode || ""), parent = String(o?.parent || "");
    if (mode === "OWN" && ORG_PARENTS.some(p => p.key === parent)) return { mode: "OWN", parent };
    if (mode === "OWN" && parent.startsWith(ORG_ROLE_PREFIX) && ROLE_ID_RE.test(parent.slice(ORG_ROLE_PREFIX.length))) return { mode: "OWN", parent };
    if ((mode === "LEFT" || mode === "RIGHT") && ORG_BESIDE.some(p => p.key === parent)) return { mode, parent };
    return { mode: "SAME" };
}
/** "Own box under AD" / "Same level as HR, on its left" / "Own box under Operations Head" / "Same place as the base role" */
export function orgPlacementText(o: OrgPlacement | undefined, roleLabel: (roleId: string) => string = r => r): string {
    if (!o || o.mode === "SAME") return "Same place as the base role";
    const p = String(o.parent || "");
    if (o.mode === "LEFT" || o.mode === "RIGHT") return `Same level as ${ORG_BESIDE.find(b => b.key === p)?.label || p}, on its ${o.mode === "LEFT" ? "left" : "right"}`;
    if (p.startsWith(ORG_ROLE_PREFIX)) return `Own box under ${roleLabel(p.slice(ORG_ROLE_PREFIX.length))}`;
    return `Own box under ${ORG_PARENTS.find(x => x.key === p)?.label.split(" (")[0] || p}`;
}
export type CustomRoleInfo = { roleId: string; label: string; baseRole: string; org: OrgPlacement };

const under = (path: string, p: string) => path === p || path.startsWith(p.endsWith("/") ? p : p + "/");

/** Is this page (URL path) blocked by one of the blocked sidebar paths? */
export function pageBlocked(blocked: string[], path: string) {
    return blocked.find(p => (EXACT_ONLY.includes(p) ? path === p : under(path, p))) || null;
}

/** Is this API path blocked by one of the blocked sidebar paths? */
export function apiBlocked(blocked: string[], path: string) {
    for (const p of blocked) for (const a of MODULE_APIS[p] || []) if (under(path, a)) return p;
    return null;
}

/** Clean a saved / submitted configuration: blocked implies hidden; locked paths never restricted */
export function normalizeRestriction(r: Partial<RoleRestriction> | null | undefined): RoleRestriction {
    const clean = (a: any) => Array.from(new Set((Array.isArray(a) ? a : []).map(String).filter(p => p.startsWith("/") && !LOCKED_PATHS.includes(p)))).sort();
    const blocked = clean(r?.blocked);
    const hidden = clean(r?.hidden).filter(p => !blocked.includes(p));
    return { hidden, blocked };
}

export const stateOf = (r: RoleRestriction, path: string): AccessState => (r.blocked.includes(path) ? "blocked" : r.hidden.includes(path) ? "hidden" : "visible");