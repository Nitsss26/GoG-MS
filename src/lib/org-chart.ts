/**
 * Organization Chart builder — 100% driven by the existing Employee records (no separate chart data).
 * Placement comes from role / designation / department / reportsTo (assigned HOI) / status.
 *
 *  CEO · COO · CTO  (role FOUNDER)
 *        │
 *  TECH LEAD (TL) ── Tech Team / Marketing Team
 *  AD             ── HOIs (each → its Professors, OMs, Tech & Marketing employees) · CL / CH · No HOI Assigned
 *  HR             ── HR Executive
 *
 * An employee can appear in more than one place (e.g. a Tech Team member assigned to an HOI);
 * every appearance references the same employee id — nothing is copied or created.
 */

export type OrgPerson = {
    id: string;
    name: string;
    designation: string;
    role: string;
    dept: string;
    photo?: string;
    reportsTo: string[];
};

export type OrgHoi = { person: OrgPerson; members: OrgPerson[] };

export type OrgChartData = {
    executives: OrgPerson[];
    techLeads: OrgPerson[];
    ads: OrgPerson[];
    hrHeads: OrgPerson[];
    hrExecutives: OrgPerson[];
    techTeam: OrgPerson[];
    marketingTeam: OrgPerson[];
    hois: OrgHoi[];
    clch: OrgPerson[];
    noHoi: OrgPerson[];
    /** where each employee id appears → expandable group keys to open (used by search) */
    placements: Record<string, string[]>;
};

const INACTIVE = /inactive|terminated|resigned|exited|relieved|left|removed|separated/i;
const ACADEMIC = ["PROFESSOR", "FACULTY", "OM"];
const HOI_MEMBER_ROLES = ["PROFESSOR", "FACULTY", "OM", "TECH_TEAM", "MARKETING_TEAM"];
// Roles that already have their own fixed place — department text never moves them
const FIXED_ROLES = ["FOUNDER", "TL", "AD", "HR", "HOI", "CURRICULUM_LEAD", "CURRICULUM_HEAD", "PROFESSOR", "FACULTY", "OM"];
const HR_EXEC = /\bhr\s*exec/i;
const isTechDept = (d: string) => /^(tech|technology|tech\s*team|it|engineering|software)$/i.test(d.trim());
const isMarketingDept = (d: string) => /marketing/i.test(d);

const EXEC_ORDER = ["CEO", "COO", "CTO"];
const execRank = (p: OrgPerson) => {
    const d = p.designation.toUpperCase();
    const i = EXEC_ORDER.findIndex(t => new RegExp(`\\b${t}\\b`).test(d)
        || (t === "CEO" && /CHIEF\s+EXECUTIVE/.test(d)) || (t === "COO" && /CHIEF\s+OPERATING/.test(d)) || (t === "CTO" && /CHIEF\s+TECHNOLOGY/.test(d)));
    return i === -1 ? 99 : i;
};
const byName = (a: OrgPerson, b: OrgPerson) => a.name.localeCompare(b.name);
const memberRank: Record<string, number> = { PROFESSOR: 0, FACULTY: 0, OM: 1, TECH_TEAM: 2, MARKETING_TEAM: 3 };

export function toOrgPerson(e: any, override?: { name?: string; designation?: string }): OrgPerson {
    const role = String(e.role || "").toUpperCase();
    const fallback: Record<string, string> = {
        FOUNDER: "Founder", TL: "Tech Lead", AD: "AD", HR: "HR", HOI: "HOI", OM: "Operation Manager",
        PROFESSOR: "Professor", FACULTY: "Professor", CURRICULUM_LEAD: "CL", CURRICULUM_HEAD: "CH",
        TECH_TEAM: "Tech Team", MARKETING_TEAM: "Marketing Team",
    };
    const name = String(override?.name || e.name || e.id || "").trim();
    return {
        id: String(e.id),
        name,
        designation: String(override?.designation || e.designation || fallback[role] || role.replace(/_/g, " ")).trim(),
        role,
        dept: String(e.dept || "").trim(),
        photo: e.passportPhotoUrl || e.photoUrl || undefined,
        reportsTo: (Array.isArray(e.reportsTo) ? e.reportsTo : e.reportsTo ? [e.reportsTo] : []).map(String),
    };
}

export function buildOrgChart(people: OrgPerson[], statusOf: (id: string) => string = () => "Active"): OrgChartData {
    const active = people.filter(p => p.id && p.name && !INACTIVE.test(statusOf(p.id) || ""));
    const of = (role: string) => active.filter(p => p.role === role).sort(byName);

    const executives = of("FOUNDER").sort((a, b) => execRank(a) - execRank(b) || byName(a, b));
    const techLeads = of("TL");
    const ads = of("AD");
    const hrAll = active.filter(p => p.role === "HR" || (!FIXED_ROLES.includes(p.role) && HR_EXEC.test(p.designation)));
    const hrExecutives = hrAll.filter(p => HR_EXEC.test(p.designation)).sort(byName);
    const hrHeads = hrAll.filter(p => !HR_EXEC.test(p.designation)).sort(byName);
    const execIds = new Set(hrExecutives.map(p => p.id));

    const techTeam = active.filter(p => !execIds.has(p.id) && (p.role === "TECH_TEAM" || (!FIXED_ROLES.includes(p.role) && p.role !== "MARKETING_TEAM" && isTechDept(p.dept)))).sort(byName);
    const marketingTeam = active.filter(p => !execIds.has(p.id) && (p.role === "MARKETING_TEAM" || (!FIXED_ROLES.includes(p.role) && p.role !== "TECH_TEAM" && isMarketingDept(p.dept)))).sort(byName);

    const hoiPeople = of("HOI");
    const hoiIds = new Set(hoiPeople.map(h => h.id));
    const hois: OrgHoi[] = hoiPeople.map(h => ({
        person: h,
        members: active
            .filter(p => p.id !== h.id && HOI_MEMBER_ROLES.includes(p.role) && p.reportsTo.includes(h.id))
            .sort((a, b) => (memberRank[a.role] ?? 9) - (memberRank[b.role] ?? 9) || byName(a, b)),
    }));
    const clch = active.filter(p => p.role === "CURRICULUM_HEAD" || p.role === "CURRICULUM_LEAD")
        .sort((a, b) => (a.role === b.role ? 0 : a.role === "CURRICULUM_HEAD" ? -1 : 1) || byName(a, b));
    // Professors / OMs not assigned to any (active) HOI — shown so HR can spot them
    const noHoi = active.filter(p => ACADEMIC.includes(p.role) && !p.reportsTo.some(r => hoiIds.has(r))).sort(byName);

    const placements: Record<string, string[]> = {};
    const put = (id: string, key: string) => { (placements[id] ||= []).includes(key) || placements[id].push(key); };
    executives.forEach(p => put(p.id, "root"));
    [...techLeads, ...ads, ...hrHeads].forEach(p => put(p.id, "root"));
    techTeam.forEach(p => put(p.id, "grp:tech"));
    marketingTeam.forEach(p => put(p.id, "grp:marketing"));
    hrExecutives.forEach(p => put(p.id, "grp:hrexec"));
    clch.forEach(p => put(p.id, "grp:clch"));
    noHoi.forEach(p => put(p.id, "grp:nohoi"));
    hois.forEach(h => { put(h.person.id, "root"); h.members.forEach(m => put(m.id, `hoi:${h.person.id}`)); });

    return { executives, techLeads, ads, hrHeads, hrExecutives, techTeam, marketingTeam, hois, clch, noHoi, placements };
}