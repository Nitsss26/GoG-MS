/**
 * A holiday HR assigned to particular employees (Holiday.employeeIds) is a holiday ONLY for those employees.
 * Every other holiday (all colleges / selected colleges) keeps its existing rules — this check only adds the
 * employee condition on top. Safe for client and server.
 *
 * Holiday Management → Remove for one employee of a college-wide holiday: the employee is listed in
 * Holiday.excludedEmployeeIds and the holiday no longer applies to that employee only.
 */
export const holidayExcludes = (h: any, employeeId?: string | null) =>
    !!employeeId && ((h?.excludedEmployeeIds || []) as string[]).includes(String(employeeId));

export const holidayForEmployee = (h: any, employeeId?: string | null) => {
    if (holidayExcludes(h, employeeId)) return false;
    const ids: string[] = h?.employeeIds || [];
    return !ids.length || (!!employeeId && ids.includes(String(employeeId)));
};