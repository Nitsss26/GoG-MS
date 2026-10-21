import { NextResponse } from 'next/server';
import { ensureChecklist } from '@/lib/post-onboarding-server';
import { cookies } from 'next/headers';
import dbConnect from '@/lib/mongodb';
import { Employee } from '@/models/Schemas';
import { verifySessionToken, COOKIE_NAME } from '@/lib/session';
import { storedPasswordValue } from '@/lib/password';
import { sendMailInternal } from '@/lib/mail-server';

export const dynamic = 'force-dynamic';

/** Server-side mirror of the reportee rules the Monthly Feedback page lists (AuthContext.getReportees). */
async function canRate(session: { userId: string; email: string; role: string }, targetId: string): Promise<boolean> {
    const actor: any = (await Employee.findOne({ id: session.userId }).select('id role location').lean())
        || (await Employee.findOne({ email: session.email, role: session.role }).select('id role location').lean());
    const target: any = await Employee.findOne({ id: targetId }).select('id role location reportsTo isRemoved').lean();
    if (!actor || !target || target.isRemoved || actor.id === target.id) return false;
    const assigned: string[] = Array.isArray(target.reportsTo) ? target.reportsTo : (target.reportsTo ? [target.reportsTo] : []);
    const isReportee = assigned.includes(actor.id);
    const role = String(target.role || '');
    switch (session.role) {
        case 'CURRICULUM_HEAD': return ['CURRICULUM_LEAD', 'FACULTY', 'PROFESSOR'].includes(role);
        case 'CURRICULUM_LEAD': return ['FACULTY', 'PROFESSOR'].includes(role);
        case 'AD': return isReportee && ['HOI', 'FACULTY', 'PROFESSOR', 'OM', 'MARKETING_TEAM', 'TECH_TEAM', 'CURRICULUM_HEAD', 'CURRICULUM_LEAD'].includes(role);
        case 'HOI': {
            if (!['FACULTY', 'PROFESSOR', 'OM', 'MARKETING_TEAM', 'TECH_TEAM'].includes(role)) return false;
            if (isReportee) return true;
            const hasAssignedHOI = assigned.length > 0 && !!(await Employee.exists({ id: { $in: assigned }, role: 'HOI' }));
            return !hasAssignedHOI && !!actor.location && target.location === actor.location;
        }
        case 'OM': return isReportee && ['FACULTY', 'PROFESSOR'].includes(role);
        default: return isReportee; // TL and others: direct reportees
    }
}

/** Bank, identity numbers and identity documents — never sent to other employees */
const SENSITIVE_FIELDS = [
    'bankAccountName', 'bankAccountNumber', 'ifscCode', 'upiId', 'bankName', 'accountNumber', 'aadhaarNumber', 'panNumber',
    'bank_account_number', 'ifsc_code', 'account_holder_name', 'upi_id', 'aadhar_card', 'pan_card', 'bank_passbook_cancelled_cheque',
    'aadharCardUrl', 'panCardUrl', 'bankPassbookUrl', 'salary', 'onboardingRemarks', 'onboardingChecklistMeta', 'onboardingActivity',
];
/** Onboarding fields the employee fills in the onboarding form */
const FORM_FIELDS = [
    'full_name', 'phone_no_', 'father_name_or_mother_name', 'parents_phone_no_', 'permanent_address', 'bachelor_s_qualification',
    'master_s_qualification', 'you_are_from_', 'current_designation_at_gog', 'linkedin_id', 'which_college_are_you_from_', 't_shirt_size',
    'date_of_birth', 'blood_group', 'bank_account_number', 'ifsc_code', 'account_holder_name', 'upi_id',
    'upload_your_resume', 'upload_your_bachelor_s_passing_certificate', 'upload_your_master_s_passing_certificate', 'ten_marksheet',
    'twelve_marksheet', 'aadhar_card', 'pan_card', 'passport_size_photo', 'bank_passbook_cancelled_cheque', 'experience_letter',
    'bachelor_marksheet_all', 'master_marksheet_all',
];
const CHECK_LABEL: Record<string, string> = {
    aadharCheck: 'Aadhar Verification', qualificationCheck: 'Qualification Audit', bankDetailsCheck: 'Bank Details Review',
    slackOnboarded: 'Added to Slack Workspace', slackChannelsAdded: 'Slack Channels & WA Groups', waGroupsAdded: 'WhatsApp Groups',
    accessRoleSetup: 'Access & Role Setup', welcomeMailSent: 'Welcome Mail Sent', hrMeetingCompleted: '1:1 / SOP Meeting with HR',
    hrMeetingScreenshot: 'HR meeting screenshot', managerMeetingCompleted: 'Meeting with Manager', adMeetingCompleted: 'Meeting with AD',
};

