export const LEADERBOARD_START_DATE = new Date("2026-05-01");

export interface AuditEntry {
    date: string;
    points: number;
    type: 'Attendance' | 'Dress Code' | 'Holiday' | 'Rating' | 'Penalty' | 'Responsibility' | 'Manual';
    reason: string;
}

export interface PerformanceStats {
    totalPoints: number;
    calculatedStars: number;
    flagCounts: {
        yellow: number; // Late + Early Out + Location Diff
        red: number;    // Misconduct
        orange: number; // Dress Code
        black: number;  // Missed Meeting
        blue: number;   // Performance/PIP
    };
    detailedFlags: {
        late: number;
        earlyOut: number;
        dressCode: number;
        misconduct: number;
        performance: number;
        meetingAbsent: number;
        locationDiff: number;
    };
    presentDays: number;
    approvedResponsibilities: any[];
    auditTrail: AuditEntry[];
}

export function calculatePerformance(
    attendanceRecords: any[],
    additionalResponsibilities: any[],
    monthlyScores: any[],
    employeeId: string,
    holidays: any[] = [],
    employeeLocation: string = "",
    baseStars: number = 3.0,
    globalRatings: any[] = []
): PerformanceStats {
    const START_DATE = LEADERBOARD_START_DATE;
    const auditTrail: AuditEntry[] = [];

    // Filter Attendance: Only from April 1st
    const myAttendance = attendanceRecords.filter(r => {
        const rDate = new Date(r.date);
        return r.employeeId === employeeId && rDate >= START_DATE;
    });

    // Filter Responsibilities: Only from April 1st
    const approvedResponsibilities = additionalResponsibilities.filter(r => {
        const rDate = new Date(r.date);
        return r.employeeId === employeeId && r.status === "Approved" && rDate >= START_DATE;
    });

    // Filter Ratings (both from employee.monthlyScores and global ratings array): Only from April 1st
    const filteredMonthlyScores = (monthlyScores || []).filter(r => {
        let rDate;
        if (r.date) {
            rDate = new Date(r.date);
        } else if (r.period) {
            if (r.period.includes(" - ")) {
                const parts = r.period.split(" - ");
                const yearMatch = parts[1].match(/\d{4}/);
                const year = yearMatch ? yearMatch[0] : "2026";
                rDate = new Date(`${parts[0]}, ${year}`);
            } else {
                rDate = new Date(r.period);
            }
        }
        return rDate && rDate >= START_DATE;
    });

    const myGlobalRatings = (globalRatings || []).filter(r => {
        const rDate = new Date(r.date);
        return r.employeeId === employeeId && rDate >= START_DATE;
    });

    // Combine them for processing
    const allRatings = [...filteredMonthlyScores, ...myGlobalRatings];

    let points = 0;
    let lateCount = 0;
    let earlyOutCount = 0;
    let dressCodeCount = 0;
    let misconductCount = 0;
    let performanceCount = 0;
    let meetingAbsentCount = 0;
    let locationDiffCount = 0;
    let presentDays = 0;

    myAttendance.forEach(record => {
        const flags = record.flags || {};
        const isLate = flags.late === true;
        const isEarlyOut = flags.earlyOut === true;
        const isDressCodeFlag = flags.dressCode === true;
        const isMisconduct = flags.misconduct === true;
        const isPerformance = flags.performance === true;
        const isMeetingAbsent = flags.meetingAbsent === true;
        const isLocationDiff = flags.locationDiff === true;

        if (isLate) lateCount++;
        if (isEarlyOut) earlyOutCount++;
        if (isDressCodeFlag) dressCodeCount++;
        if (isMisconduct) misconductCount++;
        if (isPerformance) performanceCount++;
        if (isMeetingAbsent) meetingAbsentCount++;
        if (isLocationDiff) locationDiffCount++;

        // 1. Attendance Points
        if (record.status === "Present") {
            presentDays++;
            const hasAnyFlag = Object.values(record.flags || {}).some(v => v === true);
            
            if (!hasAnyFlag) {
                points += 2;
                auditTrail.push({ date: record.date, points: 2, type: 'Attendance', reason: 'Perfect Attendance (On-time, No Flags)' });
            }
            if (isLate) {
                points -= 5;
                auditTrail.push({ date: record.date, points: -5, type: 'Penalty', reason: 'Late Arrival Penalty' });
            }
            if (isEarlyOut) {
                points -= 5;
                auditTrail.push({ date: record.date, points: -5, type: 'Penalty', reason: 'Early Clock-out Penalty' });
            }
            if (isLocationDiff) {
                points -= 5;
                auditTrail.push({ date: record.date, points: -5, type: 'Penalty', reason: 'Geofencing Mismatch Penalty' });
            }
        }

        // 2. Dress Code Points (NO DRESS CODE POINTS ON SATURDAYS)
        const rDate = new Date(record.date);
        const isSaturday = rDate.getDay() === 6;

        if (!isSaturday) {
            if (record.dressCodeStatus === "Approved") {
                points += 2;
                auditTrail.push({ date: record.date, points: 2, type: 'Dress Code', reason: 'Dress Code Compliance Approved' });
            } else if (record.dressCodeStatus === "Rejected" || isDressCodeFlag) {
                points -= 5; 
                auditTrail.push({ date: record.date, points: -5, type: 'Dress Code', reason: 'Dress Code Violation' });
            }
        }
    });

    // 3. Holiday Points (+4 for holidays, +2 if it's Saturday, EXCLUDING Sundays)
    const holidayDatesWithAttendance = new Set(myAttendance.filter(r => r.status === "Present").map(r => r.date));

    const approvedHolidays = (holidays || []).filter(h => {
        const hDate = new Date(h.date);
        const isAfterStart = hDate >= START_DATE;
        const isApproved = h.status === "Approved";
        const isForMe = h.forAll || (employeeLocation && h.collegeIds?.includes(employeeLocation));
        const isSunday = hDate.getDay() === 0;
        const hasWorkRecord = holidayDatesWithAttendance.has(h.date);
        
        return isAfterStart && isApproved && isForMe && !isSunday && !hasWorkRecord;
    });
    
    approvedHolidays.forEach(h => {
        const hDate = new Date(h.date);
        const isSaturdayHoliday = hDate.getDay() === 6;
        const val = isSaturdayHoliday ? 2 : 4;
        points += val;
        auditTrail.push({ date: h.date, points: val, type: 'Holiday', reason: `${h.name} (Holiday)` });
    });

    // 4. Rating Points
    allRatings.forEach(r => {
        const rating = r.score || r.rating || 0;
        const date = r.date || (r.period ? r.period.split(" - ")[0] : "");
        
        // If the rating has explicitly stored points (including manual bonuses), use them
        if (r.points !== undefined && r.points !== null && r.points !== 0) {
            const val = r.points;
            points += val;
            auditTrail.push({ 
                date, 
                points: val, 
                type: val > 0 ? 'Rating' : 'Penalty', 
                reason: `Monthly Progress Rating: ${rating.toFixed(1)}/5 Score` 
            });
        } else if (rating > 0) {
            // Fallback to auto-calculation for legacy records or neutral ratings
            if (rating > 4.2) {
                const val = Math.round(rating * 10);
                points += val;
                auditTrail.push({ date, points: val, type: 'Rating', reason: `Monthly Progress Rating: ${rating.toFixed(1)}/5 Score` });
            } else if (rating >= 2.0 && rating <= 3.5) {
                const val = Math.round((rating - 5) * 10);
                points += val;
                auditTrail.push({ date, points: val, type: 'Penalty', reason: `Monthly Progress Rating: ${rating.toFixed(1)}/5 Score` });
            } else if (rating < 2.0) {
                const val = Math.round((rating - 5) * 20);
                points += val;
                auditTrail.push({ date, points: val, type: 'Penalty', reason: `Monthly Progress Rating: ${rating.toFixed(1)}/5 Score` });
            } else {
                // Neutral rating (3.5 - 4.2)
                auditTrail.push({ date, points: 0, type: 'Rating', reason: `Monthly Progress Rating: ${rating.toFixed(1)}/5 Score` });
            }
        }
    });

    // 5. Misconduct/PIP/Meeting Penalties
    if (misconductCount > 0) {
        points -= misconductCount * 50;
        auditTrail.push({ date: new Date().toISOString().split('T')[0], points: -misconductCount * 50, type: 'Penalty', reason: `Misconduct Violation (${misconductCount} total)` });
    }
    if (performanceCount > 0) {
        points -= performanceCount * 20;
        auditTrail.push({ date: new Date().toISOString().split('T')[0], points: -performanceCount * 20, type: 'Penalty', reason: `PIP/Performance Flags (${performanceCount} total)` });
    }
    if (meetingAbsentCount > 0) {
        points -= meetingAbsentCount * 10;
        auditTrail.push({ date: new Date().toISOString().split('T')[0], points: -meetingAbsentCount * 10, type: 'Penalty', reason: `Mandatory Meeting Absence (${meetingAbsentCount} total)` });
    }

    // 6. Additional Responsibilities (Capped at 100/period)
    const totalRespPoints = approvedResponsibilities.reduce((acc, curr) => acc + (curr.points || 0), 0);
    const cappedRespPoints = Math.min(100, totalRespPoints);
    points += cappedRespPoints;
    
    if (cappedRespPoints > 0) {
        auditTrail.push({ 
            date: new Date().toISOString().split('T')[0], 
            points: cappedRespPoints, 
            type: 'Responsibility', 
            reason: `Additional Responsibilities (${approvedResponsibilities.length} items${totalRespPoints > 100 ? ', capped at 100' : ''})` 
        });
    }

    // 7. Star Conversion
    const calculatedStars = Math.min(5.0, Math.max(0.0, baseStars + (points / 200) * 0.5));

    return {
        totalPoints: points,
        calculatedStars,
        flagCounts: {
            yellow: lateCount + earlyOutCount + locationDiffCount,
            red: misconductCount,
            orange: dressCodeCount,
            black: meetingAbsentCount,
            blue: performanceCount
        },
        detailedFlags: {
            late: lateCount,
            earlyOut: earlyOutCount,
            dressCode: dressCodeCount,
            misconduct: misconductCount,
            performance: performanceCount,
            meetingAbsent: meetingAbsentCount,
            locationDiff: locationDiffCount
        },
        presentDays,
        approvedResponsibilities,
        auditTrail: auditTrail.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    };
}

