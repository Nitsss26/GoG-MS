import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { Employee, AccessGrant } from '@/models/Schemas';
import { getSessionUser } from '@/lib/session-user';
import { grantorPermissions } from '@/lib/access-control';
import { hubOf, PROTECTED_CATEGORIES } from '@/lib/access-hubs';
import { newId, notifySafe } from '@/lib/academic';

export const dynamic = 'force-dynamic';

/**
 * Give / edit / revoke delegated access.
 *  POST { action: "grant",  category, scopeType: "SELECTED" | "ALL" | "ALL_DYNAMIC", sourceIds?, recipientIds }
 *  POST { action: "edit",   grantId, scopeType, sourceIds? }
 *  POST { action: "revoke", grantId }
 * One ACTIVE grant per (recipient, category): a new grant for the same hub adds its sources to it.
 */
type Actor = { id: string; name: string; role: string };

async function validSources(category: string, scopeType: string, sourceIds: any): Promise<{ ids: string[] } | { error: string }> {
    const hub = hubOf(category)!;
    const pool: any[] = await Employee.find({ role: { $in: hub.sourceRoles }, status: { $nin: ['Inactive'] } }).select('id').lean();
    const poolIds = pool.map(p => p.id);
    if (scopeType === 'ALL') return poolIds.length ? { ids: poolIds } : { error: `There are no active ${category} employees.` };
    if (scopeType === 'ALL_DYNAMIC') return { ids: [] };
    const ids = Array.from(new Set((Array.isArray(sourceIds) ? sourceIds : []).map(String)));
    if (!ids.length) return { error: 'Select at least one source employee.' };
    const bad = ids.filter(id => !poolIds.includes(id));
    if (bad.length) return { error: `Not active ${category} employees: ${bad.join(', ')}` };
    return { ids };
}
const hist = (actor: Actor, action: string, note = '', sourceEmployeeIds: string[] = []) =>
    ({ action, by: actor.id, byName: actor.name, role: actor.role, at: new Date().toISOString(), note, sourceEmployeeIds });

