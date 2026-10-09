/**
 * Next.js calls register() once when a server instance starts.
 * Starts the in-process scheduler for the Saturday 10:00 AM deadline checks (Node.js runtime only).
 * Set DISABLE_ACADEMIC_SCHEDULER=true to switch it off (for example when only the hosting cron should run).
 */
export async function register() {
    if (process.env.NEXT_RUNTIME === 'nodejs' && process.env.DISABLE_ACADEMIC_SCHEDULER !== 'true') {
        const { startAcademicScheduler } = await import('./lib/scheduler');
        startAcademicScheduler();
    }
}
