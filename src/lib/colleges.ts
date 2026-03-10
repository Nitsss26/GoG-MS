// College / University Geo-Coordinates for attendance radius tracking
// These coordinates are used by the attendance system to verify employee location

export interface College {
    id: string;
    name: string;
    shortName: string;
    lat: number;
    lng: number;
    radiusKm: number;
    address: string;
    city: string;
    state: string;
}

export const COLLEGES: College[] = [
    {
        id: "sage-bhopal",
        name: "SAGE University Bhopal",
        shortName: "SAGE Bhopal",
        lat: 23.2100,
        lng: 77.4365,
        radiusKm: 2,
        address: "Bypass Road, Kailash Nagar, Bhopal",
        city: "Bhopal",
        state: "Madhya Pradesh"
    },
    {
        id: "sage-indore",
        name: "SAGE University Indore",
        shortName: "SAGE Indore",
        lat: 22.7530,
        lng: 75.8937,
        radiusKm: 2,
        address: "Bypass Road, Indore",
        city: "Indore",
        state: "Madhya Pradesh"
    },
    {
        id: "barkatullah",
        name: "Barkatullah University",
        shortName: "BU Bhopal",
        lat: 23.2076,
        lng: 77.4171,
        radiusKm: 1.5,
        address: "Hoshangabad Road, Bhopal",
        city: "Bhopal",
        state: "Madhya Pradesh"
    },
    {
        id: "centurion",
        name: "Centurion University",
        shortName: "Centurion",
        lat: 19.2183,
        lng: 84.6838,
        radiusKm: 2,
        address: "Paralakhemundi, Gajapati",
        city: "Paralakhemundi",
        state: "Odisha"
    },
    {
        id: "scope-global",
        name: "Scope Global Skills University",
        shortName: "Scope Global",
        lat: 23.2599,
        lng: 77.4126,
        radiusKm: 2,
        address: "Bhopal",
        city: "Bhopal",
        state: "Madhya Pradesh"
    },
];

export function getCollegeById(id: string): College | undefined {
    return COLLEGES.find(c => c.id === id);
}

export function getCollegeByName(name: string): College | undefined {
    return COLLEGES.find(c =>
        c.name.toLowerCase() === name.toLowerCase() ||
        c.shortName.toLowerCase() === name.toLowerCase() ||
        c.id === name
    );
}

export function resolveLocationToCollege(locationStr: string): College | undefined {
    if (!locationStr || locationStr.toLowerCase() === "wfh") return undefined;
    // Try exact match first
    const exact = getCollegeByName(locationStr) || getCollegeById(locationStr);
    if (exact) return exact;
    // Try partial match
    const lower = locationStr.toLowerCase();
    return COLLEGES.find(c =>
        c.name.toLowerCase().includes(lower) ||
        c.shortName.toLowerCase().includes(lower) ||
        lower.includes(c.shortName.toLowerCase()) ||
        lower.includes(c.name.toLowerCase())
    );
}

// Indian national/festival holidays (2026) for calendar display
export const INDIAN_HOLIDAYS_2026 = [
    { date: "2026-01-26", name: "Republic Day", type: "national" as const },
    { date: "2026-02-16", name: "Maha Shivaratri", type: "festival" as const },
    { date: "2026-03-03", name: "Holi", type: "festival" as const },
    { date: "2026-03-04", name: "Holi (Dhuleti)", type: "festival" as const },
    { date: "2026-03-27", name: "Ram Navami", type: "festival" as const },
    { date: "2026-04-03", name: "Good Friday", type: "festival" as const },
    { date: "2026-04-14", name: "Dr. Ambedkar Jayanti", type: "national" as const },
    { date: "2026-05-01", name: "May Day", type: "national" as const },
    { date: "2026-05-25", name: "Buddha Purnima", type: "festival" as const },
    { date: "2026-06-16", name: "Bakri Eid", type: "festival" as const },
    { date: "2026-07-06", name: "Muharram", type: "festival" as const },
    { date: "2026-08-15", name: "Independence Day", type: "national" as const },
    { date: "2026-10-02", name: "Gandhi Jayanti", type: "national" as const },
    { date: "2026-10-20", name: "Dussehra", type: "festival" as const },
    { date: "2026-11-08", name: "Diwali", type: "festival" as const },
    { date: "2026-12-25", name: "Christmas", type: "festival" as const },
];

// Flag configuration shared across pages
export const FLAG_CONFIG: Record<string, { label: string; emoji: string; color: string; dotColor: string }> = {
    late: { label: "Late Clock-In", emoji: "🟡", color: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20", dotColor: "bg-yellow-400" },
    earlyOut: { label: "Early Clock-Out", emoji: "🟡", color: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20", dotColor: "bg-yellow-400" },
    locationDiff: { label: "Location Diff", emoji: "🟡", color: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20", dotColor: "bg-yellow-400" },
    misconduct: { label: "Misconduct", emoji: "🔴", color: "text-red-400 bg-red-500/10 border-red-500/20", dotColor: "bg-red-500" },
    dressCode: { label: "Dress Code", emoji: "🟠", color: "text-orange-400 bg-orange-500/10 border-orange-500/20", dotColor: "bg-orange-400" },
    meetingAbsent: { label: "Meeting Absent", emoji: "⚫", color: "text-zinc-300 bg-zinc-700/50 border-zinc-600/30", dotColor: "bg-zinc-800 border border-zinc-700" },
    performance: { label: "Performance", emoji: "🔵", color: "text-blue-400 bg-blue-500/10 border-blue-500/20", dotColor: "bg-blue-400" },
};
