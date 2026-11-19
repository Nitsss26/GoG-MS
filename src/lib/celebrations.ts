/**
 * SERVER-ONLY: Celebration Management.
 *
 *  resolveToday(actor)  → the logged-in employee's celebration for today (IST): dashboard banner, colleagues'
 *                         birthdays and the global animation effect.
 *    Birthday employee: Personal Birthday > Festival > Vacation > normal header (confetti, opening once per birthday).
 *    Everyone else:     Festival > Vacation > Colleague Birthday > normal header (festival theme effect only —
 *                       birthday confetti is shown ONLY in the birthday employee's own session, never to colleagues).
 *    Vacation banner    = a holiday announcement with "Dashboard Vacation Banner" on, only on its approved holiday
 *                         days that apply to this employee (Holiday records + exclusions — the source of truth).
 *  The opening animation is recorded per employee + celebration + date (CelebrationSeen), so it runs once.
 *    New Member Welcome (HR): shown for 24 hours from the moment HR publishes it (3 PM → 3 PM next day) — the new member gets their own welcome banner,
 *                       everyone else the colleagues' welcome banner. Order: own birthday > Festival > Vacation > Welcome > Colleague Birthday.
 *  Management (HR / HR Executive / Founder): templates, active banners, per-employee overrides, DOB edit, festivals, welcomes.
 */
import { randomBytes } from 'crypto';
import { Employee, Holiday, Notice, Location } from '@/models/Schemas';
import { CelebrationTemplate, CelebrationSetting, EmployeeCelebrationConfig, FestivalCelebration, CelebrationSeen, CelebrationAudit, WelcomeCelebration } from '@/models/Celebration';
import { zonedNow, isValidYmd } from '@/lib/academic';
import { holidayCoversEmployee } from '@/lib/holiday-flag-removal';
import {
    DEFAULTS, FESTIVALS, FESTIVAL_THEME_KEYS, BIRTHDAY_SELF_THEMES, BIRTHDAY_COLLEAGUE_THEMES, festivalOf, isCssColor, birthdayBanner, festivalBanner, vacationBanner, welcomeBanner,
    type BannerData, type ColleagueBirthday, type EffectData, type TodayCelebration,
} from '@/lib/celebration-themes';

const INACTIVE = /^(inactive|removed|exited|resigned|terminated)$/i;
export const canManageCelebrations = (a: any) => !!a && ['HR', 'FOUNDER'].includes(a.role);
const nowIso = () => new Date().toISOString();

/** New Member Welcome stays up for 24 hours from the moment it is published (e.g. 3 PM today → 3 PM tomorrow) */
export const WELCOME_HOURS = 24;
export const welcomeUntil = (w: any) => { const t = Date.parse(String(w?.createdAt || '')); return Number.isFinite(t) ? new Date(t + WELCOME_HOURS * 3600000).toISOString() : ''; };
/** Is this welcome showing right now? (an old row without createdAt: on its own date, as before) */
export function welcomeLive(w: any, nowMs = Date.now()) {
    const t = Date.parse(String(w?.createdAt || ''));
    if (!Number.isFinite(t)) return w?.date === zonedNow().ymd;
    return nowMs >= t && nowMs < t + WELCOME_HOURS * 3600000;
}
const ymdMinus = (ymd: string, n: number) => { const d = new Date(`${ymd}T00:00:00Z`); d.setUTCDate(d.getUTCDate() - n); return d.toISOString().slice(0, 10); };
const newId = (p: string) => `${p}-${Date.now().toString(36)}-${randomBytes(3).toString('hex')}`.toUpperCase();
const roleLabel = (a: any) => (a?.hrExecutive ? 'HR Executive' : a?.role === 'FOUNDER' ? 'Founder' : a?.role || '');
export const HTTPS = (u: any) => typeof u === 'string' && /^https:\/\//i.test(u) && u.length < 2048;
const ALIGNS = ['left', 'center', 'right'];
const PHOTO = ['left', 'right', 'center', 'none'];

