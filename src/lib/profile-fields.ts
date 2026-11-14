/**
 * Employee profile fields — one list used by My Profile (Edit Profile), the HR Employee Directory, the View sheet and
 * the exports, so every screen reads and writes the SAME employee record.
 *
 * `key` is the field in the Employee schema (the onboarding form's field). Older records may still carry the value under
 * an earlier name (`aliases`): it is read from there when the main field is empty, and kept in step when the value changes.
 * `mirror` fields hold the same value under a second schema name (both are written).
 */
export type FieldType = "text" | "tel" | "date" | "email" | "url" | "select" | "textarea" | "college";
export type ProfileSection = "personal" | "contact" | "employment" | "academic" | "banking";
export type ProfileField = {
    key: string; label: string; section: ProfileSection; type: FieldType;
    options?: string[]; aliases?: string[]; mirror?: string[];
    /** who may change it: "self" = the employee and HR; "hr" = HR only; "none" = shown only */
    edit: "self" | "hr" | "none";
    sensitive?: boolean;      // bank / identity numbers: masked for HR Executive, never in bulk exports
    required?: boolean;       // counts for "Profile Status: Completed"
    max?: number;
};

export const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

export const PROFILE_FIELDS: ProfileField[] = [
    // Personal
    { key: "name", label: "Name", section: "personal", type: "text", edit: "hr", required: true, max: 120 },
    { key: "full_name", label: "Full Name (as per documents)", section: "personal", type: "text", edit: "self", max: 120 },
    { key: "date_of_birth", label: "Date of Birth", section: "personal", type: "date", edit: "self", mirror: ["dateOfBirth"], required: true },
    { key: "gender", label: "Gender", section: "personal", type: "select", options: ["Male", "Female", "Other"], edit: "self" },
    { key: "blood_group", label: "Blood Group", section: "personal", type: "select", options: BLOOD_GROUPS, edit: "self", mirror: ["bloodGroup"], required: true },
    { key: "father_name_or_mother_name", label: "Father / Mother Name", section: "personal", type: "text", edit: "self", aliases: ["fatherMotherName"], required: true, max: 120 },
    { key: "t_shirt_size", label: "T-Shirt Size", section: "personal", type: "select", options: ["S", "M", "L", "XL", "XXL"], edit: "self" },
    // Contact
    { key: "email", label: "Corporate Email", section: "contact", type: "email", edit: "none" },
    { key: "phone_no_", label: "Phone Number", section: "contact", type: "tel", edit: "self", mirror: ["phone"], required: true },
    { key: "parents_phone_no_", label: "Parent's Phone", section: "contact", type: "tel", edit: "self", aliases: ["parentsPhone"] },
    { key: "permanent_address", label: "Permanent Address", section: "contact", type: "textarea", edit: "self", aliases: ["address"], required: true, max: 500 },
    { key: "linkedin_id", label: "LinkedIn Profile", section: "contact", type: "url", edit: "self", aliases: ["linkedinId"], max: 300 },
    // Employment (HR only)
    { key: "designation", label: "Designation", section: "employment", type: "text", edit: "hr", aliases: ["current_designation_at_gog"], max: 120 },
    { key: "dept", label: "Department", section: "employment", type: "text", edit: "hr", max: 120 },
    { key: "location", label: "College / Work Location", section: "employment", type: "college", edit: "hr" },
    { key: "joiningDate", label: "Joining Date", section: "employment", type: "date", edit: "hr" },
    // Academic
    { key: "bachelor_s_qualification", label: "Bachelor's Degree", section: "academic", type: "text", edit: "self", aliases: ["bachelorQual", "bachelor_s_qualification____ex___b_tech__cse____iit_guwahati_"], required: true, max: 200 },
    { key: "master_s_qualification", label: "Master's Degree", section: "academic", type: "text", edit: "self", aliases: ["masterQual", "master_s_qualification____ex___m_tech__cse____iit_guwahati_"], max: 200 },
    { key: "which_college_are_you_from_", label: "University / Institution", section: "academic", type: "text", edit: "self", aliases: ["collegeName"], required: true, max: 200 },
    { key: "you_are_from_", label: "University Tier", section: "academic", type: "select", options: ["IIT", "NIT", "Other College"], edit: "self" },
    // Banking & identity
    { key: "account_holder_name", label: "Account Holder Name", section: "banking", type: "text", edit: "self", aliases: ["bankAccountName"], sensitive: true, required: true, max: 120 },
    { key: "bankName", label: "Bank Name", section: "banking", type: "text", edit: "self", sensitive: true, max: 120 },
    { key: "bank_account_number", label: "Account Number", section: "banking", type: "text", edit: "self", aliases: ["bankAccountNumber", "accountNumber"], sensitive: true, required: true },
    { key: "ifsc_code", label: "IFSC Code", section: "banking", type: "text", edit: "self", mirror: ["ifscCode"], sensitive: true, required: true },
    { key: "upi_id", label: "UPI ID", section: "banking", type: "text", edit: "self", aliases: ["upiId"], sensitive: true },
    { key: "panNumber", label: "PAN Number", section: "banking", type: "text", edit: "self", sensitive: true },
    { key: "aadhaarNumber", label: "Aadhaar Number", section: "banking", type: "text", edit: "self", sensitive: true },
];

