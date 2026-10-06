import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { CampusDailyMoM } from '@/models/Schemas';

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
        const body = await req.json();
        const {
            id,
            campus,
            date,
            title,
            agenda,
            discussionPoints,
            keyDecisions,
            actionItems,
            blockers,
            attendees,
            updateNote,
            updatedBy,
            updatedByName,
            role
        } = body;

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
            const newId = `MOM-${campus.replace(/[^a-zA-Z0-9]/g, '').slice(0, 4).toUpperCase()}-${date}`;
            momDoc = await CampusDailyMoM.create({
                id: newId,
                campus,
                date,
                title: title || `Daily Sync MoM - ${campus}`,
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