// ── DOB ──
/** Month / day of the stored DOB (dateOfBirth first, then the onboarding date_of_birth). YYYY-MM-DD or DD-MM-YYYY / DD/MM/YYYY */
export function dobParts(e: any): { y?: number; m: number; d: number; raw: string } | null {
    const raw = String(e?.dateOfBirth || e?.date_of_birth || '').trim();
    const p = raw.split(/[-/.]/).map(x => x.trim());
    if (p.length < 3) return null;
    const [a, b, c] = p.map(Number);
    let y: number, m: number, d: number;
    if (p[0].length === 4) { y = a; m = b; d = c; } else { d = a; m = b; y = c; }
    if (!m || !d || m > 12 || d > 31) return null;
    return { y, m, d, raw };
}
const leap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
/** Birthday on this IST date? (29 Feb birthdays are celebrated on 28 Feb in other years) */
export function isBirthdayOn(e: any, ymd: string) {
    const p = dobParts(e); if (!p) return false;
    const [y, m, d] = ymd.split('-').map(Number);
    if (p.m === 2 && p.d === 29 && !leap(y)) return m === 2 && d === 28;
    return p.m === m && p.d === d;
}
export const dobIso = (e: any) => { const p = dobParts(e); return p && p.y ? `${p.y}-${String(p.m).padStart(2, '0')}-${String(p.d).padStart(2, '0')}` : ''; };

// ── banners: built by the shared builders (lib/celebration-themes) — the same code the previews use ──
/** Clean the vacation banner settings sent with a holiday announcement (HR) */
export function cleanVacationBanner(vb: any) {
    if (!vb || vb.enabled !== true) return null;
    const images = (Array.isArray(vb.images) ? vb.images : []).filter(HTTPS).slice(0, 10);
    const active = HTTPS(vb.activeImage) && images.includes(vb.activeImage) ? vb.activeImage : images[0] || '';
    const col = (v: any, d: string) => (isCssColor(v) ? v : d);
    return {
        enabled: true, images, activeImage: active,
        heading: String(vb.heading || '').trim().slice(0, 120), subheading: String(vb.subheading ?? '').trim().slice(0, 240),
        headingColor: col(vb.headingColor, DEFAULTS.vacation.headingColor), textColor: col(vb.textColor, DEFAULTS.vacation.textColor),
        bgColor: col(vb.bgColor, DEFAULTS.vacation.bgColor), overlayColor: col(vb.overlayColor, DEFAULTS.vacation.overlayColor),
        align: ALIGNS.includes(vb.align) ? vb.align : 'left',
    };
}

async function locationNames() {
    const locs: any[] = await Location.find({}).select('id name shortName').lean();
    const keyToId = new Map<string, string>();
    locs.forEach(l => [l.id, l.name, l.shortName].filter(Boolean).forEach(k => keyToId.set(String(k), String(l.id))));
    const name = (v?: string) => { const id = v ? keyToId.get(String(v)) : ''; const l = locs.find(x => x.id === id); return l ? (l.shortName || l.name) : v || ''; };
    return { collegeOf: (v?: string) => (v ? keyToId.get(String(v)) || String(v) : ''), name };
}
const personOf = (e: any, college: string) => ({ name: e.name, designation: e.designation || e.current_designation_at_gog || '', college, photoUrl: e.photoUrl || e.passport_size_photo || '' });

async function templatesById(ids: string[]) {
    const list = ids.filter(Boolean);
    if (!list.length) return new Map<string, any>();
    const rows: any[] = await CelebrationTemplate.find({ id: { $in: list } }).lean();
    return new Map(rows.map(r => [r.id, r]));
}