/**
 * Onboarding audit: compares the update with the stored record and returns the activity entries plus the
 * per-item checklist metadata (who / when). Written by the server, so the timeline cannot be faked by the client.
 */
function onboardingAudit(before: any, updates: any, actor: { id: string; name: string; role: string }, isSelf: boolean) {
    const now = new Date().toISOString();
    const acts: any[] = [];
    const meta: Record<string, any> = {};
    const entry = (action: string, note = '') => acts.push({ at: now, by: actor.id, byName: actor.name, role: actor.role, action, note });
    if (updates.onboardingChecklist && typeof updates.onboardingChecklist === 'object') {
        const old = before?.onboardingChecklist || {};
        for (const [k, v] of Object.entries(updates.onboardingChecklist)) {
            if (!(k in CHECK_LABEL)) continue;
            if (typeof v === 'boolean' && Boolean(old[k]) !== v) {
                meta[k] = { done: v, by: actor.id, byName: actor.name, at: now };
                entry(`${CHECK_LABEL[k]} ${v ? 'verified' : 'marked pending'}`);
            } else if (typeof v === 'string' && v && v !== old[k]) {
                meta[k] = { done: true, by: actor.id, byName: actor.name, at: now, value: v };
                entry(`${CHECK_LABEL[k]} attached`);
            }
        }
    }
    if (updates.onboardingStatus && updates.onboardingStatus !== before?.onboardingStatus) {
        if (isSelf && updates.onboardingStatus === 'Verification Pending') entry('Onboarding form submitted');
        else entry(`Onboarding status: ${before?.onboardingStatus || 'Pending Creation'} → ${updates.onboardingStatus}`);
    }
    if ('onboardingRemarks' in updates && String(updates.onboardingRemarks || '') !== String(before?.onboardingRemarks || '')) {
        entry('HR remarks updated', String(updates.onboardingRemarks || '').slice(0, 300));
    }
    if (!isSelf) {
        const edited = FORM_FIELDS.filter(k => k in updates && String(updates[k] ?? '') !== String(before?.[k] ?? ''));
        if (edited.length) entry('Form details edited', edited.join(', '));
    }
    return { acts, meta };
}

