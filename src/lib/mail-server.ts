import nodemailer from 'nodemailer';
import crypto from 'crypto';
import dbConnect from '@/lib/mongodb';
import { Employee } from '@/models/Schemas';

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '465'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
});

interface MailOptions {
    to: string | string[];
    cc?: string | string[];
    subject: string;
    text?: string;
    html: string;
    attachments?: any[];
    inReplyTo?: string;
    references?: string | string[];
    /** true for mails that must reach only their addressee (e.g. a personal one-click leave Accept / Reject link) */
    noAutoCc?: boolean;
    /** addresses that already got their own copy (left out of the standard CC) */
    ccExclude?: string[];
}

/**
 * Every GOG OMS e-mail is copied (CC) to the main admin, all HR, all HR Executives and all ADs.
 * The list is read from the employee records (cached for 5 minutes). Addresses already on the mail are not
 * repeated, and the same mail sent to many people one by one (e.g. an announcement) is copied only once.
 */
export const MAIN_ADMIN_EMAIL = 'tech@geeksofgurukul.com';
const AUTO_CC_ROLES = ['HR', 'HR_EXECUTIVE', 'AD'];
const EMAIL_RE = /^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+$/;
const ccCache: { at: number; list: string[] } = ((globalThis as any).__gogAutoCc ||= { at: 0, list: [] });
const copiedRecently: Map<string, number> = ((globalThis as any).__gogAutoCcSent ||= new Map<string, number>());

async function autoCcList(): Promise<string[]> {
    if (Date.now() - ccCache.at < 5 * 60000 && ccCache.list.length) return ccCache.list;
    let list = [MAIN_ADMIN_EMAIL];
    try {
        await dbConnect();
        const rows: any[] = await Employee.find({ role: { $in: AUTO_CC_ROLES }, isRemoved: { $ne: true } }).select('email').lean();
        list = [MAIN_ADMIN_EMAIL, ...rows.map(r => String(r.email || '').trim().toLowerCase())];
    } catch (e: any) {
        console.error('[mail] could not load the CC list:', e?.message);
    }
    ccCache.list = Array.from(new Set(list.filter(e => EMAIL_RE.test(e) && !e.endsWith('@gog.com'))));
    ccCache.at = Date.now();
    return ccCache.list;
}

/**
 * Employees HR stopped mails for (Delete Employee → "Stop sending any mails to employee") and employees removed
 * from the portal get no OMS e-mail at all — neither To nor CC. An address that still belongs to another active
 * designation record of the same person keeps getting mail. Cached for 5 minutes; cleared on every change.
 */
const blockCache: { at: number; set: Set<string> } = ((globalThis as any).__gogMailBlock ||= { at: 0, set: new Set<string>() });
export function refreshMailBlocklist() { blockCache.at = 0; }
async function blockedEmails(): Promise<Set<string>> {
    if (Date.now() - blockCache.at < 5 * 60000) return blockCache.set;
    const set = new Set<string>();
    try {
        await dbConnect();
        const rows: any[] = await Employee.find({ isRemoved: { $in: [true, false, null] }, $or: [{ isRemoved: true }, { mailsStopped: true }] } as any).select('email').lean();
        const emails = Array.from(new Set(rows.map(r => String(r.email || '').trim().toLowerCase()).filter(Boolean)));
        if (emails.length) {
            const active: any[] = await Employee.find({ isRemoved: { $ne: true }, mailsStopped: { $ne: true }, email: { $in: rows.map(r => r.email).filter(Boolean) } } as any).select('email').lean();
            const stillActive = new Set(active.map(a => String(a.email || '').trim().toLowerCase()));
            emails.forEach(e => { if (!stillActive.has(e)) set.add(e); });
        }
    } catch (e: any) {
        console.error('[mail] could not load the stopped-mail list:', e?.message);
        return blockCache.set; // keep the last known list
    }
    blockCache.set = set; blockCache.at = Date.now();
    return set;
}

const asList = (v?: string | string[]) => (Array.isArray(v) ? v : v ? String(v).split(',') : []).map(e => e.trim()).filter(Boolean);

/** to / cc with the standard copies added */
async function withAutoCc(o: MailOptions) {
    if (o.noAutoCc) return { to: o.to, cc: o.cc };
    // the same mail (same subject + body) sent to many people one by one → the copies go with the first one only
    const key = crypto.createHash('sha1').update(`${o.subject}\n${o.html}`).digest('hex');
    const now = Date.now();
    for (const [k, t] of copiedRecently) if (now - t > 15 * 60000) copiedRecently.delete(k);
    if (copiedRecently.has(key)) return { to: o.to, cc: o.cc };
    const present = new Set([...asList(o.to), ...asList(o.cc), ...(o.ccExclude || [])].map(e => e.toLowerCase()));
    const extra = (await autoCcList()).filter(e => !present.has(e));
    if (!extra.length) return { to: o.to, cc: o.cc };
    copiedRecently.set(key, now);
    return { to: o.to, cc: [...asList(o.cc), ...extra] };
}

/**
 * SERVER-ONLY: Sends an email using nodemailer.
 */
export const sendMailInternal = async (options: MailOptions) => {
    const { subject, text, html, attachments, inReplyTo, references } = options;
    try {
        const withCc = await withAutoCc(options);
        // never to employees whose mails are stopped / who were removed
        const blocked = await blockedEmails();
        const keep = (v?: string | string[]) => asList(v).filter(e => !blocked.has(e.toLowerCase()));
        let to: string[] = keep(withCc.to);
        let cc: string[] = keep(withCc.cc);
        if (!to.length && cc.length) { to = cc; cc = []; }       // the copies still reach HR / admin
        if (!to.length) return { success: true, messageId: 'skipped-mails-stopped' };
        const info = await transporter.sendMail({
            from: `"GoG OMS" <${process.env.SMTP_USER}>`,
            to,
            cc,
            subject,
            text,
            html,
            attachments,
            inReplyTo,
            references,
        });
        console.log("Message sent to %s: %s", to, info.messageId);
        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error("Error sending email:", error);
        return { success: false, error: String(error) };
    }
};