/** Today's celebration for the logged-in employee */
export async function resolveToday(actor: any, at?: string): Promise<TodayCelebration> {
    const today = at && isValidYmd(at) ? at : zonedNow().ymd;
    const me: any = actor.employee?.toObject ? actor.employee.toObject() : actor.employee || {};
    const loc = await locationNames();
    const myCollege = loc.collegeOf(me.location);
    const [setting, festival, emps]: any[] = await Promise.all([
        CelebrationSetting.findOne({ key: 'birthday' }).lean(),
        FestivalCelebration.findOne({ date: today, status: 'Active' }).sort({ createdAt: 1 }).lean(),
        Employee.find({ $or: [{ dateOfBirth: { $nin: [null, ''] } }, { date_of_birth: { $nin: [null, ''] } }] })
            .select('id name role designation current_designation_at_gog location photoUrl passport_size_photo dateOfBirth date_of_birth status').lean(),
    ]);
    const bdays = (emps as any[]).filter(e => !INACTIVE.test(String(e.status || '')) && isBirthdayOn(e, today));
    const birthdaySelf = bdays.some(e => e.id === actor.id);
    const others = bdays.filter(e => e.id !== actor.id);
    const overrides: any[] = bdays.length ? await EmployeeCelebrationConfig.find({ employeeId: { $in: bdays.map(e => e.id) } }).lean() : [];
    const ov = new Map(overrides.map(o => [o.employeeId, o]));
    const tpl = await templatesById([setting?.selfTemplateId, setting?.colleagueTemplateId, festival?.bannerTemplateId, ...overrides.flatMap(o => [o.selfTemplateId, o.colleagueTemplateId])]);

    const colleagues: ColleagueBirthday[] = others.map(e => {
        const p = personOf(e, loc.name(e.location));
        const t = tpl.get(ov.get(e.id)?.colleagueTemplateId) || tpl.get(setting?.colleagueTemplateId);
        return { id: e.id, ...p, banner: birthdayBanner('birthday-colleague', t, p) };
    });

    // vacation: approved holiday today that applies to me + its announcement has the banner on
    let vacation: BannerData | null = null;
    const hols: any[] = await Holiday.find({ date: today, status: 'Approved', announcementId: { $nin: [null, ''] } }).select('id name date forAll collegeIds employeeIds excludedEmployeeIds announcementId').lean();
    const mine = hols.filter(h => holidayCoversEmployee(h, { id: actor.id, location: myCollege }) || holidayCoversEmployee(h, { id: actor.id, location: me.location }));
    if (mine.length) {
        const notices: any[] = await Notice.find({ id: { $in: mine.map(h => h.announcementId) } }).select('id title vacationBanner').lean();
        const n = notices.find(x => x.vacationBanner?.enabled);
        if (n) vacation = vacationBanner(n.vacationBanner, mine.find(h => h.announcementId === n.id)?.name || n.title);
    }
    const fest = festival ? festivalBanner(festival, tpl.get(festival.bannerTemplateId)) : null;

    // New Member Welcome: showing for 24 hours from publishing (a preview of another date keeps "that date")
    const wl: any[] = at && isValidYmd(at)
        ? await WelcomeCelebration.find({ date: today, status: 'Active' }).sort({ createdAt: 1 }).lean()
        : (await WelcomeCelebration.find({ date: { $in: [today, ymdMinus(today, 1)] }, status: 'Active' }).sort({ createdAt: 1 }).lean()).filter((w: any) => welcomeLive(w));
    const wEmps: any[] = wl.length ? await Employee.find({ id: { $in: wl.map(w => w.employeeId) } }).select('id name designation current_designation_at_gog location photoUrl passport_size_photo status').lean() : [];
    const wEmp = new Map(wEmps.filter(e => !INACTIVE.test(String(e.status || ''))).map(e => [e.id, e]));
    const myWelcome = wl.find(w => w.employeeId === actor.id && wEmp.has(w.employeeId));
    const welcomeSelf = myWelcome ? welcomeBanner('welcome-self', myWelcome, personOf(wEmp.get(actor.id), loc.name(wEmp.get(actor.id).location))) : null;
    const welcomeOthers = wl.filter(w => w.employeeId !== actor.id && wEmp.has(w.employeeId)).map(w => { const e = wEmp.get(w.employeeId); return welcomeBanner('welcome-colleague', w, personOf(e, loc.name(e.location))); });

    let banner: BannerData | null = null;
    if (birthdaySelf) {
        const p = personOf(me, loc.name(me.location));
        banner = birthdayBanner('birthday-self', tpl.get(ov.get(actor.id)?.selfTemplateId) || tpl.get(setting?.selfTemplateId), p);
    } else banner = fest || vacation || welcomeSelf || welcomeOthers[0] || (colleagues.length === 1 ? colleagues[0].banner : null);
    const welcomes = welcomeOthers.filter(w => w !== banner);

    // one effect at a time: own birthday confetti wins; then the festival theme
    let effect: EffectData | null = null;
    const seen = async (key: string) => !!(await CelebrationSeen.exists({ key: `${actor.id}|${key}|${today}` }));
    // Birthday Person Animation chosen by HR (empty = Confetti as before; NONE = no animation)
    const selfTheme = BIRTHDAY_SELF_THEMES.includes(setting?.selfTheme) ? setting.selfTheme : 'CONFETTI';
    const collTheme = BIRTHDAY_COLLEAGUE_THEMES.includes(setting?.colleagueTheme) ? setting.colleagueTheme : 'NONE';
    if (birthdaySelf) {
        if (selfTheme !== 'NONE') {
            const key = `BIRTHDAY:${today.slice(0, 4)}`;
            effect = { type: 'birthday', theme: selfTheme, key, opening: !(await seen(key)), subtle: true };
        }
    } else if (festival && festival.animation !== false) {
        const key = `FESTIVAL:${festival.id}`;
        effect = { type: 'festival', theme: festival.theme, key, opening: !(await seen(key)), subtle: festival.subtle !== false };
    } else if (colleagues.length && collTheme !== 'NONE') {
        // a colleague's birthday: only the light effect HR switched on (never the birthday person's animation)
        const key = `COLLEAGUE:${today}`;
        effect = { type: 'colleague-birthday', theme: collTheme, key, opening: !(await seen(key)), subtle: true };
    }
    // Birthday confetti ONLY for the employee whose birthday it is (matched by the signed-in employee's id above) —
    // never because of a colleague's birthday; colleagues get the clean colleague banner only.
    return { date: today, banner, colleagues: banner?.kind === 'birthday-colleague' ? [] : colleagues, effect, birthdaySelf, welcomes };
}

