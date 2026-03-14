export const FALLBACK_TIMINGS: Record<string, { in: string; out: string }> = {
    "bansal-kokta": { in: "09:30", out: "16:20" },
    "bansal-mandideep": { in: "10:00", out: "16:30" },
    "BGI Kokta": { in: "09:30", out: "16:20" },
    "BGI Mandideep": { in: "10:00", out: "16:30" },
    "sgsu": { in: "10:15", out: "16:00" },
    "scope-global": { in: "10:15", out: "16:00" },
    "sage-bhopal": { in: "09:30", out: "18:30" },
    "sage-indore": { in: "09:30", out: "18:30" },
    "centurion-vizianagaram": { in: "09:30", out: "16:00" },
    "centurion-bhubaneswar": { in: "09:30", out: "16:00" },
    "centurion-paralakhemundi": { in: "09:30", out: "16:00" },
    "cutm-bbsr": { in: "09:30", out: "16:00" },
    "cutm-pkd": { in: "09:30", out: "16:00" },
    "SDBC": { in: "09:30", out: "16:00" },
    "oriental-indore": { in: "09:15", out: "16:30" },
    "gyanveer": { in: "09:30", out: "16:00" }
};

export const CUSTOM_SCHEDULE_RULES = [
    { nameRegex: /Ravi Ranjan/i, location: "centurion-bhubaneswar", in: "09:30", out: "17:30", days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] },
    { nameRegex: /Vipul Kumar/i, location: "centurion-bhubaneswar", in: "09:30", out: "17:30", days: ["Mon", "Tue", "Wed", "Thu", "Fri"] },
    { nameRegex: /Aman/i, location: "centurion-bhubaneswar", in: "09:30", out: "17:30", days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] },
    { nameRegex: /Verman/i, location: "centurion-bhubaneswar", in: "09:30", out: "17:30", days: ["Mon", "Tue", "Wed", "Thu", "Fri"] },
    { nameRegex: /Siddharda/i, location: "centurion-bhubaneswar", in: "09:30", out: "17:30", days: ["Mon", "Tue", "Wed", "Thu", "Fri"] },
    { nameRegex: /Mriganka/i, location: "centurion-paralakhemundi", in: "09:30", out: "17:30", days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] },
    { nameRegex: /Sushant/i, location: "centurion-paralakhemundi", in: "09:30", out: "17:30", days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] },
    { nameRegex: /Chandan/i, location: "centurion-paralakhemundi", in: "09:30", out: "17:30", days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] },
    { nameRegex: /Jeet/i, location: "centurion-vizianagaram", in: "09:30", out: "16:30", days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] },
    { nameRegex: /K\. Revanth/i, location: "centurion-vizianagaram", in: "09:30", out: "17:30", days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] },
    { nameRegex: /Ankit Singh/i, location: "sage-bhopal", in: "08:30", out: "15:00", days: ["Mon", "Tue", "Wed", "Thu", "Fri"] },
    { nameRegex: /Ayush Sahu/i, location: "sage-bhopal", in: "10:15", out: "16:30", days: ["Mon", "Tue", "Wed", "Thu", "Fri"] },
    { nameRegex: /Ravi Bhushan Pratap/i, location: "sgsu", in: "10:15", out: "16:00", days: ["Mon", "Tue", "Wed", "Thu", "Fri"] },
    { nameRegex: /Suman Rajak/i, location: "sgsu", in: "10:15", out: "16:00", days: ["Mon", "Tue", "Wed", "Thu", "Fri"] },
    { nameRegex: /Sahil Burde/i, location: "bansal-kokta", in: "09:30", out: "16:20", days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] },
    { nameRegex: /Pranjul Sahu/i, location: "bansal-kokta", in: "09:30", out: "16:20", days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] },
    { nameRegex: /Mukesh Kumar/i, location: "bansal-kokta", in: "09:30", out: "16:20", days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] },
    { nameRegex: /Amit Singh Patel/i, location: "bansal-kokta", in: "09:30", out: "16:20", days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] },
    { nameRegex: /Mayank Choudhary/i, location: "bansal-kokta", in: "09:30", out: "16:20", days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] },
    { nameRegex: /Priyanka Kumawat/i, location: "bansal-kokta", in: "09:30", out: "16:20", days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] },
    { nameRegex: /Sujal Verma/i, location: "bansal-mandideep", in: "10:00", out: "16:00", days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] },
    { nameRegex: /Prerna Saluja/i, location: "bansal-kokta", in: "09:35", out: "16:20", days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] },
    { nameRegex: /Rahul/i, location: "sage-indore", in: "09:30", out: "16:00", days: ["Mon", "Tue", "Wed", "Thu", "Fri"] },
    { nameRegex: /Siddhant/i, location: "sage-indore", in: "09:30", out: "16:00", days: ["Mon", "Tue", "Wed", "Thu", "Fri"] },
    { nameRegex: /Nishal Caleb/i, location: "oriental-indore", in: "09:15", out: "16:30", days: ["Mon", "Tue", "Wed", "Thu", "Fri"] },
    { nameRegex: /Sumit Maity/i, location: "oriental-indore", in: "09:15", out: "16:30", days: ["Mon", "Tue", "Wed", "Thu", "Fri"] },
    { nameRegex: /Avikal/i, location: "SDBC", in: "09:30", out: "16:00", days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] },
    { nameRegex: /Vivek/i, location: "SDBC", in: "09:30", out: "16:00", days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] },
    { nameRegex: /Vinay/i, location: "SDBC", in: "09:30", out: "16:00", days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] },
    { nameRegex: /Anirudh/i, location: "SDBC", in: "09:30", out: "16:00", days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] },
    { nameRegex: /Shekhar/i, location: "SDBC", in: "09:30", out: "16:00", days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] },
    { nameRegex: /Aniket Chouhan/i, location: "SDBC", in: "09:45", out: "16:00", days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] },
    {
        nameRegex: /Abhishek Tiwari/i,
        multiLocation: [
            { location: "sage-bhopal", in: "10:15", out: "16:30", days: ["Tue", "Thu", "Fri"] },
            { location: "sgsu", in: "10:15", out: "16:00", days: ["Mon", "Wed"] },
        ],
        wfhDays: ["Sat"]
    },
    {
        nameRegex: /Yamini/i,
        multiLocation: [
            { location: "sage-indore", in: "10:15", out: "15:00", days: ["Mon", "Tue", "Wed", "Thu"] },
            { location: "oriental-indore", in: "09:45", out: "16:00", days: ["Fri", "Sat"] },
        ]
    }
];

export const isThirdSaturday = (date: Date) => {
    const day = date.getDay();
    if (day !== 6) return false;
    const dateNum = date.getDate();
    return dateNum > 14 && dateNum <= 21;
};
