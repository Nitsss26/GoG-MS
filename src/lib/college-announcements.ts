/**
 * SERVER-ONLY: HOI college-wise announcements (enhancement of the existing Announcements — same Notice collection).
 *
 *  - HOI colleges = colleges the HOI manages (own campus + campuses it heads, Location.hoiId — the academic scope)
 *    + its assigned colleges (Employee.attendanceLocations). Nothing is created or changed in these mappings.
 *  - E-mail recipients = ACTIVE professors / faculty whose college (Original Location) is one of the SELECTED colleges
 *    + ACTIVE OMs of those colleges (Original Location or assigned college), computed on the backend,
 *    de-duplicated by employee and by e-mail address.
 *  - One Notice per announcement (collegeIds = the selected colleges). The announcement itself is visible to
 *    everyone in Announcements; only the e-mail is limited to the selected colleges' professors / OMs.
 *  - Holidays are NOT announced here: an HOI announces a holiday only from Holidays → Announce Holiday
 *    (existing /api/holidays/announce).
 *  - E-mail: one e-mail per recipient (nobody sees other addresses, no automatic CC), existing SMTP service.
 *    Delivery is logged per recipient (Notification.emailStatus); retry sends only FAILED ones, once each.
 */
import { randomBytes } from 'crypto';
import mongoose from 'mongoose';
import { Employee, Holiday, Location, Notice, Notification } from '@/models/Schemas';
import { getAcademicScope, collegeKeysFor, isValidYmd, zonedNow, addDays, appUrl } from '@/lib/academic';
import { PROFESSOR_ROLES } from '@/lib/academic-status';
import { sendMailInternal } from '@/lib/mail-server';

export const ANNOUNCEMENT_TYPES = ['Important Notice', 'Academic Announcement', 'Meeting Announcement', 'Schedule Update', 'Examination Notice', 'General Announcement', 'Other'];
const EMAIL_RE = /^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+$/;
const ENTITY = 'CollegeAnnouncement';
const esc = (v: any) => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' } as any)[c]);
export const fmtLong = (ymd: string) => (isValidYmd(ymd) ? new Date(`${ymd}T00:00:00Z`).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'UTC' }) : '');
const nowIso = () => new Date().toISOString();

/** One send per delivery attempt (unique key) — a double click on Retry cannot send twice */
const LockSchema = new mongoose.Schema({ key: { type: String, required: true, unique: true }, at: String });
const AnnouncementMailLock = (mongoose.models.AnnouncementMailLock || mongoose.model('AnnouncementMailLock', LockSchema)) as mongoose.Model<any>;

/** The HOI's colleges (id + name) */
export async function hoiColleges(actor: any): Promise<{ id: string; name: string }[]> {
    const emp = actor.employee?.toObject ? actor.employee.toObject() : actor.employee;
    const scope = await getAcademicScope({ role: 'HOI', employee: emp });
    const out = scope.colleges.map(c => ({ id: c.id, name: c.name }));
    const extra: string[] = (emp?.attendanceLocations || []).filter((id: string) => id && !out.some(c => c.id === id));
    if (extra.length) {
        const locs: any[] = await Location.find({ id: { $in: extra } }).select('id name shortName').lean();
        locs.forEach(l => out.push({ id: l.id, name: l.name || l.shortName || l.id }));
    }
    return out.sort((a, b) => a.name.localeCompare(b.name));
}

/** Active professors / faculty and OMs of the selected colleges (de-duplicated) — each with the college(s) it matched */
export async function professorsOf(collegeIds: string[]) {
    const byId = new Map<string, any>();
    for (const cid of collegeIds) {
        const keys = await collegeKeysFor(cid);
        const rows: any[] = await Employee.find({
            $or: [
                { role: { $in: PROFESSOR_ROLES }, location: { $in: keys } },
                { role: 'OM', $or: [{ location: { $in: keys } }, { attendanceLocations: cid }] },
            ],
            status: { $nin: ['Inactive', 'Removed', 'Exited', 'Resigned', 'Terminated'] }, isRemoved: { $ne: true },
        }).select('id name email role location').lean();
        rows.forEach(r => { const cur = byId.get(r.id) || { ...r, colleges: [] as string[] }; if (!cur.colleges.includes(cid)) cur.colleges.push(cid); byId.set(r.id, cur); });
    }
    // the same e-mail address (several designation records of one person) gets one e-mail
    const seenEmail = new Set<string>();
    return Array.from(byId.values()).filter(r => {
        const e = String(r.email || '').trim().toLowerCase();
        if (!e) return true;
        if (seenEmail.has(e)) return false;
        seenEmail.add(e); return true;
    });
}

