/**
 * SERVER-ONLY: class record (lecture report) pipeline — Modules 6–20, 26, 27.
 *
 *   Professor submits ─▶ PENDING_OM ─OM verify─▶ PENDING_CL_CH ("pending final verification")
 *                                                   └─ ANY ONE of CL / CH / HOI ─final verify─▶ COMPLETED
 *                         │ OM revert              │ CL / CH / HOI revert (to Professor or to OM)
 *                         ▼                        ▼
 *                    OM_REVERTED            CL_CH_REVERTED / PENDING_OM
 *   (PENDING_HOI only exists on records CL/CH verified under the old flow; they are final-verified the same way.)
 *                         └──── professor corrects and re-submits ──▶ PENDING_OM
 *
 * A class record is a LectureReport document (existing model), linked to the sprint plan entry it came from.
 * Every role check is made here on the server, together with the college scope (Module 24).
 */
import { LectureReport, SprintPlan, Employee, JobRun, Attendance } from '@/models/Schemas';
import {
    getClassStatus, getPlanStatus, PROFESSOR_ROLES, CL_CH_ROLES, PROFESSOR_EDITABLE_CLASS_STATUSES,
    CLASS_STATUS_LABEL, DEFAULT_CLASS_STRENGTH, roleShort, OM_TIME_GRACE_MINUTES, NOTES_GROUP_TYPES, notesGroupLabel,
} from '@/lib/academic-status';
import {
    getAcademicScope, scopeAllowsProfessor, collegeRecipients, employeesByIds, notifySafe, nowISO, newId,
    hasClassEnded, dayCodeOf, collegeName, AcademicScope,
} from '@/lib/academic';

export type Actor = { id: string; name: string; role: string; employee?: any };
type Result = { ok: true; record: any; message: string } | { ok: false; status: number; error: string };
const fail = (status: number, error: string): Result => ({ ok: false, status, error });

const URL_RE = /^https?:\/\/\S+$/i;
const isUrl = (v: any) => typeof v === 'string' && URL_RE.test(v.trim());

function historyItem(actor: Actor, action: string, fromStatus: string, toStatus: string, comment?: string) {
    return { action, fromStatus, toStatus, by: actor.id, byName: actor.name, role: actor.role, at: nowISO(), comment: comment || '' };
}
/** Statuses in which CL / CH / HOI may do the final verification (PENDING_HOI = records CL/CH verified under the old flow) */
const FINAL_PENDING = ['PENDING_CL_CH', 'PENDING_HOI'];
const fmtIST = (iso?: string) => iso ? new Date(iso).toLocaleString('en-IN', { timeZone: process.env.ACADEMIC_TIMEZONE || 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }) : '';
const alreadyFinal = (rec: any) => {
    const f = rec?.finalVerification?.status === 'VERIFIED' ? rec.finalVerification : (rec?.hoiVerification?.status === 'VERIFIED' ? rec.hoiVerification : null);
    return f ? `Final verification was already done by ${roleShort(f.role)} (${f.byName}) on ${fmtIST(f.at)}.` : 'This class record is already completed.';
};
/**
 * Only ONE final step (verify or revert) can win for a given state of the record, even when CL, CH and HOI
 * click at the same moment: each attempt must first insert a unique key (unique index on JobRun.key).
 * The key changes whenever the record moves on (its history grows), so a later cycle can be verified again.
 */
async function claimFinalStep(record: any, actor: Actor, action: string): Promise<boolean> {
    await JobRun.init(); // make sure the unique index exists
    try {
        await JobRun.create({
            key: `final-step:${record._id}:${(record.pipelineHistory || []).length}`,
            job: 'class-final-verification', trigger: action, startedAt: nowISO(), finishedAt: nowISO(), status: 'DONE',
            result: { by: actor.id, byName: actor.name, role: actor.role },
        });
        return true;
    } catch (e: any) {
        if (e?.code === 11000) return false;
        throw e;
    }
}
const stamp = (actor: Actor, status: string, comment?: string) =>
    ({ status, by: actor.id, byName: actor.name, role: actor.role, at: nowISO(), comment: comment || '' });

// ─────────────────────────── sprint plan → classes ───────────────────────────
/** Classes of one day in plan order. Lecture number = position in that list (same rule as the existing pages). */
export function classesOfDay(plan: any, date: string) {
    const code = dayCodeOf(date);
    return (plan?.entries || []).filter((e: any) => e.date === date || (!e.date && e.day?.toUpperCase()?.startsWith(code)));
}

/** The submitted plan of a professor that covers a date (drafts are not classes yet) */
export async function planForDate(facultyId: string, date: string) {
    const plans = await SprintPlan.find({ facultyId, weekStartDate: { $lte: date }, weekEndDate: { $gte: date } }).sort({ updatedAt: -1 });
    return plans.find((p: any) => getPlanStatus(p) !== 'DRAFT') || null;
}

/** Entries as they were when the plan was last submitted (used while a plan is being revised) */
export function effectiveEntries(plan: any) {
    if (getPlanStatus(plan) === 'UNLOCKED_FOR_REVISION' && plan.revisions?.length) {
        return plan.revisions[plan.revisions.length - 1].entries || [];
    }
    return plan.entries || [];
}

async function findEntry(facultyId: string, date: string, lectureNumber?: number, sprintEntryId?: string) {
    const plan: any = await planForDate(facultyId, date);
    if (!plan) return { plan: null, entry: null, lectureNumber: lectureNumber || 0 };
    const list = classesOfDay(plan, date);
    let idx = sprintEntryId ? list.findIndex((e: any) => String(e._id) === String(sprintEntryId)) : -1;
    if (idx < 0 && lectureNumber) idx = lectureNumber - 1;
    const entry = idx >= 0 ? list[idx] : null;
    return { plan, entry, lectureNumber: idx >= 0 ? idx + 1 : (lectureNumber || 0) };
}

function entryFields(entry: any, plan: any) {
    if (!entry) return {};
    return {
        sprintPlanId: String(plan?._id || ''),
        sprintEntryId: String(entry._id || ''),
        courseName: entry.subjectName || 'Subject',
        subjectCode: entry.subjectCode || '',
        topicsCovered: entry.topics || '',
        stream: entry.stream || '', year: entry.year || '', semester: entry.semester || '',
        section: entry.section || '', className: entry.className || '',
        lectureType: entry.lectureType || '', unitNumber: entry.unitNumber || '',
        timeStart: entry.timeStart, timeStop: entry.timeStop,
    };
}

