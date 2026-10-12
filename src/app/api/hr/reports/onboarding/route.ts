import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { Employee } from '@/models/Schemas';
import { getSessionUser } from '@/lib/session-user';
import { onboardingListRows, onboardingReport, removedEmployees, EXPORT_FULL_ROLES } from '@/lib/employee-report';

export const dynamic = 'force-dynamic';

/**
 * Onboarding Hub data (HR / Founder only).
 *  GET ?employeeId=EMP305      → complete onboarding report of one employee (all sections)
 *  GET ?removed=1              → employees removed from the portal (for the "Removed" tab)
 *  POST { ids?: string[] }     → onboarding list rows (ids = current tab / search; none = all)
 */
async function guard() {
    const actor = await getSessionUser({ ignoreDelegation: true });
    if (!actor) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
    if (!EXPORT_FULL_ROLES.includes(actor.role)) return { error: NextResponse.json({ error: 'Only HR or the Founder can export onboarding data.' }, { status: 403 }) };
    return { actor };
}

export async function GET(req: Request) {
    try {
        await dbConnect();
        const g = await guard(); if (g.error) return g.error;
        const { searchParams } = new URL(req.url);
        if (searchParams.get('removed') === '1') return NextResponse.json({ employees: await removedEmployees() });
        const employeeId = searchParams.get('employeeId');
        if (!employeeId) return NextResponse.json({ error: 'employeeId is required' }, { status: 400 });
        const report = await onboardingReport(employeeId);
        if (!report) return NextResponse.json({ error: 'Employee not found.' }, { status: 404 });
        return NextResponse.json({ title: 'Employee Onboarding Report', generatedBy: `${g.actor!.name} (${g.actor!.role})`, generatedAt: new Date().toISOString(), report });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        await dbConnect();
        const g = await guard(); if (g.error) return g.error;
        const b = await req.json().catch(() => ({}));
        const ids: string[] | null = Array.isArray(b.ids) ? b.ids.map(String) : null;
        const [active, removed]: any[] = await Promise.all([Employee.find({ role: { $ne: 'FOUNDER' } }).lean(), Employee.find({ isRemoved: true }).lean()]);
        const all: any[] = [...active, ...removed];
        const list = (ids ? all.filter((e: any) => ids.includes(e.id)) : (active as any[])).sort((a: any, z: any) => String(a.name).localeCompare(String(z.name)));
        const { cols, rows } = await onboardingListRows(list);
        return NextResponse.json({
            title: 'Onboarding List Report', scope: ids ? `Filtered onboarding records (${rows.length})` : `All onboarding records (${rows.length})`,
            generatedBy: `${g.actor!.name} (${g.actor!.role})`, generatedAt: new Date().toISOString(), cols, rows,
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}