import fs from 'fs';
import path from 'path';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const s3Client = new S3Client({
    region: process.env.AWS_REGION || 'ap-south-1',
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
    },
});

const bucketName = process.env.AWS_BUCKET_NAME || 'gog-oms';
const ticketsDir = path.join(process.cwd(), 'Tickets');

const TicketSchema = new mongoose.Schema({
    id: { type: String, unique: true },
    raisedBy: { type: String, required: true },
    createdAt: { type: String, required: true },
    proofUrls: [String]
}, { strict: false });

const Ticket = mongoose.models.Ticket || mongoose.model('Ticket', TicketSchema);

async function migrateTickets() {
    console.log("🚀 Starting Ticket Proofs Migration to S3...");

    if (!process.env.MONGODB_URI) {
        console.error("❌ MONGODB_URI not found");
        process.exit(1);
    }
    
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Connected to MongoDB.");

    if (!fs.existsSync(ticketsDir)) {
        console.error(`❌ Directory not found: ${ticketsDir}`);
        process.exit(1);
    }

    const files = fs.readdirSync(ticketsDir);
    console.log(`📂 Found ${files.length} ticket images to process.`);

    // Group files by Date_EmpId
    // Filename pattern: "2026-03-16_EMP111_Ticket_1.png"
    const groups: Record<string, string[]> = {};

    for (const file of files) {
        const match = file.match(/^(\d{4}-\d{2}-\d{2})_([A-Z0-9]+)_/i);
        if (match) {
            const date = match[1];
            const empId = match[2];
            const key = `${date}_${empId}`;
            if (!groups[key]) groups[key] = [];
            groups[key].push(file);
        } else {
            console.warn(`⚠️ Unrecognized filename format: ${file}`);
        }
    }

    let totalUploaded = 0;
    let ticketUpdates = 0;
    let failed = 0;

    for (const [key, groupFiles] of Object.entries(groups)) {
        const [dateStr, empId] = key.split('_');
        console.log(`\n🔍 Processing Group: ${dateStr} for ${empId} (${groupFiles.length} files)`);

        // Find tickets for this employee on this date
        // createdAt looks like "2026-03-16T04:12:21.908Z"
        const tickets = await Ticket.find({ 
            raisedBy: empId, 
            createdAt: { $regex: `^${dateStr}` } 
        }).sort({ createdAt: 1 });

        if (tickets.length === 0) {
            console.warn(`⚠️ No tickets found for ${empId} on ${dateStr}. Uploading to S3 anyway but DB won't update.`);
        } else {
            console.log(`📎 Found ${tickets.length} matching tickets in DB.`);
        }

        // We sort the files alphabetically (Ticket_1, Ticket_2, etc)
        groupFiles.sort();

        // If there's 1 ticket and multiple files, all files belong to this ticket
        if (tickets.length === 1) {
            const ticket = tickets[0];
            const newUrls: string[] = [];

            for (const file of groupFiles) {
                const s3Url = await uploadFile(file, empId);
                if (s3Url) {
                    newUrls.push(s3Url);
                    totalUploaded++;
                } else {
                    failed++;
                }
            }

            ticket.proofUrls = newUrls;
            await ticket.save();
            ticketUpdates++;
            console.log(`✅ Ticket ${ticket.id} updated with ${newUrls.length} S3 URLs.`);
        } 
        // If there are multiple tickets, attempt to assign Ticket_1 to ticket[0], Ticket_2 to ticket[1], etc.
        else if (tickets.length > 1) {
            for (let i = 0; i < groupFiles.length; i++) {
                const file = groupFiles[i];
                const s3Url = await uploadFile(file, empId);
                if (!s3Url) {
                    failed++;
                    continue;
                }
                totalUploaded++;

                // If we have a matching ticket index, replace its proofs array with this single proof
                if (tickets[i]) {
                    tickets[i].proofUrls = [s3Url];
                    await tickets[i].save();
                    ticketUpdates++;
                    console.log(`✅ Ticket ${tickets[i].id} updated with S3 URL from ${file}.`);
                } else {
                    console.warn(`⚠️ Extra file ${file} uploaded to S3, but no corresponding ticket found for index ${i}.`);
                }
            }
        }
        else {
            // No tickets found in DB, just upload
            for (const file of groupFiles) {
                const s3Url = await uploadFile(file, empId);
                if (s3Url) totalUploaded++;
                else failed++;
            }
        }
    }

    console.log("\n==================================");
    console.log(`Migration Complete! ✅ Uploaded: ${totalUploaded} | 🎫 Tickets Updated: ${ticketUpdates} | ❌ Failed: ${failed}`);
    console.log("==================================");
    
    await mongoose.disconnect();
    process.exit(0);
}

async function uploadFile(filename: string, empId: string): Promise<string | null> {
    const filePath = path.join(ticketsDir, filename);
    const fileContent = fs.readFileSync(filePath);
    const ext = path.extname(filename).toLowerCase();
    
    let contentType = 'image/jpeg';
    if (ext === '.png') contentType = 'image/png';
    if (ext === '.pdf') contentType = 'application/pdf';
    if (ext === '.mp4') contentType = 'video/mp4';

    // Unique S3 key
    const safeName = filename.replace(/[^a-z0-9._-]/gi, '_');
    const s3Key = `tickets/${empId}_${Date.now()}_${safeName}`;

    try {
        const command = new PutObjectCommand({
            Bucket: bucketName,
            Key: s3Key,
            Body: fileContent,
            ContentType: contentType,
        });
        await s3Client.send(command);
        return `https://${bucketName}.s3.${process.env.AWS_REGION}.amazonaws.com/${s3Key}`;
    } catch (err: any) {
        console.error(`❌ Failed to upload ${filename}: ${err.message}`);
        return null;
    }
}

migrateTickets();