/** Existing record of a class, or a new placeholder (PENDING_PROFESSOR) linked to the plan entry */
export async function ensureRecordForClass(facultyId: string, date: string, lectureNumber?: number, sprintEntryId?: string) {
    const found = await findEntry(facultyId, date, lectureNumber, sprintEntryId);
    const num = found.lectureNumber || lectureNumber;
    if (!num) return null;
    let record: any = null;
    if (found.entry?._id) record = await LectureReport.findOne({ facultyId, date, sprintEntryId: String(found.entry._id) });
    if (!record) record = await LectureReport.findOne({ facultyId, date, lectureNumber: num });
    if (record) return record;
    if (!found.entry) return null;
    const prof: any = await Employee.findOne({ id: facultyId }).lean();
    if (!prof) return null;
    record = await LectureReport.create({
        facultyId, facultyName: prof.name, college: prof.location || 'Not assigned', date, lectureNumber: num,
        ...entryFields(found.entry, found.plan),
        scheduledDuration: 0, status: 'Scheduled', pipelineStatus: 'PENDING_PROFESSOR',
        pipelineHistory: [],
    });
    return record;
}

// ─────────────────────────── access ───────────────────────────
async function scopeFor(actor: Actor): Promise<AcademicScope> { return getAcademicScope(actor); }

/** May this actor see / act on this professor's records (college scope)? */
export async function recordInScope(actor: Actor, record: any) {
    if (record.facultyId === actor.id) return true;
    if (PROFESSOR_ROLES.includes(actor.role)) return false;
    const scope = await scopeFor(actor);
    if (scope.orgWide) return true;
    const prof: any = await Employee.findOne({ id: record.facultyId }).select('location').lean();
    return scopeAllowsProfessor(scope, record.facultyId, prof?.location || record.college);
}

async function classLabel(r: any) {
    return [
        { label: 'Professor', value: r.facultyName },
        { label: 'College', value: await collegeName(r.college) },
        { label: 'Subject', value: r.courseName },
        { label: 'Class / Section', value: [r.className || r.stream, r.section].filter(Boolean).join(' / ') },
        { label: 'Date / Time', value: `${r.date} ${r.timeStart || r.classStartTime || ''}${r.timeStop ? ' – ' + r.timeStop : ''}` },
        { label: 'Topic', value: r.topicsCovered },
    ];
}
const shortClass = (r: any) => `${r.courseName} · ${r.date}${r.timeStart ? ' ' + r.timeStart : ''}${r.section ? ' · Sec ' + r.section : ''}`;

/**
 * OM entry / exit details from the request merged with what is already saved. The professor's own submitted
 * times (classStartTime / classEndTime) are never touched. Delay = actual start (or entry) − scheduled start.
 */
function omCheckFrom(record: any, input: any, actor: Actor): { error: string } | { set: any; entry: string; exit: string; summary: string } {
    const prev = record.omCheck?.toObject ? record.omCheck.toObject() : (record.omCheck || {});
    const pick = (k: string, legacy?: string) => (input[k] !== undefined ? String(input[k] || '').trim() : String(prev[k] || (legacy ? record[legacy] : '') || ''));
    // Professor's entry / exit time as seen by the OM
    const entry = input.actualInTime !== undefined ? String(input.actualInTime || '').trim() : pick('entryTime', 'actualInTime');
    const exit = input.actualOutTime !== undefined ? String(input.actualOutTime || '').trim() : pick('exitTime', 'actualOutTime');
    for (const [label, v] of [['Entry time', entry], ['Exit time', exit]] as [string, string][]) {
        if (v && !TIME_RE.test(v)) return { error: `${label} must be HH:MM.` };
    }
    const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
    if (entry && exit && toMin(exit) <= toMin(entry)) return { error: 'Exit time must be after entry time.' };
    const scheduledStart = record.timeStart || record.classStartTime || '';
    const scheduledEnd = record.timeStop || record.classEndTime || '';
    // Late entry / early exit against the scheduled time; more than the grace minutes needs a reason
    const lateMin = scheduledStart && entry && TIME_RE.test(scheduledStart) ? Math.max(0, toMin(entry) - toMin(scheduledStart)) : 0;
    const earlyMin = scheduledEnd && exit && TIME_RE.test(scheduledEnd) ? Math.max(0, toMin(scheduledEnd) - toMin(exit)) : 0;
    const isDelayed = lateMin > OM_TIME_GRACE_MINUTES;
    const isEarlyExit = earlyMin > OM_TIME_GRACE_MINUTES;
    const delayReason = !isDelayed ? '' : input.delayReason !== undefined ? String(input.delayReason || '').trim() : input.remarksWhyLate !== undefined ? String(input.remarksWhyLate || '').trim() : String(prev.delayReason || record.remarksWhyLate || '');
    const earlyExitReason = !isEarlyExit ? '' : input.earlyExitReason !== undefined ? String(input.earlyExitReason || '').trim() : String(prev.earlyExitReason || '');
    if (isDelayed && delayReason.length < 3) return { error: `The professor entered ${lateMin} min late. Select the reason for the late entry.` };
    if (isEarlyExit && earlyExitReason.length < 3) return { error: `The professor left ${earlyMin} min early. Select the reason for the early exit.` };
    const remarks = input.omRemarks !== undefined ? String(input.omRemarks || '').trim() : String(prev.remarks || '');
    const now = nowISO();
    const set: any = {
        'omCheck.entryTime': entry, 'omCheck.exitTime': exit,
        'omCheck.scheduledStart': scheduledStart, 'omCheck.scheduledEnd': scheduledEnd,
        'omCheck.delayMinutes': lateMin, 'omCheck.isDelayed': isDelayed, 'omCheck.delayReason': delayReason,
        'omCheck.earlyExitMinutes': earlyMin, 'omCheck.isEarlyExit': isEarlyExit, 'omCheck.earlyExitReason': earlyExitReason,
        'omCheck.remarks': remarks,
        'omCheck.by': actor.id, 'omCheck.byName': actor.name, 'omCheck.at': now,
        // existing fields used by Daily Lecture Timings and the reports (OM-entered, not the professor's)
        actualInTime: entry, actualOutTime: exit, isLate: isDelayed, remarksWhyLate: delayReason,
        omTimesUpdatedBy: actor.id, omTimesUpdatedByName: actor.name, omTimesUpdatedAt: now,
    };
    const summary = `Professor entry/exit recorded (${entry || '—'} / ${exit || '—'})`
        + (isDelayed ? ` · late ${lateMin} min: ${delayReason}` : '')
        + (isEarlyExit ? ` · left ${earlyMin} min early: ${earlyExitReason}` : '');
    return { set, entry, exit, summary };
}

async function omsOf(record: any) {
    const prof: any = await Employee.findOne({ id: record.facultyId }).select('location').lean();
    return collegeRecipients(prof?.location || record.college, ['OM'], record.facultyId);
}
async function professorOf(record: any) {
    const [p] = await employeesByIds([record.facultyId]);
    return p ? [p] : [];
}