/** Validates the selection against the HOI's colleges (backend) */
export async function validateSelection(actor: any, collegeIdsIn: any) {
    if (!Array.isArray(collegeIdsIn) || !collegeIdsIn.length) return { ok: false as const, status: 400, error: 'Select at least one college.' };
    const ids = Array.from(new Set(collegeIdsIn.map((x: any) => String(x || '')).filter(Boolean)));
    if (!ids.length) return { ok: false as const, status: 400, error: 'Select at least one college.' };
    const mine = await hoiColleges(actor);
    const bad = ids.filter(id => !mine.some(c => c.id === id));
    if (bad.length) return { ok: false as const, status: 403, error: 'You can only announce to the colleges assigned to you.' };
    return { ok: true as const, ids, colleges: mine.filter(c => ids.includes(c.id)) };
}

function mailFor(n: any, prof: any, collegeNames: Record<string, string>) {
    const subject = `${n.announcementType} — ${n.title}`;
    const cols = n.scope === 'GENERAL' ? 'All colleges / all employees' : (prof.colleges?.length ? prof.colleges : n.collegeIds).map((id: string) => collegeNames[id] || id).join(', ');
    const rows: [string, string][] = [
        ['Announcement Type', n.announcementType], ['College(s)', cols], ['Title', n.title],
        ...(n.effectiveDate ? [[n.holidayIds?.length ? 'Holiday Date' : 'Effective Date', fmtLong(n.effectiveDate)] as [string, string]] : []),
        ['Announced By', n.createdBy],
    ];
    const details = `${n.description}${n.additionalDetails ? `\n\n${n.additionalDetails}` : ''}`;
    const link = appUrl('/announcements');
    const html = `<div style="font-family:Arial,sans-serif;font-size:14px;color:#18181b;line-height:1.55;max-width:620px">
<p>Dear ${esc(prof.name || 'Colleague')},</p><p>${esc(n.scope === 'GENERAL' ? 'An announcement has been issued for all employees.' : 'An announcement has been issued for your college.')}</p>
<table style="border-collapse:collapse;margin:12px 0">${rows.map(([k, v]) => `<tr><td style="padding:5px 14px 5px 0;color:#52525b;vertical-align:top">${esc(k)}</td><td style="padding:5px 0;font-weight:bold">${esc(v)}</td></tr>`).join('')}</table>
<p style="margin:0 0 4px;color:#52525b">Details:</p><div style="white-space:pre-wrap;border-left:3px solid #10b981;padding:4px 12px;margin:0 0 14px">${esc(details)}</div>
${(n.imageUrls || []).length ? `<p>Attachment(s): ${(n.imageUrls as string[]).map((u, i) => `<a href="${esc(u)}">Attachment ${i + 1}</a>`).join(' · ')}</p>` : ''}
${link ? `<p><a href="${esc(link)}">Open in GOG OMS</a></p>` : ''}
<p>Regards,<br/>Geeks of Gurukul<br/>Academic Administration</p></div>`;
    const text = [`Dear ${prof.name || 'Colleague'},`, '', n.scope === 'GENERAL' ? 'An announcement has been issued for all employees.' : 'An announcement has been issued for your college.', '', ...rows.map(([k, v]) => `${k}: ${v}`), '', 'Details:', details, '', 'Regards,', 'Geeks of Gurukul', 'Academic Administration'].join('\n');
    return { subject, html, text };
}

