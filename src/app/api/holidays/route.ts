import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { Holiday, Employee, Location } from '@/models/Schemas';
import { getSessionUser } from '@/lib/session-user';
import { sendMailInternal } from '@/lib/mail-server';
import { getHolidayFacultyTemplate } from '@/lib/mail-templates';

export const dynamic = 'force-dynamic';

// Roles that count as teachers / faculty for a holiday notification
const TEACHER_ROLES = ["PROFESSOR", "FACULTY"];
const PROPOSER_ROLES = ["HOI", "AD", "OM", "HR", "FOUNDER"];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** A college is stored on the employee as its Location id; older records hold the name or short name. */
async function resolveCollegeId(value?: string | null): Promise<string | null> {
    if (!value) return null;
    const loc = await Location.findOne({ $or: [{ id: value }, { name: value }, { shortName: value }] });
    return loc ? loc.id : null;
}

/**
 * Active teachers mapped to the holiday's college(s), using the Employee.location mapping in the database.
 * Employees removed from the portal are never returned (see the Employee schema).
 */
async function getHolidayRecipients(holiday: any) {
    const collegeIds: string[] = holiday.collegeIds || [];
    const query: any = { role: { $in: TEACHER_ROLES }, status: "Active" };
    let collegeName = "all colleges";

    if (!holiday.forAll) {
        if (collegeIds.length === 0) return { collegeName: "", teachers: [] as any[] };
        const colleges = await Location.find({ id: { $in: collegeIds } });
        const keys = new Set<string>(collegeIds);
        colleges.forEach((c: any) => { keys.add(c.name); keys.add(c.shortName); });
        query.location = { $in: Array.from(keys).filter(Boolean) };
        collegeName = colleges.map((c: any) => c.name).join(", ") || collegeIds.join(", ");
    }

    const teachers = await Employee.find(query).select('id name email location');
    return { collegeName, teachers };
}

