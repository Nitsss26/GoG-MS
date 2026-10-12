import { NextResponse, after } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { Holiday, Notice, Employee, Location, Notification } from '@/models/Schemas';
import { getSessionUser } from '@/lib/session-user';
import { getAcademicScope, notifySafe, collegeKeysFor, isValidYmd, zonedNow, addDays, appUrl } from '@/lib/academic';
import { sendMailInternal } from '@/lib/mail-server';
import { getAcademicNotificationTemplate } from '@/lib/mail-templates';

export const dynamic = 'force-dynamic';

/**
 * HOI direct holiday announcement (no HR approval).
 *   GET                — HOI: colleges it may announce for + its announcements with e-mail delivery status
 *                        (HR / Founder: every HOI announcement)
 *   POST { title, collegeId, date, holidayType, reason, description }   — HOI only, for a college it manages
 *   PUT  { holidayId, action: "retry_emails" }                          — resend failed e-mails (HOI owner / HR / Founder)
 * "Colleges an HOI manages" = its own campus + campuses it heads (Location.hoiId) — the same scope the academic
 * workflow uses. Authorised attendance locations do NOT grant this.
 */
const HOLIDAY_TYPES = ['Public Holiday', 'Institutional Holiday', 'Special Holiday', 'Emergency Closure', 'Other'];
const fmtLong = (ymd: string) => new Date(`${ymd}T00:00:00Z`).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'UTC' });

async function managedColleges(actor: any) {
    const scope = await getAcademicScope({ role: 'HOI', employee: actor.employee });
    return scope.colleges.map(c => ({ id: c.id, name: c.name }));
}

function emailParts(h: any, collegeName: string) {
    return {
        title: `Holiday Announcement – ${collegeName}`,
        message: `Dear Employee, this is to inform you that a holiday has been announced for ${collegeName}.`,
        rows: [
            { label: 'Holiday', value: h.name }, { label: 'Date', value: fmtLong(h.date) }, { label: 'Type', value: h.holidayType || '' },
            { label: 'Reason', value: h.reason || '' }, { label: 'Announced By', value: `Head of Institution (${h.proposedByName})` },
        ],
        note: 'Please refer to the GOG OMS Announcements section for further information.',
    };
}

/** Active employees assigned to the college (Original Location, or the college as an authorised attendance location) */
async function collegeEmployees(collegeId: string) {
    const keys = await collegeKeysFor(collegeId);
    return Employee.find({ status: { $ne: 'Inactive' }, $or: [{ location: { $in: keys } }, { attendanceLocations: collegeId }] }).select('id name email role location').lean();
}

async function deliveryOf(holidayIds: string[]) {
    if (!holidayIds.length) return {};
    const notes: any[] = await Notification.find({ entityType: 'Holiday', entityId: { $in: holidayIds } }).select('entityId emailStatus').lean();
    const out: Record<string, any> = {};
    notes.forEach(n => {
        const o = out[n.entityId] ||= { total: 0, SENT: 0, FAILED: 0, SKIPPED: 0, PENDING: 0 };
        o.total++; o[n.emailStatus || 'PENDING'] = (o[n.emailStatus || 'PENDING'] || 0) + 1;
    });
    return out;
}