export async function GET() {
    try {
        // Authenticate session
        const cookieStore = await cookies();
        const sessionCookie = cookieStore.get(COOKIE_NAME);
        if (!sessionCookie?.value) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const session = verifySessionToken(sessionCookie.value);
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        await dbConnect();
        const employees = await Employee.find({});
        
        // Strip sensitive data for standard users (they still see their own records in full)
        const isPrivileged = session.role === "FOUNDER" || session.role === "HR";
        const myEmail = String(session.email || '').toLowerCase();
        const sanitizedEmployees = employees.map(emp => {
            const data = emp.toObject();
            delete data.password; // NEVER send passwords
            if (!isPrivileged && String(data.email || '').toLowerCase() !== myEmail) {
                // Bank details, identity numbers and identity documents: HR / Founder only
                SENSITIVE_FIELDS.forEach(k => delete data[k]);
            }
            return data;
        });

        return NextResponse.json(sanitizedEmployees);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    try {
        // Authenticate session
        const cookieStore = await cookies();
        const sessionCookie = cookieStore.get(COOKIE_NAME);
        if (!sessionCookie?.value) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const session = verifySessionToken(sessionCookie.value);
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        await dbConnect();
        const data = await request.json();
        const { id, ...updates } = data;
        // Passwords are changed only through Change Password or HR → Reset Password (both store a hash)
        delete updates.password;
        delete updates.passwordChangedAt; delete updates.passwordResetAt; delete updates.passwordResetBy; delete updates.passwordResetByName;
        // Changed only through their own APIs (validation + audit): /api/onboarding/checklist and /api/hr/assign
        delete updates.postOnboardingChecklist; delete updates.attendanceLocations;

        // Who may change what: HR / Founder any employee; everyone else only their own profile
        // (never role, college, reporting line or status), plus manager ratings of others.
        const isHrOrFounder = session.role === "HR" || session.role === "FOUNDER";
        if (!isHrOrFounder) {
            const actor: any = (await Employee.findOne({ id: session.userId }).select('id').lean())
                || (await Employee.findOne({ email: session.email, role: session.role }).select('id').lean());
            const isSelf = actor?.id === id;
            const PROTECTED = ["role", "location", "reportsTo", "status", "isRemoved", "removedAt", "removedBy", "removedByName", "removalSnapshot", "email", "salary", "employeeId", "_id",
                // HR verification and ratings are never set by the employee themselves
                "isOnboarded", "onboardingChecklist", "onboardingChecklistMeta", "onboardingActivity", "onboardingRemarks", "onboardingApprovedAt",
                "onboardingApprovedBy", "onboardingApprovedByName", "monthlyScores", "slackInviteLink"];
            if (isSelf) {
                PROTECTED.forEach(k => delete updates[k]);
                // The employee can only submit the form (→ Verification Pending), never approve themselves
                if (updates.onboardingStatus && updates.onboardingStatus !== "Verification Pending") delete updates.onboardingStatus;
            } else {
                const keys = Object.keys(updates);
                const RATING_ROLES = ["AD", "HOI", "OM", "TL", "CURRICULUM_LEAD", "CURRICULUM_HEAD"];
                if (!RATING_ROLES.includes(session.role) || keys.some(k => k !== "monthlyScores")) {
                    return NextResponse.json({ error: 'You can only update your own profile.' }, { status: 403 });
                }
                // Monthly Feedback: a rater may only rate employees inside their own reportee scope
                if (!(await canRate(session, id))) {
                    return NextResponse.json({ error: 'This employee is not in your reporting scope.' }, { status: 403 });
                }
            }
        }

        if (!id) {
            return NextResponse.json({ error: 'Employee ID is required' }, { status: 400 });
        }
        // Promoting someone to Founder is a Founder-only action
        if (updates.role === 'FOUNDER' && session.role !== 'FOUNDER') {
            return NextResponse.json({ error: 'Only a Founder can assign the Founder role.' }, { status: 403 });
        }
        if (updates.role === 'HR' && session.hrExecutive) {
            return NextResponse.json({ error: 'HR Executive cannot assign the HR role.' }, { status: 403 });
        }

        // Onboarding audit trail (checklist who/when, status changes, remarks, HR edits)
        const touchesOnboarding = updates.onboardingChecklist || updates.onboardingStatus || 'onboardingRemarks' in updates || FORM_FIELDS.some(k => k in updates);
        const op: any = { $set: updates };
        if (touchesOnboarding) {
            const before: any = await Employee.findOne({ id }).lean();
            if (before && before.onboardingStatus === 'Approved' && updates.onboardingStatus === 'Verification Pending' && !isHrOrFounder) delete updates.onboardingStatus;
            const actorDoc: any = (await Employee.findOne({ id: session.userId }).select('id name role').lean())
                || (await Employee.findOne({ email: session.email, role: session.role }).select('id name role').lean());
            const actor = { id: actorDoc?.id || session.userId, name: actorDoc?.name || session.email, role: session.role };
            const isSelfUpdate = actor.id === id;
            const { acts, meta } = onboardingAudit(before, updates, actor, isSelfUpdate);
            Object.entries(meta).forEach(([k, v]) => { updates[`onboardingChecklistMeta.${k}`] = v; });
            if (updates.onboardingStatus === 'Approved' && before?.onboardingStatus !== 'Approved') {
                updates.onboardingApprovedBy = actor.id; updates.onboardingApprovedByName = actor.name;
                if (!updates.onboardingApprovedAt) updates.onboardingApprovedAt = new Date().toISOString();
            }
            if (isSelfUpdate && updates.onboardingStatus === 'Verification Pending' && !updates.onboardingSubmittedAt) updates.onboardingSubmittedAt = new Date().toISOString();
            if (acts.length) op.$push = { onboardingActivity: { $each: acts } };
        }

        const updatedEmployee = await Employee.findOneAndUpdate(
            { id },
            op,
            { new: true }
        );

        if (!updatedEmployee) {
            return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
        }

        // Onboarding form submitted → the five-step post-onboarding checklist is created once (idempotent)
        if (updates.onboardingStatus === 'Verification Pending' && updatedEmployee.onboardingStatus === 'Verification Pending') {
            await ensureChecklist(String(id), { notify: true }).catch(() => false);
        }
        const result = updatedEmployee.toObject();
        delete result.password;
        return NextResponse.json(result);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        // Authenticate session
        const cookieStore = await cookies();
        const sessionCookie = cookieStore.get(COOKIE_NAME);
        if (!sessionCookie?.value) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const session = verifySessionToken(sessionCookie.value);
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Only HR / Founder add employees
        if (session.role !== "HR" && session.role !== "FOUNDER") {
            return NextResponse.json({ error: 'Only HR can add employees.' }, { status: 403 });
        }

        await dbConnect();
        const data = await request.json();
        delete data.isRemoved;
        delete data.postOnboardingChecklist; delete data.attendanceLocations;
        delete data.removedAt; delete data.removedBy; delete data.removedByName; delete data.removalSnapshot;
        // Optional Slack invite link (shown to the joinee before the onboarding form): only http(s) links are stored
        if (data.slackInviteLink !== undefined) {
            const link = String(data.slackInviteLink || '').trim();
            if (link && !/^https?:\/\/\S+$/i.test(link)) return NextResponse.json({ error: 'Enter a valid Slack link (starting with https://).' }, { status: 400 });
            data.slackInviteLink = link;
        }

        const email = String(data.email || '').trim();
        const role = String(data.role || '').trim();
        // Founder is the top access level: only an existing Founder may create one (HR cannot)
        if (role === 'FOUNDER' && session.role !== 'FOUNDER') {
            return NextResponse.json({ error: 'Only a Founder can add another Founder.' }, { status: 403 });
        }
        // HR Executive cannot create a full HR account (HR has Reimbursements access, HR Executive does not)
        if (role === 'HR' && session.hrExecutive) {
            return NextResponse.json({ error: 'HR Executive cannot add an HR account.' }, { status: 403 });
        }
        if (!email || !role || !data.name || !data.id) {
            return NextResponse.json({ error: 'Name, email, designation (role) and employee id are required.' }, { status: 400 });
        }
        data.email = email;
        if (await Employee.findOne({ id: data.id }).select('_id').lean()) {
            return NextResponse.json({ error: `Employee id ${data.id} is already in use.` }, { status: 409 });
        }

        // Same person, another designation: allowed. The login identity stays ONE (the email + one password);
        // this designation record is linked to it and the person picks the designation in the login dropdown.
        const escaped = email.replace(/[.*+?^$()|[\]{}\\]/g, '\\$&');
        const sameEmail: any[] = await Employee.find({ email: { $regex: new RegExp(`^${escaped}$`, 'i') } }).select('id name role password isRemoved').lean();
        // Faculty and Professor are one designation
        const sameRoles = ['PROFESSOR', 'FACULTY'].includes(role) ? ['PROFESSOR', 'FACULTY'] : [role];
        const sameDesignation = sameEmail.find(e => sameRoles.includes(e.role) && !e.isRemoved);
        if (sameDesignation) {
            return NextResponse.json({
                error: `${sameDesignation.name} (${sameDesignation.id}) is already onboarded as ${role} with this email. Edit that record or resend its onboarding instead of creating a duplicate.`,
                code: 'SAME_DESIGNATION_EXISTS', existingId: sameDesignation.id,
            }, { status: 409 });
        }
        const linked = sameEmail.length > 0;
        if (linked) {
            // one password for the person: reuse the existing login's hash (HR's new password is not applied)
            const withPassword = sameEmail.find(e => e.password);
            if (withPassword) data.password = withPassword.password;
            else if (data.password) data.password = storedPasswordValue(String(data.password));
            data.linkedEmployeeIds = sameEmail.map(e => e.id);
        } else if (data.password) {
            // Saved as plain text (as in the original portal)
            data.password = storedPasswordValue(String(data.password));
        }

        const newEmployee = await Employee.create(data);
        const created = newEmployee.toObject();
        delete created.password;

        // Designation-specific onboarding email (no password in the email)
        const appUrl = (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/+$/, '');
        const roleLabel = role.replace(/_/g, ' ');
        let onboardingEmail: 'SENT' | 'FAILED' | 'NOT_CONFIGURED' = 'NOT_CONFIGURED';
        if (process.env.SMTP_USER && process.env.SMTP_PASS) {
            const result: any = await Promise.race([
                sendMailInternal({
                    to: email,
                    subject: `Welcome to GoG OMS — ${roleLabel} onboarding (${created.id})`,
                    html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px;border:1px solid #e5e7eb;border-radius:8px">
                        <h2 style="color:#10b981;margin-top:0">Onboarding: ${roleLabel}</h2>
                        <p>Hi ${String(created.name).replace(/</g, '&lt;')},</p>
                        <p>An onboarding record has been created for you on GoG OMS.</p>
                        <table style="font-size:14px">
                          <tr><td><b>Designation</b></td><td>${roleLabel}${created.designation ? ` — ${String(created.designation).replace(/</g, '&lt;')}` : ''}</td></tr>
                          <tr><td><b>Employee ID</b></td><td>${created.id}</td></tr>
                          <tr><td><b>Login email</b></td><td>${email}</td></tr>
                        </table>
                        <p>${linked ? `Log in with your existing GoG OMS password and choose <b>${roleLabel}</b> in the designation list.` : 'HR will share your temporary password separately. Choose your designation in the login list.'}</p>
                        ${appUrl ? `<p><a href="${appUrl}/login">${appUrl}/login</a></p>` : ''}
                        <p style="font-size:12px;color:#6b7280">Geeks of Gurukul HRMS</p></div>`,
                }),
                new Promise(r => setTimeout(() => r({ success: false }), 10000)),
            ]);
            onboardingEmail = result?.success ? 'SENT' : 'FAILED';
        }
        return NextResponse.json({ ...created, linkedToExistingLogin: linked, onboardingEmail });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}