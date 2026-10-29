import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { AttendanceViolation, Employee } from '@/models/Schemas';
import { getSessionUser } from '@/lib/session-user';
import { istNow } from '@/lib/attendance-violations';

export const dynamic = 'force-dynamic';

/**
 * Attendance violations (Late Clock-In / Early Clock-Out / Missing Clock-Out).
 *   GET                       → own violations (any employee)
 *   GET ?view=all&period=YYYY-MM → HR / Founder: everyone, with a per-employee summary
 */
export async function GET(req: Request) {
    try {
        await dbConnect();
        const actor: any = await getSessionUser({ ignoreDelegation: true });
        if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const { searchParams } = new URL(req.url);
        const period = /^\d{4}-\d{2}$/.test(searchParams.get('period') || '') ? searchParams.get('period')! : istNow().ymd.slice(0, 7);

        if (searchParams.get('view') === 'all') {
            if (actor.role !== 'HR' && actor.role !== 'FOUNDER') return NextResponse.json({ error: 'Only HR can view all attendance violations.' }, { status: 403 });
            // employees HR removed from attendance are left out
            const hidden: any[] = await Employee.find({ hideFromAttendance: true } as any).select('id').lean();
            const rows: any[] = await AttendanceViolation.find({ period, ...(hidden.length ? { employeeId: { $nin: hidden.map(h => h.id) } } : {}) }).sort({ date: -1, createdAt: -1 }).limit(3000).select('-__v').lean();
            const summary = new Map<string, any>();
            for (const v of rows) {
                const s = summary.get(v.employeeId) || { employeeId: v.employeeId, employeeName: v.employeeName, email: v.email, LATE_IN: 0, EARLY_OUT: 0, MISSING_OUT: 0, lateLevel: '', earlyLevel: '', proposed: [] as string[], pendingHr: 0, emailFailed: 0, lastEmailStatus: '' };
                const counted = !['Waived', 'Approved'].includes(v.hrStatus);
                if (counted) s[v.type] = Math.max(s[v.type], v.instance || 0);
                if (v.type === 'LATE_IN' && !s.lateLevel) s.lateLevel = v.level;
                if (v.type === 'EARLY_OUT' && !s.earlyLevel) s.earlyLevel = v.level;
                if (['Half-Day', 'Full-Day'].includes(v.proposedDeduction) && v.hrStatus !== 'Waived') s.proposed.push(`${v.proposedDeduction} (${v.date.split('-').reverse().join('-')})`);
                if (['Pending HR Verification', 'Awaiting Explanation'].includes(v.hrStatus) || (v.type === 'MISSING_OUT' && v.hrStatus === 'Pending HR Verification')) s.pendingHr++;
                if (v.emailStatus === 'Failed') s.emailFailed++;
                if (!s.lastEmailStatus) s.lastEmailStatus = v.emailStatus;
                summary.set(v.employeeId, s);
            }
            return NextResponse.json({ period, violations: rows, summary: Array.from(summary.values()).sort((a, b) => (b.LATE_IN + b.EARLY_OUT + b.MISSING_OUT) - (a.LATE_IN + a.EARLY_OUT + a.MISSING_OUT)) });
        }
        const rows = await AttendanceViolation.find({ employeeId: actor.id }).sort({ date: -1 }).limit(200)
            .select('id type date period scheduledTime actualTime durationMins instance level proposedDeduction hrStatus emailStatus explanation proofUrls explanationAt hrRemarks hrDecisionAt laterClockOut').lean();
        return NextResponse.json({ violations: rows });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}