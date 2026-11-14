import mongoose, { Schema } from 'mongoose';

/**
 * Celebration Management (Announcements → Celebration Management, HR / HR Executive / Founder).
 * Employee DOB stays on the Employee record (dateOfBirth / date_of_birth) and holidays stay in Holiday —
 * nothing here copies them.
 */

/** A banner image + its text / colour settings. BIRTHDAY_SELF / BIRTHDAY_COLLEAGUE libraries, FESTIVAL library per festivalKey */
const CelebrationTemplateSchema = new Schema({
    id: { type: String, required: true, unique: true },
    category: { type: String, required: true, index: true },   // BIRTHDAY_SELF | BIRTHDAY_COLLEAGUE | FESTIVAL
    festivalKey: { type: String, index: true },                  // FESTIVAL only (DIWALI, HOLI, …)
    name: { type: String },
    imageUrl: { type: String, required: true },
    greeting: { type: String },                                  // heading ({name} / {firstName} / {designation} are filled in)
    subtext: { type: String },
    headingColor: { type: String },
    textColor: { type: String },
    overlayColor: { type: String },
    bgColor: { type: String },
    align: { type: String },                                     // left | center | right
    photoPosition: { type: String },                             // left | right | center | none (birthday)
    createdBy: { type: String }, createdByName: { type: String }, createdAt: { type: String },
    updatedBy: { type: String }, updatedByName: { type: String }, updatedAt: { type: String },
});

/** Active birthday banners + birthday animations (key "birthday") */
const CelebrationSettingSchema = new Schema({
    key: { type: String, required: true, unique: true },
    selfTemplateId: { type: String },
    colleagueTemplateId: { type: String },
    selfTheme: { type: String },        // Birthday Person Animation (empty = Confetti as before, NONE = no animation)
    colleagueTheme: { type: String },   // Colleagues' Birthday Animation (empty / NONE = off, the default)
    updatedBy: { type: String }, updatedByName: { type: String }, updatedAt: { type: String },
});

/** Optional per-employee birthday banner overrides */
const EmployeeCelebrationConfigSchema = new Schema({
    employeeId: { type: String, required: true, unique: true },
    selfTemplateId: { type: String },
    colleagueTemplateId: { type: String },
    updatedBy: { type: String }, updatedByName: { type: String }, updatedAt: { type: String },
});

/** A festival celebration on one date (independent of holidays) */
const FestivalCelebrationSchema = new Schema({
    id: { type: String, required: true, unique: true },
    festivalKey: { type: String, required: true },
    name: { type: String, required: true },
    date: { type: String, required: true, index: true },        // YYYY-MM-DD
    theme: { type: String, required: true },
    bannerTemplateId: { type: String },
    greeting: { type: String },
    textColor: { type: String },
    bgColor: { type: String },
    animation: { type: Boolean, default: true },
    subtle: { type: Boolean, default: true },
    status: { type: String, default: 'Active' },
    createdBy: { type: String }, createdByName: { type: String }, createdAt: { type: String },
    updatedBy: { type: String }, updatedByName: { type: String }, updatedAt: { type: String },
});

/** New Member Welcome — published by HR; shown on the dashboard ONLY on `date` (the day it was published) */
const WelcomeCelebrationSchema = new Schema({
    id: { type: String, required: true, unique: true },
    employeeId: { type: String, required: true, index: true },
    employeeName: { type: String },
    date: { type: String, required: true, index: true },        // YYYY-MM-DD (IST) — publish day
    imageUrl: { type: String },                                  // colleagues' banner image (optional → built-in design)
    selfImageUrl: { type: String },                              // new member's own banner image (optional → imageUrl)
    greeting: { type: String }, subtext: { type: String },       // colleagues ({name} / {firstName} / {designation})
    selfGreeting: { type: String }, selfSubtext: { type: String },
    headingColor: { type: String }, textColor: { type: String }, overlayColor: { type: String }, bgColor: { type: String },
    align: { type: String }, photoPosition: { type: String },
    status: { type: String, default: 'Active' },
    createdBy: { type: String }, createdByName: { type: String }, createdAt: { type: String },
    updatedBy: { type: String }, updatedByName: { type: String }, updatedAt: { type: String },
});

/** The opening animation was shown to this employee for this celebration on this date (shown once) */
const CelebrationSeenSchema = new Schema({
    key: { type: String, required: true, unique: true },         // employeeId|celebrationKey|date
    employeeId: { type: String, index: true },
    celebrationKey: { type: String },
    date: { type: String },
    at: { type: String },
});

/** Who changed what (DOB edits, templates, festivals) */
const CelebrationAuditSchema = new Schema({
    id: { type: String, required: true, unique: true },
    action: { type: String },
    entityId: { type: String, index: true },
    employeeId: { type: String, index: true },
    before: { type: Schema.Types.Mixed },
    after: { type: Schema.Types.Mixed },
    by: { type: String }, byName: { type: String }, byRole: { type: String }, at: { type: String },
});

export const CelebrationTemplate = mongoose.models.CelebrationTemplate || mongoose.model('CelebrationTemplate', CelebrationTemplateSchema);
export const CelebrationSetting = mongoose.models.CelebrationSetting || mongoose.model('CelebrationSetting', CelebrationSettingSchema);
export const EmployeeCelebrationConfig = mongoose.models.EmployeeCelebrationConfig || mongoose.model('EmployeeCelebrationConfig', EmployeeCelebrationConfigSchema);
export const FestivalCelebration = mongoose.models.FestivalCelebration || mongoose.model('FestivalCelebration', FestivalCelebrationSchema);
export const WelcomeCelebration = mongoose.models.WelcomeCelebration || mongoose.model('WelcomeCelebration', WelcomeCelebrationSchema);
export const CelebrationSeen = mongoose.models.CelebrationSeen || mongoose.model('CelebrationSeen', CelebrationSeenSchema);
export const CelebrationAudit = mongoose.models.CelebrationAudit || mongoose.model('CelebrationAudit', CelebrationAuditSchema);