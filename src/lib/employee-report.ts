/**
 * SERVER-ONLY: data for the Workforce and Onboarding exports (PDF / Excel are generated in the browser from this).
 * Everything comes from the database. Bank account and Aadhaar numbers are masked, no password / token /
 * document link is ever returned, and every caller is checked against the session first.
 */
import { Employee, Location, ExitRecord } from '@/models/Schemas';

export const EXPORT_FULL_ROLES = ['HR', 'FOUNDER'];
/** Management roles that see their reportees on the Workforce page (and may export only them) */
export const EXPORT_SCOPED_ROLES = ['HOI', 'AD', 'OM'];

const ROLE_LABEL: Record<string, string> = {
    FOUNDER: 'Founder', HR: 'HR', AD: 'AD', TL: 'Tech Lead', HOI: 'HOI', OM: 'OM', FACULTY: 'Professor / Faculty', PROFESSOR: 'Professor / Faculty',
    MARKETING_TEAM: 'Marketing Team', TECH_TEAM: 'Tech Team', CURRICULUM_HEAD: 'Curriculum Head', CURRICULUM_LEAD: 'Curriculum Lead', HR_EXECUTIVE: 'HR Executive',
};
export const roleLabel = (r?: string) => (r ? ROLE_LABEL[r] || r : '');

/** "XXXXXX7890" — only the last 4 characters are kept */
export const maskTail = (v?: string, keep = 4) => {
    const s = String(v || '').replace(/\s+/g, '');
    if (!s) return '';
    return s.length <= keep ? '•'.repeat(s.length) : 'X'.repeat(Math.min(8, s.length - keep)) + s.slice(-keep);
};
const ymdIST = (d?: any) => {
    if (!d) return '';
    const x = new Date(d);
    return isNaN(x.getTime()) ? String(d) : x.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
};
const dateTimeIST = (d?: any) => {
    if (!d) return '';
    const x = new Date(d);
    return isNaN(x.getTime()) ? String(d) : x.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};
/** Date the record was created (MongoDB ObjectId timestamp) */
const addedOn = (e: any) => { try { return e?._id?.getTimestamp ? ymdIST(e._id.getTimestamp()) : ''; } catch { return ''; } };

async function lookups() {
    const [locs, all]: any[] = await Promise.all([
        Location.find({}).select('id name shortName').lean(),
        Employee.find({}).select('id name email role').lean(),
    ]);
    const loc = new Map<string, string>();
    locs.forEach((l: any) => [l.id, l.name, l.shortName].filter(Boolean).forEach((k: string) => loc.set(k, l.name)));
    const byId = new Map<string, any>(all.map((e: any) => [e.id, e]));
    const rolesByEmail = new Map<string, string[]>();
    all.forEach((e: any) => {
        const k = String(e.email || '').toLowerCase();
        rolesByEmail.set(k, Array.from(new Set([...(rolesByEmail.get(k) || []), roleLabel(e.role)])));
    });
    return {
        campus: (v?: string) => (v ? loc.get(v) || v : ''),
        managers: (e: any) => (Array.isArray(e.reportsTo) ? e.reportsTo : e.reportsTo ? [e.reportsTo] : [])
            .map((id: string) => { const m = byId.get(id); return m ? `${m.name} (${roleLabel(m.role)})` : id; }).join(', '),
        roles: (e: any) => (rolesByEmail.get(String(e.email || '').toLowerCase()) || [roleLabel(e.role)]).join(', '),
    };
}

/** Employees the actor may export from the Workforce page (server-side mirror of the page's scope) */
export async function workforceScope(actor: { id: string; role: string; employee?: any }): Promise<any[] | null> {
    if (EXPORT_FULL_ROLES.includes(actor.role)) return Employee.find({}).lean();
    if (!EXPORT_SCOPED_ROLES.includes(actor.role)) return null;
    const me: any = actor.employee || await Employee.findOne({ id: actor.id }).lean();
    const all: any[] = await Employee.find({}).lean();
    const hoiIds = new Set(all.filter(e => e.role === 'HOI').map(e => e.id));
    return all.filter(e => {
        if (e.id === actor.id) return false;
        const assigned: string[] = Array.isArray(e.reportsTo) ? e.reportsTo : e.reportsTo ? [e.reportsTo] : [];
        if (assigned.includes(actor.id)) return true;
        // HOI: employees of the HOI's campus that have no HOI assigned (same fallback as the page)
        return actor.role === 'HOI' && !!me?.location && e.location === me.location && !assigned.some(id => hoiIds.has(id))
            && ['FACULTY', 'PROFESSOR', 'OM', 'MARKETING_TEAM', 'TECH_TEAM'].includes(e.role);
    });
}

