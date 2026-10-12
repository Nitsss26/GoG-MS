import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { Ticket, Employee } from '@/models/Schemas';
import { getSessionUser } from '@/lib/session-user';
import { notifySafe } from '@/lib/academic';
import { ATTENDANCE_ISSUES, ATTENDANCE_TICKET_CATEGORY, ATTENDANCE_OVERRIDE_CATEGORY, ticketTypeOf } from '@/lib/ticket-types';

export const dynamic = 'force-dynamic';

/** Roles that see and manage every ticket (unchanged: HR, Founder, AD — HR Executive works as HR) */
const TICKET_ADMIN_ROLES = ['HR', 'FOUNDER', 'AD'];
const YMD = /^\d{4}-\d{2}-\d{2}$/;
const HM = /^([01]?\d|2[0-3]):[0-5]\d$/;

const historyItem = (actor: any, action: string, status: string, remarks = '') =>
    ({ action, status, by: actor.id, byName: actor.name, role: actor.session?.actualRole || actor.role, at: new Date().toISOString(), remarks });

/** In-app notification to the employee who raised the ticket (the existing e-mails are sent by the client as before) */
async function notifyRaiser(ticket: any, title: string, message: string, actor: any) {
    const raiser: any = await Employee.findOne({ id: ticket.raisedBy }).select('id name email role').lean();
    if (!raiser || raiser.id === actor.id) return;
    await notifySafe({ recipients: [raiser], title, message, type: 'TICKET_UPDATE', link: '/tickets', entityType: 'Ticket', entityId: ticket.id, actor, email: false });
}

