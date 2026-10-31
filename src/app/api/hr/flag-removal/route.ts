import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { Employee } from '@/models/Schemas';
import { getSessionUser } from '@/lib/session-user';
import { FlagRemoval } from '@/models/SalaryModule';
import { canRemoveFlags, listFlags, resolveFlag, sendFlagRemovalEmail, nowIso, actorRoleLabel, isYmd, istToday, IMAGE_URL_RE } from '@/lib/salary-module';

export const dynamic = 'force-dynamic';

const PAGE = 20;

/**
 * GET — flags (HR, HR Executive, Founders).
 * ?tab=ALL|DRESS_CODE|CLOCK_IN|CLOCK_OUT|REMOVED &q= &from= &to= &dept= &college= &page=
 * Default: active flags only. "REMOVED" shows the removal history.
 */
export async function GET(req: Request) {
    try {
        await dbConnect();
        const actor: any = await getSessionUser({ ignoreDelegation: true });
        if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        if (!canRemoveFlags(actor)) return NextResponse.json({ error: 'Only HR, HR Executive or Founders can open Flag Removal.' }, { status: 403 });
        const sp = new URL(req.url).searchParams;
        const tab = sp.get('tab') || 'ALL';
        const from = isYmd(sp.get('from')) ? sp.get('from')! : '';
        const to = isYmd(sp.get('to')) ? sp.get('to')! : '';
        const q = (sp.get('q') || '').trim().toLowerCase();
        const dept = sp.get('dept') || '';
        const college = sp.get('college') || '';
        const page = Math.max(1, Number(sp.get('page')) || 1);

        const rows = await listFlags({ from, to });
        const active = rows.filter(r => r.status === 'Active');
        const month = istToday().slice(0, 7);
        const removedThisMonth = await FlagRemoval.countDocuments({ removedAt: { $gte: `${month}-01` } });
        const summary = {
            totalActive: active.length,
            dressCode: active.filter(r => r.category === 'DRESS_CODE').length,
            clockIn: active.filter(r => r.category === 'CLOCK_IN').length,
            clockOut: active.filter(r => r.category === 'CLOCK_OUT').length,
            removedThisMonth,
        };
        const base = tab === 'REMOVED' ? rows.filter(r => r.status === 'Removed') : active.filter(r => tab === 'ALL' || r.category === tab);
        const filtered = base.filter(r => (!q || r.employeeName.toLowerCase().includes(q) || r.employeeId.toLowerCase().includes(q))
            && (!dept || r.dept === dept) && (!college || r.location === college))
            .sort((a, b) => tab === 'REMOVED' ? String(b.removal?.removedAt || '').localeCompare(String(a.removal?.removedAt || '')) : b.date.localeCompare(a.date) || a.employeeName.localeCompare(b.employeeName));
        const depts = Array.from(new Set(rows.map(r => r.dept).filter(Boolean))).sort();
        const colleges = Array.from(new Map(rows.filter(r => r.location).map(r => [r.location, r.locationName || r.location])).entries()).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
        return NextResponse.json({
            summary, total: filtered.length, page, pageSize: PAGE, pages: Math.max(1, Math.ceil(filtered.length / PAGE)),
            rows: filtered.slice((page - 1) * PAGE, page * PAGE), depts, colleges,
        });
    } catch (e: any) {
        console.error('flag-removal GET', e);
        return NextResponse.json({ error: 'Could not load flags.' }, { status: 500 });
    }
}

/** POST — remove one active flag { flagId, reason, imageUrl? }. The original record is never changed or deleted. */
export async function POST(req: Request) {
    try {
        await dbConnect();
        const actor: any = await getSessionUser({ ignoreDelegation: true });
        if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        if (!canRemoveFlags(actor)) return NextResponse.json({ error: 'Only HR, HR Executive or Founders can remove flags.' }, { status: 403 });
        const b = await req.json().catch(() => ({}));
        const reason = String(b.reason || '').trim();
        if (reason.length < 5) return NextResponse.json({ error: 'Reason for flag removal is required (at least 5 characters).' }, { status: 400 });
        const imageUrl = String(b.imageUrl || '').trim();
        if (imageUrl && (!IMAGE_URL_RE.test(imageUrl) || imageUrl.length > 2048)) return NextResponse.json({ error: 'The supporting image must be an uploaded JPG, PNG or WEBP file.' }, { status: 400 });
        const found = await resolveFlag(String(b.flagId || ''));
        if (!found) return NextResponse.json({ error: 'Flag not found.' }, { status: 404 });
        if (found.row.status !== 'Active') return NextResponse.json({ error: 'This flag is already removed.' }, { status: 409 });
        if (found.row.employeeId === actor.id) return NextResponse.json({ error: 'You cannot remove your own flag.' }, { status: 403 });
        if (found.row.source === 'VIOLATION' && ['Waived', 'Approved'].includes(found.snapshot.hrStatus)) return NextResponse.json({ error: 'This flag is already closed by HR.' }, { status: 409 });

        const me: any = actor.employee || {};
        const now = nowIso();
        const doc = {
            id: `FR-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`.toUpperCase(),
            flagId: found.row.flagId, source: found.row.source, sourceId: found.row.sourceId,
            employeeId: found.row.employeeId, employeeName: found.row.employeeName, employeeRole: found.row.role,
            dept: found.row.dept, designation: found.row.designation, location: found.row.location, locationName: found.row.locationName,
            flagCategory: found.row.category, flagType: found.row.type, flagLabel: found.row.typeLabel, flagDate: found.row.date,
            originalStatus: 'active', updatedStatus: 'removed', originalSnapshot: found.snapshot,
            removalReason: reason.slice(0, 3000), supportingImageUrl: imageUrl,
            removedBy: actor.id, removedByName: actor.name, removedByRole: actorRoleLabel(actor),
            removedByDesignation: me.designation || me.current_designation_at_gog || actorRoleLabel(actor),
            removedAt: now, emailStatus: 'PENDING', emailAttempts: 0, emailLog: [],
        };
        try { await FlagRemoval.create(doc); }
        catch (e: any) {
            if (e?.code === 11000) return NextResponse.json({ error: 'This flag was just removed by someone else.' }, { status: 409 });
            throw e;
        }
        // email after the removal is saved — a mail problem never undoes the removal
        const mail = await sendFlagRemovalEmail(doc.id, actor.id).catch((e: any) => ({ ok: false, status: 'FAILED', error: e?.message }));
        const emp: any = await Employee.findOne({ id: doc.employeeId }).select('name').lean();
        return NextResponse.json({
            success: true, removalId: doc.id, emailStatus: (mail as any).status,
            message: `Flag removed for ${emp?.name || doc.employeeName}.${(mail as any).ok ? ' Email sent.' : ' The email could not be sent — use Retry Email.'}`,
        });
    } catch (e: any) {
        console.error('flag-removal POST', e);
        return NextResponse.json({ error: 'Could not remove the flag.' }, { status: 500 });
    }
}