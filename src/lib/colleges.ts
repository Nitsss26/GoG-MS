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
        id: "centurion-bhubaneswar",
        name: "Centurion University (CUTM) Bhubaneswar",
        shortName: "CUTM Bhubaneswar",
        lat: 20.176947,
        lng: 85.707729,
        radiusKm: 2,
        address: "Ramachandrapur, Jatni, Bhubaneswar, Odisha, 752050",
        city: "Bhubaneswar",
        state: "Odisha"
    },
    {
        id: "bansal-mandideep",
        name: "Bansal College of Engineering, BGI, - Mandideep",
        shortName: "BGI Mandideep",
        lat: 23.03720391098222,
        lng: 77.55742391129526,
        radiusKm: 2,
        address: "NH-12, near Bhopal, MP, 462046",
        city: "Mandideep",
        state: "Madhya Pradesh"
    },
    {
        id: "bansal-kokta",
        name: "Bansal Institute of Research Technology & Science, Kokta",
        shortName: "BGI Kokta",
        lat: 23.269452,
        lng: 77.509497,
        radiusKm: 2,
        address: "Raisen Road, Bhopal, MP, 462021",
        city: "Bhopal",
        state: "Madhya Pradesh"
    },
    {
        id: "gyanveer",
        name: "Gyanveer University (GU)",
        shortName: "Gyanveer University",
        lat: 23.87427599889863,
        lng: 78.60787718177589,
        radiusKm: 2,
        address: "Village-Maa-Emliya, Rahatgarh, Sagar, MP, 470115",
        city: "Sagar",
        state: "Madhya Pradesh"
    },
    {
        id: "centurion-paralakhemundi",
        name: "Centurion University (CUTM) Paralakhemundi",
        shortName: "CUTM Paralakhemundi",
        lat: 18.818788224302555,
        lng: 84.1437052960369,
        radiusKm: 2,
        address: "Alluri Nagar, P.O. R Sitapur, Uppalada, PKD, Odisha",
        city: "Paralakhemundi",
        state: "Odisha"
    },
    {
        id: "scope-global",
        name: "Scope Global Skills University (SGSU)",
        shortName: "SGSU",
        lat: 23.154472,
        lng: 77.478716,
        radiusKm: 2,
        address: "Central India's 1st Skill University, Bhopal",
        city: "Bhopal",
        state: "Madhya Pradesh"
    },
    {
        id: "oriental-indore",
        name: "Oriental University",
        shortName: "Oriental University",
        lat: 22.802552,
        lng: 75.85635,
        radiusKm: 2,
        address: "Sanwer Road, Jakhya, Indore, MP, 453555",
        city: "Indore",
        state: "Madhya Pradesh"
    },
    {
        id: "sage-bhopal",
        name: "Sage University Bhopal",
        shortName: "SAGE Bhopal",
        lat: 23.184109,
        lng: 77.522191,
        radiusKm: 2,
        address: "Ayodhya Nagar, Bhopal, MP, 462041",
        city: "Bhopal",
        state: "Madhya Pradesh"
    },
    {
        id: "centurion-vizianagaram",
        name: "Centurion University Vizianagaram",
        shortName: "CUTM Vizianagaram",
        lat: 18.189786,
        lng: 83.388425,
        radiusKm: 2,
        address: "Rollavaka Village Bondapalli, AP, 535003",
        city: "Vizianagaram",
        state: "Andhra Pradesh"
    },
    {
        id: "sage-indore",
        name: "Sage University Indore",
        shortName: "SAGE Indore",
        lat: 22.636632721551177,
        lng: 75.85187466499627,
        radiusKm: 2,
        address: "Rau Bypass Road, Indore, MP, 452020",
        city: "Indore",
        state: "Madhya Pradesh"
    },
    {
        id: "SDBC",
        name: "Sushila Devi Bansal College of Technology",
        shortName: "SDBC",
        lat: 22.59748,
        lng: 75.787466,
        radiusKm: 2,
        address: "AB Road, Umaria, Near Rau, Indore, Madhya Pradesh 453331",
        city: "Indore",
        state: "Madhya Pradesh"
    },
    {
        id: "sgsu",
        name: "Scope Global Skills University (SGSU)",
        shortName: "SGSU",
        lat: 23.154472,
        lng: 77.478716,
        radiusKm: 2,
        address: "Bhopal",
        city: "Bhopal",
        state: "Madhya Pradesh"
    },
    {
        id: "bansi-kokta",
        name: "Bansal Institute of Research Technology & Science, Kokta",
        shortName: "BGI Kokta",
        lat: 23.267874766410966,
        lng: 77.5089131650162,
        radiusKm: 2,
        address: "Kokta, Bhopal",
        city: "Bhopal",
        state: "Madhya Pradesh"
    },
    {
        id: "bce-mandideep",
        name: "Bansal College of Engineering, Mandideep",
        shortName: "BCE Mandideep",
        lat: 23.037134097357068,
        lng: 77.55757438035224,
        radiusKm: 2,
        address: "Mandideep",
        city: "Mandideep",
        state: "Madhya Pradesh"
    },
    {
        id: "cutm-bbsr",
        name: "Centurion University (CUTM) Bhubaneswar",
        shortName: "CUTM Bhubaneswar",
        lat: 20.178496425093297,
        lng: 85.70762188821803,
        radiusKm: 2,
        address: "Bhubaneswar",
        city: "Bhubaneswar",
        state: "Odisha"
    },
    {
        id: "cutm-pkd",
        name: "Centurion University (CUTM) Paralakhemundi",
        shortName: "CUTM Paralakhemundi",
        lat: 31.636551,
        lng: 74.901152,
        radiusKm: 2,
        address: "Paralakhemundi",
        city: "Paralakhemundi",
        state: "Odisha"
    }
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
