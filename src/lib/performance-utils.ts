export const LEADERBOARD_START_DATE = new Date("2026-04-01");

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
}

export function calculatePerformance(
    attendanceRecords: any[],
    additionalResponsibilities: any[],
    biWeeklyScores: any[],
    employeeId: string,
    holidays: any[] = [],
    employeeLocation: string = "",
    baseStars: number = 3.0
): PerformanceStats {
    const START_DATE = LEADERBOARD_START_DATE;

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

    // Filter Ratings: Only from April 1st
    const myRatings = (biWeeklyScores || []).filter(r => {
        const rDate = new Date(r.date || "");
        return rDate >= START_DATE;
    });

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
            if (!isLate && !isEarlyOut && !isLocationDiff) {
                points += 2; // Perfect attendance
            }
            if (isLate) points -= 5;
            if (isEarlyOut) points -= 5;
            if (isLocationDiff) points -= 5; // Yellow Flag Misbehaviour
        }

        // 2. Dress Code Points
        if (record.dressCodeStatus === "Approved") {
            points += 2;
        } else if (record.dressCodeStatus === "Rejected" || isDressCodeFlag) {
            points -= 5; // Orange Flag
        }
    });

    // 3. Holiday Points (+4 for holidays at their location)
    const approvedHolidays = (holidays || []).filter(h => {
        const hDate = new Date(h.date);
        const isAfterStart = hDate >= START_DATE;
        const isApproved = h.status === "Approved";
        const isForMe = h.forAll || (employeeLocation && h.collegeIds?.includes(employeeLocation));
        return isAfterStart && isApproved && isForMe;
    });
    points += approvedHolidays.length * 4;

    // 4. Rating Points
    myRatings.forEach(r => {
        const rating = r.score || r.rating || 0;
        if (rating > 4.2) {
            points += rating * 10;
        } else if (rating >= 2.0 && rating <= 3.5) {
            points += (rating - 5) * 10; // Penalty
        } else if (rating < 2.0) {
            points += (rating - 5) * 20; // Penalty
        }
    });

    // 5. Misconduct/PIP/Meeting Penalties
    points -= misconductCount * 50; // Red Flag
    points -= performanceCount * 20; // Blue Flag
    points -= meetingAbsentCount * 10; // Black Flag

    // 6. Additional Responsibilities (Capped at 100/period)
    const responsibilityPoints = Math.min(100, approvedResponsibilities.reduce((acc, curr) => acc + (curr.points || 0), 0));
    points += responsibilityPoints;

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
        approvedResponsibilities
    };
}
