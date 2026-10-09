/**
 * SERVER-ONLY: Saturday 10:00 AM deadline checks (Modules 5, 19, 31).
 *
 * At the deadline (Saturday 10:00 in ACADEMIC_TIMEZONE, default Asia/Kolkata):
 *   1. Missing sprint plan — every active professor who has not SUBMITTED the plan for the coming week
 *      (Monday after the deadline). No plan, or a plan still in Draft, counts as missing.
 *   2. Missing assignments — for the teaching week that ends at the deadline (Monday–Friday before it),
 *      every class of the professor's submitted plan that has no assignment yet. One email per professor
 *      listing the exact classes. No penalty is applied (the project has no assignment penalty policy).
 *
 * Duplicate protection:
 *   - JobRun (unique key "weekly-deadlines:<saturday>") — the run happens once per deadline even with
 *     several servers / a cron URL and the in-process scheduler both active.
 *   - ReminderLog (unique key per professor + type + week) — each reminder email is sent once.
 * Triggered by src/lib/scheduler.ts (in-process, every minute) and /api/cron/weekly-deadlines (hosting cron).
 */
import { Employee, SprintPlan, LectureReport, JobRun, ReminderLog } from '@/models/Schemas';
import { zonedNow, addDays, dayCodeOf, nowISO, notify, weekLabel, ACADEMIC_TZ } from '@/lib/academic';
import { getPlanStatus, PROFESSOR_ROLES } from '@/lib/academic-status';
import { effectiveEntries, classesOfDay } from '@/lib/class-record-workflow';

const DEADLINE_DOW = 6;            // Saturday
const DEADLINE_MINUTES = 10 * 60;  // 10:00
const DAY_NAMES: Record<string, string> = { MON: 'Monday', TUE: 'Tuesday', WED: 'Wednesday', THU: 'Thursday', FRI: 'Friday', SAT: 'Saturday', SUN: 'Sunday' };

/** The Saturday whose 10:00 deadline has passed at `at`, if `at` is on that Saturday after 10:00 */
export function deadlineReached(at: Date = new Date()): string | null {
    const z = zonedNow(at);
    return z.dow === DEADLINE_DOW && z.minutes >= DEADLINE_MINUTES ? z.ymd : null;
}

/** The latest Saturday on or before `at` (used by a forced test run) */
function latestSaturday(at: Date): string {
    const z = zonedNow(at);
    return addDays(z.ymd, -((z.dow - DEADLINE_DOW + 7) % 7));
}

async function claim(model: any, key: string, extra: any) {
    await model.init(); // make sure the unique index on "key" exists before relying on it
    try {
        await model.create({ key, ...extra });
        return true;
    } catch (e: any) {
        if (e?.code !== 11000) throw e;
        // A failed earlier attempt may be retried; anything else already happened
        const retried = await model.findOneAndUpdate({ key, status: 'FAILED' }, { $set: { ...extra } });
        return !!retried;
    }
}

async function activeProfessors() {
    return Employee.find({ role: { $in: PROFESSOR_ROLES }, status: { $ne: 'Inactive' } }).select('id name email role location').lean();
}

/** 1. Professors without a submitted plan for the week starting `weekStart` */
export async function findMissingSprintPlans(weekStart: string) {
    const profs: any[] = await activeProfessors();
    const plans: any[] = await SprintPlan.find({ facultyId: { $in: profs.map(p => p.id) }, weekStartDate: weekStart }).lean();
    return profs.filter(p => {
        const plan = plans.find(x => x.facultyId === p.id);
        return !plan || getPlanStatus(plan) === 'DRAFT';
    }).map(p => ({ professor: p, plan: plans.find(x => x.facultyId === p.id) || null }));
}

