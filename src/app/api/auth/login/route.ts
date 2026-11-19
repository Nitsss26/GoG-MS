import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import dbConnect from '@/lib/mongodb';
import { Employee, RoleDefinition } from '@/models/Schemas';
import { createSessionToken, getSessionCookieOptions } from '@/lib/session';
import { verifyPassword, isHashedPassword, storedPasswordValue } from '@/lib/password';
import { recordLogin } from '@/lib/presence';

/** Roles of the login dropdown that exist in the code (anything else may be a role HR created in Role Management) */
const BUILT_IN_ROLES = ['FOUNDER', 'HR', 'HR_EXECUTIVE', 'AD', 'TL', 'HOI', 'OM', 'MARKETING_TEAM', 'TECH_TEAM', 'PLACEMENT_INTERN_HEAD', 'TECH_INTERN', 'CURRICULUM_HEAD', 'CURRICULUM_LEAD', 'PROFESSOR', 'FACULTY'];

export async function POST(request: Request) {
    try {
        const { email, password, role } = await request.json();

        if (!email || !password) {
            return NextResponse.json({ success: false, error: "Email and password are required" }, { status: 400 });
        }

        await dbConnect();

        // Exact (case-insensitive) email match — typed characters are never treated as a pattern
        const escapedEmail = String(email).trim().replace(/[.*+?^$()|[\]{}\\]/g, '\\$&');
        const emailPattern = new RegExp('^' + escapedEmail + '$', 'i');
        // One email can hold several designation records: the designation chosen in the login dropdown picks one.
        // Faculty and Professor are the same designation: "Professor" in the dropdown also opens older FACULTY records.
        const SAME_ROLE: Record<string, string[]> = { PROFESSOR: ['PROFESSOR', 'FACULTY'], FACULTY: ['FACULTY', 'PROFESSOR'] };
        // A role HR created in Role Management (e.g. ASSISTANT_PROFESSOR): the record is stored with its base role
        // and customRole = that role, so the dropdown choice picks the base-role record carrying that customRole
        const custom: any = role && !BUILT_IN_ROLES.includes(String(role)) ? await RoleDefinition.findOne({ roleId: String(role), status: 'PUBLISHED' }).lean() : null;
        const roleSet: string[] | null = role ? (custom ? (SAME_ROLE[custom.baseRole] || [custom.baseRole]) : (SAME_ROLE[role] || [role])) : null;
        const only = custom ? { customRole: custom.roleId } : {};
        const employee = roleSet
            ? (await Employee.findOne({ email: { $regex: emailPattern }, role: { $in: roleSet }, ...only, isRemoved: { $ne: true } })) ||
              (await Employee.findOne({ email: { $regex: emailPattern }, role: { $in: roleSet }, ...only })) || (await Employee.findOne({ email: { $regex: emailPattern } }))
            : await Employee.findOne({ email: { $regex: emailPattern } });

        if (!employee) {
            // Removed from the portal by HR: the account exists only as a historical record and cannot log in
            const removed = await Employee.findOne({ email: { $regex: emailPattern }, isRemoved: true, ...(roleSet ? { role: { $in: roleSet }, ...only } : {}) });
            if (removed) {
                return NextResponse.json({ success: false, error: "This account has been removed from the portal." }, { status: 403 });
            }
            return NextResponse.json({ success: false, error: "Institutional account not found." }, { status: 404 });
        }

        // Check password against the stored value: a secure hash, or (older accounts) plain text.
        // Default is "26082001" if no password was ever set, same as before.
        const storedPassword = employee.password || "26082001";
        const check = await verifyPassword(String(password), storedPassword);
        if (!check.ok) {
            return NextResponse.json({ success: false, error: "Incorrect passkey." }, { status: 401 });
        }

        // Check role if provided
        if (roleSet && !roleSet.includes(employee.role)) {
            return NextResponse.json({ success: false, error: `Institutional role mismatch.` }, { status: 403 });
        }
        if (custom && employee.customRole !== custom.roleId) {
            return NextResponse.json({ success: false, error: `Institutional role mismatch.` }, { status: 403 });
        }

        // Account still holding an older hash: store the (now verified) password as plain text, like the original portal
        if (isHashedPassword(storedPassword)) {
            try {
                await Employee.updateOne({ _id: employee._id }, { $set: { password: storedPasswordValue(String(password)) } });
            } catch (e) {
                console.error("Login: could not update the stored password");
            }
        }

        // Create session token and set HTTP-only cookie
        const employeeData = employee.toObject();
        const userId = employeeData.employeeId || employeeData._id?.toString() || employeeData.id;
        const token = createSessionToken(userId, employeeData.email, employeeData.role, employeeData.customRole);

        const cookieOptions = getSessionCookieOptions();
        const cookieStore = await cookies();
        cookieStore.set(cookieOptions.name, token, {
            httpOnly: cookieOptions.httpOnly,
            secure: cookieOptions.secure,
            sameSite: cookieOptions.sameSite,
            path: cookieOptions.path,
            maxAge: cookieOptions.maxAge,
        });

        // HR → Workforce: Last Login / Last Seen (server time; a failure never blocks the login)
        try { await recordLogin(String(employeeData.id || '')); } catch (e) { console.error("Login: could not record presence"); }

        // Return sanitized employee data — NEVER include password in response
        const sanitizedEmployee = { ...employeeData };
        delete sanitizedEmployee.password;
        // Role Management: the name of the HR-created role (shown in the sidebar)
        if (employeeData.customRole) {
            const def: any = custom?.roleId === employeeData.customRole ? custom : await RoleDefinition.findOne({ roleId: employeeData.customRole }).select('label').lean().catch(() => null);
            if (def?.label) sanitizedEmployee.customRoleLabel = def.label;
        }

        return NextResponse.json({ success: true, employee: sanitizedEmployee });
    } catch (error: any) {
        console.error("Login Error:", error);
        return NextResponse.json({ success: false, error: "Server error. Please try again." }, { status: 500 });
    }
}