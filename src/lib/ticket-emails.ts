/**
 * SERVER-ONLY: ticket e-mails sent by the server through the existing SMTP sender (src/lib/mail-server.ts).
 *  - Resolution e-mail → only the employee who raised the ticket, once, when the ticket becomes Resolved.
 *  - 48-hour reminder → the responsible HR (the HR handling the ticket), once per ticket, never to all HR.
 * Status / time / recipient are stored on the ticket; failed sends are retried (max 3) without duplicates.
 */
import { Ticket, Employee, ReminderLog } from '@/models/Schemas';
import { sendMailInternal } from '@/lib/mail-server';
import { getTicketResolvedEmployeeTemplate, getTicketEscalationTemplate } from '@/lib/mail-templates';

const DONE = ['Resolved', 'Closed'];
const HR_ROLES = ['HR', 'HR_EXECUTIVE'];
const MAX_ATTEMPTS = 3;
const H48 = 48 * 3600 * 1000;

/** Resolution e-mail to the raiser. Safe to call more than once: the ticket is claimed atomically. */
export async function sendTicketResolvedEmail(ticketId: string) {
    const t: any = await Ticket.findOneAndUpdate(
        { id: ticketId, status: 'Resolved', resolutionEmailStatus: { $nin: ['SENDING', 'SENT', 'NO_EMAIL'] } },
        { $set: { resolutionEmailStatus: 'SENDING' } }, { new: true }).lean();
    if (!t) return { sent: false, reason: 'already sent or not resolved' };
    const raiser: any = await Employee.findOne({ id: t.raisedBy }).select('id name email').lean();
    if (!raiser?.email) {
        await Ticket.updateOne({ id: ticketId }, { $set: { resolutionEmailStatus: 'NO_EMAIL' } });
        return { sent: false, reason: 'raiser has no e-mail' };
    }
    const { subject, html } = getTicketResolvedEmployeeTemplate(t, raiser.name);
    const res: any = await sendMailInternal({ to: raiser.email, subject, html, ...(t.originalMessageId ? { inReplyTo: t.originalMessageId, references: t.originalMessageId } : {}) });
    await Ticket.updateOne({ id: ticketId }, { $set: { resolutionEmailStatus: res?.success ? 'SENT' : 'FAILED', resolutionEmailAt: new Date().toISOString() } });
    console.log(`[ticket-mail] resolution ${ticketId} → raiser: ${res?.success ? 'accepted by SMTP' : 'failed'}`);
    return { sent: !!res?.success };
}

const pending = (ms: number) => { const h = Math.floor(ms / 3600000), d = Math.floor(h / 24); return d ? `${d} day(s) ${h % 24} hour(s)` : `${h} hour(s)`; };

/** Responsible HR of a ticket: the HR / HR Executive currently handling it (forwarded → assigned → routed). */
async function responsibleHr(t: any) {
    for (const id of [t.forwardedTo, t.assignedTo, t.routeTo].filter(Boolean)) {
        const e: any = await Employee.findOne({ id, isRemoved: { $ne: true } }).select('id name email role status').lean();
        if (e && HR_ROLES.includes(e.role) && e.email && e.status !== 'Inactive') return e;
    }
    return null;
}

/** 48-hour reminders for unresolved tickets (+ retries of failed reminders). Runs from the scheduler / cron / page ping. */
export async function runTicketEscalations(at: Date = new Date()) {
    const cutoff = new Date(at.getTime() - H48).toISOString();
    const due: any[] = await Ticket.find({
        status: { $nin: DONE }, createdAt: { $lte: cutoff },
        $or: [{ escalationStatus: { $exists: false } }, { escalationStatus: null }, { escalationStatus: 'FAILED', escalationAttempts: { $lt: MAX_ATTEMPTS } }],
    }).select('id').limit(100).lean();
    let sent = 0, flagged = 0;
    for (const { id } of due) {
        // claim (no duplicate even with several servers)
        const t: any = await Ticket.findOneAndUpdate(
            { id, status: { $nin: DONE }, $or: [{ escalationStatus: { $exists: false } }, { escalationStatus: null }, { escalationStatus: 'FAILED', escalationAttempts: { $lt: MAX_ATTEMPTS } }] },
            { $set: { escalationStatus: 'SENDING' }, $inc: { escalationAttempts: 1 } }, { new: true }).lean();
        if (!t) continue;
        const hr = await responsibleHr(t);
        if (!hr) {
            await Ticket.updateOne({ id }, { $set: { escalationStatus: 'ROUTING_ISSUE', escalationError: 'No responsible HR found for this ticket' } });
            await ReminderLog.updateOne({ key: `EMAIL_ROUTING:TICKET:${id}` }, { $setOnInsert: { key: `EMAIL_ROUTING:TICKET:${id}`, type: 'EMAIL_ROUTING_ISSUE', recipientId: t.raisedBy, details: { issue: `Ticket ${id} pending 48 h: no responsible HR (handler is not HR)`, ticketId: id }, status: 'OPEN', createdAt: at.toISOString() } }, { upsert: true });
            flagged++; continue;
        }
        const { subject, html } = getTicketEscalationTemplate(t, hr.name, pending(at.getTime() - new Date(t.createdAt).getTime()));
        const res: any = await sendMailInternal({ to: hr.email, subject, html });
        await Ticket.updateOne({ id }, { $set: res?.success
            ? { escalationStatus: 'SENT', escalationSentAt: at.toISOString(), escalationTo: hr.id, escalationError: '' }
            : { escalationStatus: 'FAILED', escalationError: String(res?.error || 'send failed').slice(0, 200) } });
        console.log(`[ticket-mail] 48h reminder ${id} → HR ${hr.id}: ${res?.success ? 'accepted by SMTP' : 'failed'}`);
        if (res?.success) sent++;
    }
    return { checked: due.length, sent, flagged };
}