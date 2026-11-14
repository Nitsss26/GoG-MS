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

/**
 * Does an (approved) holiday apply to this employee? Same rule as the server (salary / flags):
 * removed for the employee → no; assigned to particular employees → only them; otherwise all colleges,
 * or the employee's college (the employee may store the college id, name or short name).
 */
export const holidayAppliesTo = (h: any, emp: { id?: string; location?: string } | null | undefined, colleges: { id: string; name?: string; shortName?: string }[] = []) => {
    if (!emp) return false;
    if (holidayExcludes(h, emp.id)) return false;
    const ids: string[] = h?.employeeIds || [];
    if (ids.length) return !!emp.id && ids.includes(String(emp.id));
    const cols: string[] = h?.collegeIds || [];
    if (h?.forAll || !cols.length) return true;
    const loc = String(emp.location || '');
    if (!loc) return false;
    const college = colleges.find(c => [c.id, c.name, c.shortName].filter(Boolean).includes(loc));
    return cols.includes(loc) || (!!college && cols.includes(college.id));
};