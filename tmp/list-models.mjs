import axios from 'axios';
import "dotenv/config";

const apiKey = process.env.GEMINI_API_KEY;

async function main() {
    try {
        console.log("Listing models in v1beta...");
        const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
        const response = await axios.get(url);
        console.log("Status:", response.status);
        const models = response.data.models.map(m => m.name);
        console.log("--- FULL MODELS LIST START ---");
        models.forEach(name => console.log(name));
        console.log("--- FULL MODELS LIST END ---");
    } catch (e) {
        if (e.response) {
            console.error("Status:", e.response.status);
            console.error("Error:", JSON.stringify(e.response.data, null, 2));
        } else {
            console.error("Error:", e.message);
        }
    }
}

main();