export async function GET() {
    try {
        await dbConnect();
        const holidays = await Holiday.find({});
        return NextResponse.json(holidays);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

/**
 * Create a holiday (HR / Founder: approved directly) or a holiday request (everyone else: goes to HR as "Proposed").
 * A request from an HOI always belongs to the HOI's own college.
 */
export async function POST(req: Request) {
    try {
        await dbConnect();
        const actor = await getSessionUser();
        if (!actor) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        if (!PROPOSER_ROLES.includes(actor.role)) {
            return NextResponse.json({ error: 'You are not allowed to report a holiday.' }, { status: 403 });
        }

        const body = await req.json();
        const isHR = actor.role === "HR" || actor.role === "FOUNDER";

        const data: any = {
            ...body,
            // Never trusted from the client:
            status: isHR ? (body.status === "Proposed" ? "Proposed" : "Approved") : "Proposed",
            proposedBy: actor.id,
            proposedByName: actor.name,
            proposedAt: new Date().toISOString(),
        };
        ['approvedBy', 'approvedByName', 'approvedAt', 'rejectedBy', 'rejectedByName', 'rejectedAt', 'rejectionReason', 'emailSentAt', 'emailStatus', 'emailRecipients', 'emailError'].forEach(k => delete data[k]);

        if (actor.role === "HOI") {
            const collegeId = await resolveCollegeId(actor.employee?.location);
            if (collegeId) {
                data.collegeIds = [collegeId];
                data.forAll = false;
            } else if (!data.forAll && (!data.collegeIds || data.collegeIds.length === 0)) {
                return NextResponse.json({ error: 'Your account is not mapped to a college. Please select the college for this holiday.' }, { status: 400 });
            }
        }
        if (isHR && data.status === "Approved") {
            data.approvedBy = actor.id;
            data.approvedByName = actor.name;
            data.approvedAt = data.proposedAt;
        }

        // Check if updating existing or creating new
        if (body.id) {
            const existing = await Holiday.findOne({ id: body.id });
            if (existing) {
                return NextResponse.json({ error: 'A holiday with this id already exists.' }, { status: 409 });
            }
            const newItem = await Holiday.create(data);
            return NextResponse.json(newItem);
        } else {
            const newItem = await Holiday.create({ ...data, id: `HOL${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}` });
            return NextResponse.json(newItem);
        }
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

/**
 * HR decision on a holiday request: { id, status: "Approved" | "Rejected", customMessage?, rejectionReason? }
 *
 * On approval the holiday notice is emailed ONLY to the active teachers of the holiday's college.
 * Nothing is emailed for a pending or rejected request, and an approval is emailed only once.
 */
export async function PUT(req: Request) {
    try {
        await dbConnect();
        const actor = await getSessionUser();
        if (!actor) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        if (actor.role !== "HR" && actor.role !== "FOUNDER") {
            return NextResponse.json({ error: 'Only HR can approve or reject a holiday.' }, { status: 403 });
        }

        const { id, status, customMessage, rejectionReason } = await req.json();
        if (!id || (status !== "Approved" && status !== "Rejected")) {
            return NextResponse.json({ error: 'Holiday id and a valid status (Approved / Rejected) are required' }, { status: 400 });
        }

        const now = new Date().toISOString();
        const decision: any = status === "Approved"
            ? { status, approvedBy: actor.id, approvedByName: actor.name, approvedAt: now }
            : { status, rejectedBy: actor.id, rejectedByName: actor.name, rejectedAt: now, rejectionReason: rejectionReason || undefined };
        if (customMessage) decision.customMessage = customMessage;

        // Only a pending request can be decided. A repeated call (refresh, double click, API retry)
        // matches nothing here, so it changes nothing and sends nothing.
        const updated = await Holiday.findOneAndUpdate({ id, status: "Proposed" }, { $set: decision }, { returnDocument: 'after' });
        if (!updated) {
            const existing = await Holiday.findOne({ id });
            if (!existing) return NextResponse.json({ error: 'Holiday not found' }, { status: 404 });
            return NextResponse.json({ ...existing.toObject(), alreadyProcessed: true, emailInfo: { sent: false, reason: `Already ${existing.status}` } });
        }

        if (status !== "Approved") {
            return NextResponse.json({ ...updated.toObject(), emailInfo: { sent: false, reason: "Rejected" } });
        }

        // Claim the notification first (set once), then send it
        const claimed = await Holiday.findOneAndUpdate(
            { id, emailSentAt: { $in: [null, ""] } },
            { $set: { emailSentAt: now } },
            { returnDocument: 'after' }
        );
        if (!claimed) {
            return NextResponse.json({ ...updated.toObject(), emailInfo: { sent: false, reason: "Already notified" } });
        }

        const { collegeName, teachers } = await getHolidayRecipients(claimed);
        const recipients = Array.from(new Set(
            teachers.map((t: any) => String(t.email || "").trim().toLowerCase())
                .filter((e: string) => EMAIL_RE.test(e) && !e.endsWith('@gog.com')) // same placeholder-address rule as /api/send-email
        ));

        let emailStatus = "No Recipients";
        let emailError: string | undefined;
        if (recipients.length > 0) {
            const { subject, html } = getHolidayFacultyTemplate(claimed, collegeName);
            const result = await sendMailInternal({ to: recipients, subject, html });
            emailStatus = result.success ? "Sent" : "Failed";
            if (!result.success) emailError = String(result.error || "").slice(0, 300);
        }

        const final = await Holiday.findOneAndUpdate(
            { id },
            { $set: { emailStatus, emailRecipients: recipients, emailError: emailError || "" } },
            { returnDocument: 'after' }
        );

        return NextResponse.json({
            ...final.toObject(),
            emailInfo: { sent: emailStatus === "Sent", status: emailStatus, college: collegeName, recipientCount: recipients.length, recipients, error: emailError }
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
