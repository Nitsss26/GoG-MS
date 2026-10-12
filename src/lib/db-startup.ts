/**
 * SERVER-ONLY: runs once when the database connection opens.
 *  1. Loads removed accounts so their sessions are rejected (lib/session).
 *  2. Employee identity index — one person (email) may hold several designation records
 *     (HR onboards the same email as Professor, Tech Lead, HR …). Login picks the record by email + the
 *     designation chosen in the login dropdown, so the unique rule is (email, role) among active records,
 *     not email alone. The old unique "email_1" index is replaced; nothing else is changed.
 */
import { primeRevokedSessions } from '@/lib/session';

export async function onDbConnected(db: any) {
    await primeRevokedSessions(db);
    await ensureEmployeeIdentityIndex(db);
}

async function ensureEmployeeIdentityIndex(db: any) {
    try {
        const col = db.collection('employees');
        // records saved before the soft-delete field existed count as active
        await col.updateMany({ isRemoved: { $exists: false } }, { $set: { isRemoved: false } });
        const indexes: any[] = await col.indexes().catch(() => []);
        const emailOnly = indexes.find(i => i.unique && JSON.stringify(i.key) === JSON.stringify({ email: 1 }));
        if (emailOnly) await col.dropIndex(emailOnly.name);
        if (!indexes.some(i => i.name === 'email_role_active_unique')) {
            try {
                await col.createIndex({ email: 1, role: 1 }, { name: 'email_role_active_unique', unique: true, partialFilterExpression: { isRemoved: false } });
            } catch {
                // database without partial-index support: plain lookup index; uniqueness is checked by the API
                await col.createIndex({ email: 1, role: 1 }, { name: 'email_role_lookup' }).catch(() => { });
            }
        }
    } catch (err: any) {
        console.warn('[DB] Could not update the employee email index:', err?.message);
    }
}
