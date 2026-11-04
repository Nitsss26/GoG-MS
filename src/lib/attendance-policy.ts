/**
 * GOG attendance & dress-code disciplinary policy (in force from POLICY_FROM).
 * Pure functions — usable on the server and in the browser. Records dated before POLICY_FROM keep the earlier rules.
 *
 * Late Arrivals Policy (Late Clock-In only; Early Clock-Out keeps its earlier ladder):
 *   1st, 2nd instance in a month → warning
 *   3rd → Half-day pay cut · 4th → Full-day pay cut · 5th and onwards → 2 days' pay cut
 *   The pay cut is automatic (no HR approval needed). A late clock-in whose justification HR approved, that HR
 *   waived, or whose flag was removed does not count; one whose justification is still under review is on hold.
 *
 * Dress Code Violation – Disciplinary Process:
 *   1st, 2nd instance → warning via email (recorded in HR records)
 *   3rd → 10% · 4th → 20% · 5th and onwards → 30% fine of one day's gross salary (with a warning email)
 *   No payable-day deduction: the fine is recorded as a percentage; the rupee amount is worked out by the finance system.
 */
export const POLICY_FROM = '2026-11-04';
export const isNewPolicy = (date?: string) => !!date && String(date) >= POLICY_FROM;

const ORD = ['', 'First', 'Second', 'Third', 'Fourth', 'Fifth', 'Sixth', 'Seventh', 'Eighth', 'Ninth', 'Tenth'];
export const ordinalWord = (n: number) => ORD[n] || `${n}th`;

/** Late Clock-In ladder (new policy) */
export function lateLadder(instance: number) {
    if (instance <= 1) return { level: 'FIRST_WARNING', proposedDeduction: 'None', days: 0, hrStatus: 'Not Required' };
    if (instance === 2) return { level: 'SECOND_WARNING', proposedDeduction: 'None', days: 0, hrStatus: 'Not Required' };
    if (instance === 3) return { level: 'HALF_DAY', proposedDeduction: 'Half-Day', days: 0.5, hrStatus: 'Approved for Payroll' };
    if (instance === 4) return { level: 'FULL_DAY', proposedDeduction: 'Full-Day', days: 1, hrStatus: 'Approved for Payroll' };
    return { level: 'TWO_DAY', proposedDeduction: '2 Days', days: 2, hrStatus: 'Approved for Payroll' };
}

/** Dress Code ladder (new policy): warning number + fine % of one day's gross salary */
export function dressLadder(instance: number) {
    const n = Math.max(1, instance);
    const finePercent = n <= 2 ? 0 : n === 3 ? 10 : n === 4 ? 20 : 30;
    const level = n <= 1 ? 'FIRST_WARNING' : n === 2 ? 'SECOND_WARNING' : n === 3 ? 'THIRD_WARNING' : n === 4 ? 'FOURTH_WARNING' : 'FIFTH_WARNING';
    return {
        level, finePercent, warning: `${ordinalWord(n)} Warning`,
        deduction: finePercent ? `Fine ${finePercent}% of one day's gross salary` : 'None',
    };
}