/** Sends the e-mail of every recipient row still to be sent (PENDING / FAILED) — once per attempt */
export async function deliver(noticeId: string, onlyFailed = false) {
    const n: any = await Notice.collection.findOne({ id: noticeId });
    if (!n) return { sent: 0, failed: 0 };
    const locs: any[] = await Location.find({ id: { $in: n.collegeIds || [] } }).select('id name shortName').lean();
    const names: Record<string, string> = Object.fromEntries(locs.map(l => [l.id, l.name || l.shortName || l.id]));
    const rows: any[] = await Notification.find({ entityType: ENTITY, entityId: noticeId, emailStatus: onlyFailed ? 'FAILED' : { $in: ['PENDING', 'FAILED'] } }).lean();
    await AnnouncementMailLock.init().catch(() => {});
    let sent = 0, failed = 0;
    for (const row of rows) {
        const attempt = Number((row as any).emailAttempts || 0) + 1;
        const claimed = await AnnouncementMailLock.create({ key: `${row.id}#${attempt}`, at: nowIso() }).then(() => true).catch(() => false);
        if (!claimed) continue;   // another send of this recipient is running / done
        const fresh: any = await Notification.findOne({ id: row.id }).select('emailStatus').lean();
        if (fresh?.emailStatus === 'SENT') continue;
        const prof: any = await Employee.findOne({ id: row.recipientId }).select('email').lean();
        const email = String(prof?.email || '').trim();
        let res: any;
        if (!EMAIL_RE.test(email) || email.toLowerCase().endsWith('@gog.com')) res = { success: false, error: 'No valid email address' };
        else {
            const mail = mailFor(n, { name: row.recipientName, colleges: (row as any).collegeIds || [] }, names);
            res = await sendMailInternal({ to: email, subject: mail.subject, html: mail.html, text: mail.text, noAutoCc: true } as any).catch((e: any) => ({ success: false, error: String(e?.message || e) }));
            if (res?.success && res.messageId === 'skipped-mails-stopped') res = { success: false, error: 'Emails are stopped for this employee.' };
        }
        await Notification.collection.updateOne({ id: row.id }, {
            $set: res?.success ? { emailStatus: 'SENT', emailError: '', emailSentAt: nowIso(), emailTo: email } : { emailStatus: 'FAILED', emailError: String(res?.error || 'Send failed').slice(0, 300) },
            $inc: { emailAttempts: 1 },
        });
        res?.success ? sent++ : failed++;
    }
    await Notice.collection.updateOne({ id: noticeId }, { $set: { lastDeliveryAt: nowIso() } });
    return { sent, failed };
}

/** Delivery counts per announcement */
export async function deliveryOf(ids: string[]) {
    const out: Record<string, any> = {};
    if (!ids.length) return out;
    const rows: any[] = await Notification.find({ entityType: ENTITY, entityId: { $in: ids } }).select('entityId emailStatus').lean();
    rows.forEach(r => {
        const o = out[r.entityId] ||= { total: 0, SENT: 0, FAILED: 0, PENDING: 0 };
        o.total++; o[r.emailStatus || 'PENDING'] = (o[r.emailStatus || 'PENDING'] || 0) + 1;
    });
    return out;
}
export const deliveryLabel = (d?: any) => !d || !d.total ? 'No recipients' : d.FAILED ? `${d.FAILED} failed` : d.PENDING ? 'Sending' : 'Sent';

type Input = { announcementType?: string; customType?: string; collegeIds?: any; title?: string; description?: string; effectiveDate?: string; additionalDetails?: string; imageUrls?: any };

