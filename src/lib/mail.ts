/**
 * Client-safe mail utility that re-exports templates and provides
 * a sendMail implementation that calls the backend API.
 */
export * from './mail-templates';

interface MailOptions {
    to: string | string[];
    cc?: string | string[];
    subject: string;
    text?: string;
    html: string;
}

/**
 * Sends an email by calling the /api/send-email endpoint.
 * This is safe to call from Client Components.
 */
export const sendMail = async (options: MailOptions) => {
    try {
        const response = await fetch('/api/send-email', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(options),
        });

        const data = await response.json();
        return data;
    } catch (error) {
        console.error("Client sendMail error:", error);
        return { success: false, error: String(error) };
    }
};
