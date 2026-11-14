/**
 * Who is shown as an employee's manager (display only — approvals and routing are unchanged):
 *   • Professor / Faculty / OM → their HOI (label "HOI")
 *   • everyone else       → the manager HR assigned (Work Location → Assign Manager), label "Manager";
 *                           without an assignment: their non-HOI reporting manager(s).
 * Works on the client and the server: pass a lookup for employees and the assigned manager id (if any).
 */
export const HOI_LABEL_ROLES = ["PROFESSOR", "FACULTY", "OM"];

type Person = { id: string; name?: string; role?: string };
export type DisplayManager = { label: "HOI" | "Manager"; people: Person[]; names: string };

const idsOf = (e: any): string[] => (Array.isArray(e?.reportsTo) ? e.reportsTo : e?.reportsTo ? [e.reportsTo] : []).filter(Boolean).map(String);

export function displayManager(emp: any, find: (id: string) => Person | undefined, assignedManagerId?: string | null): DisplayManager {
    const role = String(emp?.role || "");
    const ids = idsOf(emp);
    const linked = ids.map(id => find(id) || { id, name: id }).filter(p => p.id !== String(emp?.id || ""));
    const hois = linked.filter(p => p.role === "HOI");
    const done = (label: DisplayManager["label"], people: Person[]): DisplayManager => ({ label, people, names: people.map(p => p.name || p.id).join(", ") });
    if (HOI_LABEL_ROLES.includes(role)) return done("HOI", hois);
    if (assignedManagerId) return done("Manager", [find(assignedManagerId) || { id: assignedManagerId, name: assignedManagerId }]);
    return done("Manager", linked.filter(p => p.role !== "HOI"));
}