export async function createAnnouncement(actor: any, body: Input) {
    if (actor?.role !== 'HOI') return { ok: false as const, status: 403, error: 'Only an HOI can create a college announcement.' };
    const type = String(body.announcementType || '');
    if (/holiday/i.test(type) || /holiday/i.test(String(body.customType || ''))) return { ok: false as const, status: 400, error: 'Holidays are announced from Holidays → Announce Holiday, not from Announcements.' };
    if (!ANNOUNCEMENT_TYPES.includes(type)) return { ok: false as const, status: 400, error: 'Select the announcement type.' };
    const custom = String(body.customType || '').trim().slice(0, 80);
    if (type === 'Other' && !custom) return { ok: false as const, status: 400, error: 'Enter the announcement type.' };
    const announcementType = type === 'Other' ? custom : type;
    const sel = await validateSelection(actor, body.collegeIds);
    if (!sel.ok) return sel;
    const title = String(body.title || '').trim().slice(0, 200);
    const description = String(body.description || '').trim().slice(0, 10000);
    const additionalDetails = String(body.additionalDetails || '').trim().slice(0, 4000);
    if (title.length < 2) return { ok: false as const, status: 400, error: 'Enter the announcement title.' };
    if (description.length < 2) return { ok: false as const, status: 400, error: 'Enter the announcement description.' };
    const effectiveDate = String(body.effectiveDate || '');
    if (effectiveDate && !isValidYmd(effectiveDate)) return { ok: false as const, status: 400, error: 'Enter a valid date.' };
    const today = zonedNow().ymd;
    const imageUrls = Array.isArray(body.imageUrls) ? body.imageUrls.filter((u: any) => typeof u === 'string' && /^https:\/\//i.test(u) && u.length < 2048).slice(0, 10) : [];

    const recipients = await professorsOf(sel.ids);
    if (!recipients.length) return { ok: false as const, status: 400, error: 'There are no active professors or OMs in the selected college(s).' };

    const now = nowIso();
    const noticeId = `N-CA-${Date.now().toString(36)}-${randomBytes(3).toString('hex')}`.toUpperCase();
    const collegeLabel = sel.colleges.map(c => c.name).join(', ');

    // One Notice (existing collection; extra fields stored as-is)
    const content = [`${announcementType.toUpperCase()}`, `College(s): ${collegeLabel}`, ...(effectiveDate ? [`Effective Date: ${fmtLong(effectiveDate)}`] : []), '', description, ...(additionalDetails ? ['', additionalDetails] : []), '', `Announced By: HOI – ${actor.name}`].join('\n');
    const notice = {
        id: noticeId, title, content, category: announcementType,
        createdBy: actor.name, createdById: actor.id, createdByRole: 'HOI', createdAt: today, createdAtIso: now,
        readBy: [], isEdited: false, imageUrls, collegeIds: sel.ids, status: 'Published',
        audience: 'EVERYONE', emailAudience: 'PROFESSORS_OMS', source: 'HOI_COLLEGE_ANNOUNCEMENT', announcementType, description, additionalDetails,
        ...(effectiveDate ? { effectiveDate } : {}),
        recipientCount: recipients.length,
    };
    await Notice.collection.insertOne(notice);

    // in-app + delivery log (one row per professor); e-mails go out afterwards
    await Notification.collection.insertMany(recipients.map(r => ({
        id: `NTF-${Date.now().toString(36)}-${randomBytes(4).toString('hex')}`.toUpperCase(),
        recipientId: r.id, recipientName: r.name, recipientRole: r.role,
        title: `${announcementType} — ${title}`, message: `${actor.name} (HOI) published an announcement for ${r.colleges.map((id: string) => sel.colleges.find(c => c.id === id)?.name || id).join(', ')}.`,
        type: 'COLLEGE_ANNOUNCEMENT', link: '/announcements', entityType: ENTITY, entityId: noticeId, college: r.colleges[0],
        collegeIds: r.colleges, actorId: actor.id, actorName: actor.name, read: false, createdAt: now, emailStatus: 'PENDING', emailAttempts: 0,
    })));
    return { ok: true as const, id: noticeId, recipients: recipients.length };
}

/** HOI: own announcements; HR / Founder: every HOI college announcement */
export async function history(actor: any) {
    const isAdmin = ['HR', 'FOUNDER'].includes(actor.role);
    const q: any = isAdmin ? { source: { $in: ['HOI_COLLEGE_ANNOUNCEMENT', 'HR_ANNOUNCEMENT'] } } : { source: 'HOI_COLLEGE_ANNOUNCEMENT', createdById: actor.id };
    const rows: any[] = await Notice.collection.find(q).sort({ createdAtIso: -1 }).limit(500).toArray();
    const d = await deliveryOf(rows.map(r => r.id));
    const locs: any[] = await Location.find({ id: { $in: Array.from(new Set(rows.flatMap(r => r.collegeIds || []))) } }).select('id name shortName').lean();
    const name = (id: string) => { const l = locs.find(x => x.id === id); return l?.name || l?.shortName || id; };
    return rows.map(r => ({
        id: r.id, title: r.title, announcementType: r.announcementType, colleges: (r.collegeIds || []).map((id: string) => ({ id, name: name(id) })),
        createdAt: r.createdAtIso || r.createdAt, effectiveDate: r.effectiveDate || '', recipients: r.recipientCount ?? d[r.id]?.total ?? 0,
        delivery: d[r.id] || { total: 0, SENT: 0, FAILED: 0, PENDING: 0 }, deliveryLabel: deliveryLabel(d[r.id]), status: r.status || 'Published', createdBy: r.createdBy,
        canRetry: !!d[r.id]?.FAILED && (isAdmin || r.createdById === actor.id),
    }));
}

/** Retry only the failed deliveries (author HOI / HR / Founder) */
export async function retry(actor: any, id: string) {
    const n: any = await Notice.collection.findOne({ id, source: { $in: ['HOI_COLLEGE_ANNOUNCEMENT', 'HR_ANNOUNCEMENT'] } });
    if (!n) return { ok: false as const, status: 404, error: 'Announcement not found.' };
    if (!(['HR', 'FOUNDER'].includes(actor.role) || n.createdById === actor.id)) return { ok: false as const, status: 403, error: 'Not allowed.' };
    // failed ones, plus any left pending by an interrupted send; a recipient already SENT is never mailed again
    const r = await deliver(id);
    return { ok: true as const, ...r };
}

/* ─────────────── HR / HR Executive / Founder announcements (incl. holidays) ─────────────── */
export const HR_CATEGORIES = ['General', 'Policy', 'Event', 'Urgent', 'Update', 'HR', 'Achievement', 'Training', 'Holiday'];
const INACTIVE = ['Inactive', 'Removed', 'Exited', 'Resigned', 'Terminated'];

/** Every location (HR may announce to any college) */
export async function allColleges(): Promise<{ id: string; name: string }[]> {
    const locs: any[] = await Location.find({}).select('id name shortName').lean();
    return locs.map(l => ({ id: l.id, name: l.name || l.shortName || l.id })).sort((a, b) => a.name.localeCompare(b.name));
}

/** Active employees of the selected colleges (Original Location or assigned college); GENERAL → every active employee */
export async function employeesOf(collegeIds: string[] | 'GENERAL') {
    const base = { status: { $nin: INACTIVE }, isRemoved: { $ne: true }, role: { $ne: 'FOUNDER' } };
    const byId = new Map<string, any>();
    if (collegeIds === 'GENERAL') {
        const rows: any[] = await Employee.find(base).select('id name email role location').lean();
        rows.forEach(r => byId.set(r.id, { ...r, colleges: [] }));
    } else {
        for (const cid of collegeIds) {
            const keys = await collegeKeysFor(cid);
            const rows: any[] = await Employee.find({ ...base, $or: [{ location: { $in: keys } }, { attendanceLocations: cid }] }).select('id name email role location').lean();
            rows.forEach(r => { const cur = byId.get(r.id) || { ...r, colleges: [] as string[] }; if (!cur.colleges.includes(cid)) cur.colleges.push(cid); byId.set(r.id, cur); });
        }
    }
    const seen = new Set<string>();
    return Array.from(byId.values()).filter(r => { const e = String(r.email || '').trim().toLowerCase(); if (!e) return true; if (seen.has(e)) return false; seen.add(e); return true; });
}

export async function validateHrSelection(scope: any, collegeIdsIn: any) {
    if (scope === 'GENERAL') return { ok: true as const, ids: [] as string[], colleges: [] as { id: string; name: string }[], general: true };
    if (!Array.isArray(collegeIdsIn) || !collegeIdsIn.length) return { ok: false as const, status: 400, error: 'Select at least one college, or choose General (everyone).' };
    const ids = Array.from(new Set(collegeIdsIn.map((x: any) => String(x || '')).filter(Boolean)));
    const all = await allColleges();
    if (!ids.length || ids.some(id => !all.some(c => c.id === id))) return { ok: false as const, status: 400, error: 'Unknown college selected.' };
    return { ok: true as const, ids, colleges: all.filter(c => ids.includes(c.id)), general: false };
}

export async function createHrAnnouncement(actor: any, body: any) {
    if (!['HR', 'FOUNDER'].includes(actor?.role)) return { ok: false as const, status: 403, error: 'Only HR / HR Executive can post this announcement.' };
    const category = String(body.category || '');
    if (!HR_CATEGORIES.includes(category)) return { ok: false as const, status: 400, error: 'Select the category.' };
    const general = body.scope === 'GENERAL';
    const sel = await validateHrSelection(general ? 'GENERAL' : 'COLLEGES', body.collegeIds);
    if (!sel.ok) return sel;
    const title = String(body.title || '').trim().slice(0, 200);
    const description = String(body.content || '').trim().slice(0, 10000);
    if (title.length < 2) return { ok: false as const, status: 400, error: 'Enter the announcement title.' };
    if (description.length < 2) return { ok: false as const, status: 400, error: 'Enter the announcement content.' };
    const isHoliday = category === 'Holiday';
    const date = String(body.holidayDate || '');
    const today = zonedNow().ymd;
    if (isHoliday) {
        if (!isValidYmd(date)) return { ok: false as const, status: 400, error: 'Select the holiday date.' };
        if (date < addDays(today, -30) || date > addDays(today, 366)) return { ok: false as const, status: 400, error: 'The holiday date must be within the last 30 days or the next year.' };
    }
    const imageUrls = Array.isArray(body.imageUrls) ? body.imageUrls.filter((u: any) => typeof u === 'string' && /^https:\/\//i.test(u) && u.length < 2048).slice(0, 10) : [];
    const recipients = await employeesOf(general ? 'GENERAL' : sel.ids);
    if (!recipients.length) return { ok: false as const, status: 400, error: 'There are no active employees in the selected college(s).' };

    const now = nowIso();
    const noticeId = `N-HR-${Date.now().toString(36)}-${randomBytes(3).toString('hex')}`.toUpperCase();
    const holidayIds: string[] = [];
    if (isHoliday) {
        // HR's holiday is approved directly (existing HR rule); one record for everyone, or one per selected college
        const clash: any = await Holiday.findOne({ date, status: { $in: ['Approved', 'Proposed'] }, ...(general ? {} : { $or: [{ forAll: true }, { collegeIds: { $in: sel.ids } }] }) }).lean();
        if (clash) return { ok: false as const, status: 409, error: `A holiday already exists on ${fmtLong(date)}: "${clash.name}" (${clash.status}).` };
        const base = { name: title, date, status: 'Approved', source: 'HR_ANNOUNCEMENT', customMessage: description.slice(0, 500), reason: description.slice(0, 500), description,
            proposedBy: actor.id, proposedByName: actor.name, proposedAt: now, approvedBy: actor.id, approvedByName: actor.name, approvedAt: now, createdAt: now, announcementId: noticeId,
            emailSentAt: now, emailStatus: 'Sent' };
        try {
            if (general) { const hid = `HOL-ALL-${date}`; await Holiday.create({ ...base, id: hid, collegeIds: [], forAll: true }); holidayIds.push(hid); }
            else for (const c of sel.colleges) { const hid = `HOL-${c.id}-${date}`; await Holiday.create({ ...base, id: hid, collegeIds: [c.id], forAll: false }); holidayIds.push(hid); }
        } catch (e: any) {
            await Holiday.deleteMany({ id: { $in: holidayIds } }).catch(() => {});
            if (e?.code === 11000) return { ok: false as const, status: 409, error: 'This holiday has already been announced.' };
            throw e;
        }
    }
    const collegeLabel = general ? 'All employees' : sel.colleges.map(c => c.name).join(', ');
    const content = [...(isHoliday ? [`HOLIDAY`, `Holiday Date: ${fmtLong(date)}`] : []), `Audience: ${collegeLabel}`, '', description].join('\n');
    const notice = {
        id: noticeId, title, content, category, createdBy: actor.name, createdById: actor.id, createdByRole: actor.hrExecutive ? 'HR_EXECUTIVE' : actor.role,
        createdAt: today, createdAtIso: now, readBy: [], isEdited: false, imageUrls, collegeIds: sel.ids, status: 'Published',
        audience: 'EVERYONE', scope: general ? 'GENERAL' : 'COLLEGES', source: 'HR_ANNOUNCEMENT', announcementType: category, description,
        ...(isHoliday ? { effectiveDate: date, holidayId: holidayIds[0], holidayIds } : {}), recipientCount: recipients.length,
    };
    try { await Notice.collection.insertOne(notice); }
    catch (e) { if (holidayIds.length) await Holiday.deleteMany({ id: { $in: holidayIds } }).catch(() => {}); throw e; }
    await Notification.collection.insertMany(recipients.map(r => ({
        id: `NTF-${Date.now().toString(36)}-${randomBytes(4).toString('hex')}`.toUpperCase(),
        recipientId: r.id, recipientName: r.name, recipientRole: r.role, title: `${category} — ${title}`,
        message: `${actor.name} published an announcement${general ? ' for everyone' : ` for ${r.colleges.map((id: string) => sel.colleges.find(c => c.id === id)?.name || id).join(', ')}`}.`,
        type: 'COLLEGE_ANNOUNCEMENT', link: '/announcements', entityType: ENTITY, entityId: noticeId, ...(r.colleges[0] ? { college: r.colleges[0] } : {}),
        collegeIds: r.colleges, actorId: actor.id, actorName: actor.name, read: false, createdAt: now, emailStatus: 'PENDING', emailAttempts: 0,
    })));
    return { ok: true as const, id: noticeId, recipients: recipients.length };
}