// ─────────────────────────── professor: submit / re-submit ───────────────────────────
export type SubmitInput = {
    date: string; lectureNumber?: number; sprintEntryId?: string;
    numberOfAttendees: any; totalStudents?: any;
    notesUrl?: string; notesFileUrl?: string; notesContent?: string;
    notesMissing?: boolean; notesMissingReason?: string;
    isNotesSharedWithStudents?: boolean; notesNotSharedRemarks?: string;
    assignmentUrl?: string; assignmentTitle?: string; assignmentDescription?: string; assignmentDeadline?: string;
    hasAssignment?: boolean; studentsCompletedCount?: any; totalStudentsExpected?: any;
    snapshotUrls?: string[]; classPhotoUrl?: string; classPhotoLat?: number; classPhotoLng?: number;
    recordingUrl?: string; recordingDurationSeconds?: number;
    issuesFaced?: string; reasonForLessAttendance?: string; topicsCovered?: string;
};

/** Class strength already stored for this class (latest record of the same class), else the default */
export async function classStrength(facultyId: string, entry: any) {
    if (!entry) return DEFAULT_CLASS_STRENGTH;
    const q: any = { facultyId, totalStudents: { $gt: 0 }, courseName: entry.subjectName };
    if (entry.section) q.section = entry.section;
    if (entry.className) q.className = entry.className;
    const last: any = await LectureReport.findOne(q).sort({ date: -1 }).select('totalStudents').lean();
    return last?.totalStudents || DEFAULT_CLASS_STRENGTH;
}

export async function submitClassRecord(actor: Actor, input: SubmitInput): Promise<Result> {
    if (!PROFESSOR_ROLES.includes(actor.role)) return fail(403, 'Only the professor can submit a class record.');
    const { date } = input;
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return fail(400, 'A valid class date is required.');

    const { plan, entry, lectureNumber } = await findEntry(actor.id, date, Number(input.lectureNumber) || undefined, input.sprintEntryId);
    if (!plan || !entry) return fail(404, 'This class is not in your submitted sprint plan for that date.');
    if (!hasClassEnded(date, entry.timeStop)) return fail(400, `You can complete the class record after the class ends (${entry.timeStop}).`);

    // Attendance (Module 7)
    const strength = await classStrength(actor.id, entry);
    const total = input.totalStudents === undefined || input.totalStudents === '' || input.totalStudents === null ? strength : Number(input.totalStudents);
    const present = Number(input.numberOfAttendees);
    if (!Number.isInteger(total) || total < 1 || total > 1000) return fail(400, 'Total students must be a whole number between 1 and 1000.');
    if (input.numberOfAttendees === '' || input.numberOfAttendees === undefined || !Number.isInteger(present) || present < 0 || present > total) {
        return fail(400, `Students present must be a whole number from 0 to ${total}.`);
    }

    // Notes (Module 8): an uploaded document or a link — otherwise a reason is mandatory
    const notesUrl = String(input.notesUrl || '').trim();
    const notesFileUrl = String(input.notesFileUrl || '').trim();
    if (notesUrl && !isUrl(notesUrl)) return fail(400, 'The notes link must start with http:// or https://');
    if (notesFileUrl && !isUrl(notesFileUrl)) return fail(400, 'The uploaded notes file has an invalid address.');
    const hasNotes = !!(notesUrl || notesFileUrl);
    const notesMissing = !hasNotes;
    const reason = String(input.notesMissingReason || '').trim();
    if (notesMissing && !input.notesMissing) return fail(400, 'Upload the notes or add a notes link. If you cannot, choose "Unable to Submit Notes" and give the reason.');
    if (notesMissing && reason.length < 10) return fail(400, 'Please explain why the notes could not be submitted (at least 10 characters).');

    // Optional assignment + snapshots (Module 10)
    const assignmentUrl = String(input.assignmentUrl || '').trim();
    if (assignmentUrl && !isUrl(assignmentUrl)) return fail(400, 'The assignment link must start with http:// or https://');
    const snapshots = (Array.isArray(input.snapshotUrls) ? input.snapshotUrls : []).concat(input.classPhotoUrl ? [input.classPhotoUrl] : [])
        .map(s => String(s).trim()).filter(Boolean);
    if (snapshots.some(s => !isUrl(s))) return fail(400, 'Snapshot links must start with http:// or https://');

    let record: any = await ensureRecordForClass(actor.id, date, lectureNumber, String(entry._id));
    if (!record) return fail(404, 'Class not found.');
    const before = getClassStatus(record);
    const legacy = !record.pipelineStatus && record.status === 'Completed';
    if (!PROFESSOR_EDITABLE_CLASS_STATUSES.includes(before) && !legacy) {
        return fail(409, `This class record is already submitted (${CLASS_STATUS_LABEL[before]}). It can be changed only if it is reverted to you.`);
    }
    // Class snapshots are compulsory (a new upload, or the ones already on this record when re-submitting)
    if (!snapshots.length && !(record.snapshotUrls || []).length && !record.classPhotoUrl) {
        return fail(400, 'Upload at least one class snapshot (photo of the class) before submitting.');
    }

    const now = nowISO();
    const isResubmit = (record.submissionCount || 0) > 0 || legacy;
    const hasAssignment = !!(assignmentUrl || input.hasAssignment && (input.assignmentTitle || input.assignmentDescription));
    const existingAssignment = record.assignment?.toObject ? record.assignment.toObject() : (record.assignment || {});

    const set: any = {
        ...entryFields(entry, plan),
        facultyName: actor.name,
        college: actor.employee?.location || record.college || 'Not assigned',
        lectureNumber,
        topicsCovered: input.topicsCovered || entry.topics || record.topicsCovered,
        scheduledDuration: entry.timeStart && entry.timeStop ? (() => { const [a, b] = entry.timeStart.split(':').map(Number); const [c, d] = entry.timeStop.split(':').map(Number); return (c * 60 + d) - (a * 60 + b); })() : record.scheduledDuration,
        classStartTime: entry.timeStart, classEndTime: entry.timeStop,
        numberOfAttendees: present, totalStudents: total,
        issuesFaced: input.issuesFaced || '',
        reasonForLessAttendance: input.reasonForLessAttendance || '',
        snapshotUrls: snapshots.length ? snapshots : (record.snapshotUrls || []),
        classPhotoUrl: input.classPhotoUrl || snapshots[0] || record.classPhotoUrl,
        classPhotoLat: input.classPhotoLat ?? record.classPhotoLat,
        classPhotoLng: input.classPhotoLng ?? record.classPhotoLng,
        recordingUrl: input.recordingUrl || record.recordingUrl,
        recordingDurationSeconds: input.recordingDurationSeconds || record.recordingDurationSeconds,
        actualDurationMinutes: Math.round(((input.recordingDurationSeconds || record.recordingDurationSeconds || 0) as number) / 60),
        lectureNotes: {
            notesUrl: notesFileUrl || notesUrl,
            notesContent: [notesFileUrl && notesUrl ? `Link: ${notesUrl}` : '', input.notesContent || ''].filter(Boolean).join('\n'),
            isSharedWithStudents: Boolean(input.isNotesSharedWithStudents) && hasNotes,
            sharedWithStudentsTickedBy: actor.name,
            notSharedRemarks: input.notesNotSharedRemarks || '',
            verificationStatus: 'Pending',
        },
        notesMissing,
        notesMissingReason: notesMissing ? reason : '',
        notesReasonStatus: notesMissing ? 'PENDING' : undefined,
        notesReasonReviewedBy: '', notesReasonReviewedByName: '', notesReasonReviewedAt: '', notesReasonComment: '',
        assignment: hasAssignment ? {
            hasAssignment: true,
            title: input.assignmentTitle || existingAssignment.title || 'Assignment',
            description: input.assignmentDescription || existingAssignment.description || '',
            assignmentUrl: assignmentUrl || existingAssignment.assignmentUrl || '',
            deadline: input.assignmentDeadline || existingAssignment.deadline || '',
            studentsCompletedCount: parseInt(input.studentsCompletedCount) || 0,
            totalStudentsExpected: parseInt(input.totalStudentsExpected) || total,
            verificationStatus: 'Pending', isSharedInProfGroup: false,
            addedAt: existingAssignment.addedAt || now, addedBy: actor.id, addedByName: actor.name, addedLater: !!existingAssignment.addedLater,
        } : (existingAssignment.hasAssignment ? existingAssignment : { hasAssignment: false, verificationStatus: 'Approved', isSharedInProfGroup: false }),
        status: 'Completed',
        clVerificationStatus: 'Pending',
        auditStatus: 'Pending',
        pipelineStatus: 'PENDING_OM',
        submittedAt: now,
        omVerification: { status: 'PENDING' },
        clChVerification: { status: 'PENDING' },
        hoiVerification: { status: 'PENDING' },
    };
    const unset: any = {};
    if (!notesMissing) { delete set.notesReasonStatus; unset.notesReasonStatus = ''; }

    const push: any = {
        pipelineHistory: {
            $each: [
                historyItem(actor, isResubmit ? 'Re-submitted by Professor' : 'Submitted by Professor', before, 'SUBMITTED',
                    notesMissing ? `Notes not submitted — reason: ${reason}` : `Attendance ${present}/${total}`),
                { ...historyItem(actor, 'Sent to OM', 'SUBMITTED', 'PENDING_OM'), comment: '' },
            ],
        },
    };

    // Notes provided now → close open "notes pending" flags, keeping them as history
    const updateOps: any = { $set: set, $push: push, $inc: { submissionCount: 1 } };
    if (Object.keys(unset).length) updateOps.$unset = unset;
    let updated: any = await LectureReport.findOneAndUpdate(
        { _id: record._id, $or: [{ pipelineStatus: { $in: PROFESSOR_EDITABLE_CLASS_STATUSES } }, { pipelineStatus: { $exists: false } }] },
        updateOps, { new: true }
    );
    if (!updated) return fail(409, 'The class record was changed meanwhile. Refresh and try again.');
    if (hasNotes && (updated.delayFlags || []).some((f: any) => f.status === 'OPEN')) {
        await resolveOpenFlags(updated, actor, 'Notes submitted with the class record');
        updated = await LectureReport.findById(updated._id);
    }

    // Notifications: missing-notes reason → OM (email); every (re)submission → OM in-app
    const oms = await omsOf(updated);
    if (notesMissing) {
        await notifySafe({
            recipients: oms,
            title: `Missing Notes Reason — ${updated.facultyName}`,
            message: `${updated.facultyName} submitted the class record without notes and gave a reason. Please verify or revert the reason.`,
            type: 'CLASS_NOTES_REASON_SUBMITTED',
            link: `/academic/verification?record=${updated._id}`,
            entityType: 'LectureReport', entityId: String(updated._id), college: updated.college, actor,
            rows: [...(await classLabel(updated)), { label: 'Notes Status', value: 'Not submitted' }, { label: 'Reason', value: reason }],
        });
    } else {
        await notifySafe({
            recipients: oms, email: false,
            title: `Class record ${isResubmit ? 're-submitted' : 'submitted'} — ${updated.facultyName}`,
            message: `${shortClass(updated)} is waiting for OM verification.`,
            type: 'CLASS_SUBMITTED', link: `/academic/verification?record=${updated._id}`,
            entityType: 'LectureReport', entityId: String(updated._id), college: updated.college, actor,
        });
    }
    return { ok: true, record: updated, message: isResubmit ? 'Class record re-submitted for OM verification.' : 'Class record submitted. It now goes to OM for verification.' };
}