export type Col = { key: string; label: string; width?: number };

export async function workforceRows(list: any[], full: boolean) {
    const L = await lookups();
    const cols: Col[] = [
        { key: 'name', label: 'Employee Name', width: 24 }, { key: 'id', label: 'Employee ID', width: 13 }, { key: 'email', label: 'Email Address', width: 28 },
        { key: 'mobile', label: 'Mobile Number', width: 15 }, { key: 'dept', label: 'Department', width: 18 }, { key: 'designation', label: 'Designation', width: 20 },
        { key: 'roles', label: 'Assigned Role(s)', width: 20 }, { key: 'campus', label: 'Campus / Work Location', width: 22 },
        { key: 'manager', label: 'Reporting HOI / Manager', width: 26 }, { key: 'status', label: 'Employment Status', width: 14 },
        { key: 'joiningDate', label: 'Joining Date', width: 13 }, { key: 'addedOn', label: 'Added to Portal', width: 13 },
        { key: 'onboarding', label: 'Onboarding Status', width: 18 },
        ...(full ? [
            { key: 'dob', label: 'Date of Birth', width: 13 }, { key: 'blood', label: 'Blood Group', width: 10 },
            { key: 'gender', label: 'Gender', width: 9 }, { key: 'linkedin', label: 'LinkedIn', width: 26 },
        ] : []),
    ];
    const rows = list.map((e: any) => ({
        name: e.name || e.full_name || '', id: e.id, email: e.email || '', mobile: e.phone_no_ || e.phone || '',
        dept: e.dept || '', designation: e.designation || '', roles: L.roles(e), campus: L.campus(e.location), manager: L.managers(e),
        status: e.status || '', joiningDate: e.joiningDate || '', addedOn: addedOn(e), onboarding: e.onboardingStatus || (e.isOnboarded ? 'Approved' : 'Pending Creation'),
        ...(full ? { dob: e.date_of_birth || e.dateOfBirth || '', blood: e.blood_group || e.bloodGroup || '', gender: e.gender || '', linkedin: e.linkedin_id || '' } : {}),
    }));
    return { cols, rows };
}

/** Onboarding status groups used by the Onboarding Hub tabs */
export function onboardingGroup(e: any): 'APPROVED' | 'VERIFICATION' | 'FORM' | 'REMOVED' {
    if (e.isRemoved) return 'REMOVED';
    if (e.onboardingStatus === 'Approved' || (e.isOnboarded && !e.onboardingStatus)) return 'APPROVED';
    if (e.onboardingStatus === 'Verification Pending') return 'VERIFICATION';
    return 'FORM';
}
export const GROUP_LABEL = { APPROVED: 'Approved', VERIFICATION: 'Verification Pending', FORM: 'Form Pending', REMOVED: 'Removed' } as const;

export const CHECKLIST: { key: string; label: string; hint: string; mandatory?: boolean }[] = [
    { key: 'aadharCheck', label: 'Aadhar Verification', hint: 'Verify government ID and details.', mandatory: true },
    { key: 'qualificationCheck', label: 'Qualification Audit', hint: 'Verify academic qualification documents.', mandatory: true },
    { key: 'bankDetailsCheck', label: 'Bank Details Review', hint: 'Verify bank account information.' },
    { key: 'slackOnboarded', label: 'Added to Slack Workspace', hint: 'Confirm the employee has been added to Slack.' },
    { key: 'slackChannelsAdded', label: 'Slack Channels & WA Groups', hint: 'Added to the team channels and WhatsApp groups.' },
    { key: 'accessRoleSetup', label: 'Access & Role Setup', hint: 'System access and role configuration.' },
    { key: 'welcomeMailSent', label: 'Welcome Mail Sent', hint: 'Send the onboarding confirmation email.' },
    { key: 'hrMeetingCompleted', label: '1:1 / SOP Meeting with HR', hint: 'Attach the meeting screenshot.', mandatory: true },
    { key: 'managerMeetingCompleted', label: 'Meeting with Manager', hint: 'Introduction with the reporting manager.' },
    { key: 'adMeetingCompleted', label: 'Meeting with AD', hint: 'Introduction with the Associate Director.' },
];

