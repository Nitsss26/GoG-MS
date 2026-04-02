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
            if (!isLate && !isEarlyOut) {
                points += 2; // Perfect attendance
            }
            if (isLate) points -= 5;
            if (isEarlyOut) points -= 5;
        }

        // 2. Dress Code Points
        if (record.dressCodeStatus === "Approved") {
            points += 2;
        } else if (record.dressCodeStatus === "Rejected" || isDressCodeFlag) {
            points -= 5;
        }
    });

    // 3. Rating Points
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

    // 4. Misconduct/PIP/Meeting Penalties (already partially covered by loops, but these are per flag instance)
    points -= misconductCount * 50;
    points -= performanceCount * 20;
    points -= meetingAbsentCount * 10;

    // 5. Additional Responsibilities (Capped at 100/period)
    const responsibilityPoints = Math.min(100, approvedResponsibilities.reduce((acc, curr) => acc + (curr.points || 0), 0));
    points += responsibilityPoints;

    // 6. Star Conversion
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