export async function GET() {
    try {
        await dbConnect();
        const actor = await getSessionUser({ ignoreDelegation: true });
        if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const perm = await grantorPermissions(actor);
        if (!perm.canManage) return NextResponse.json({ error: 'You are not allowed to manage access.' }, { status: 403 });
        return NextResponse.json({ grants: await AccessGrant.find({}).sort({ grantedAt: -1 }).lean() });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        await dbConnect();
        const actor = await getSessionUser({ ignoreDelegation: true });
        if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const perm = await grantorPermissions(actor);
        if (!perm.canManage) return NextResponse.json({ error: 'You are not allowed to manage access.' }, { status: 403 });
        const b = await req.json().catch(() => ({}));
        const action = String(b.action || '');
        const now = new Date().toISOString();

        if (action === 'grant') {
            const category = String(b.category || '');
            const scopeType = ['SELECTED', 'ALL', 'ALL_DYNAMIC'].includes(b.scopeType) ? b.scopeType : 'SELECTED';
            if (!hubOf(category) || PROTECTED_CATEGORIES.includes(category)) return NextResponse.json({ error: 'This category cannot be delegated.' }, { status: 400 });
            if (!perm.categories.includes(category)) return NextResponse.json({ error: `You are not allowed to delegate ${category} access.` }, { status: 403 });
            if (scopeType === 'ALL_DYNAMIC' && !perm.canDynamic) return NextResponse.json({ error: 'Only the Founder can include future employees automatically.' }, { status: 403 });
            const src = await validSources(category, scopeType, b.sourceIds);
            if ('error' in src) return NextResponse.json({ error: src.error }, { status: 400 });

            const recipientIds = Array.from(new Set((Array.isArray(b.recipientIds) ? b.recipientIds : []).map(String)));
            if (!recipientIds.length) return NextResponse.json({ error: 'Select at least one recipient.' }, { status: 400 });
            if (recipientIds.includes(actor.id)) return NextResponse.json({ error: 'You cannot give access to yourself.' }, { status: 403 });
            const recipients: any[] = await Employee.find({ id: { $in: recipientIds }, status: { $nin: ['Inactive'] } }).select('id name email role').lean();
            const missing = recipientIds.filter(id => !recipients.some(r => r.id === id));
            if (missing.length) return NextResponse.json({ error: `Recipients not found / inactive: ${missing.join(', ')}` }, { status: 400 });

            const results: any[] = [];
            for (const r of recipients) {
                const sourceIds = src.ids.filter(id => id !== r.id); // nobody is a source for themselves
                if (scopeType !== 'ALL_DYNAMIC' && !sourceIds.length) { results.push({ recipientId: r.id, skipped: 'is the only selected source' }); continue; }
                const existing: any = await AccessGrant.findOne({ recipientId: r.id, category, status: 'ACTIVE' });
                if (existing) {
                    const merged = existing.scopeType === 'ALL_DYNAMIC' ? [] : Array.from(new Set([...(existing.sourceEmployeeIds || []), ...sourceIds]));
                    existing.scopeType = existing.scopeType === 'ALL_DYNAMIC' || scopeType === 'ALL_DYNAMIC' ? 'ALL_DYNAMIC' : scopeType === 'ALL' || existing.scopeType === 'ALL' ? 'ALL' : 'SELECTED';
                    existing.sourceEmployeeIds = existing.scopeType === 'ALL_DYNAMIC' ? [] : merged;
                    Object.assign(existing, { updatedBy: actor.id, updatedByName: actor.name, updatedAt: now });
                    existing.history.push(hist(actor, 'Access extended', scopeType, sourceIds));
                    await existing.save();
                    results.push({ recipientId: r.id, grantId: existing.id, updated: true });
                } else {
                    const g = await AccessGrant.create({
                        id: newId('ACC'), recipientId: r.id, recipientName: r.name, category, scopeType, sourceEmployeeIds: sourceIds,
                        status: 'ACTIVE', grantedBy: actor.id, grantedByName: actor.name, grantedByRole: actor.role, grantedAt: now,
                        history: [hist(actor, 'Access granted', scopeType, sourceIds)],
                    });
                    results.push({ recipientId: r.id, grantId: g.id, created: true });
                }
                await notifySafe({
                    recipients: [r], title: `${hubOf(category)!.label} access granted`,
                    message: `${actor.name} gave you ${hubOf(category)!.label} access. It appears in your sidebar.`,
                    type: 'ACCESS_GRANTED', link: '/', entityType: 'AccessGrant', entityId: category, actor, email: false,
                });
            }
            return NextResponse.json({ success: true, message: `Access saved for ${results.filter(r => !r.skipped).length} employee(s).`, results });
        }

        if (action === 'edit' || action === 'revoke') {
            const grant: any = await AccessGrant.findOne({ id: String(b.grantId || '') });
            if (!grant) return NextResponse.json({ error: 'Access grant not found.' }, { status: 404 });
            if (!perm.categories.includes(grant.category)) return NextResponse.json({ error: 'You are not allowed to change this access.' }, { status: 403 });
            if (grant.status !== 'ACTIVE') return NextResponse.json({ error: 'This access was already revoked.' }, { status: 409 });
            if (grant.recipientId === actor.id) return NextResponse.json({ error: 'You cannot change your own access.' }, { status: 403 });

            if (action === 'revoke') {
                Object.assign(grant, { status: 'REVOKED', revokedBy: actor.id, revokedByName: actor.name, revokedAt: now, updatedAt: now });
                grant.history.push(hist(actor, 'Access revoked'));
                await grant.save();
                return NextResponse.json({ success: true, message: 'Access revoked.', grant });
            }
            const scopeType = ['SELECTED', 'ALL', 'ALL_DYNAMIC'].includes(b.scopeType) ? b.scopeType : 'SELECTED';
            if (scopeType === 'ALL_DYNAMIC' && !perm.canDynamic) return NextResponse.json({ error: 'Only the Founder can include future employees automatically.' }, { status: 403 });
            const src = await validSources(grant.category, scopeType, b.sourceIds);
            if ('error' in src) return NextResponse.json({ error: src.error }, { status: 400 });
            const ids = src.ids.filter(id => id !== grant.recipientId);
            if (scopeType !== 'ALL_DYNAMIC' && !ids.length) return NextResponse.json({ error: 'Select at least one source employee.' }, { status: 400 });
            Object.assign(grant, { scopeType, sourceEmployeeIds: ids, updatedBy: actor.id, updatedByName: actor.name, updatedAt: now });
            grant.history.push(hist(actor, 'Access edited', scopeType, ids));
            await grant.save();
            return NextResponse.json({ success: true, message: 'Access updated.', grant });
        }
        return NextResponse.json({ error: 'Invalid action.' }, { status: 400 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}