export const DOCUMENTS: { key: string; label: string; type: string; check?: string }[] = [
    { key: 'upload_your_resume', label: 'Resume', type: 'Professional' },
    { key: 'aadhar_card', label: 'Aadhar Card', type: 'Identity', check: 'aadharCheck' },
    { key: 'pan_card', label: 'PAN Card', type: 'Identity', check: 'aadharCheck' },
    { key: 'passport_size_photo', label: 'Passport Size Photo', type: 'Identity' },
    { key: 'ten_marksheet', label: '10th Marksheet', type: 'Education', check: 'qualificationCheck' },
    { key: 'twelve_marksheet', label: '12th Marksheet', type: 'Education', check: 'qualificationCheck' },
    { key: 'upload_your_bachelor_s_passing_certificate', label: "Bachelor's Passing Certificate", type: 'Education', check: 'qualificationCheck' },
    { key: 'bachelor_marksheet_all', label: "Bachelor's Marksheets", type: 'Education', check: 'qualificationCheck' },
    { key: 'upload_your_master_s_passing_certificate', label: "Master's Passing Certificate", type: 'Education', check: 'qualificationCheck' },
    { key: 'master_marksheet_all', label: "Master's Marksheets", type: 'Education', check: 'qualificationCheck' },
    { key: 'bank_passbook_cancelled_cheque', label: 'Bank Passbook / Cancelled Cheque', type: 'Banking', check: 'bankDetailsCheck' },
    { key: 'experience_letter', label: 'Experience Letter', type: 'Experience' },
];

export async function onboardingListRows(list: any[]) {
    const L = await lookups();
    const done = (e: any) => CHECKLIST.filter(c => e.onboardingChecklist?.[c.key]).length;
    const cols: Col[] = [
        { key: 'name', label: 'Employee Name', width: 24 }, { key: 'id', label: 'Employee ID', width: 13 }, { key: 'email', label: 'Email', width: 28 },
        { key: 'designation', label: 'Designation', width: 20 }, { key: 'role', label: 'Role', width: 16 }, { key: 'dept', label: 'Department', width: 18 },
        { key: 'campus', label: 'Campus / Location', width: 22 }, { key: 'status', label: 'Onboarding Status', width: 20 },
        { key: 'form', label: 'Form Submission', width: 16 }, { key: 'verification', label: 'Verification (checklist)', width: 18 },
        { key: 'submittedAt', label: 'Form Submitted On', width: 15 }, { key: 'approvedAt', label: 'Approved On', width: 13 },
        { key: 'approvedBy', label: 'Approved By', width: 18 }, { key: 'joiningDate', label: 'Joining Date', width: 13 }, { key: 'manager', label: 'Reporting HOI / Manager', width: 26 },
    ];
    const rows = list.map((e: any) => {
        const g = onboardingGroup(e);
        return {
            name: e.name || '', id: e.id, email: e.email || '', designation: e.designation || '', role: roleLabel(e.role), dept: e.dept || '',
            campus: L.campus(e.location), status: GROUP_LABEL[g], form: e.onboardingSubmittedAt || g === 'VERIFICATION' || g === 'APPROVED' ? 'Submitted' : 'Not submitted',
            verification: `${done(e)} / ${CHECKLIST.length} verified`, submittedAt: ymdIST(e.onboardingSubmittedAt), approvedAt: ymdIST(e.onboardingApprovedAt),
            approvedBy: e.onboardingApprovedByName || '', joiningDate: e.joiningDate || '', manager: L.managers(e),
        };
    });
    return { cols, rows };
}

export type KV = [string, string];
export type Report = {
    employee: { id: string; name: string };
    info: KV[]; form: KV[]; banking: KV[];
    checklist: { item: string; status: string; mandatory: string; by: string; at: string; remarks: string }[];
    documents: { name: string; type: string; upload: string; verification: string; uploadedOn: string }[];
    history: KV[]; activity: { at: string; by: string; action: string; note: string }[];
};

