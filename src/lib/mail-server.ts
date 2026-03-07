import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '465'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
});

interface MailOptions {
    to: string | string[];
    cc?: string | string[];
    subject: string;
    text?: string;
    html: string;
}

/**
 * SERVER-ONLY: Sends an email using nodemailer.
 */
export const sendMailInternal = async ({ to, cc, subject, text, html }: MailOptions) => {
    try {
        const info = await transporter.sendMail({
            from: `"GoG OMS" <${process.env.SMTP_USER}>`,
            to,
            cc,
            subject,
            text,
            html,
        });
        console.log("Message sent to %s: %s", to, info.messageId);
        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error("Error sending email:", error);
        return { success: false, error: String(error) };
    }
};
