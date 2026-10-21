/**
 * READ-ONLY login / database diagnostic for GOG OMS.
 *
 *   node scripts/diagnose-login.js                     → which database MONGODB_URI selects + what it contains
 *   node scripts/diagnose-login.js someone@gog.com     → also looks that login up (email or Employee ID)
 *
 * It never writes, never prints the connection string, a password or a password hash.
 * It reads MONGODB_URI exactly like `next dev` does: a system environment variable wins over .env.local.
 */
const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');
// Same DNS servers as src/lib/mongodb.ts (some networks cannot resolve the Atlas SRV record otherwise)
try { require('dns').setServers(['1.1.1.1', '8.8.8.8']); } catch { /* keep the system DNS */ }

const fromSystem = !!process.env.MONGODB_URI;
require('dotenv').config({ path: path.join(process.cwd(), '.env.local'), quiet: true }); // does not override a system variable
const uri = process.env.MONGODB_URI;
const lookup = (process.argv[2] || '').trim();

const ENV_FILES = ['.env', '.env.local', '.env.development', '.env.development.local', '.env.production', '.env.production.local'];
const line = (s = '') => console.log(s);

function describeUri(u) {
    const m = u.match(/^(mongodb(?:\+srv)?):\/\/(?:[^@/]*@)?([^/?]+)(?:\/([^?]*))?/);
    if (!m) return { scheme: '?', host: '?', db: '' };
    return { scheme: m[1], host: m[2], db: decodeURIComponent(m[3] || '') };
}

function passwordFormat(p) {
    if (p === undefined || p === null || p === '') return 'MISSING (the app then accepts only the old default password)';
    const s = String(p);
    if (/^scrypt\$[0-9a-f]+\$[0-9a-f]+$/i.test(s)) return 'scrypt hash (supported by this app)';
    if (/^\$2[aby]\$\d{2}\$/.test(s)) return 'bcrypt hash (NOT supported by this app\'s login)';
    if (/^\$argon2/.test(s)) return 'argon2 hash (NOT supported by this app\'s login)';
    return 'plain text (supported; turned into a hash on the next successful login)';
}

(async () => {
    line('GOG OMS — read-only login diagnostic');
    line('────────────────────────────────────');
    line('Env files present: ' + (ENV_FILES.filter(f => fs.existsSync(path.join(process.cwd(), f))).join(', ') || 'none'));
    if (!uri) { line('✗ MONGODB_URI is not set (neither in the system environment nor in .env.local).'); process.exit(1); }
    line('MONGODB_URI comes from: ' + (fromSystem ? 'SYSTEM ENVIRONMENT VARIABLE (this overrides .env.local!)' : '.env.local'));
    const u = describeUri(uri);
    line(`Cluster host: ${u.host}`);
    line(`Database in the URI: ${u.db ? `"${u.db}"` : '(none) → MongoDB uses the default database "test"'}`);

    const client = new MongoClient(uri, { serverSelectionTimeoutMS: 10000 });
    try {
        await client.connect();
    } catch (e) {
        line('✗ Could not connect: ' + String(e.message || e).replace(/\/\/[^@]*@/g, '//***@'));
        line('  Check the password in the URI, and Atlas → Network Access (your IP must be allowed).');
        process.exit(1);
    }
    try {
        const active = client.db(); // the database the app will use
        line(`✓ Connected. The app will use database: "${active.databaseName}"`);
        line('');

        // All databases the user can see (needs listDatabases permission; skipped if not allowed)
        let names = [active.databaseName];
        try {
            const dbs = await client.db('admin').admin().listDatabases({ nameOnly: true });
            names = [...new Set([active.databaseName, ...dbs.databases.map(d => d.name).filter(n => !['admin', 'local', 'config'].includes(n))])];
        } catch { line('(This database user cannot list other databases — only the active one is checked.)'); }

        line('Databases → login collections:');
        for (const name of names) {
            const db = client.db(name);
            const cols = (await db.listCollections({}, { nameOnly: true }).toArray()).map(c => c.name);
            const emp = cols.includes('employees') ? await db.collection('employees').countDocuments() : null;
            const usr = cols.includes('users') ? await db.collection('users').countDocuments() : null;
            // Today's attendance (IST date, the format the app saves: YYYY-MM-DD) — shows where today's clock-ins are
            const today = new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
            const att = cols.includes('attendances') ? await db.collection('attendances').countDocuments({ date: today, clockIn: { $exists: true, $nin: [null, ''] } }) : null;
            line(`  ${name === active.databaseName ? '→' : ' '} ${name}: employees=${emp ?? '—'}  users=${usr ?? '—'}  clock-ins today (${today})=${att ?? '—'}  (${cols.length} collections)`);
        }
        line('  (→ = the database the app uses. The app logs in from the "employees" collection only.)');

        // Any collection of the active database holding records dated today (finds attendance saved somewhere else)
        const todayIst = new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
        const [y, m, d] = todayIst.split('-');
        const dayStart = new Date(`${todayIst}T00:00:00+05:30`), dayEnd = new Date(dayStart.getTime() + 86400000);
        const dateForms = [todayIst, `${d}-${m}-${y}`, `${d}/${m}/${y}`, `${m}/${d}/${y}`];
        line('');
        line(`Records dated today in "${active.databaseName}" (any collection, date as text ${dateForms.join(' | ')} or a real date):`);
        let anyToday = false;
        for (const c of (await active.listCollections({}, { nameOnly: true }).toArray()).map(x => x.name).sort()) {
            const col = active.collection(c);
            const n = await col.countDocuments({ $or: [{ date: { $in: dateForms } }, { date: { $gte: dayStart, $lt: dayEnd } }, { createdAt: { $gte: dayStart, $lt: dayEnd } }] }).catch(() => 0);
            if (n) { anyToday = true; line(`    ${c}: ${n}`); }
        }
        if (!anyToday) line('    (none)');

        if (lookup) {
            line('');
            line(`Looking up "${lookup}" in every database (email, or Employee ID in id / employeeId):`);
            const esc = lookup.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const q = lookup.includes('@') ? { email: { $regex: `^${esc}$`, $options: 'i' } } : { $or: [{ id: lookup }, { employeeId: lookup }] };
            let found = 0;
            for (const name of names) {
                for (const col of ['employees', 'users']) {
                    const docs = await client.db(name).collection(col)
                        .find(q, { projection: { id: 1, employeeId: 1, name: 1, email: 1, role: 1, status: 1, isRemoved: 1, password: 1 } }).limit(10).toArray();
                    for (const d of docs) {
                        found++;
                        line(`  • ${name}.${col}: id=${d.id ?? '—'} employeeId=${d.employeeId ?? '—'} email=${d.email ?? '—'} role=${d.role ?? '—'} status=${d.status ?? '—'} removed=${d.isRemoved === true}`);
                        line(`      password: ${passwordFormat(d.password)}`);
                    }
                }
            }
            if (!found) line('  ✗ Not found in any database/collection this user can read.');
        }
        line('');
        line('Nothing was changed in the database.');
    } finally {
        await client.close();
    }
})().catch(e => { console.error('Diagnostic failed:', String(e.message || e).replace(/\/\/[^@]*@/g, '//***@')); process.exit(1); });