import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { getSessionUser } from '@/lib/session-user';
import { Employee } from '@/models/Schemas';
import { ManagerAssignmentLog } from '@/models/ManagerAssignment';
import { assignManager, canAssignManagers, currentManagerMap, combinedManagerMap, isActiveEmployee, personCard, HOI_ONLY_ROLES } from '@/lib/manager-assignment';

export const dynamic = 'force-dynamic';

/**
 * Assign Manager (HR → Work Location → Assign Manager — replaces Assign HOI).
 * GET               HR / Founder: every active employee with their current manager (assigned HOI, else reporting
 *                   manager) + manager-wise teams
 * GET ?history=ID   HR / Founder: assignment history of one employee (ID) or of everyone (all)
 * GET ?view=map     any signed-in user: employeeId → managerId (Organization Chart)
 * POST { employeeId, managerId, effectiveDate?, reason? }   HR / Founder: assign / reassign (validated on the server)
 */
export async function GET(req: Request) {
    try {
        await dbConnect();
        const actor = await getSessionUser();
        if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const { searchParams } = new URL(req.url);

        if (searchParams.get('view') === 'map') {
            const map = await currentManagerMap();
            return NextResponse.json({ map: Object.fromEntries(Array.from(map.entries()).map(([k, v]) => [k, v.managerId])) });
        }
        if (!canAssignManagers(actor)) return NextResponse.json({ error: 'Only HR can view manager assignments.' }, { status: 403 });

        const history = searchParams.get('history');
        if (history) {
            const q = history === 'all' ? {} : { employeeId: history };
            const logs = await ManagerAssignmentLog.find(q).sort({ assignedAt: -1 }).limit(history === 'all' ? 300 : 100).lean();
            return NextResponse.json({ history: logs });
        }

        const all: any[] = await Employee.find({}).select('id name email role designation current_designation_at_gog dept location status isRemoved reportsTo').lean();
        const active = all.filter(e => e.id && e.id !== 'HOI' && isActiveEmployee(e));
        const byId = new Map(active.map(e => [String(e.id), e]));
        const map = await combinedManagerMap(all);
        const employees = active.map(e => {
            const cur = map.get(String(e.id));
            const m = cur ? byId.get(cur.managerId) : null;
            return {
                ...personCard(e),
                manager: cur ? {
                    id: cur.managerId, name: m?.name || cur.managerId, designation: m ? personCard(m).designation : '', dept: m?.dept || '', email: m?.email || '',
                    active: !!m, source: cur.source, effectiveDate: cur.row?.effectiveDate, assignedAt: cur.row?.assignedAt, assignedByName: cur.row?.assignedByName,
                } : null,
                hoiOnly: HOI_ONLY_ROLES.includes(e.role),
            };
        }).sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));

        // Manager-wise teams: direct reportees, and indirect (reportees of reportees) through the same assignments
        const direct = new Map<string, string[]>();
        map.forEach((v, empId) => { if (byId.has(empId)) (direct.get(v.managerId) || direct.set(v.managerId, []).get(v.managerId)!).push(empId); });
        const indirectOf = (id: string) => {
            const out: string[] = []; const seen = new Set([id]); let level = direct.get(id) || [];
            while (level.length) { const next: string[] = []; for (const x of level) for (const y of direct.get(x) || []) if (!seen.has(y)) { seen.add(y); out.push(y); next.push(y); } level = next; }
            return out;
        };
        const teams = Array.from(direct.keys()).filter(id => byId.has(id)).map(id => ({
            manager: personCard(byId.get(id)),
            direct: (direct.get(id) || []).map(x => personCard(byId.get(x))).sort((a, b) => a.name.localeCompare(b.name)),
            indirect: indirectOf(id).filter(x => byId.has(x)).map(x => ({ ...personCard(byId.get(x)), via: map.get(x)?.managerId })),
        })).sort((a, b) => b.direct.length - a.direct.length || a.manager.name.localeCompare(b.manager.name));

        return NextResponse.json({ employees, teams, canEdit: true });
    } catch (error: any) {
        console.error('Manager assignment GET error:', error?.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        await dbConnect();
        const actor = await getSessionUser();
        if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const body = await req.json().catch(() => ({}));
        const result = await assignManager(actor as any, { employeeId: body.employeeId, managerId: body.managerId, effectiveDate: body.effectiveDate, reason: body.reason });
        if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
        return NextResponse.json({ success: true, message: result.message, log: result.log, current: result.current });
    } catch (error: any) {
        console.error('Manager assignment POST error:', error?.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}