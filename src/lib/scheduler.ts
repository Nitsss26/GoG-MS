/**
 * SERVER-ONLY: in-process scheduler, started once per server from src/instrumentation.ts.
 * Every minute it checks whether the Saturday 10:00 deadline (institution time zone) has been reached and,
 * if so, runs the weekly deadline checks. The run itself is protected against duplicates in the database
 * (src/lib/weekly-deadlines.ts), so several servers or restarts never send an email twice.
 *
 * Serverless hosting (e.g. Vercel) does not keep a process running — there the hosting cron calls
 * /api/cron/weekly-deadlines instead (see vercel.json). Both can be active at the same time.
 */
const TICK_MS = 60 * 1000;

export function startAcademicScheduler() {
    const g = globalThis as any;
    if (g.__gogAcademicScheduler) return; // already running (hot reload / several imports)
    if (!process.env.MONGODB_URI) {
        console.warn('[scheduler] MONGODB_URI is not set — weekly deadline checks are not started.');
        return;
    }
    let busy = false;
    let doneFor: string | null = null;
    let lastAttendanceSweep = 0;

    const tick = async () => {
        if (busy) return;
        busy = true;
        try {
            const { deadlineReached, runWeeklyDeadlines } = await import('@/lib/weekly-deadlines');
            const saturday = deadlineReached(new Date());
            if (saturday && doneFor !== saturday) {
                const { default: dbConnect } = await import('@/lib/mongodb');
                await dbConnect();
                const result: any = await runWeeklyDeadlines({ trigger: 'scheduler' });
                doneFor = saturday; // ran now, or another server / the cron URL already ran it
                if (result?.ran) console.log('[scheduler] weekly deadline checks finished for', saturday);
            }
            // Attendance: Missing Clock-Out alerts (30 min after the scheduled clock-out) + email retries, every 5 minutes
            if (Date.now() - lastAttendanceSweep >= 5 * 60000) {
                lastAttendanceSweep = Date.now();
                const { default: dbConnect } = await import('@/lib/mongodb');
                await dbConnect();
                const { runAttendanceSweep } = await import('@/lib/attendance-violations');
                const r = await runAttendanceSweep();
                if (r.alerts || r.retried) console.log('[scheduler] attendance alerts:', r);
                // Tickets unresolved for 48 hours → reminder to the responsible HR (once per ticket)
                const { runTicketEscalations } = await import('@/lib/ticket-emails');
                const te = await runTicketEscalations();
                if (te.sent || te.flagged) console.log('[scheduler] ticket 48h reminders:', te);
            }
        } catch (e: any) {
            console.error('[scheduler] weekly deadline check failed:', e?.message);
        } finally {
            busy = false;
        }
    };

    g.__gogAcademicScheduler = setInterval(tick, TICK_MS);
    // Do not keep the process alive only for this timer
    g.__gogAcademicScheduler.unref?.();
    setTimeout(tick, 5000);
    console.log('[scheduler] weekly deadline checks scheduled (Saturday 10:00, ' + (process.env.ACADEMIC_TIMEZONE || 'Asia/Kolkata') + ')');
}