import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { getSessionUser } from '@/lib/session-user';
import { workforceScope, workforceRows, EXPORT_FULL_ROLES } from '@/lib/employee-report';

export const dynamic = 'force-dynamic';

/**
 * Workforce export data. POST { ids?: string[] } — ids = the rows matching the page's search / filters ("Export Filtered");
 * no ids = every employee the caller may see ("Export All"). HR / Founder: all employees incl. personal details;
 * HOI / AD / OM: only their reportees, work details only. Others: 403.
 */
export async function POST(req: Request) {
    try {
        await dbConnect();
        const actor = await getSessionUser({ ignoreDelegation: true });
        if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const scope = await workforceScope(actor);
        if (!scope) return NextResponse.json({ error: 'You are not allowed to export workforce data.' }, { status: 403 });
        const b = await req.json().catch(() => ({}));
        const ids: string[] | null = Array.isArray(b.ids) ? b.ids.map(String) : null;
        const list = (ids ? scope.filter(e => ids.includes(e.id)) : scope).sort((a, z) => String(a.name).localeCompare(String(z.name)));
        const full = EXPORT_FULL_ROLES.includes(actor.role);
        const { cols, rows } = await workforceRows(list, full);
        return NextResponse.json({
            title: 'Workforce Employee Report', scope: ids ? `Filtered employees (${rows.length})` : `All employees (${rows.length})`,
            generatedBy: `${actor.name} (${actor.role})`, generatedAt: new Date().toISOString(), cols, rows,
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}