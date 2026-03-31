import { NextRequest, NextResponse } from 'next/server';
import { sendMailInternal } from '@/lib/mail-server';

/** Strip out any @gog.com emails (internal test/placeholder accounts) */
const filterEmails = (emails: string | string[] | undefined): string | string[] | undefined => {
    if (!emails) return emails;
    if (Array.isArray(emails)) return emails.filter(e => !e.toLowerCase().endsWith('@gog.com'));
    return emails.toLowerCase().endsWith('@gog.com') ? undefined : emails;
};

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { to, cc, subject, text, html } = body;

        if (!to || !subject || !html) {
            return NextResponse.json({ success: false, error: "Missing required fields: to, subject, or html" }, { status: 400 });
        }

        const cleanTo = filterEmails(to);
        const cleanCc = filterEmails(cc);

        if (!cleanTo || (Array.isArray(cleanTo) && cleanTo.length === 0)) {
            return NextResponse.json({ success: true, messageId: "skipped-no-valid-recipients" });
        }

        const result = await sendMailInternal({ to: cleanTo, cc: cleanCc, subject, text, html });

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
