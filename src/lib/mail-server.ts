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
const MAIN_ADMIN_EMAIL = 'tech@geeksofgurukul.com';
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
        const { to, cc } = await withAutoCc(options);
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