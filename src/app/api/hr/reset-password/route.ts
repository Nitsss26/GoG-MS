import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { Employee } from '@/models/Schemas';
import { getSessionUser } from '@/lib/session-user';
import { hashPassword, generateTemporaryPassword, validateNewPassword } from '@/lib/password';

export const dynamic = 'force-dynamic';

/**
 * HR → Reset an employee's password.
 * Body: { employeeId, mode: "generate" }                                  -> a strong temporary password is created
 *       { employeeId, mode: "manual", newPassword, confirmPassword }     -> HR types the temporary password
 *
 * Only the scrypt hash is saved. The plain password is returned ONCE in this response (so HR can hand it over)
 * and is never logged or stored. The old password stops working immediately.
 */
export async function POST(request: Request) {
    try {
        await dbConnect();
        const actor = await getSessionUser();
        if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        if (actor.role !== 'HR' && actor.role !== 'FOUNDER') {
            return NextResponse.json({ error: 'Only HR can reset passwords.' }, { status: 403 });
        }

        const body = await request.json().catch(() => ({}));
        const { employeeId, mode, newPassword, confirmPassword } = body || {};
        if (!employeeId || (mode !== 'generate' && mode !== 'manual')) {
            return NextResponse.json({ error: 'employeeId and mode ("generate" or "manual") are required.' }, { status: 400 });
        }

        // Removed employees are excluded by the Employee find hook, so only active accounts are found
        const target: any = await Employee.findOne({ id: employeeId });
        if (!target) return NextResponse.json({ error: 'Active employee not found.' }, { status: 404 });
        if (target.id === actor.id) {
            return NextResponse.json({ error: 'Use Change Password to change your own password.' }, { status: 400 });
        }
        if (target.role === 'FOUNDER' && actor.role !== 'FOUNDER') {
            return NextResponse.json({ error: "HR cannot reset the Founder's password." }, { status: 403 });
        }

        let plain: string;
        if (mode === 'generate') {
            plain = generateTemporaryPassword();
        } else {
            if (newPassword !== confirmPassword) {
                return NextResponse.json({ error: 'Passwords do not match.' }, { status: 400 });
            }
            const problem = validateNewPassword(String(newPassword || ''));
            if (problem) return NextResponse.json({ error: problem }, { status: 400 });
            plain = String(newPassword);
        }

        const now = new Date().toISOString();
        await Employee.updateOne(
            { _id: target._id },
            {
                $set: {
                    password: await hashPassword(plain),
                    passwordChangedAt: now,
                    passwordResetAt: now,
                    passwordResetBy: actor.id,
                    passwordResetByName: actor.name,
                },
            }
        );

        // Audit line without the password
        console.log(`[HR] Password reset for ${target.id} by ${actor.id} at ${now}`);

        return NextResponse.json({
            success: true,
            employeeId: target.id,
            employeeName: target.name,
            email: target.email,
            role: target.role,
            resetAt: now,
            // Shown to HR once. Only for "generate"; in manual mode HR already knows it.
            temporaryPassword: mode === 'generate' ? plain : undefined,
        }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (error: any) {
        console.error('Reset password error:', error?.message);
        return NextResponse.json({ error: 'Server error. Please try again.' }, { status: 500 });
    }
}
