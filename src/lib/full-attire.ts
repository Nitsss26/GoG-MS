/**
 * SERVER-ONLY: Full Attire Management.
 *
 * OM (Operations Manager): sees the professors of their own academic scope (same rule as Class Verification —
 * the OM's college + the attendance locations HR assigned to the OM), captures ONE live photo for one professor
 * or a group, confirms the left → right standing order and submits. The photo is stored once (existing upload
 * storage); every selected professor gets an independent review record.
 * HR / HR Executive / Founder (same access as the Dress Code review): Accept or Reject each professor separately;
 * a rejection needs reason(s) (the existing Dress Code reasons) + an explanation, optional evidence image.
 * Saving a decision never sends an email — the per-professor email is sent from Email Management ("Full Attire").
 */
import { Employee, Location } from '@/models/Schemas';
import { FullAttireSubmission, FullAttireReview } from '@/models/FullAttire';
import { ManualEmail } from '@/models/ManualEmail';
import { getAcademicScope, professorsInScope, hoisAbove } from '@/lib/academic';
import { DRESS_CODE_REASONS, dressReasonText } from '@/lib/dress-code-reasons';
import { MAIN_ADMIN_EMAIL } from '@/lib/mail-server';

export const MAX_GROUP = 20;
const URL_RE = /^https:\/\/[^\s"'<>]+$/i;
const nowIso = () => new Date().toISOString();

export const canCapture = (actor: any) => !!actor && actor.role === 'OM';
/** Same roles as the Dress Code review page (HR — incl. HR Executive — and Founder) */
export const canReview = (actor: any) => !!actor && ['HR', 'FOUNDER'].includes(actor.role);
export const reviewerRole = (actor: any) => (actor?.hrExecutive || actor?.session?.actualRole === 'HR_EXECUTIVE' ? 'HR Executive' : actor?.role === 'FOUNDER' ? 'Founder' : 'HR');

async function locNames() {
    const rows: any[] = await Location.find({}).select('id name shortName').lean();
    const m = new Map<string, string>();
    rows.forEach(l => { m.set(l.id, l.name); m.set(l.name, l.name); if (l.shortName) m.set(l.shortName, l.name); });
    return m;
}

/** Professors the OM may photograph (backend scope) */
export async function omProfessors(actor: any) {
    const scope = await getAcademicScope(actor);
    const profs: any[] = await professorsInScope(scope);
    // the OM can also upload their own Full Attire (shown first, marked "You")
    const ids = Array.from(new Set([actor.id, ...profs.map(p => p.id)]));
    const full: any[] = ids.length ? await Employee.find({ id: { $in: ids }, isRemoved: { $ne: true } }).select('id name email dept designation location status').lean() : [];
    const names = await locNames();
    const today = await uploadedToday(ids);
    const list = full.filter(p => !/inactive|removed|terminated|resigned/i.test(String(p.status || 'Active')))
        .map(p => ({ id: p.id, name: p.name, dept: p.dept || '', designation: p.id === actor.id ? (p.designation || 'Operations Manager') : (p.designation || 'Professor'), location: p.location || '', college: names.get(p.location) || p.location || '', today: today.get(p.id) || null, self: p.id === actor.id }))
        .sort((a, b) => Number(b.self) - Number(a.self) || a.name.localeCompare(b.name));
    return {
        colleges: scope.colleges.map(c => ({ id: c.id, name: c.name })),
        professors: list,
    };
}

/** Start of today (IST) as an ISO time — "today" for Full Attire uploads */
const istDayStartIso = () => { const d = new Date(Date.now() + 5.5 * 3600000).toISOString().slice(0, 10); return new Date(`${d}T00:00:00+05:30`).toISOString(); };

/**
 * Latest Full Attire photo of each professor uploaded today (any OM), not counting replaced ones:
 * professorId → { reviewId, submissionId, status, at }
 */
export async function uploadedToday(professorIds: string[]) {
    const m = new Map<string, { reviewId: string; submissionId: string; status: string; at: string }>();
    if (!professorIds.length) return m;
    const rows: any[] = await FullAttireReview.find({ professorId: { $in: professorIds }, createdAt: { $gte: istDayStartIso() }, status: { $ne: 'replaced' } })
        .select('id submissionId professorId status createdAt').sort({ createdAt: 1 }).lean();
    rows.forEach(r => m.set(r.professorId, { reviewId: r.id, submissionId: r.submissionId, status: r.status, at: r.createdAt }));
    return m;
}

async function nextId() {
    const d = new Date(Date.now() + 5.5 * 3600000).toISOString().slice(0, 10).replace(/-/g, '');
    return `FA-${d}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
}

export async function createSubmission(actor: any, body: any) {
    if (!canCapture(actor)) return { ok: false as const, status: 403, error: 'Only an Operations Manager can submit Full Attire photos.' };
    const clientKey = String(body?.clientKey || '').trim().slice(0, 80);
    const imageUrl = String(body?.imageUrl || '').trim();
    const order: string[] = Array.isArray(body?.order) ? body.order.map((x: any) => String(x)) : [];
    if (!clientKey) return { ok: false as const, status: 400, error: 'Missing capture key.' };
    if (!URL_RE.test(imageUrl) || imageUrl.length > 2048) return { ok: false as const, status: 400, error: 'Capture the photo with the camera before submitting.' };
    if (!order.length) return { ok: false as const, status: 400, error: 'Select at least one professor.' };
    if (order.length > MAX_GROUP) return { ok: false as const, status: 400, error: `A group photo can have at most ${MAX_GROUP} professors.` };
    if (new Set(order).size !== order.length) return { ok: false as const, status: 400, error: 'A professor is selected twice.' };
    const dup: any = await FullAttireSubmission.findOne({ clientKey }).select('id').lean();
    if (dup) return { ok: false as const, status: 409, error: `This photo was already submitted (${dup.id}).` };

    // backend scope check: every professor must be in the OM's authorised list
    const { professors, colleges } = await omProfessors(actor);
    const byId = new Map(professors.map(p => [p.id, p]));
    const outside = order.filter(id => !byId.has(id));
    if (outside.length) return { ok: false as const, status: 403, error: `Not in your college: ${outside.join(', ')}` };

    // Already uploaded today → only as an explicit Re-upload
    const already = await uploadedToday(order);
    if (already.size && body?.reupload !== true) {
        const list = order.filter(id => already.has(id)).map(id => ({ id, name: byId.get(id)!.name, status: already.get(id)!.status, submissionId: already.get(id)!.submissionId }));
        return { ok: false as const, status: 409, error: `Full Attire already uploaded today for: ${list.map(x => x.name).join(', ')}. Choose Re-upload to send a new photo.`, already: list };
    }

    const capturedAt = typeof body?.capturedAt === 'string' && !isNaN(Date.parse(body.capturedAt)) ? new Date(body.capturedAt).toISOString() : nowIso();
    const now = nowIso();
    const first = byId.get(order[0])!;
    const college = first.location || colleges[0]?.id || '';
    const collegeName = first.college || colleges[0]?.name || '';
    const id = await nextId();
    const standingOrder = order.map((pid, i) => ({ position: i + 1, professorId: pid, professorName: byId.get(pid)!.name }));
    try {
        await FullAttireSubmission.create({
            id, clientKey, type: order.length > 1 ? 'group' : 'single', college, collegeName, omId: actor.id, omName: actor.name,
            imageUrl, capturedAt, submittedAt: now, professorIds: order, standingOrder, status: 'Pending Review',
        });
    } catch (e: any) {
        if (e?.code === 11000) return { ok: false as const, status: 409, error: 'This photo was already submitted.' };
        throw e;
    }
    await FullAttireReview.insertMany(standingOrder.map(s => ({
        id: `${id}:${s.professorId}`, submissionId: id, professorId: s.professorId, professorName: s.professorName, position: s.position,
        college: byId.get(s.professorId)!.location || college, collegeName: byId.get(s.professorId)!.college || collegeName, status: 'pending', createdAt: now,
        history: [{ at: now, by: actor.id, byName: actor.name, role: 'OM', action: already.has(s.professorId) ? 'Re-uploaded' : 'Submitted', note: `${order.length > 1 ? `Group photo · position ${s.position} of ${order.length}` : 'Single photo'}${already.has(s.professorId) ? ` · replaces today's photo ${already.get(s.professorId)!.submissionId}` : ''}` }],
    })));
    // Re-upload: today's earlier photo that HR has not reviewed yet is replaced (HR reviews only the new one);
    // a photo HR already accepted / rejected stays as it is (its decision and email are kept)
    let replaced = 0;
    const oldSubs = new Set<string>();
    for (const prev of Array.from(already.values())) {
        const u = await FullAttireReview.updateOne({ id: prev.reviewId, status: 'pending' },
            { $set: { status: 'replaced' }, $push: { history: { at: now, by: actor.id, byName: actor.name, role: 'OM', action: 'Replaced', note: `Re-uploaded in ${id}` } } });
        if (u.modifiedCount) { replaced++; oldSubs.add(prev.submissionId); }
    }
    for (const sid of Array.from(oldSubs)) {
        const rs: any[] = await FullAttireReview.find({ submissionId: sid }).select('status').lean();
        const left = rs.filter(r => r.status === 'pending').length, decided = rs.filter(r => r.status === 'accepted' || r.status === 'rejected').length;
        await FullAttireSubmission.updateOne({ id: sid }, { $set: { status: left ? (decided ? 'Partly Reviewed' : 'Pending Review') : decided ? 'Reviewed' : 'Replaced' } });
    }
    const reup = already.size;
    return { ok: true as const, id, message: reup
        ? `Re-uploaded for HR review (${order.length} professor${order.length > 1 ? 's' : ''}${replaced ? `; today's earlier pending photo replaced for ${replaced}` : ''}).`
        : `Submitted for HR review (${order.length} professor${order.length > 1 ? 's' : ''}).` };
}

/** Submissions with their per-professor reviews */
export async function listSubmissions(actor: any, opts: { mine?: boolean; status?: string; q?: string }) {
    const q: any = {};
    if (opts.mine) q.omId = actor.id;
    const subs: any[] = await FullAttireSubmission.find(q).sort({ submittedAt: -1 }).limit(500).lean();
    const reviews: any[] = subs.length ? await FullAttireReview.find({ submissionId: { $in: subs.map(s => s.id) } }).select('-history').lean() : [];
    // email state of each decided review (same record as Email Management → Full Attire)
    const decided = reviews.filter(r => r.status === 'accepted' || r.status === 'rejected');
    const mails: any[] = decided.length ? await ManualEmail.find({ key: { $in: decided.map(r => `full_attire:${r.id}`) } }).select('key emailStatus sendingAt').lean() : [];
    const mailBy = new Map(mails.map(d => [d.key, d]));
    const mailState = (d: any) => !d ? 'not_sent' : d.emailStatus === 'sent' ? 'sent' : d.emailStatus === 'failed' ? 'failed'
        : d.emailStatus === 'sending' ? (Date.now() - Date.parse(d.sendingAt || 0) < 2 * 60000 ? 'sending' : 'failed') : 'not_sent';
    const bySub = new Map<string, any[]>();
    reviews.forEach(r => { (bySub.get(r.submissionId) || bySub.set(r.submissionId, []).get(r.submissionId)!).push(r); });
    let out = subs.map(s => {
        const rs = (bySub.get(s.id) || []).sort((a, b) => a.position - b.position);
        const pending = rs.filter(r => r.status === 'pending').length;
        return { ...s, reviews: rs.map(r => ({ ...r, reasonText: dressReasonText(r.reasons, r.other), ...(r.status === 'accepted' || r.status === 'rejected' ? { emailStatus: mailState(mailBy.get(`full_attire:${r.id}`)) } : {}) })), pending, accepted: rs.filter(r => r.status === 'accepted').length, rejected: rs.filter(r => r.status === 'rejected').length };
    });
    if (opts.status === 'pending') out = out.filter(s => s.pending > 0);
    if (opts.status === 'reviewed') out = out.filter(s => s.pending === 0);
    const s = (opts.q || '').trim().toLowerCase();
    if (s) out = out.filter(x => `${x.id} ${x.collegeName} ${x.omName} ${x.reviews.map((r: any) => `${r.professorName} ${r.professorId}`).join(' ')}`.toLowerCase().includes(s));
    return out;
}

export async function reviewHistory(professorId: string) {
    const rs: any[] = await FullAttireReview.find({ professorId }).sort({ createdAt: -1 }).lean();
    const subs: any[] = rs.length ? await FullAttireSubmission.find({ id: { $in: rs.map(r => r.submissionId) } }).select('id imageUrl omName submittedAt type').lean() : [];
    const m = new Map(subs.map(s => [s.id, s]));
    return rs.map(r => ({ ...r, reasonText: dressReasonText(r.reasons, r.other), submission: m.get(r.submissionId) || null }));
}

export async function decide(actor: any, reviewId: string, body: any) {
    if (!canReview(actor)) return { ok: false as const, status: 403, error: 'Only HR, HR Executive or Founders can review Full Attire.' };
    const action = String(body?.action || '');
    if (!['accept', 'reject'].includes(action)) return { ok: false as const, status: 400, error: 'Choose Accept or Reject.' };
    const r: any = await FullAttireReview.findOne({ id: reviewId }).lean();
    if (!r) return { ok: false as const, status: 404, error: 'Review not found.' };
    const sub: any = await FullAttireSubmission.findOne({ id: r.submissionId }).select('omId').lean();
    if (sub?.omId === actor.id) return { ok: false as const, status: 403, error: 'You cannot review your own submission.' };
    if (r.professorId === actor.id) return { ok: false as const, status: 403, error: 'You cannot review your own Full Attire.' };
    const now = nowIso(); const role = reviewerRole(actor);
    let set: any = { reviewedBy: actor.id, reviewedByName: actor.name, reviewedByRole: role, reviewedAt: now };
    let note = '';
    if (action === 'accept') { set.status = 'accepted'; set.reasons = []; set.other = ''; set.explanation = String(body?.remarks || '').trim().slice(0, 1000); set.evidenceUrl = ''; note = set.explanation; }
    else {
        const reasons = Array.from(new Set((Array.isArray(body?.reasons) ? body.reasons : []).map((x: any) => String(x)).filter((x: string) => (DRESS_CODE_REASONS as readonly string[]).includes(x)))) as string[];
        if (!reasons.length) return { ok: false as const, status: 400, error: 'Select at least one rejection reason.' };
        const other = String(body?.other || '').trim().slice(0, 300);
        if (reasons.includes('Other') && other.length < 2) return { ok: false as const, status: 400, error: 'Please write the reason for "Other".' };
        const explanation = String(body?.explanation || '').trim().slice(0, 2000);
        if (explanation.length < 5) return { ok: false as const, status: 400, error: 'Write a detailed explanation (at least 5 characters).' };
        const evidenceUrl = String(body?.evidenceUrl || '').trim();
        if (evidenceUrl && (!/^https?:\/\/[^\s"'<>]+$/i.test(evidenceUrl) || evidenceUrl.length > 2048)) return { ok: false as const, status: 400, error: 'The supporting image must be an uploaded image.' };
        set = { ...set, status: 'rejected', reasons, other: reasons.includes('Other') ? other : '', explanation, evidenceUrl };
        note = `${dressReasonText(reasons, other)} — ${explanation}`;
    }
    // decided once: only while still pending (two reviewers at the same moment → one wins)
    const updated: any = await FullAttireReview.findOneAndUpdate({ id: reviewId, status: 'pending' },
        { $set: set, $push: { history: { at: now, by: actor.id, byName: actor.name, role, action: action === 'accept' ? 'Accepted' : 'Rejected', note } } }, { new: true }).lean();
    if (!updated) return { ok: false as const, status: 409, error: `Already reviewed (${r.status}).` };
    const left = await FullAttireReview.countDocuments({ submissionId: r.submissionId, status: 'pending' });
    const total = await FullAttireReview.countDocuments({ submissionId: r.submissionId });
    await FullAttireSubmission.updateOne({ id: r.submissionId }, { $set: { status: left === 0 ? 'Reviewed' : left < total ? 'Partly Reviewed' : 'Pending Review' } });
    return { ok: true as const, review: updated, message: `${r.professorName}: ${action === 'accept' ? 'Accepted' : 'Rejected'}. Use Send Email here (or in Email Management → Full Attire) to email the professor.` };
}

/** CC of a professor's Full Attire email: HR, HR Executive, all Founders and the professor's own HOI(s) */
/**
 * Full Attire REJECTION e-mail copies: admin, HR, HR Executive, all Founders, the professor's HOI(s) (reporting line + the HOI who
 * heads the college) and the OM(s) — the OM who captured the photo and the OM(s) of the professor's college.
 * (The professor is the To address.)
 */
export async function fullAttireRejectCc(professorId: string, collegeValue?: string, submissionId?: string) {
    const EMAIL_RE = /^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+$/;
    const team: any[] = await Employee.find({ role: { $in: ['HR', 'HR_EXECUTIVE', 'FOUNDER'] }, isRemoved: { $ne: true } }).select('email status mailsStopped').lean();
    const hois: any[] = await hoisAbove(professorId);
    const oms: any[] = [];
    if (collegeValue) {
        const loc: any = await Location.findOne({ $or: [{ id: collegeValue }, { name: collegeValue }, { shortName: collegeValue }] }).select('id name shortName hoiId').lean();
        if (loc?.hoiId) { const h: any = await Employee.findOne({ id: loc.hoiId, role: 'HOI' }).select('email status mailsStopped').lean(); if (h) hois.push(h); }
        const keys = loc ? [loc.id, loc.name, loc.shortName].filter(Boolean) : [collegeValue];
        oms.push(...await Employee.find({ role: 'OM', isRemoved: { $ne: true }, $or: [{ location: { $in: keys } }, ...(loc ? [{ attendanceLocations: loc.id }] : [])] }).select('email status mailsStopped').lean());
    }
    if (submissionId) {
        const sub: any = await FullAttireSubmission.findOne({ id: submissionId }).select('omId').lean();
        if (sub?.omId) { const om: any = await Employee.findOne({ id: sub.omId }).select('email status mailsStopped').lean(); if (om) oms.push(om); }
    }
    const people = [...team, ...hois, ...oms]
        .filter(e => e && !e.mailsStopped && !/inactive|removed/i.test(String(e.status || 'Active')))
        .map(e => String(e.email || '').trim().toLowerCase());
    return Array.from(new Set([MAIN_ADMIN_EMAIL.toLowerCase(), ...people])).filter(e => EMAIL_RE.test(e) && !e.endsWith('@gog.com'));
}

export async function fullAttireCc(professorId: string, collegeValue?: string) {
    const EMAIL_RE = /^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+$/;
    const team: any[] = await Employee.find({ role: { $in: ['HR', 'HR_EXECUTIVE', 'FOUNDER'] }, isRemoved: { $ne: true } }).select('email status mailsStopped').lean();
    const hois: any[] = await hoisAbove(professorId);
    if (collegeValue) {
        const loc: any = await Location.findOne({ $or: [{ id: collegeValue }, { name: collegeValue }, { shortName: collegeValue }] }).select('hoiId').lean();
        if (loc?.hoiId) { const h: any = await Employee.findOne({ id: loc.hoiId, role: 'HOI' }).select('email status mailsStopped').lean(); if (h) hois.push(h); }
    }
    return Array.from(new Set([...team, ...hois]
        .filter(e => e && !e.mailsStopped && !/inactive|removed/i.test(String(e.status || 'Active')))
        .map(e => String(e.email || '').trim().toLowerCase()).filter(e => EMAIL_RE.test(e))));
}