/** 2. Classes between from..to (inclusive) of submitted plans that have no assignment, per professor */
export async function findMissingAssignments(from: string, to: string) {
    const profs: any[] = await activeProfessors();
    const ids = profs.map(p => p.id);
    const plans: any[] = await SprintPlan.find({ facultyId: { $in: ids }, weekStartDate: { $lte: to }, weekEndDate: { $gte: from } }).lean();
    const reports: any[] = await LectureReport.find({ facultyId: { $in: ids }, date: { $gte: from, $lte: to } })
        .select('facultyId date lectureNumber sprintEntryId assignment.hasAssignment assignment.assignmentUrl').lean();

    const result: { professor: any; classes: any[] }[] = [];
    for (const prof of profs) {
        const missing: any[] = [];
        for (const plan of plans.filter(p => p.facultyId === prof.id)) {
            if (getPlanStatus(plan) === 'DRAFT') continue;
            const entries = effectiveEntries(plan);
            const dates = Array.from(new Set(entries.map((e: any) => e.date).filter((d: string) => d >= from && d <= to))).sort() as string[];
            for (const date of dates) {
                classesOfDay({ entries }, date).forEach((e: any, idx: number) => {
                    const rep = reports.find(r => r.facultyId === prof.id && r.date === date &&
                        (r.sprintEntryId ? r.sprintEntryId === String(e._id) : r.lectureNumber === idx + 1));
                    if (!rep?.assignment?.hasAssignment) {
                        missing.push({
                            date, day: DAY_NAMES[dayCodeOf(date)], timeStart: e.timeStart, timeStop: e.timeStop,
                            subject: e.subjectName || e.subjectCode || 'Subject',
                            classSection: [e.className || e.stream, e.section ? `Section ${e.section}` : ''].filter(Boolean).join(' / ') || '—',
                            topic: e.topics || '', sprintEntryId: String(e._id),
                        });
                    }
                });
            }
        }
        if (missing.length) result.push({ professor: prof, classes: missing });
    }
    return result;
}

async function sendOnce(key: string, type: string, prof: any, weekStartDate: string, details: any, send: () => Promise<{ emailed: number }>) {
    const claimed = await claim(ReminderLog, key, {
        type, recipientId: prof.id, recipientEmail: prof.email, weekStartDate, details, status: 'SENDING', createdAt: nowISO(),
    });
    if (!claimed) return 'DUPLICATE';
    try {
        const r = await send();
        const status = r.emailed > 0 ? 'SENT' : (prof.email ? 'FAILED' : 'NO_EMAIL');
        await ReminderLog.updateOne({ key }, { $set: { status, sentAt: nowISO(), error: status === 'FAILED' ? 'Email could not be sent (check SMTP settings)' : '' } });
        return status;
    } catch (e: any) {
        await ReminderLog.updateOne({ key }, { $set: { status: 'FAILED', error: String(e?.message || e).slice(0, 300) } });
        return 'FAILED';
    }
}

export type WeeklyRunOptions = { at?: Date; trigger?: string; force?: boolean; dryRun?: boolean };