/** Tickets: HR / Founder / AD see all; everyone else the tickets they raised, handle or are copied on (from the session) */
export async function GET() {
    try {
        await dbConnect();
        const actor = await getSessionUser();
        if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const query = TICKET_ADMIN_ROLES.includes(actor.role) ? {} : { $or: [{ raisedBy: actor.id }, { routeTo: actor.id }, { cc: actor.id }] };
        const tickets = await Ticket.find(query).sort({ createdAt: -1 });
        return NextResponse.json(tickets);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        await dbConnect();
        const actor = await getSessionUser();
        if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const body = await req.json();

        // Ticket type: Normal or Attendance (older clients send none → classified from the category)
        const ticketType = ticketTypeOf(body);
        if (ticketType === 'ATTENDANCE' && body.targetCategory !== ATTENDANCE_OVERRIDE_CATEGORY) {
            if (!ATTENDANCE_ISSUES.includes(String(body.issueCategory || ''))) return NextResponse.json({ error: 'Select the attendance issue.' }, { status: 400 });
            if (!YMD.test(String(body.attendanceDate || ''))) return NextResponse.json({ error: 'Select the attendance date.' }, { status: 400 });
            if (body.issueTime && !HM.test(String(body.issueTime))) return NextResponse.json({ error: 'Issue time must be HH:MM.' }, { status: 400 });
        }

        // Ticket ID Generation Logic (unchanged; attendance tickets get their own code)
        const getCategoryCode = (cat: string) => {
            if (cat === ATTENDANCE_TICKET_CATEGORY) return "AT";
            if (cat.includes("Attendance Override")) return "AO";
            if (cat.includes("Against HR")) return "GR";
            if (cat.includes("HR Desk")) return "HR";
            if (cat.includes("Misconduct")) return "MI";
            if (cat.includes("Academic")) return "AC";
            if (cat.includes("Technical")) return "TE";
            return "OT";
        };

        const code = getCategoryCode(String(body.targetCategory || ''));
        const lastTicket = await Ticket.findOne({ id: { $regex: `^TK-GOG-${code}-` } }).sort({ id: -1 });
        let nextNumber = 1;
        if (lastTicket && lastTicket.id) {
            const parts = lastTicket.id.split('-');
            const lastNum = parseInt(parts[parts.length - 1], 10);
            if (!isNaN(lastNum)) {
                nextNumber = lastNum + 1;
            }
        }
        const ticketId = `TK-GOG-${code}-${String(nextNumber).padStart(3, '0')}`;

        const now = new Date().toISOString();
        const { statusHistory, resolvedBy, resolvedByName, resolvedAt, ...rest } = body;
        const ticketData = {
            ...rest,
            id: ticketId,
            // captured by the server, never trusted from the browser
            raisedBy: actor.id,
            employeeName: actor.employee?.name || actor.name,
            employeeRole: actor.session?.actualRole || actor.role,
            status: 'Open',
            createdAt: now,
            updatedAt: now,
            ticketType,
            issueCategory: body.issueCategory || body.targetCategory,
            ...(body.routeTo ? { assignedAt: now } : {}),
            statusHistory: [historyItem(actor, 'Submitted', 'Open')],
        };

        const ticket = await Ticket.create(ticketData);
        await notifyRaiser(ticket, `Ticket submitted — ${ticket.id}`, `Your ${ticketType === 'ATTENDANCE' ? 'attendance' : 'support'} ticket "${ticket.subject}" was submitted.`, { id: '', name: 'GoG OMS' });
        // the assigned handler gets an in-app notification too (the e-mail is sent by the existing flow)
        if (ticket.routeTo && ticket.routeTo !== actor.id) {
            const handler: any = await Employee.findOne({ id: ticket.routeTo }).select('id name email role').lean();
            if (handler) await notifySafe({ recipients: [handler], title: `New ticket assigned — ${ticket.id}`, message: `${ticket.employeeName}: ${ticket.subject}`, type: 'TICKET_ASSIGNED', link: '/tickets', entityType: 'Ticket', entityId: ticket.id, actor, email: false });
        }
        return NextResponse.json(ticket);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

/**
 * Update a ticket. HR / Founder / AD or the assigned handler may change it; the employee who raised it may only
 * store the e-mail thread reference. Status, assignment and remarks changes are recorded in statusHistory.
 */
export async function PUT(req: Request) {
    try {
        await dbConnect();
        const actor = await getSessionUser();
        if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const body = await req.json();
        const { id, $push, ...updates } = body;
        const ticket: any = await Ticket.findOne({ id }).lean();
        if (!ticket) return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });

        const isAdmin = TICKET_ADMIN_ROLES.includes(actor.role);
        const isHandler = [ticket.routeTo, ticket.assignedTo, ticket.forwardedTo].includes(actor.id);
        const onlyThreadRef = Object.keys(updates).every(k => k === 'originalMessageId') && !$push;
        if (!isAdmin && !isHandler && !(ticket.raisedBy === actor.id && onlyThreadRef)) {
            return NextResponse.json({ error: 'You are not allowed to update this ticket.' }, { status: 403 });
        }
        // fields written by the server only
        ['raisedBy', 'employeeName', 'employeeRole', 'createdAt', 'statusHistory', 'ticketType', 'resolvedBy', 'resolvedByName', '_id'].forEach(k => delete updates[k]);

        const now = new Date().toISOString();
        const history: any[] = [];
        const set: any = { ...updates, updatedAt: now };
        if (updates.status && updates.status !== ticket.status) {
            if (updates.status === 'Resolved') {
                set.resolvedAt = updates.resolvedAt || now; set.resolvedBy = actor.id; set.resolvedByName = actor.name;
                history.push(historyItem(actor, 'Resolved', 'Resolved', String(updates.resolutionNotes || '')));
            } else {
                history.push(historyItem(actor, `Status changed to ${updates.status}`, updates.status, String(updates.remarks || '')));
            }
        }
        const push: any = { ...($push || {}) };
        if (push.forwardHistory) {
            // the existing forward entry is completed with who forwarded it
            push.forwardHistory = { ...push.forwardHistory, forwardedBy: push.forwardHistory.forwardedBy || actor.id };
        }
        if (updates.routeTo && updates.routeTo !== ticket.routeTo) {
            set.assignedAt = now;
            history.push(historyItem(actor, 'Assigned', updates.status || ticket.status, String(push.forwardHistory?.remarks || '')));
        }
        if (typeof updates.adRemarks === 'string' && updates.adRemarks !== ticket.adRemarks) history.push(historyItem(actor, 'Remarks added', ticket.status, updates.adRemarks));
        if (history.length) push.statusHistory = { $each: history };

        const op: any = { $set: set };
        if (Object.keys(push).length) op.$push = push;
        const updated: any = await Ticket.findOneAndUpdate({ id }, op, { new: true });

        // In-app notifications to the employee (e-mails are sent by the existing client flow)
        if (updated && history.length) {
            const last = history[history.length - 1];
            const title = last.action === 'Resolved' ? `Ticket resolved — ${updated.id}`
                : last.action === 'Assigned' ? `Ticket assigned — ${updated.id}` : `Ticket updated — ${updated.id}`;
            await notifyRaiser(updated, title, `${updated.subject}: ${last.action}${last.remarks ? ` — ${last.remarks}` : ''}`, actor);
            if (last.action === 'Assigned' && updated.routeTo && updated.routeTo !== actor.id) {
                const handler: any = await Employee.findOne({ id: updated.routeTo }).select('id name email role').lean();
                if (handler) await notifySafe({ recipients: [handler], title: `Ticket assigned to you — ${updated.id}`, message: `${updated.employeeName}: ${updated.subject}`, type: 'TICKET_ASSIGNED', link: '/tickets', entityType: 'Ticket', entityId: updated.id, actor, email: false });
            }
        }
        return NextResponse.json(updated);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}