export const BLOCKED_EMAILS = [
    "ayush.chouhan@geeksofgurukul.com",
    "sachin@geeksofgurukul.com",
    "ayush@geeksofgurukul.com",
    "skgupta272829@gmail.com",
    "abhishek.tiwari@geeksofgurukul.com",
    "ceo@geeksofgurukul.com",
    "cto@geeksofgurukul.com",
    "coo@geeksofgurukul.com"
];

export function getLeaderboardStats(
    employees: any[],
    attendanceRecords: any[],
    additionalResponsibilities: any[],
    holidays: any[],
    performanceStars: any[],
    ratings: any[] = []
) {
    return performanceStars
        .map(s => {
            const emp = employees.find(e => e.id === s.employeeId);
            if (!emp || emp.status === "Resigned") return null;
            if (BLOCKED_EMAILS.includes(emp.email?.toLowerCase())) return null;

            const perf = calculatePerformance(
                attendanceRecords,
                additionalResponsibilities,
                emp.monthlyScores || [],
                s.employeeId,
                holidays,
                emp.location,
                3.0,
                ratings
            );

            return {
                ...s,
                emp,
                ...perf,
                responsibilities: perf.approvedResponsibilities,
                flagsCount: Object.values(perf.detailedFlags).reduce((a: number, b: any) => a + (typeof b === 'number' ? b : 0), 0)
            };
        })
        .filter((item): item is any => item !== null)
        .sort((a, b) => b.totalPoints - a.totalPoints || a.flagsCount - b.flagsCount);
}