export async function markOpeningSeen(actor: any, key: string) {
    if (!/^(BIRTHDAY|FESTIVAL|COLLEAGUE):[A-Z0-9-]+$/i.test(key)) return false;
    const today = zonedNow().ymd;
    await CelebrationSeen.create({ key: `${actor.id}|${key}|${today}`, employeeId: actor.id, celebrationKey: key, date: today, at: nowIso() }).catch((e: any) => { if (e?.code !== 11000) throw e; });
    return true;
}

// ───────────────────────── management (HR / HR Executive / Founder) ─────────────────────────
const audit = (actor: any, action: string, x: { entityId?: string; employeeId?: string; before?: any; after?: any }) =>
    CelebrationAudit.create({ id: newId('CA'), action, ...x, by: actor.id, byName: actor.name, byRole: roleLabel(actor), at: nowIso() }).catch((e: any) => console.error('[celebration-audit]', e?.message));

/** A welcome of this employee that is still showing (published within the last 24 hours) */
async function liveWelcomeOf(employeeId: string) {
    const today = zonedNow().ymd;
    const rows: any[] = await WelcomeCelebration.find({ employeeId, date: { $in: [today, ymdMinus(today, 1)] }, status: 'Active' }).lean();
    return rows.find(w => welcomeLive(w)) || null;
}
const untilText = (iso: string) => (iso ? new Date(iso).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true }) : '24 hours');

