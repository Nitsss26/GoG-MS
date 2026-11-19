/**
 * Admin → Role Management: refuses pages / APIs that HR blocked for the logged-in designation's role.
 *
 * Runs before every page and API request. It only ever REFUSES a request when a saved rule says so; with no rule
 * (the default for every role), or when anything goes wrong reading the rules, the request continues exactly as before.
 * Founder and HR are never restricted. All other permission checks stay where they are (in the pages and APIs).
 */
import { NextResponse, type NextRequest } from 'next/server';
import { verifySessionToken, COOKIE_NAME } from '@/lib/session';
import { LOCKED_ROLES, pageBlocked, apiBlocked, type RoleRestriction } from '@/lib/role-modules';
import { rulesKey, RULES_HEADER } from '@/lib/role-rules-key';

const TTL_MS = 30_000;
type Cache = { at: number; roles: Record<string, RoleRestriction> } | null;

async function rules(req: NextRequest): Promise<Record<string, RoleRestriction>> {
    const g = globalThis as any;
    const c: Cache = g.__gogRoleRules;
    if (c && Date.now() - c.at < TTL_MS) return c.roles;
    if (!g.__gogRoleRulesLoading) {
        g.__gogRoleRulesLoading = (async () => {
            try {
                const res = await fetch(new URL('/api/admin/roles/rules', req.nextUrl.origin), { headers: { [RULES_HEADER]: rulesKey() }, cache: 'no-store' });
                if (!res.ok) throw new Error(String(res.status));
                const d = await res.json();
                g.__gogRoleRules = { at: Date.now(), roles: d?.roles && typeof d.roles === 'object' ? d.roles : {} };
            } catch {
                // keep the last known rules for a while; none known → nothing is refused
                g.__gogRoleRules = { at: Date.now() - TTL_MS + 5_000, roles: c?.roles || {} };
            } finally {
                g.__gogRoleRulesLoading = null;
            }
        })();
    }
    await g.__gogRoleRulesLoading;
    return (g.__gogRoleRules as Cache)?.roles || {};
}

/** Paths never checked (login, session, the Admin APIs themselves, the "no access" page) */
const SKIP = ['/api/auth/', '/api/admin/', '/no-access', '/login'];

export async function proxy(req: NextRequest) {
    try {
        const path = req.nextUrl.pathname;
        if (SKIP.some(s => path === s || path.startsWith(s))) return NextResponse.next();
        const token = req.cookies.get(COOKIE_NAME)?.value;
        if (!token) return NextResponse.next();
        const s = verifySessionToken(token);
        if (!s) return NextResponse.next();
        const stored = s.actualRole || s.role;
        if (!stored || LOCKED_ROLES.includes(stored)) return NextResponse.next();
        // an employee with an HR-created role follows that role's rules
        const role = s.customRole || stored;
        const r = (await rules(req))[role];
        if (!r || !r.blocked?.length) return NextResponse.next();
        if (path.startsWith('/api/')) {
            if (!apiBlocked(r.blocked, path)) return NextResponse.next();
            return NextResponse.json({ error: 'Your role does not have access to this module. Contact HR if you need it.', blockedByRole: true }, { status: 403 });
        }
        const hit = pageBlocked(r.blocked, path);
        if (!hit) return NextResponse.next();
        const url = req.nextUrl.clone();
        url.pathname = '/no-access';
        url.search = `?from=${encodeURIComponent(path)}`;
        return NextResponse.rewrite(url);
    } catch {
        return NextResponse.next();
    }
}

export const config = {
    // pages and APIs; not Next.js files or static assets. /api/directreports is left out: it receives file uploads,
    // and Next.js buffers request bodies (max 10 MB) of every request a proxy runs on.
    matcher: ['/((?!_next/|api/directreports|favicon\\.ico|.*\\.(?:png|jpe?g|gif|svg|webp|ico|css|js|map|txt|xml|woff2?|ttf|mp3|mp4|webm|pdf)$).*)'],
};