async function resolveOpenFlags(record: any, actor: Actor, note: string) {
    const open = (record.delayFlags || []).filter((f: any) => f.status === 'OPEN');
    if (!open.length) return;
    const set: any = {};
    record.delayFlags.forEach((f: any, i: number) => {
        if (f.status !== 'OPEN') return;
        set[`delayFlags.${i}.status`] = 'RESOLVED';
        set[`delayFlags.${i}.resolvedBy`] = actor.id;
        set[`delayFlags.${i}.resolvedByName`] = actor.name;
        set[`delayFlags.${i}.resolvedAt`] = nowISO();
        set[`delayFlags.${i}.resolutionNote`] = note;
    });
    await LectureReport.updateOne({ _id: record._id }, { $set: set, $push: { pipelineHistory: historyItem(actor, `Notes-pending flag resolved (${open.length})`, getClassStatus(record), getClassStatus(record), note) } });
}

// ─────────────────────────── review actions ───────────────────────────
export type ActionInput = {
    action: string; comment?: string; revertTo?: string; value?: boolean;
    actualInTime?: string; actualOutTime?: string; isLate?: boolean; remarksWhyLate?: string;
    flagId?: string; title?: string; assignmentUrl?: string; description?: string; deadline?: string; notesUrl?: string;
};

const TIME_RE = /^([01]?\d|2[0-3]):[0-5]\d$/;

