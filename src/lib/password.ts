import { randomBytes, scrypt as scryptCb, timingSafeEqual, randomInt } from 'crypto';
import { promisify } from 'util';

/**
 * SERVER-ONLY password helpers.
 *
 * Passwords are stored as   scrypt$<salt hex>$<hash hex>   (Node's built-in scrypt, no extra package).
 * Older accounts may still hold a plain-text password: verifyPassword() accepts it once and tells the
 * caller to replace it with a hash (needsRehash), so every account moves to hashed storage on its next login.
 *
 * Never log a plain password or a hash.
 */
const scrypt = promisify(scryptCb) as (password: string, salt: Buffer, keylen: number) => Promise<Buffer>;
const PREFIX = 'scrypt';
const KEY_LENGTH = 64;

export function isHashedPassword(stored?: string | null): boolean {
    return typeof stored === 'string' && stored.startsWith(PREFIX + '$') && stored.split('$').length === 3;
}

export async function hashPassword(plain: string): Promise<string> {
    const salt = randomBytes(16);
    const hash = await scrypt(plain, salt, KEY_LENGTH);
    return `${PREFIX}$${salt.toString('hex')}$${hash.toString('hex')}`;
}

/**
 * Compare a typed password with what is stored.
 * ok: the password is correct. needsRehash: the stored value was plain text and should be replaced by a hash.
 */
export async function verifyPassword(plain: string, stored?: string | null): Promise<{ ok: boolean; needsRehash: boolean }> {
    if (typeof plain !== 'string' || !stored) return { ok: false, needsRehash: false };

    if (isHashedPassword(stored)) {
        const [, saltHex, hashHex] = stored.split('$');
        const expected = Buffer.from(hashHex, 'hex');
        const actual = await scrypt(plain, Buffer.from(saltHex, 'hex'), expected.length);
        const ok = actual.length === expected.length && timingSafeEqual(actual, expected);
        return { ok, needsRehash: false };
    }

    // Legacy plain-text value (constant-time compare)
    const a = Buffer.from(plain);
    const b = Buffer.from(String(stored));
    const ok = a.length === b.length && timingSafeEqual(a, b);
    return { ok, needsRehash: ok };
}

/** Rules for a password that HR sets by hand. Returns an error message, or null when it is fine. */
export function validateNewPassword(pw: string): string | null {
    if (typeof pw !== 'string' || pw.length < 8) return 'Password must be at least 8 characters.';
    if (pw.length > 128) return 'Password is too long (max 128 characters).';
    if (/\s/.test(pw)) return 'Password must not contain spaces.';
    if (!/[A-Za-z]/.test(pw) || !/[0-9]/.test(pw)) return 'Password must contain at least one letter and one number.';
    return null;
}

/** Strong temporary password: 12 characters with upper, lower, digit and symbol, no look-alike characters. */
export function generateTemporaryPassword(length = 12): string {
    const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const lower = 'abcdefghijkmnpqrstuvwxyz';
    const digits = '23456789';
    const symbols = '@#$%&*!?';
    const all = upper + lower + digits + symbols;
    const pick = (set: string) => set[randomInt(set.length)];
    const chars = [pick(upper), pick(lower), pick(digits), pick(symbols)];
    while (chars.length < length) chars.push(pick(all));
    // Fisher–Yates shuffle with a crypto RNG
    for (let i = chars.length - 1; i > 0; i--) {
        const j = randomInt(i + 1);
        [chars[i], chars[j]] = [chars[j], chars[i]];
    }
    return chars.join('');
}
