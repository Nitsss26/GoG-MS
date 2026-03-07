import { NextRequest, NextResponse } from 'next/server';
import { sendMailInternal } from '@/lib/mail-server';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { to, cc, subject, text, html } = body;

        if (!to || !subject || !html) {
            return NextResponse.json({ success: false, error: "Missing required fields: to, subject, or html" }, { status: 400 });
        }

        const result = await sendMailInternal({ to, cc, subject, text, html });

        if (result.success) {
            return NextResponse.json(result);
        } else {
            return NextResponse.json(result, { status: 500 });
        }
    } catch (error) {
        console.error("API send-email error:", error);
        return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
    }
}