export type DocGroup = "personal" | "vault";
export type ProfileDoc = { key: string; label: string; group: DocGroup; aliases?: string[]; sensitive?: boolean; required?: boolean };
/** Personal Documents (identity / bank) and the Institutional Document Vault (resume, academic, experience) */
export const PROFILE_DOCS: ProfileDoc[] = [
    { key: "passport_size_photo", label: "Passport Size Photo", group: "personal", aliases: ["passportPhotoUrl"], required: true },
    { key: "aadhar_card", label: "Aadhar Card", group: "personal", aliases: ["aadharCardUrl"], required: true },
    { key: "pan_card", label: "PAN Card", group: "personal", aliases: ["panCardUrl"], required: true },
    { key: "bank_passbook_cancelled_cheque", label: "Bank Passbook / Cancelled Cheque", group: "personal", aliases: ["bankPassbookUrl", "bank_passbook___cancelled_cheque"], sensitive: true, required: true },
    { key: "upload_your_resume", label: "Resume / CV", group: "vault", aliases: ["resumeUrl"], required: true },
    { key: "ten_marksheet", label: "10th Marksheet", group: "vault", aliases: ["marksheet10Url", "10th_marksheet"], required: true },
    { key: "twelve_marksheet", label: "12th Marksheet", group: "vault", aliases: ["marksheet12Url", "12th_marksheet"], required: true },
    { key: "upload_your_bachelor_s_passing_certificate", label: "Bachelor's Passing Certificate", group: "vault", aliases: ["bachelorCertUrl"], required: true },
    { key: "bachelor_marksheet_all", label: "Bachelor's Marksheets", group: "vault", aliases: ["bachelorMarksheetUrl", "upload_your_bachelor_s_marksheet__all_marksheet_together_"], required: true },
    { key: "upload_your_master_s_passing_certificate", label: "Master's Passing Certificate", group: "vault", aliases: ["masterCertUrl"] },
    { key: "master_marksheet_all", label: "Master's Marksheets", group: "vault", aliases: ["masterMarksheetUrl", "upload_your_masters_marksheet__all_marksheet_together_"] },
    { key: "experience_letter", label: "Experience Letter", group: "vault", aliases: ["expLetterUrl", "experience_letter__if_any_"] },
];

export const SECTION_LABEL: Record<ProfileSection, string> = {
    personal: "Personal Information", contact: "Contact Details", employment: "Employment Information",
    academic: "Academic Qualifications", banking: "Banking Details",
};

const EMPTY = new Set(["", "?", "NA", "N/A", "na", "n/a", "-", "—"]);
const filled = (v: any) => v !== undefined && v !== null && !EMPTY.has(String(v).trim());

/** The stored value: the main field, else the first older name that has one */
export function readField(e: any, f: { key: string; aliases?: string[]; mirror?: string[] }): string {
    if (!e) return "";
    for (const k of [f.key, ...(f.mirror || []), ...(f.aliases || [])]) if (filled(e[k])) return String(e[k]).trim();
    return "";
}
export const fieldByKey = (k: string) => PROFILE_FIELDS.find(f => f.key === k);
export const docByKey = (k: string) => PROFILE_DOCS.find(d => d.key === k);

