import { CUSTOM_SCHEDULE_RULES, FALLBACK_TIMINGS, isThirdSaturday } from './attendance-config';

export interface ExpectedTiming {
    in: string;
    out: string;
    location: string;
    isWFH: boolean;
}

export function getExpectedTimingInternal(employeeName: string, employeeLocation: string, dateStr: string): ExpectedTiming {
    const date = new Date(dateStr);
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const dayName = dayNames[date.getDay()];

    // 1. Check Custom Rules
    const customRule = CUSTOM_SCHEDULE_RULES.find(r => r.nameRegex.test(employeeName));

    if (customRule) {
        // Multi-location logic
        if ('multiLocation' in customRule && customRule.multiLocation) {
            const locRule = customRule.multiLocation.find(l => l.days.includes(dayName));
            if (locRule) {
                return { in: locRule.in, out: locRule.out, location: locRule.location, isWFH: false };
            }
        }

        // WFH Days
        if (customRule.wfhDays?.includes(dayName)) {
            return { in: customRule.in || "09:30", out: customRule.out || "18:30", location: "WFH", isWFH: true };
        }

        // Third Saturday WFH
        if ('thirdSatWFH' in customRule && customRule.thirdSatWFH && isThirdSaturday(date)) {
            return { in: customRule.in || "09:30", out: customRule.out || "18:30", location: "WFH", isWFH: true };
        }

        // Regular Custom Rule
        if (customRule.days && customRule.days.includes(dayName)) {
            return { 
                in: customRule.in || "09:30", 
                out: customRule.out || "18:30", 
                location: customRule.location || employeeLocation, 
                isWFH: false 
            };
        }
    }

    // 2. Fallback Timings based on Employee's assigned location
    const fallback = FALLBACK_TIMINGS[employeeLocation] || { in: "09:30", out: "18:30" };
    
    // Check if Sunday
    if (dayName === "Sun") {
        return { in: fallback.in, out: fallback.out, location: "Holiday", isWFH: true };
    }

    return { 
        in: fallback.in, 
        out: fallback.out, 
        location: employeeLocation, 
        isWFH: false 
    };
}