export async function performClassAction(actor: Actor, record: any, input: ActionInput): Promise<Result> {
    if (PROFESSOR_ROLES.includes(actor.role) && record.facultyId !== actor.id) return fail(403, 'You can only change your own class records.');
    if (!(await recordInScope(actor, record))) return fail(403, 'This class is not in your college.');
    const status = getClassStatus(record);
    const comment = String(input.comment || '').trim();
    const isOwner = record.facultyId === actor.id && PROFESSOR_ROLES.includes(actor.role);
    const isOM = actor.role === 'OM';
    const isClCh = CL_CH_ROLES.includes(actor.role);
    const isHOI = actor.role === 'HOI';
    // AD: organisation-wide academic authority — same final-stage actions as HOI and CL/CH
    const isAD = actor.role === 'AD';
    const id = record._id;
    // Older-flow records have no pipelineStatus (status "Completed" ⇒ PENDING_OM, see getClassStatus) — match them too
    const atomic = async (from: string[], ops: any) => LectureReport.findOneAndUpdate({
        _id: id,
        $or: [{ pipelineStatus: { $in: from } }, ...(from.includes('PENDING_OM') ? [{ pipelineStatus: { $exists: false }, status: 'Completed' }] : [])],
    }, ops, { new: true });
    const changed = () => fail(409, 'The record was changed by someone else. Refresh and try again.');

    switch (input.action) {
        // ── OM: missing-notes reason (Module 9) ──
        case 'om_verify_reason': {
            if (!isOM) return fail(403, 'Only the OM can verify the missing-notes reason.');
            if (status !== 'PENDING_OM' || !record.notesMissing || record.notesReasonStatus !== 'PENDING') return fail(409, 'There is no missing-notes reason waiting for verification.');
            const r = await atomic(['PENDING_OM'], {
                $set: { notesReasonStatus: 'VERIFIED', notesReasonReviewedBy: actor.id, notesReasonReviewedByName: actor.name, notesReasonReviewedAt: nowISO(), notesReasonComment: comment },
                $push: { pipelineHistory: historyItem(actor, 'Missing-notes reason verified by OM', status, status, comment) },
            });
            return r ? { ok: true, record: r, message: 'Reason verified. You can now verify the class record.' } : changed();
        }
        case 'om_revert': {
            if (!isOM) return fail(403, 'Only the OM can revert at this stage.');
            if (status !== 'PENDING_OM') return fail(409, `This record is not waiting for OM (${CLASS_STATUS_LABEL[status]}).`);
            if (comment.length < 5) return fail(400, 'Please write what the professor must correct (at least 5 characters).');
            const reasonReverted = record.notesMissing && record.notesReasonStatus === 'PENDING';
            const set: any = { pipelineStatus: 'OM_REVERTED', omVerification: stamp(actor, 'REVERTED', comment) };
            if (reasonReverted) Object.assign(set, { notesReasonStatus: 'REVERTED', notesReasonReviewedBy: actor.id, notesReasonReviewedByName: actor.name, notesReasonReviewedAt: nowISO(), notesReasonComment: comment });
            const r = await atomic(['PENDING_OM'], { $set: set, $push: { pipelineHistory: historyItem(actor, reasonReverted ? 'Missing-notes reason reverted by OM' : 'Reverted by OM', status, 'OM_REVERTED', comment) } });
            if (!r) return changed();
            await notifySafe({
                recipients: await professorOf(r),
                title: 'Class Record Reverted by OM',
                message: `${actor.name} (OM) reverted your class record. Please correct it and re-submit.`,
                type: 'CLASS_OM_REVERTED', link: `/faculty/lectures?date=${r.date}`,
                entityType: 'LectureReport', entityId: String(r._id), college: r.college, actor,
                rows: [...(await classLabel(r)), { label: 'OM Comment', value: comment }],
            });
            return { ok: true, record: r, message: 'Record returned to the professor.' };
        }
        case 'om_verify': {
            if (!isOM) return fail(403, 'Only the OM can verify at this stage.');
            if (status !== 'PENDING_OM') return fail(409, `This record is not waiting for OM (${CLASS_STATUS_LABEL[status]}).`);
            if (record.notesMissing && record.notesReasonStatus !== 'VERIFIED') return fail(409, 'Verify the missing-notes reason first (or revert it).');
            // Notes must be shared to the students' group before forwarding (not needed when notes were not submitted — reason verified)
            // read the raw stored value too (works even if the running server still has an older LectureReport schema)
            const groupType = record.submittedToGroupType || (record.toObject ? record.toObject() : record).submittedToGroupType || '';
            if (!record.notesMissing && (!record.submittedToGroup || !groupType)) return fail(409, 'Tick "Notes Submitted to Groups" and choose the group (Telegram / WhatsApp) before forwarding.');
            // Verify & Forward: the entry / exit details may come with this request; both times are required
            const c = omCheckFrom(record, input, actor);
            if ('error' in c) return fail(400, c.error);
            if (!c.entry || !c.exit) return fail(400, 'Record the professor\'s entry and exit time before verifying.');
            const r = await atomic(['PENDING_OM'], {
                $set: { ...c.set, pipelineStatus: 'PENDING_CL_CH', omVerification: stamp(actor, 'VERIFIED', comment || c.set['omCheck.remarks'] || ''), clChVerification: { status: 'PENDING' }, hoiVerification: { status: 'PENDING' }, finalVerification: { status: 'PENDING' } },
                $push: { pipelineHistory: { $each: [historyItem(actor, 'Verified by OM', status, 'OM_VERIFIED', comment), { ...historyItem(actor, 'Sent for final verification (CL / CH / HOI)', 'OM_VERIFIED', 'PENDING_CL_CH'), comment: '' }] } },
            });
            if (!r) return changed();
            const prof: any = await Employee.findOne({ id: r.facultyId }).select('location').lean();
            await notifySafe({
                recipients: await collegeRecipients(prof?.location || r.college, ['CURRICULUM_LEAD', 'CURRICULUM_HEAD', 'HOI'], r.facultyId),
                title: `Class Record Ready for Final Verification — ${r.facultyName}`,
                message: `${actor.name} (OM) verified this class record. Any one of CL, CH or HOI can now do the final verification.`,
                type: 'CLASS_OM_VERIFIED', link: `/academic/verification?record=${r._id}`,
                entityType: 'LectureReport', entityId: String(r._id), college: r.college, actor,
                rows: [...(await classLabel(r)), { label: 'Attendance', value: `${r.numberOfAttendees}/${r.totalStudents}` },
                { label: 'Notes', value: r.notesMissing ? `Not submitted (reason verified): ${r.notesMissingReason}` : 'Submitted' },
                { label: 'Submitted to Groups', value: r.submittedToGroup ? `Yes — ${notesGroupLabel(r.submittedToGroupType) || 'group'}` : 'No' },
                { label: 'Professor Entry / Exit', value: `${r.omCheck?.entryTime || r.actualInTime || '—'} / ${r.omCheck?.exitTime || r.actualOutTime || '—'}` },
                { label: 'Late Entry', value: r.omCheck?.isDelayed ? `${r.omCheck.delayMinutes} min — ${r.omCheck.delayReason || 'no reason given'}` : 'On time' },
                { label: 'Early Exit', value: r.omCheck?.isEarlyExit ? `${r.omCheck.earlyExitMinutes} min — ${r.omCheck.earlyExitReason || 'no reason given'}` : 'No' },
                { label: 'OM Comment', value: comment || r.omCheck?.remarks || '' }],
            });
            return { ok: true, record: r, message: 'Verified. Sent for final verification (CL / CH / HOI).' };
        }
        // ── OM: submitted to groups (Module 12) ──
        case 'submitted_to_group': {
            if (!isOM) return fail(403, 'Only the OM can mark "Submitted to Groups".');
            if (status === 'PENDING_PROFESSOR') return fail(409, 'The professor has not submitted this class record yet.');
            const value = input.value !== false;
            const groupType = value ? String((input as any).groupType || '').toUpperCase() : '';
            if (value && !NOTES_GROUP_TYPES.some(g => g.value === groupType)) return fail(400, 'Choose where the notes were shared: Telegram Group or WhatsApp Group.');
            const r = await LectureReport.findOneAndUpdate({ _id: id }, {
                // also the existing "notes shared" tick used by Daily Lecture Timings
                $set: {
                    submittedToGroup: value, submittedToGroupType: groupType, submittedToGroupBy: actor.id, submittedToGroupByName: actor.name, submittedToGroupAt: nowISO(),
                    'lectureNotes.isSharedWithStudents': value, 'lectureNotes.sharedWithStudentsTickedBy': actor.name,
                },
                $push: { pipelineHistory: historyItem(actor, value ? `Notes submitted to groups (${notesGroupLabel(groupType)})` : 'Unmarked "Submitted to Groups"', status, status) },
            }, { new: true, strict: false });
            return { ok: true, record: r, message: value ? `Notes marked as submitted to ${notesGroupLabel(groupType)}.` : 'Unmarked.' };
        }
        // ── OM: entry / exit time, actual start / end, delay (Module 13) ──
        case 'om_times': {
            if (!isOM) return fail(403, 'Only the OM can record entry / exit times.');
            if (status === 'COMPLETED') return fail(409, 'This class record is already completed.');
            const c = omCheckFrom(record, input, actor);
            if ('error' in c) return fail(400, c.error);
            const r = await LectureReport.findOneAndUpdate({ _id: id }, { $set: c.set, $push: { pipelineHistory: historyItem(actor, c.summary, status, status, c.set['omCheck.remarks'] || '') } }, { new: true });
            return { ok: true, record: r, message: 'Entry / exit details saved.' };
        }

        // ── Final verification: ANY ONE of CL / CH / HOI (whoever acts first) ──
        // 'clch_verify' and 'hoi_verify' are kept as aliases so the existing pages/APIs keep working.
        case 'final_verify':
        case 'clch_verify':
        case 'hoi_verify': {
            if (!isClCh && !isHOI && !isAD) return fail(403, 'Only CL, CH, HOI or AD can do the final verification.');
            if (status === 'COMPLETED') return fail(409, alreadyFinal(record));
            if (!FINAL_PENDING.includes(status)) return fail(409, `This record is not waiting for final verification (${CLASS_STATUS_LABEL[status]}).`);
            if (record.omVerification?.status !== 'VERIFIED') return fail(409, 'OM verification must be complete first.');
            const now = nowISO();
            const who = roleShort(actor.role);
            const reference = [record.sprintEntryId || record.sprintPlanId || '', record.date, record.lectureNumber ? `Lecture ${record.lectureNumber}` : '', record.subjectName || record.subject || ''].filter(Boolean).join(' · ');
            const set: any = {
                pipelineStatus: 'COMPLETED', auditStatus: 'Approved',
                finalVerification: { ...stamp(actor, 'VERIFIED', comment), reference },
                // keep the existing CL / notes / assignment fields in step for the existing pages
                clVerificationStatus: 'Verified', clRemarks: comment || `Final verification by ${who} ${actor.name}`,
                'lectureNotes.verificationStatus': record.notesMissing ? 'Pending' : 'Approved',
                'lectureNotes.verifiedBy': actor.id, 'lectureNotes.verifiedByName': actor.name, 'lectureNotes.verifiedAt': now,
            };
            if (isAD) {
                // AD's verification is the final one; the HOI and CL/CH steps are no longer needed
                if (record.clChVerification?.status !== 'VERIFIED') set.clChVerification = { status: 'NOT_REQUIRED' };
                if (record.hoiVerification?.status !== 'VERIFIED') set.hoiVerification = { status: 'NOT_REQUIRED' };
            } else if (isHOI) {
                set.hoiVerification = stamp(actor, 'VERIFIED', comment);
                // a legacy record already verified by CL/CH keeps that stamp; otherwise CL/CH is no longer needed
                if (record.clChVerification?.status !== 'VERIFIED') set.clChVerification = { status: 'NOT_REQUIRED' };
            } else {
                set.clChVerification = stamp(actor, 'VERIFIED', comment);
                set.hoiVerification = { status: 'NOT_REQUIRED' };
            }
            if (record.assignment?.hasAssignment) Object.assign(set, { 'assignment.verificationStatus': 'Approved', 'assignment.verifiedBy': actor.id, 'assignment.verifiedByName': actor.name, 'assignment.verifiedAt': now });
            // Only one of CL / CH / HOI can move it from "pending final" to COMPLETED (unique claim + conditional update)
            if (!(await claimFinalStep(record, actor, 'final_verify'))) {
                const fresh: any = await LectureReport.findById(id).lean();
                return fresh && getClassStatus(fresh) === 'COMPLETED' ? fail(409, alreadyFinal(fresh)) : changed();
            }
            const r = await atomic(FINAL_PENDING, {
                $set: set,
                $push: { pipelineHistory: historyItem(actor, `Final verification by ${who} (${actor.name}) — Completed`, status, 'COMPLETED', comment) },
            });
            if (!r) {
                const fresh: any = await LectureReport.findById(id).lean();
                return fresh && getClassStatus(fresh) === 'COMPLETED' ? fail(409, alreadyFinal(fresh)) : changed();
            }
            await notifySafe({
                recipients: await professorOf(r),
                title: 'Class Record Verified — Completed',
                message: `Final verification done by ${who} (${actor.name}). Your class record is completed.`,
                type: 'CLASS_COMPLETED', link: `/faculty/lectures?date=${r.date}`,
                entityType: 'LectureReport', entityId: String(r._id), college: r.college, actor,
                rows: [...(await classLabel(r)), { label: 'Final Verification', value: `${who} — ${actor.name}` }, { label: 'Comment', value: comment }],
            });
            // The other final verifiers are told in-app that nothing is pending for them any more
            const prof: any = await Employee.findOne({ id: r.facultyId }).select('location').lean();
            const others = (await collegeRecipients(prof?.location || r.college, ['CURRICULUM_LEAD', 'CURRICULUM_HEAD', 'HOI'], r.facultyId)).filter((e: any) => e.id !== actor.id);
            await notifySafe({
                recipients: [...others, ...(await omsOf(r))], email: false,
                title: `Final verification done by ${who} — ${r.facultyName}`,
                message: `${shortClass(r)} was final-verified by ${who} (${actor.name}). No further action is needed.`,
                type: 'CLASS_FINAL_VERIFIED_INFO', link: `/academic/verification?record=${r._id}`,
                entityType: 'LectureReport', entityId: String(r._id), college: r.college, actor,
            });
            return { ok: true, record: r, message: `Final verification done by ${who}. Status: Completed.` };
        }
        // Revert at the final stage (CL / CH / HOI) → back to the professor or to the OM
        case 'final_revert':
        case 'clch_revert':
        case 'hoi_revert': {
            if (!isClCh && !isHOI && !isAD) return fail(403, 'Only CL, CH, HOI or AD can revert at this stage.');
            if (status === 'COMPLETED') return fail(409, alreadyFinal(record));
            if (!FINAL_PENDING.includes(status)) return fail(409, `This record is not waiting for final verification (${CLASS_STATUS_LABEL[status]}).`);
            if (comment.length < 5) return fail(400, 'Please write what must be corrected (at least 5 characters).');
            const who = roleShort(actor.role);
            const toOM = String(input.revertTo || '').toUpperCase() === 'OM';
            const to = toOM ? 'PENDING_OM' : 'CL_CH_REVERTED';
            const revertStamp = { ...stamp(actor, 'REVERTED', comment), revertTo: toOM ? 'OM' : 'PROFESSOR' };
            const set: any = { pipelineStatus: to, finalVerification: revertStamp, clVerificationStatus: 'Needs Revision', clRemarks: comment, auditStatus: 'Flagged' };
            if (isAD) { set.clChVerification = { status: 'PENDING' }; set.hoiVerification = { status: 'PENDING' }; }
            else if (isHOI) { set.hoiVerification = stamp(actor, 'REVERTED', comment); set.clChVerification = { status: 'PENDING' }; }
            else { set.clChVerification = revertStamp; set.hoiVerification = { status: 'PENDING' }; }
            if (toOM) set.omVerification = { status: 'PENDING' };
            if (!(await claimFinalStep(record, actor, 'final_revert'))) {
                const fresh: any = await LectureReport.findById(id).lean();
                return fresh && getClassStatus(fresh) === 'COMPLETED' ? fail(409, alreadyFinal(fresh)) : changed();
            }
            const r = await atomic(FINAL_PENDING, {
                $set: set,
                $push: { pipelineHistory: historyItem(actor, `Reverted by ${who} to ${toOM ? 'OM' : 'Professor'}`, status, to, comment) },
            });
            if (!r) return changed();
            const oms = await omsOf(r);
            const prof = await professorOf(r);
            await notifySafe({
                recipients: toOM ? oms : prof,
                title: `Class Record Reverted by ${who}`,
                message: toOM
                    ? `${actor.name} (${who}) sent this class record back to OM for correction.`
                    : `${actor.name} (${who}) reverted your class record. Please correct it and re-submit.`,
                type: 'CLASS_CLCH_REVERTED', link: toOM ? `/academic/verification?record=${r._id}` : `/faculty/lectures?date=${r.date}`,
                entityType: 'LectureReport', entityId: String(r._id), college: r.college, actor,
                rows: [...(await classLabel(r)), { label: 'Comment', value: comment }],
            });
            await notifySafe({
                recipients: toOM ? prof : oms, email: false,
                title: `Class record reverted by ${who} to ${toOM ? 'OM' : 'Professor'}`,
                message: `${shortClass(r)} — ${comment}`,
                type: 'CLASS_CLCH_REVERTED_INFO', link: toOM ? `/faculty/lectures?date=${r.date}` : `/academic/verification?record=${r._id}`,
                entityType: 'LectureReport', entityId: String(r._id), college: r.college, actor,
            });
            return { ok: true, record: r, message: `Reverted to ${toOM ? 'OM' : 'the professor'}.` };
        }

        // ── HOI / CL / CH: notes delay flag (Module 20) ──
        case 'flag_delay': {
            if (!isHOI && !isClCh && !isAD) return fail(403, 'Only HOI, CL, CH or AD can add a notes-pending comment.');
            if (comment.length < 5) return fail(400, 'Please write the comment (at least 5 characters).');
            if (status === 'COMPLETED') return fail(409, 'This class record is already completed.');
            const flag = { flagId: newId('FLG'), comment, by: actor.id, byName: actor.name, role: actor.role, at: nowISO(), status: 'OPEN' };
            const r = await LectureReport.findOneAndUpdate({ _id: id }, { $push: { delayFlags: flag, pipelineHistory: historyItem(actor, `Notes-pending comment by ${roleShort(actor.role)}`, status, status, comment) } }, { new: true });
            const recipients = [...(await professorOf(r)), ...(await omsOf(r))];
            await notifySafe({
                recipients,
                title: `Notes Pending — ${r.courseName} (${r.date})`,
                message: `${actor.name} (${roleShort(actor.role)}) commented: notes / class record for this class are still pending.`,
                type: 'CLASS_NOTES_DELAY', link: `/faculty/lectures?date=${r.date}`,
                entityType: 'LectureReport', entityId: String(r._id), college: r.college, actor,
                rows: [...(await classLabel(r)), { label: 'Comment', value: comment }, { label: 'Current Status', value: CLASS_STATUS_LABEL[status] }],
            });
            return { ok: true, record: r, message: 'Comment added. Professor and OM notified.' };
        }
        case 'resolve_flag': {
            const flag = (record.delayFlags || []).find((f: any) => f.flagId === input.flagId);
            if (!flag) return fail(404, 'Comment not found.');
            if (flag.status !== 'OPEN') return fail(409, 'This comment is already resolved.');
            if (!isOwner && !isHOI && !isClCh && !isAD) return fail(403, 'Only the professor, HOI, CL, CH or AD can resolve this comment.');
            const i = record.delayFlags.indexOf(flag);
            const r = await LectureReport.findOneAndUpdate({ _id: id, [`delayFlags.${i}.status`]: 'OPEN' }, {
                $set: { [`delayFlags.${i}.status`]: 'RESOLVED', [`delayFlags.${i}.resolvedBy`]: actor.id, [`delayFlags.${i}.resolvedByName`]: actor.name, [`delayFlags.${i}.resolvedAt`]: nowISO(), [`delayFlags.${i}.resolutionNote`]: comment },
                $push: { pipelineHistory: historyItem(actor, 'Notes-pending comment resolved', status, status, comment) },
            }, { new: true });
            return r ? { ok: true, record: r, message: 'Marked as resolved (kept in history).' } : changed();
        }

        // ── Professor: add assignment later (Module 18) ──
        case 'add_assignment': {
            if (!isOwner) return fail(403, 'Only the professor of this class can add its assignment.');
            const url = String(input.assignmentUrl || '').trim();
            if (!isUrl(url)) return fail(400, 'Add the assignment link (or upload the file) — it must start with http:// or https://');
            if (!hasClassEnded(record.date, '00:00')) return fail(400, 'You can add the assignment once the class day has started.');
            const prev = record.assignment?.toObject ? record.assignment.toObject() : (record.assignment || {});
            const now = nowISO();
            const r = await LectureReport.findOneAndUpdate({ _id: id }, {
                $set: {
                    assignment: {
                        ...prev, hasAssignment: true, title: String(input.title || prev.title || `Assignment — ${record.courseName}`).slice(0, 200),
                        description: input.description ?? prev.description ?? '', assignmentUrl: url, deadline: input.deadline || prev.deadline || '',
                        verificationStatus: 'Pending', addedAt: prev.addedAt || now, addedBy: actor.id, addedByName: actor.name, addedLater: true,
                        totalStudentsExpected: prev.totalStudentsExpected || record.totalStudents || 0,
                    },
                },
                $push: { pipelineHistory: historyItem(actor, prev.hasAssignment ? 'Assignment updated' : 'Assignment added', status, status, url) },
            }, { new: true });
            return { ok: true, record: r, message: 'Assignment saved for this class.' };
        }
        // ── Professor: upload notes later (resolves "notes pending") ──
        case 'upload_notes': {
            if (!isOwner) return fail(403, 'Only the professor of this class can add its notes.');
            const url = String(input.notesUrl || '').trim();
            if (!isUrl(url)) return fail(400, 'The notes link must start with http:// or https://');
            if (status === 'PENDING_PROFESSOR') return fail(409, 'Complete the class record (with these notes) from My Lectures.');
            const r = await LectureReport.findOneAndUpdate({ _id: id }, {
                $set: { 'lectureNotes.notesUrl': url, notesMissing: false },
                $push: { pipelineHistory: historyItem(actor, 'Notes added later by Professor', status, status, url) },
            }, { new: true });
            await resolveOpenFlags(r, actor, 'Notes added by the professor');
            const fresh = await LectureReport.findById(id);
            await notifySafe({
                recipients: await omsOf(fresh), email: false,
                title: `Notes added — ${fresh.facultyName}`, message: `${shortClass(fresh)}: the professor has added the notes.`,
                type: 'CLASS_NOTES_ADDED', link: `/academic/verification?record=${fresh._id}`,
                entityType: 'LectureReport', entityId: String(fresh._id), college: fresh.college, actor,
            });
            return { ok: true, record: fresh, message: 'Notes added.' };
        }
        default:
            return fail(400, 'Unknown action.');
    }
}

