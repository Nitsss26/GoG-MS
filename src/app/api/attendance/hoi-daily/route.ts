import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { getSessionUser } from '@/lib/session-user';
import { Location, WorkSchedule } from '@/models/Schemas';
import { hoiDailyLocations, weekdayOf, FIELD_VISIT_LABEL } from '@/lib/hoi-daily-locations';

export const dynamic = 'force-dynamic';

/**
 * The logged-in HOI's clock-in locations for TODAY (IST) — the weekday rule HR set (HR → Location Management → Every weekday):
 * several colleges and / or Automatic Location Fetch. Read only; the clock-in API decides on its own.
 */
export async function GET() {
    try {
        await dbConnect();
        const actor: any = await getSessionUser({ ignoreDelegation: true });
        if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const today = new Date(Date.now() + 5.5 * 3600000).toISOString().slice(0, 10);
        if (actor.role !== 'HOI') return NextResponse.json({ date: today, set: false, locations: [], autoFetch: false });
        // same order as the clock-in API: a specific-date entry wins over the weekday (Mon … Sun) entry
        const rows: any[] = await WorkSchedule.find({ employeeId: actor.id, date: { $in: [today, weekdayOf(today)] } }).select('date location locations locationsFor autoLocationFetch').lean();
        const row: any = rows.find(r => r.date === today) || rows.find(r => r.date === weekdayOf(today)) || null;
        const daily = hoiDailyLocations(row, today);
        const locs: any[] = daily.ids.length ? await Location.find({ id: { $in: daily.ids } }).select('id name shortName').lean() : [];
        const locations = daily.ids.map(id => { const l = locs.find(x => x.id === id); return { id, name: l?.shortName || l?.name || id }; });
        return NextResponse.json({ date: today, set: daily.set, locations, autoFetch: daily.autoFetch, label: [...locations.map(l => l.name), ...(daily.autoFetch ? [FIELD_VISIT_LABEL] : [])].join(', ') });
    } catch (e: any) {
        console.error('hoi-daily GET', e);
        return NextResponse.json({ error: 'Could not load.' }, { status: 500 });
    }
}