export async function managementData() {
    const [templates, setting, overrides, festivals, emps, loc, welcomes]: any[] = await Promise.all([
        CelebrationTemplate.find({}).sort({ createdAt: -1 }).lean(),
        CelebrationSetting.findOne({ key: 'birthday' }).lean(),
        EmployeeCelebrationConfig.find({}).lean(),
        FestivalCelebration.find({}).sort({ date: -1 }).lean(),
        Employee.find({}).select('id name role designation current_designation_at_gog dept location photoUrl passport_size_photo dateOfBirth date_of_birth status').lean(),
        locationNames(),
        WelcomeCelebration.find({ status: 'Active' }).sort({ date: -1, createdAt: -1 }).limit(100).lean(),
    ]);
    const ov = new Map((overrides as any[]).map(o => [o.employeeId, o]));
    const employees = (emps as any[]).filter(e => !INACTIVE.test(String(e.status || ''))).map(e => {
        const p = dobParts(e); const o = ov.get(e.id);
        return {
            id: e.id, name: e.name, role: e.role, designation: e.designation || e.current_designation_at_gog || e.role, dept: e.dept || '',
            college: loc.name(e.location), photoUrl: e.photoUrl || e.passport_size_photo || '', dob: dobIso(e) || (p ? `--${String(p.m).padStart(2, '0')}-${String(p.d).padStart(2, '0')}` : ''),
            dobMonth: p?.m || 0, dobDay: p?.d || 0, selfTemplateId: o?.selfTemplateId || '', colleagueTemplateId: o?.colleagueTemplateId || '', configured: !!(o?.selfTemplateId || o?.colleagueTemplateId),
        };
    }).sort((a, b) => String(a.name).localeCompare(String(b.name)));
    // each welcome: still showing? until when? (24 hours from publishing)
    const welcomeRows = (welcomes as any[]).map(w => ({ ...w, live: welcomeLive(w), liveUntil: welcomeUntil(w) }));
    return { templates, setting: setting || { key: 'birthday', selfTemplateId: '', colleagueTemplateId: '' }, employees, festivals, festivalsList: FESTIVALS, welcomes: welcomeRows, today: zonedNow().ymd };
}

const tplFields = (b: any) => {
    const out: any = {};
    if (b.name !== undefined) out.name = String(b.name || '').trim().slice(0, 80);
    if (b.greeting !== undefined) out.greeting = String(b.greeting || '').trim().slice(0, 140);
    if (b.subtext !== undefined) out.subtext = String(b.subtext || '').trim().slice(0, 240);
    for (const k of ['headingColor', 'textColor', 'overlayColor', 'bgColor']) if (b[k] !== undefined && isCssColor(b[k])) out[k] = b[k];
    if (b.align !== undefined && ALIGNS.includes(b.align)) out.align = b.align;
    if (b.photoPosition !== undefined && PHOTO.includes(b.photoPosition)) out.photoPosition = b.photoPosition;
    return out;
};
const CATS = ['BIRTHDAY_SELF', 'BIRTHDAY_COLLEAGUE', 'FESTIVAL'];
const fail = (status: number, error: string) => ({ ok: false as const, status, error });

/** Is a template in use (active birthday banner, an employee override or a festival)? */
async function templateUse(id: string) {
    const [s, o, f]: any[] = await Promise.all([
        CelebrationSetting.exists({ $or: [{ selfTemplateId: id }, { colleagueTemplateId: id }] }),
        EmployeeCelebrationConfig.exists({ $or: [{ selfTemplateId: id }, { colleagueTemplateId: id }] }),
        FestivalCelebration.exists({ bannerTemplateId: id }),
    ]);
    return !!(s || o || f);
}