/** Complete onboarding report of one employee (HR / Founder) */
export async function onboardingReport(employeeId: string): Promise<Report | null> {
    const e: any = (await Employee.findOne({ id: employeeId }).lean()) || (await Employee.findOne({ id: employeeId, isRemoved: true }).lean());
    if (!e) return null;
    const L = await lookups();
    const ck = e.onboardingChecklist || {};
    const meta = e.onboardingChecklistMeta || {};
    const g = onboardingGroup(e);
    const exit: any = e.isRemoved ? await ExitRecord.findOne({ employeeId: e.id }).sort({ _id: -1 }).lean().catch(() => null) : null;
    return {
        employee: { id: e.id, name: e.name },
        info: [
            ['Full Name', e.name || ''], ['Employee ID', e.id], ['Email', e.email || ''], ['Mobile Number', e.phone_no_ || e.phone || ''],
            ['Department', e.dept || ''], ['Designation', e.designation || ''], ['Role(s)', L.roles(e)], ['Assigned Campus', L.campus(e.location)],
            ['Reporting Manager / HOI', L.managers(e)], ['Joining Date', e.joiningDate || ''], ['Added to Portal', addedOn(e)], ['Employment Status', e.status || ''],
        ],
        form: [
            ['Full Name (as submitted)', e.full_name || ''], ['Date of Birth', e.date_of_birth || e.dateOfBirth || ''], ['Blood Group', e.blood_group || e.bloodGroup || ''],
            ["Father's / Mother's Name", e.father_name_or_mother_name || ''], ["Parent's Phone", e.parents_phone_no_ || ''],
            ['Permanent Address', e.permanent_address || ''], ['College / Institution', e.which_college_are_you_from_ || ''], ['From (IIT / NIT / Other)', e.you_are_from_ || ''],
            ["Bachelor's Qualification", e.bachelor_s_qualification || ''], ["Master's Qualification", e.master_s_qualification || ''],
            ['Current Designation at GOG', e.current_designation_at_gog || ''], ['LinkedIn', e.linkedin_id || ''], ['T-Shirt Size', e.t_shirt_size || ''],
        ],
        banking: [
            ['Account Holder Name', e.account_holder_name || e.bankAccountName || ''], ['Bank Name', e.bankName || ''],
            ['Account Number', maskTail(e.bank_account_number || e.accountNumber || e.bankAccountNumber)], ['IFSC Code', e.ifsc_code || e.ifscCode || ''],
            ['UPI ID', e.upi_id || e.upiId || ''], ['PAN Number', maskTail(e.panNumber)], ['Aadhaar Number', maskTail(e.aadhaarNumber)],
        ],
        checklist: CHECKLIST.map(c => ({
            item: c.label, status: ck[c.key] ? 'Verified' : 'Pending', mandatory: c.mandatory ? 'Yes' : 'No',
            by: meta[c.key]?.byName || '', at: dateTimeIST(meta[c.key]?.at),
            remarks: c.key === 'hrMeetingCompleted' ? (ck.hrMeetingScreenshot ? 'Meeting screenshot attached' : '') : '',
        })),
        documents: DOCUMENTS.map(d => ({
            name: d.label, type: d.type, upload: e[d.key] ? 'Uploaded' : 'Not uploaded',
            verification: !e[d.key] ? '' : d.check ? (ck[d.check] ? 'Verified' : 'Pending') : 'Not required',
            uploadedOn: e[d.key] ? ymdIST(e.onboardingSubmittedAt) : '',
        })),
        history: [
            ['Current Onboarding Status', GROUP_LABEL[g]], ['Form Submitted On', dateTimeIST(e.onboardingSubmittedAt)],
            ['Approval Status', g === 'APPROVED' ? 'Approved' : g === 'REMOVED' ? 'Removed from portal' : 'Not approved yet'],
            ['Approved By', e.onboardingApprovedByName || ''], ['Approval Date', dateTimeIST(e.onboardingApprovedAt)],
            ...(e.isRemoved ? [['Removed On', dateTimeIST(e.removedAt)] as KV, ['Removed By', e.removedByName || ''] as KV,
                ['Reason', exit ? [exit.leavingReason, exit.leavingReasonOther].filter(Boolean).join(' — ') : ''] as KV] : []),
            ['Checklist Progress', `${CHECKLIST.filter(c => ck[c.key]).length} of ${CHECKLIST.length} verified`],
            ['Additional HR Remarks', e.onboardingRemarks || ''],
        ],
        activity: (e.onboardingActivity || []).map((a: any) => ({ at: dateTimeIST(a.at), by: [a.byName, a.role ? `(${roleLabel(a.role)})` : ''].filter(Boolean).join(' '), action: a.action || '', note: a.note || '' })),
    };
}

/** Removed employees for the Onboarding Hub "Removed" tab (no personal / sensitive data) */
export async function removedEmployees() {
    const list: any[] = await Employee.find({ isRemoved: true }).select('id name email role designation dept location removedAt removedByName onboardingStatus').lean();
    const L = await lookups();
    return list.map(e => ({ id: e.id, name: e.name, email: e.email, role: e.role, designation: e.designation || '', dept: e.dept || '', campus: L.campus(e.location), removedAt: e.removedAt || '', removedByName: e.removedByName || '', isRemoved: true }));
}