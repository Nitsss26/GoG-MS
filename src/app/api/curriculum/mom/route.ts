import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { CampusDailyMoM } from '@/models/Schemas';
import { getSessionUser } from '@/lib/session-user';

export async function GET(req: Request) {
    try {
        await dbConnect();
        const { searchParams } = new URL(req.url);
        const campus = searchParams.get('campus');
        const date = searchParams.get('date');

        const query: any = {};
        if (campus && campus !== "All") {
            query.campus = { $regex: new RegExp(campus.trim(), 'i') };
        }
        if (date) {
            query.date = date;
        }

        const moms = await CampusDailyMoM.find(query).sort({ date: -1, updatedAt: -1 }).lean();

        return NextResponse.json({ success: true, moms });
    } catch (error: any) {
        console.error("Campus Daily MoM GET error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        await dbConnect();
        // The person saving is always the logged-in user (not taken from the request body)
        const actor = await getSessionUser();
        if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const body = await req.json();
        const {
            id,
            campus,
            date,
            title,
            meetingTime,
            meetingType,
            agenda,
            discussionPoints,
            keyDecisions,
            actionItems,
            blockers,
            attendees,
            updateNote,
        } = body;
        const updatedBy = actor.id, updatedByName = actor.name, role = actor.role;

        if (!campus || !date) {
            return NextResponse.json({ error: "Campus and date are required" }, { status: 400 });
        }

        const now = new Date().toISOString();

        let momDoc: any = null;
        if (id) {
            momDoc = await CampusDailyMoM.findOne({ id });
        }
        if (!momDoc) {
            momDoc = await CampusDailyMoM.findOne({ campus: { $regex: new RegExp(`^${campus.trim()}$`, 'i') }, date });
        }

        const auditUpdate = {
            updatedBy: updatedBy || "User",
            updatedByName: updatedByName || updatedBy || "Contributor",
            role: role || "Staff",
            updatedAt: now,
            note: updateNote || "Updated MoM sections"
        };

        if (momDoc) {
            if (title !== undefined) momDoc.title = title;
            if (meetingTime !== undefined) momDoc.meetingTime = meetingTime;
            if (meetingType !== undefined) momDoc.meetingType = meetingType;
            if (agenda !== undefined) momDoc.agenda = agenda;
            if (discussionPoints !== undefined) momDoc.discussionPoints = discussionPoints;
            if (keyDecisions !== undefined) momDoc.keyDecisions = keyDecisions;
            if (actionItems !== undefined) momDoc.actionItems = actionItems;
            if (blockers !== undefined) momDoc.blockers = blockers;
            if (attendees !== undefined) momDoc.attendees = attendees;
            momDoc.lastUpdatedBy = updatedByName || updatedBy;
            momDoc.lastUpdatedAt = now;
            momDoc.updates.push(auditUpdate);
            await momDoc.save();
        } else {
            // Full campus name + date + short random part: two campuses starting with the same letters (e.g. SAGE Bhopal / SAGE Indore) no longer clash
            const newId = `MOM-${campus.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 40)}-${date}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
            momDoc = await CampusDailyMoM.create({
                id: newId,
                campus,
                date,
                title: title || `Daily Sync MoM - ${campus}`,
                meetingTime: meetingTime || "",
                meetingType: meetingType || "",
                agenda: agenda || "",
                discussionPoints: discussionPoints || "",
                keyDecisions: keyDecisions || "",
                actionItems: actionItems || [],
                blockers: blockers || "",
                attendees: attendees || [],
                updates: [auditUpdate],
                lastUpdatedBy: updatedByName || updatedBy,
                lastUpdatedAt: now
            });
        }

        return NextResponse.json({ success: true, mom: momDoc });
    } catch (error: any) {
        console.error("Campus Daily MoM POST error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}