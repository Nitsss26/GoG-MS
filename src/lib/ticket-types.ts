/**
 * Ticket types and categories (shared by the tickets page and /api/tickets — no server-only imports).
 * The existing ticket system is extended, not replaced: the original categories stay ("targetCategory" keeps
 * driving routing and the ticket ID code); the new fields are ticketType + issueCategory.
 */
export const TICKET_TYPES = { NORMAL: "NORMAL", ATTENDANCE: "ATTENDANCE" } as const;
export const TICKET_TYPE_LABEL: Record<string, string> = { NORMAL: "Normal", ATTENDANCE: "Attendance" };

/** Normal ticket issues → the existing category (desk) that handles them */
export const NORMAL_ISSUES: { label: string; route: string }[] = [
    { label: "Login Problem", route: "HR Desk" },
    { label: "Password Reset", route: "HR Desk" },
    { label: "Portal Not Working", route: "Technical" },
    { label: "Technical Issue", route: "Technical" },
    { label: "Profile Update Issue", route: "HR Desk" },
    { label: "Leave Application Issue", route: "HR Desk" },
    { label: "Document Upload Issue", route: "Technical" },
    { label: "Schedule Issue", route: "HR Desk" },
    { label: "Permission / Access Issue", route: "Technical" },
    { label: "Other", route: "Others" },
];
/** The existing categories — kept exactly as before */
export const EXISTING_CATEGORIES: { value: string; label: string }[] = [
    { value: "HR Desk", label: "HR Desk [Accounts/HR]" },
    { value: "Misconduct", label: "Misconduct / Institute Issues" },
    { value: "Academic", label: "Academic / Student Concerns" },
    { value: "Technical", label: "Technical Issues" },
    { value: "Against HR (Confidential to Founders)", label: "Against HR (Confidential to Founders)" },
    { value: "Others", label: "Others" },
];

export const ATTENDANCE_ISSUES: string[] = [
    "Unable to Clock In", "Unable to Clock Out", "Clock-In Time Incorrect", "Clock-Out Time Incorrect",
    "Attendance Not Marked", "Attendance Showing Absent", "Attendance Showing Half Day Incorrectly",
    "Location Not Fetching", "Incorrect Location Detected", "Location Permission Issue", "Outside Allowed Location Error",
    "GPS / Geolocation Issue", "Clock-In Button Not Working", "Clock-Out Button Not Working", "Attendance Record Missing",
    "Attendance Sync Issue", "Incorrect Working Hours", "Other Attendance Issue",
];
/** Category stored for the new attendance tickets (routes to HR like the other attendance categories) */
export const ATTENDANCE_TICKET_CATEGORY = "Attendance / Clock-In Ticket";
/** Existing attendance category — keeps its own flow (resolving it applies the attendance override) */
export const ATTENDANCE_OVERRIDE_CATEGORY = "Attendance Override Request";

/** Type of any ticket, including tickets raised before ticket types existed */
export function ticketTypeOf(t: any): "NORMAL" | "ATTENDANCE" {
    if (t?.ticketType === "ATTENDANCE" || t?.ticketType === "NORMAL") return t.ticketType;
    return /attendance/i.test(String(t?.targetCategory || "")) ? "ATTENDANCE" : "NORMAL";
}
export const ticketIssueOf = (t: any): string => t?.issueCategory || t?.targetCategory || "";