export async function manage(actor: any, b: any) {
    const action = String(b.action || '');
    const now = nowIso();
    const by = { updatedBy: actor.id, updatedByName: actor.name, updatedAt: now };
    switch (action) {
        case 'template_create': {
            if (!CATS.includes(b.category)) return fail(400, 'Choose the banner type.');
            if (!HTTPS(b.imageUrl)) return fail(400, 'Upload the banner image.');
            if (b.category === 'FESTIVAL' && !festivalOf(b.festivalKey)) return fail(400, 'Choose the festival.');
            const doc = { id: newId('CT'), category: b.category, ...(b.category === 'FESTIVAL' ? { festivalKey: b.festivalKey } : {}), imageUrl: b.imageUrl, ...tplFields(b), createdBy: actor.id, createdByName: actor.name, createdAt: now, ...by };
            if (!doc.name) doc.name = `Banner ${new Date().toLocaleDateString('en-GB')}`;
            await CelebrationTemplate.create(doc);
            await audit(actor, 'TEMPLATE_CREATE', { entityId: doc.id, after: doc });
            return { ok: true as const, id: doc.id, message: 'Banner uploaded.' };
        }
        case 'template_update': {
            const t: any = await CelebrationTemplate.findOne({ id: String(b.id || '') }).lean();
            if (!t) return fail(404, 'Banner not found.');
            const set: any = { ...tplFields(b), ...by };
            if (b.imageUrl !== undefined) { if (!HTTPS(b.imageUrl)) return fail(400, 'Upload a valid image.'); set.imageUrl = b.imageUrl; }
            await CelebrationTemplate.updateOne({ id: t.id }, { $set: set });
            await audit(actor, b.imageUrl ? 'TEMPLATE_REPLACE' : 'TEMPLATE_UPDATE', { entityId: t.id, before: t, after: set });
            return { ok: true as const, message: b.imageUrl ? 'Banner image replaced.' : 'Banner saved.' };
        }
        case 'template_delete': {
            const t: any = await CelebrationTemplate.findOne({ id: String(b.id || '') }).lean();
            if (!t) return fail(404, 'Banner not found.');
            if (await templateUse(t.id)) return fail(409, 'This banner is in use (selected as active, for an employee or a festival). Select another banner first.');
            await CelebrationTemplate.deleteOne({ id: t.id });
            await audit(actor, 'TEMPLATE_DELETE', { entityId: t.id, before: t });
            return { ok: true as const, message: 'Banner deleted.' };
        }
        case 'set_active': {
            const field = b.category === 'BIRTHDAY_SELF' ? 'selfTemplateId' : b.category === 'BIRTHDAY_COLLEAGUE' ? 'colleagueTemplateId' : '';
            if (!field) return fail(400, 'Choose the banner type.');
            const id = String(b.id || '');
            if (id) { const t: any = await CelebrationTemplate.findOne({ id, category: b.category }).lean(); if (!t) return fail(404, 'Banner not found.'); }
            const before: any = await CelebrationSetting.findOne({ key: 'birthday' }).lean();
            await CelebrationSetting.findOneAndUpdate({ key: 'birthday' }, { $set: { [field]: id, ...by } }, { upsert: true, new: true });
            await audit(actor, 'SET_ACTIVE', { entityId: field, before: before?.[field] || '', after: id });
            return { ok: true as const, message: id ? 'Active banner selected.' : 'Default banner selected.' };
        }
        case 'birthday_animation': {
            // Birthday Person Animation / Colleagues' Birthday Animation (theme only)
            const set: any = { ...by };
            if (b.selfTheme !== undefined) { if (!BIRTHDAY_SELF_THEMES.includes(b.selfTheme)) return fail(400, 'Choose a birthday animation.'); set.selfTheme = b.selfTheme; }
            if (b.colleagueTheme !== undefined) { if (!BIRTHDAY_COLLEAGUE_THEMES.includes(b.colleagueTheme)) return fail(400, 'Choose a colleague animation.'); set.colleagueTheme = b.colleagueTheme; }
            const before: any = await CelebrationSetting.findOne({ key: 'birthday' }).lean();
            await CelebrationSetting.findOneAndUpdate({ key: 'birthday' }, { $set: set }, { upsert: true, new: true });
            await audit(actor, 'BIRTHDAY_ANIMATION', { entityId: 'birthday', before: { selfTheme: before?.selfTheme || '', colleagueTheme: before?.colleagueTheme || '' }, after: { selfTheme: set.selfTheme ?? before?.selfTheme ?? '', colleagueTheme: set.colleagueTheme ?? before?.colleagueTheme ?? '' } });
            return { ok: true as const, message: 'Birthday animation saved.' };
        }
        case 'employee_config': {
            const emp: any = await Employee.findOne({ id: String(b.employeeId || '') }).select('id name').lean();
            if (!emp) return fail(404, 'Employee not found.');
            const check = async (id: any, cat: string) => (!id || !!(await CelebrationTemplate.exists({ id, category: cat })));
            if (!(await check(b.selfTemplateId, 'BIRTHDAY_SELF')) || !(await check(b.colleagueTemplateId, 'BIRTHDAY_COLLEAGUE'))) return fail(400, 'Choose a banner from the library.');
            const before: any = await EmployeeCelebrationConfig.findOne({ employeeId: emp.id }).lean();
            await EmployeeCelebrationConfig.findOneAndUpdate({ employeeId: emp.id }, { $set: { selfTemplateId: b.selfTemplateId || '', colleagueTemplateId: b.colleagueTemplateId || '', ...by } }, { upsert: true, new: true });
            await audit(actor, 'EMPLOYEE_CONFIG', { employeeId: emp.id, before, after: { selfTemplateId: b.selfTemplateId || '', colleagueTemplateId: b.colleagueTemplateId || '' } });
            return { ok: true as const, message: `Birthday banners saved for ${emp.name}.` };
        }
        case 'edit_dob': {
            const dob = String(b.dob || '');
            if (!isValidYmd(dob)) return fail(400, 'Enter a valid date of birth.');
            const today = zonedNow().ymd;
            if (dob > today) return fail(400, 'The date of birth cannot be in the future.');
            if (dob < '1930-01-01') return fail(400, 'Enter a valid date of birth.');
            const emp: any = await Employee.findOne({ id: String(b.employeeId || '') }).select('id name dateOfBirth date_of_birth').lean();
            if (!emp) return fail(404, 'Employee not found.');
            // both DOB fields get the same date (dateOfBirth keeps its existing format: DD-MM-YYYY stays DD-MM-YYYY)
            const [y, m, d] = dob.split('-');
            const oldDob = String(emp.dateOfBirth || '');
            const dateOfBirth = /^\d{1,2}[-/]\d{1,2}[-/]\d{4}$/.test(oldDob) ? `${d}${oldDob.includes('/') ? '/' : '-'}${m}${oldDob.includes('/') ? '/' : '-'}${y}` : dob;
            await Employee.updateOne({ id: emp.id }, { $set: { dateOfBirth, date_of_birth: dob } });
            await audit(actor, 'EDIT_DOB', { employeeId: emp.id, before: { dateOfBirth: emp.dateOfBirth || '', date_of_birth: emp.date_of_birth || '' }, after: { dateOfBirth, date_of_birth: dob } });
            return { ok: true as const, message: `Date of birth saved for ${emp.name}.` };
        }
        case 'festival_save': {
            const fk = festivalOf(b.festivalKey);
            if (!fk) return fail(400, 'Choose the festival.');
            const date = String(b.date || '');
            if (!isValidYmd(date)) return fail(400, 'Choose the celebration date.');
            if (!FESTIVAL_THEME_KEYS.includes(b.theme)) return fail(400, 'Choose the festival theme.');
            const bannerTemplateId = String(b.bannerTemplateId || '');
            if (bannerTemplateId && !(await CelebrationTemplate.exists({ id: bannerTemplateId, category: 'FESTIVAL' }))) return fail(400, 'Choose a banner from the library.');
            const name = String(b.name || '').trim().slice(0, 80) || fk.name;
            const doc: any = {
                festivalKey: fk.key, name, date, theme: b.theme, bannerTemplateId, greeting: String(b.greeting || '').trim().slice(0, 200) || fk.greeting,
                textColor: isCssColor(b.textColor) ? b.textColor : DEFAULTS.festival.textColor, bgColor: isCssColor(b.bgColor) ? b.bgColor : DEFAULTS.festival.bgColor,
                animation: b.animation !== false, subtle: b.subtle !== false, status: 'Active', ...by,
            };
            const clash: any = await FestivalCelebration.findOne({ date, status: 'Active', ...(b.id ? { id: { $ne: b.id } } : {}) }).lean();
            if (clash) return fail(409, `"${clash.name}" is already set for this date. Edit it, or choose another date.`);
            if (b.id) {
                const before: any = await FestivalCelebration.findOne({ id: String(b.id) }).lean();
                if (!before) return fail(404, 'Festival not found.');
                await FestivalCelebration.updateOne({ id: before.id }, { $set: doc });
                await audit(actor, 'FESTIVAL_UPDATE', { entityId: before.id, before, after: doc });
                return { ok: true as const, id: before.id, message: `${name} saved.` };
            }
            const id = newId('FC');
            await FestivalCelebration.create({ id, ...doc, createdBy: actor.id, createdByName: actor.name, createdAt: now });
            await audit(actor, 'FESTIVAL_CREATE', { entityId: id, after: doc });
            return { ok: true as const, id, message: `${name} celebration saved for ${date.split('-').reverse().join('-')}.` };
        }
        case 'festival_delete': {
            const f: any = await FestivalCelebration.findOne({ id: String(b.id || '') }).lean();
            if (!f) return fail(404, 'Festival not found.');
            await FestivalCelebration.deleteOne({ id: f.id });
            await audit(actor, 'FESTIVAL_DELETE', { entityId: f.id, before: f });
            return { ok: true as const, message: `${f.name} celebration removed. Holidays are not changed.` };
        }
        case 'welcome_save': {
            // New Member Welcome: shown for 24 hours from publishing; it can be edited / removed while it is showing
            const today = zonedNow().ymd;
            const emp: any = await Employee.findOne({ id: String(b.employeeId || '') }).select('id name status').lean();
            if (!emp) return fail(404, 'Choose the new member.');
            if (INACTIVE.test(String(emp.status || ''))) return fail(400, 'This employee is not active.');
            for (const k of ['imageUrl', 'selfImageUrl']) if (b[k] && !HTTPS(b[k])) return fail(400, 'Upload a valid banner image.');
            const col = (v: any) => (isCssColor(v) ? v : undefined);
            const doc: any = {
                employeeId: emp.id, employeeName: emp.name, imageUrl: b.imageUrl || '', selfImageUrl: b.selfImageUrl || '',
                greeting: String(b.greeting || '').trim().slice(0, 140) || DEFAULTS.welcomeColleague.heading,
                subtext: b.subtext === undefined ? DEFAULTS.welcomeColleague.subheading : String(b.subtext || '').trim().slice(0, 240),
                selfGreeting: String(b.selfGreeting || '').trim().slice(0, 140) || DEFAULTS.welcomeSelf.heading,
                selfSubtext: b.selfSubtext === undefined ? DEFAULTS.welcomeSelf.subheading : String(b.selfSubtext || '').trim().slice(0, 240),
                headingColor: col(b.headingColor) || DEFAULTS.welcomeColleague.headingColor, textColor: col(b.textColor) || DEFAULTS.welcomeColleague.textColor,
                overlayColor: col(b.overlayColor) || DEFAULTS.welcomeColleague.overlayColor, bgColor: col(b.bgColor) || DEFAULTS.welcomeColleague.bgColor,
                align: ALIGNS.includes(b.align) ? b.align : 'left', photoPosition: PHOTO.includes(b.photoPosition) ? b.photoPosition : 'right', ...by,
            };
            if (b.id) {
                const before: any = await WelcomeCelebration.findOne({ id: String(b.id), status: 'Active' }).lean();
                if (!before) return fail(404, 'Welcome not found.');
                if (!welcomeLive(before)) return fail(409, 'This welcome is no longer showing (24 hours are over), so it cannot be edited.');
                if (before.employeeId !== emp.id && (await liveWelcomeOf(emp.id))) return fail(409, `${emp.name} already has a welcome showing.`);
                await WelcomeCelebration.updateOne({ id: before.id }, { $set: doc });
                await audit(actor, 'WELCOME_UPDATE', { entityId: before.id, employeeId: emp.id, before, after: doc });
                return { ok: true as const, id: before.id, message: `Welcome for ${emp.name} saved — showing till ${untilText(welcomeUntil(before))}.` };
            }
            if (await liveWelcomeOf(emp.id)) return fail(409, `${emp.name} already has a welcome showing. Edit it instead.`);
            const id = newId('WC');
            await WelcomeCelebration.create({ id, ...doc, date: today, status: 'Active', createdBy: actor.id, createdByName: actor.name, createdAt: now });
            await audit(actor, 'WELCOME_CREATE', { entityId: id, employeeId: emp.id, after: { ...doc, date: today } });
            return { ok: true as const, id, message: `Welcome banner for ${emp.name} published — everyone sees it on the dashboard for 24 hours (till ${untilText(welcomeUntil({ createdAt: now }))}).` };
        }
        case 'welcome_delete': {
            const w: any = await WelcomeCelebration.findOne({ id: String(b.id || ''), status: 'Active' }).lean();
            if (!w) return fail(404, 'Welcome not found.');
            await WelcomeCelebration.updateOne({ id: w.id }, { $set: { status: 'Removed', ...by } });
            await audit(actor, 'WELCOME_DELETE', { entityId: w.id, employeeId: w.employeeId, before: w });
            return { ok: true as const, message: `Welcome for ${w.employeeName} removed.` };
        }
        default: return fail(400, 'Unknown action.');
    }
}