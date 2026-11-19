/**
 * SERVER-ONLY: shared key between the proxy and /api/admin/roles/rules (the proxy reads the Role Management rules
 * from that route; nobody else may). Derived from the same secret as the session tokens — no new setting.
 */
import crypto from 'crypto';

const SECRET = process.env.JWT_SECRET || process.env.MONGODB_URI || 'gog-oms-fallback-secret-change-in-production';
export const RULES_HEADER = 'x-gog-role-rules';
export const rulesKey = () => crypto.createHmac('sha256', SECRET).update('gog-role-rules-v1').digest('base64url');
export function isRulesKey(v: string | null | undefined) {
    if (!v) return false;
    const a = Buffer.from(String(v)), b = Buffer.from(rulesKey());
    return a.length === b.length && crypto.timingSafeEqual(a, b);
}