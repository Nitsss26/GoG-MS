import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/lib/mongodb';
import { getSessionUser } from '@/lib/session-user';
import { Employee, LeaveRequest, SprintPlan, LectureReport, Notification, JobRun } from '@/models/Schemas';

export const dynamic = 'force-dynamic';

/**
 * Live system status for the Tech Lead / Founder: database round-trip, record counts, last scheduler runs
 * and whether the integrations are configured (true/false only — no secrets are returned).
 */
export async function GET() {
    const started = Date.now();
    try {
        await dbConnect();
        const actor = await getSessionUser();
        if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        if (!['TL', 'FOUNDER'].includes(actor.role)) return NextResponse.json({ error: 'Only the Tech Lead or Founder can see the system status.' }, { status: 403 });

        const t0 = Date.now();
        await mongoose.connection.db?.admin().command({ ping: 1 }).catch(() => Employee.findOne({}).select('_id').lean());
        const dbMs = Date.now() - t0;
        const [employees, active, leaves, pendingLeaves, plans, records, unread, jobs] = await Promise.all([
            Employee.countDocuments({}), Employee.countDocuments({ status: { $ne: 'Inactive' } }),
            LeaveRequest.countDocuments({}), LeaveRequest.countDocuments({ status: { $in: ['Pending', 'Pending HOI Approval'] } }),
            SprintPlan.countDocuments({}), LectureReport.countDocuments({}),
            Notification.countDocuments({ read: false }),
            JobRun.find({}).sort({ _id: -1 }).limit(5).lean(),
        ]);
        return NextResponse.json({
            ok: true,
            checkedAt: new Date().toISOString(),
            responseMs: Date.now() - started,
            database: { connected: mongoose.connection.readyState === 1, roundTripMs: dbMs },
            server: { uptimeSeconds: Math.round(process.uptime()), node: process.version, timezone: process.env.ACADEMIC_TIMEZONE || 'Asia/Kolkata' },
            counts: { employees, activeEmployees: active, leaves, pendingLeaves, sprintPlans: plans, classRecords: records, unreadNotifications: unread },
            integrations: {
                email: !!(process.env.SMTP_USER && process.env.SMTP_PASS),
                cloudinary: true, // unsigned upload preset configured in src/lib/cloudinary.ts
                appUrl: !!(process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL),
            },
            recentJobs: jobs.map((j: any) => ({ key: j.key, at: j.createdAt || j.at || (j._id?.getTimestamp ? j._id.getTimestamp() : null) })),
        });
    } catch (error: any) {
        return NextResponse.json({ ok: false, error: error.message, responseMs: Date.now() - started }, { status: 500 });
    }
}
