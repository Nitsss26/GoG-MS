/**
 * Server-side session token utilities.
 * Uses HMAC-SHA256 signed tokens stored in HTTP-only cookies.
 * NO sensitive data is ever stored client-side.
 */
import crypto from 'crypto';

const SECRET = process.env.JWT_SECRET || process.env.MONGODB_URI || 'gog-oms-fallback-secret-change-in-production';
const COOKIE_NAME = 'gog_session';
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export interface SessionPayload {
    userId: string;
    email: string;
    role: string;
    iat: number;
    exp: number;
}

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