export async function runWeeklyDeadlines(opts: WeeklyRunOptions = {}) {
    const at = opts.at || new Date();
    let saturday = deadlineReached(at);
    if (!saturday) {
        if (!opts.force) return { ran: false, reason: `Not yet the deadline (Saturday 10:00 ${ACADEMIC_TZ}).` };
        saturday = latestSaturday(at);
    }
    const nextWeekStart = addDays(saturday, 2);      // Monday after the deadline
    const thisWeekStart = addDays(saturday, -5);     // Monday of the week that ends at the deadline
    const thisWeekEnd = addDays(saturday, -1);       // Friday

    if (opts.dryRun) {
        const plans = await findMissingSprintPlans(nextWeekStart);
        const assignments = await findMissingAssignments(thisWeekStart, thisWeekEnd);
        return {
            ran: false, dryRun: true, saturday, nextWeekStart, assignmentWeek: [thisWeekStart, thisWeekEnd],
            missingSprintPlans: plans.map(p => ({ id: p.professor.id, name: p.professor.name, planStatus: p.plan ? getPlanStatus(p.plan) : 'NONE' })),
            missingAssignments: assignments.map(a => ({ id: a.professor.id, name: a.professor.name, classes: a.classes })),
        };
    }

    const jobKey = `weekly-deadlines:${saturday}`;
    const claimed = await claim(JobRun, jobKey, { job: 'weekly-deadlines', trigger: opts.trigger || 'manual', startedAt: nowISO(), status: 'RUNNING' });
    if (!claimed) {
        const prev: any = await JobRun.findOne({ key: jobKey }).lean();
        return { ran: false, reason: 'Already ran for this deadline.', saturday, previous: prev ? { status: prev.status, startedAt: prev.startedAt, trigger: prev.trigger } : null };
    }

    try {
        const summary = { saturday, nextWeekStart, assignmentWeek: [thisWeekStart, thisWeekEnd], sprintPlanReminders: {} as Record<string, number>, assignmentReminders: {} as Record<string, number> };
        const count = (bucket: Record<string, number>, s: string) => { bucket[s] = (bucket[s] || 0) + 1; };

        // 1. Missing sprint plans for next week
        for (const { professor, plan } of await findMissingSprintPlans(nextWeekStart)) {
            const status = await sendOnce(`MISSING_SPRINT_PLAN:${professor.id}:${nextWeekStart}`, 'MISSING_SPRINT_PLAN', professor, nextWeekStart,
                { planStatus: plan ? getPlanStatus(plan) : 'NONE' },
                () => notify({
                    recipients: [professor],
                    title: `Sprint Plan Not Submitted — Week ${weekLabel(nextWeekStart, addDays(nextWeekStart, 5))}`,
                    message: 'Your required weekly Sprint Plan has not been submitted yet. Please complete and submit it as soon as possible and provide the required reason for the delay where applicable.',
                    type: 'MISSING_SPRINT_PLAN', link: `/faculty/sprint-plan?week=${nextWeekStart}`,
                    entityType: 'SprintPlan', entityId: plan ? String(plan._id) : undefined, college: professor.location,
                    rows: [
                        { label: 'Week', value: weekLabel(nextWeekStart, addDays(nextWeekStart, 5)) },
                        { label: 'Deadline', value: `Saturday ${weekLabel(saturday)}, 10:00 AM` },
                        { label: 'Current Status', value: plan ? 'Draft (not submitted)' : 'No plan created' },
                    ],
                }));
            count(summary.sprintPlanReminders, status);
        }

        // 2. Missing assignments for the week that ends at the deadline
        for (const { professor, classes } of await findMissingAssignments(thisWeekStart, thisWeekEnd)) {
            const status = await sendOnce(`MISSING_ASSIGNMENT:${professor.id}:${thisWeekStart}`, 'MISSING_ASSIGNMENT', professor, thisWeekStart,
                { classes },
                () => notify({
                    recipients: [professor],
                    title: `Assignment Submission Pending — Week ${weekLabel(thisWeekStart, thisWeekEnd)}`,
                    message: 'Your assignment submission is pending for the following classes:',
                    listItems: classes.map((c: any) => `${c.day} (${weekLabel(c.date)}, ${c.timeStart}–${c.timeStop}) — ${c.subject} — ${c.classSection}`),
                    note: "Please submit the pending assignments. Continued non-submission may be subject to the institution's existing policy.",
                    type: 'MISSING_ASSIGNMENT', link: `/academic/weekly-calendar?week=${thisWeekStart}`,
                    college: professor.location,
                }));
            count(summary.assignmentReminders, status);
        }

        await JobRun.updateOne({ key: jobKey }, { $set: { status: 'DONE', finishedAt: nowISO(), result: summary } });
        console.log(`[weekly-deadlines] ${saturday}: plans ${JSON.stringify(summary.sprintPlanReminders)}, assignments ${JSON.stringify(summary.assignmentReminders)}`);
        return { ran: true, ...summary };
    } catch (e: any) {
        await JobRun.updateOne({ key: jobKey }, { $set: { status: 'FAILED', finishedAt: nowISO(), error: String(e?.message || e).slice(0, 500) } });
        throw e;
    }
}
