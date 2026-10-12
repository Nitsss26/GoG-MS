/**
 * Server-side session token utilities.
 * Uses HMAC-SHA256 signed tokens stored in HTTP-only cookies.
 * NO sensitive data is ever stored client-side.
 */
import crypto from 'crypto';

const SECRET = process.env.JWT_SECRET || process.env.MONGODB_URI || 'gog-oms-fallback-secret-change-in-production';
const COOKIE_NAME = 'gog_session';
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// Sessions of employees removed from the portal. A signed token cannot be recalled, so the server
// keeps the removed accounts here and rejects their tokens on every request.
// One email can hold several designation records (HR onboards the same person as Professor, TL, …), so a
// removal is keyed by email + designation, and only tokens issued before the removal are rejected.
// Filled when the database connects (primeRevokedSessions) and when HR removes someone (revokeSessionsFor).
const revokedSessions: Map<string, number> = ((globalThis as any).__gogRevokedSessions ||= new Map<string, number>());
const revokeKey = (email: string, role: string) => `${String(email).trim().toLowerCase()}|${String(role || '').toUpperCase()}`;

export function revokeSessionsFor(email?: string | null, role?: string | null, at: number = Date.now()) {
    if (!email || !role) return;
    const k = revokeKey(email, role);
    revokedSessions.set(k, Math.max(revokedSessions.get(k) || 0, at));
}

export async function primeRevokedSessions(db: any) {
    try {
        const removed = await db.collection('employees').find({ isRemoved: true }, { projection: { email: 1, role: 1, removedAt: 1 } }).toArray();
        removed.forEach((e: any) => revokeSessionsFor(e.email, e.role, e.removedAt ? new Date(e.removedAt).getTime() : Date.now()));
    } catch (err) {
        console.warn("[SESSION] Could not load removed accounts:", err);
    }
}

export interface SessionPayload {
    userId: string;
    email: string;
    role: string;
    iat: number;
    exp: number;
    /** HR Executive: stored role HR_EXECUTIVE; works with the HR permissions except Reimbursements */
    hrExecutive?: boolean;
    /** The role stored on the employee record (differs from `role` only for HR Executive) */
    actualRole?: string;
}

/** HR Executive designation: an HR-like role without Reimbursements access */
export const HR_EXECUTIVE_ROLE = 'HR_EXECUTIVE';

/**
 * Create a signed session token from user data.
 */
export function createSessionToken(userId: string, email: string, role: string): string {
    const payload: SessionPayload = {
        userId,
        email,
        role,
        iat: Date.now(),
        exp: Date.now() + SESSION_DURATION_MS,
    };
    const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signature = crypto.createHmac('sha256', SECRET).update(encoded).digest('base64url');
    return `${encoded}.${signature}`;
}

/**
 * Verify and decode a session token. Returns null if invalid or expired.
 */
export function verifySessionToken(token: string): SessionPayload | null {
    try {
        const parts = token.split('.');
        if (parts.length !== 2) return null;

        const [encoded, signature] = parts;
        const expectedSig = crypto.createHmac('sha256', SECRET).update(encoded).digest('base64url');

        // Timing-safe comparison to prevent timing attacks
        if (signature.length !== expectedSig.length) return null;
        const sigBuffer = Buffer.from(signature);
        const expectedBuffer = Buffer.from(expectedSig);
        if (!crypto.timingSafeEqual(sigBuffer, expectedBuffer)) return null;

        const payload: SessionPayload = JSON.parse(Buffer.from(encoded, 'base64url').toString());

        // Check expiration
        if (payload.exp < Date.now()) return null;

        // Account (this designation) removed from the portal after the token was issued: no longer valid
        if (payload.email) {
            const removedAt = revokedSessions.get(revokeKey(payload.email, payload.role));
            if (removedAt && (payload.iat || 0) <= removedAt) return null;
        }

        // HR Executive: every existing HR permission check keeps working (role "HR"); the flag lets the
        // Reimbursement endpoints (and HR-account protections) refuse this designation.
        if (payload.role === HR_EXECUTIVE_ROLE) {
            return { ...payload, role: 'HR', hrExecutive: true, actualRole: HR_EXECUTIVE_ROLE };
        }
        return payload;
    } catch {
        return null;
    }
}

/**
 * Get the cookie configuration for the session token.
 */
export function getSessionCookieOptions(maxAge?: number) {
    return {
        name: COOKIE_NAME,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax' as const,
        path: '/',
        maxAge: maxAge ?? Math.floor(SESSION_DURATION_MS / 1000), // in seconds
    };
}

export { COOKIE_NAME };