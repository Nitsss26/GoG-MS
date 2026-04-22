import axios from 'axios';
import "dotenv/config";

const apiKey = process.env.GEMINI_API_KEY;
const apiUrl = `https://generativelanguage.googleapis.com/v1/models/gemini-3-pro-preview:generateContent?key=${apiKey}`;

async function main() {
    try {
        const payload = {
            contents: [{
                parts: [
                    { text: "Hello, this is a test." }
                ]
            }]
        };

        const response = await axios.post(apiUrl, payload, {
            headers: { 'Content-Type': 'application/json' }
        });
        console.log("Success:", JSON.stringify(response.data, null, 2));
    } catch (e) {
        if (e.response) {
            console.error("Status:", e.response.status);
            console.error("Error Data:", JSON.stringify(e.response.data, null, 2));
        } else {
            console.error("Error Message:", e.message);
        }
    }
}

main();