export async function GET() {
    try {
        await dbConnect();
        const actor: any = await getSessionUser();
        if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const isAdmin = actor.role === 'HR' || actor.role === 'FOUNDER';
        if (actor.role !== 'HOI' && !isAdmin) return NextResponse.json({ error: 'Not allowed.' }, { status: 403 });
        const colleges = actor.role === 'HOI' ? await managedColleges(actor) : [];
        const holidays: any[] = await Holiday.find({ source: 'HOI_ANNOUNCEMENT', ...(isAdmin ? {} : { proposedBy: actor.id }) }).sort({ date: -1 }).lean();
        const delivery = await deliveryOf(holidays.map(h => h.id));
        return NextResponse.json({ colleges, types: HOLIDAY_TYPES, holidays: holidays.map(h => ({ ...h, _id: String(h._id), delivery: delivery[h.id] || { total: 0, SENT: 0, FAILED: 0, SKIPPED: 0, PENDING: 0 } })) });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        await dbConnect();
        const actor: any = await getSessionUser();
        if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        if (actor.role !== 'HOI') return NextResponse.json({ error: 'Only an HOI can announce a holiday directly.' }, { status: 403 });

        const body = await req.json().catch(() => ({}));
        const title = String(body.title || '').trim();
        const collegeId = String(body.collegeId || '');
        const date = String(body.date || '');
        const holidayType = HOLIDAY_TYPES.includes(body.holidayType) ? body.holidayType : '';
        const reason = String(body.reason || '').trim();
        const description = String(body.description || '').trim();
        if (title.length < 2) return NextResponse.json({ error: 'Enter the holiday title.' }, { status: 400 });
        if (!holidayType) return NextResponse.json({ error: 'Select the holiday type.' }, { status: 400 });
        if (reason.length < 3) return NextResponse.json({ error: 'Enter the reason.' }, { status: 400 });
        if (!isValidYmd(date)) return NextResponse.json({ error: 'Select a valid holiday date.' }, { status: 400 });
        const today = zonedNow().ymd;
        if (date < addDays(today, -30)) return NextResponse.json({ error: 'A holiday can be announced at most 30 days in the past.' }, { status: 400 });
        if (date > addDays(today, 366)) return NextResponse.json({ error: 'A holiday can be announced at most one year ahead.' }, { status: 400 });

        const colleges = await managedColleges(actor);
        const college = colleges.find(c => c.id === collegeId);
        if (!college) return NextResponse.json({ error: 'You can only announce holidays for the colleges you manage.' }, { status: 403 });

        // No second holiday for the same college and date (announced, approved or waiting for HR)
        const existing: any = await Holiday.findOne({ date, status: { $in: ['Approved', 'Proposed'] }, $or: [{ forAll: true }, { collegeIds: collegeId }] }).lean();
        if (existing) return NextResponse.json({ error: `A holiday already exists for ${college.name} on ${fmtLong(date)}: "${existing.name}" (${existing.status}).`, existingId: existing.id }, { status: 409 });

        const now = new Date().toISOString();
        const holidayId = `HOL-${collegeId}-${date}`;   // stable id: a retried request cannot create a second record
        let holiday: any;
        try {
            holiday = await Holiday.create({
                id: holidayId, name: title, date, collegeIds: [collegeId], forAll: false, status: 'Approved',
                source: 'HOI_ANNOUNCEMENT', holidayType, reason, description, customMessage: reason,
                proposedBy: actor.id, proposedByName: actor.name, proposedAt: now,
                approvedBy: actor.id, approvedByName: actor.name, approvedAt: now,
                announcedByRole: 'HOI', createdAt: now, publishedStatus: 'Published',
            });
        } catch (e: any) {
            if (e?.code === 11000) return NextResponse.json({ error: 'This holiday has already been announced.' }, { status: 409 });
            throw e;
        }

        // Publish in the existing Announcements (linked to the holiday). If this fails, the holiday is rolled back.
        const noticeId = `N-${holidayId}`;
        try {
            await Notice.create({
                id: noticeId, title: `Holiday: ${title}`, category: 'Holiday',
                content: `HOLIDAY ANNOUNCEMENT\nCollege: ${college.name}\nHoliday Date: ${fmtLong(date)}\nType: ${holidayType}\nReason: ${reason}${description ? `\n${description}` : ''}\nAnnounced By: HOI – ${actor.name}`,
                createdBy: actor.name, createdById: actor.id, createdByRole: 'HOI', createdAt: today,
                collegeIds: [collegeId], holidayId, status: 'Published', readBy: [],
            });
        } catch (e: any) {
            if (e?.code !== 11000) { await Holiday.deleteOne({ id: holidayId }); throw e; }
        }
        await Holiday.updateOne({ id: holidayId }, { $set: { announcementId: noticeId } });

        // E-mail + in-app to the college's employees after the response (delivery is tracked per recipient;
        // an e-mail problem never removes the holiday or the announcement)
        const recipients = await collegeEmployees(collegeId);
        const parts = emailParts(holiday, college.name);
        after(async () => {
            const already = await Notification.countDocuments({ entityType: 'Holiday', entityId: holidayId });
            if (already) return; // idempotent
            await notifySafe({ recipients, ...parts, type: 'HOLIDAY_ANNOUNCED', link: '/announcements', entityType: 'Holiday', entityId: holidayId, college: collegeId, actor });
        });

        return NextResponse.json({ success: true, holiday: { ...holiday.toObject(), announcementId: noticeId }, announcementId: noticeId, recipients: recipients.length, message: `Holiday announced for ${college.name}. ${recipients.length} employee(s) are being notified.` });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function PUT(req: Request) {
    try {
        await dbConnect();
        const actor: any = await getSessionUser();
        if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const { holidayId, action } = await req.json().catch(() => ({}));
        if (action !== 'retry_emails') return NextResponse.json({ error: 'Unknown action.' }, { status: 400 });
        const h: any = await Holiday.findOne({ id: holidayId, source: 'HOI_ANNOUNCEMENT' }).lean();
        if (!h) return NextResponse.json({ error: 'Holiday not found.' }, { status: 404 });
        const isAdmin = actor.role === 'HR' || actor.role === 'FOUNDER';
        if (!isAdmin && h.proposedBy !== actor.id) return NextResponse.json({ error: 'Not allowed.' }, { status: 403 });
        const loc: any = await Location.findOne({ id: h.collegeIds?.[0] }).select('name').lean();
        const parts = emailParts(h, loc?.name || h.collegeIds?.[0] || '');
        const tpl = getAcademicNotificationTemplate({ title: parts.title, intro: parts.message, rows: parts.rows, note: parts.note, link: appUrl('/announcements') });
        const failed: any[] = await Notification.find({ entityType: 'Holiday', entityId: holidayId, emailStatus: 'FAILED' }).lean();
        let sent = 0;
        for (const n of failed) {
            const emp: any = await Employee.findOne({ id: n.recipientId }).select('email').lean();
            if (!emp?.email) continue;
            const res: any = await sendMailInternal({ to: emp.email, subject: tpl.subject, html: tpl.html });
            await Notification.updateOne({ id: n.id }, { $set: res?.success ? { emailStatus: 'SENT', emailError: '' } : { emailStatus: 'FAILED', emailError: String(res?.error || 'Unknown error').slice(0, 300) } });
            if (res?.success) sent++;
        }
        const delivery = (await deliveryOf([holidayId]))[holidayId];
        return NextResponse.json({ success: true, retried: failed.length, sent, delivery });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