// ─────────────────────────── listing ───────────────────────────
/**
 * Class list for a set of professors and dates: submitted plan entries merged with their records.
 * Classes without a record appear with status PENDING_PROFESSOR (virtual: true).
 */
export async function buildClassList(professors: any[], from: string, to: string, opts: { includePlanned?: boolean } = {}) {
    const ids = professors.map((p: any) => p.id);
    const profMap = new Map(professors.map((p: any) => [p.id, p]));
    const reports: any[] = await LectureReport.find({ facultyId: { $in: ids }, date: { $gte: from, $lte: to } }).lean();
    const items: any[] = [];
    const used = new Set<string>();

    if (opts.includePlanned) {
        const plans: any[] = await SprintPlan.find({ facultyId: { $in: ids }, weekStartDate: { $lte: to }, weekEndDate: { $gte: from } }).lean();
        for (const plan of plans) {
            if (getPlanStatus(plan) === 'DRAFT') continue;
            const entries = effectiveEntries(plan);
            const dates = Array.from(new Set(entries.map((e: any) => e.date).filter((d: string) => d >= from && d <= to))) as string[];
            for (const date of dates) {
                const dayList = classesOfDay({ entries }, date);
                dayList.forEach((entry: any, idx: number) => {
                    const num = idx + 1;
                    const rep = reports.find(r => !used.has(String(r._id)) && r.facultyId === plan.facultyId && r.date === date &&
                        (r.sprintEntryId ? r.sprintEntryId === String(entry._id) : r.lectureNumber === num));
                    if (rep) { used.add(String(rep._id)); items.push(decorate(rep, profMap)); return; }
                    items.push({
                        virtual: true, _id: `${plan.facultyId}|${date}|${num}|${entry._id}`,
                        facultyId: plan.facultyId, facultyName: plan.facultyName, college: profMap.get(plan.facultyId)?.location || plan.college,
                        date, lectureNumber: num, sprintPlanId: String(plan._id), sprintEntryId: String(entry._id),
                        courseName: entry.subjectName, subjectCode: entry.subjectCode, topicsCovered: entry.topics,
                        stream: entry.stream, year: entry.year, semester: entry.semester, section: entry.section,
                        className: entry.className, lectureType: entry.lectureType, unitNumber: entry.unitNumber,
                        timeStart: entry.timeStart, timeStop: entry.timeStop,
                        pipelineStatus: 'PENDING_PROFESSOR', classEnded: hasClassEnded(date, entry.timeStop), delayFlags: [],
                    });
                });
            }
        }
    }
    reports.filter(r => !used.has(String(r._id))).forEach(r => items.push(decorate(r, profMap)));
    // The professor's own clock-in / clock-out of that day (attendance), shown next to the OM's entry / exit
    if (items.length) {
        const att: any[] = await Attendance.find({ employeeId: { $in: ids }, date: { $gte: from, $lte: to } }).select('employeeId date clockIn clockOut status').lean().catch(() => []);
        const byKey = new Map(att.map(a => [`${a.employeeId}|${a.date}`, a]));
        items.forEach(it => { const a: any = byKey.get(`${it.facultyId}|${it.date}`); if (a) { it.profClockIn = a.clockIn || ''; it.profClockOut = a.clockOut || ''; it.profAttendance = a.status || ''; } });
    }
    return items.sort((a, b) => (a.date + (a.timeStart || '')).localeCompare(b.date + (b.timeStart || '')));
}

function decorate(r: any, profMap: Map<string, any>) {
    return {
        ...r,
        _id: String(r._id),
        college: profMap.get(r.facultyId)?.location || r.college,
        timeStart: r.timeStart || r.classStartTime, timeStop: r.timeStop || r.classEndTime,
        pipelineStatus: getClassStatus(r),
        classEnded: hasClassEnded(r.date, r.timeStop || r.classEndTime),
    };
}