/** "XXXXXX7890" — only the last 4 characters are kept */
export const maskTail = (v?: string, keep = 4) => {
    const s = String(v || "").replace(/\s+/g, "");
    if (!s) return "";
    return s.length <= keep ? "•".repeat(s.length) : "X".repeat(Math.min(8, s.length - keep)) + s.slice(-keep);
};

/** Missing required details / documents ("Profile Status": Completed when nothing is missing) */
export function missingItems(e: any): string[] {
    const out: string[] = [];
    PROFILE_FIELDS.filter(f => f.required).forEach(f => { if (!readField(e, f)) out.push(f.label); });
    PROFILE_DOCS.filter(d => d.required).forEach(d => { if (!readField(e, d)) out.push(d.label); });
    return out;
}
export const profileStatus = (e: any) => (missingItems(e).length ? "Incomplete" : "Completed");

/** DD-MM-YYYY or YYYY-MM-DD → YYYY-MM-DD (for the date input) */
export function toIsoDate(v?: string): string {
    const s = String(v || "").trim();
    let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/); if (m) return `${m[1]}-${m[2]}-${m[3]}`;
    m = s.match(/^(\d{2})[-/](\d{2})[-/](\d{4})$/); if (m) return `${m[3]}-${m[2]}-${m[1]}`;
    return "";
}

/** Same checks on the page and on the server. Returns an error message or "" */
export function validateField(f: ProfileField, raw: any, todayYmd: string): string {
    const v = String(raw ?? "").trim();
    if (!v) return f.key === "name" ? "Name cannot be empty." : "";
    if (f.max && v.length > f.max) return `${f.label}: at most ${f.max} characters.`;
    if (f.options && !f.options.includes(v)) return `${f.label}: choose one of the options.`;
    switch (f.type) {
        case "tel": return /^\+?[0-9][0-9 ()-]{8,18}$/.test(v) && v.replace(/\D/g, "").length >= 10 && v.replace(/\D/g, "").length <= 13 ? "" : `${f.label}: enter a valid phone number (10–13 digits).`;
        case "date": {
            const iso = toIsoDate(v);
            if (!iso || isNaN(Date.parse(`${iso}T00:00:00Z`))) return `${f.label}: enter a valid date.`;
            if (f.key === "date_of_birth" && (iso >= todayYmd || iso < "1940-01-01")) return "Date of Birth must be a past date.";
            return "";
        }
        case "url": return /^https?:\/\/[^\s<>"']+\.[^\s<>"']+$/i.test(v) ? "" : `${f.label}: enter a full link starting with https://`;
        case "email": return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? "" : `${f.label}: enter a valid email.`;
    }
    if (f.key === "ifsc_code" && !/^[A-Za-z]{4}0[A-Za-z0-9]{6}$/.test(v)) return "IFSC Code: 11 characters, e.g. SBIN0001234.";
    if (f.key === "bank_account_number" && !/^[0-9]{6,20}$/.test(v.replace(/\s+/g, ""))) return "Account Number: 6–20 digits.";
    if (f.key === "upi_id" && !/^[\w.\-]{2,}@[A-Za-z][A-Za-z0-9.]{1,}$/.test(v)) return "UPI ID: e.g. name@bank.";
    if (f.key === "panNumber" && !/^[A-Za-z]{5}[0-9]{4}[A-Za-z]$/.test(v)) return "PAN Number: 10 characters, e.g. ABCDE1234F.";
    if (f.key === "aadhaarNumber" && !/^[0-9]{12}$/.test(v.replace(/\s+/g, ""))) return "Aadhaar Number: 12 digits.";
    if (/[<>]/.test(v)) return `${f.label}: < and > are not allowed.`;
    return "";
}

/** Normalised value that is stored */
export function cleanValue(f: ProfileField, raw: any): string {
    let v = String(raw ?? "").trim();
    if (f.key === "ifsc_code" || f.key === "panNumber") v = v.toUpperCase();
    if (f.key === "bank_account_number" || f.key === "aadhaarNumber") v = v.replace(/\s+/g, "");
    if (f.type === "date") v = toIsoDate(v) || v;
    return v;
}
