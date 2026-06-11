import fs from 'fs';
import path from 'path';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' });

// Initialize S3 Client
const s3Client = new S3Client({
    region: process.env.AWS_REGION || 'ap-south-1',
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
    },
});

const bucketName = process.env.AWS_BUCKET_NAME || 'gog-oms';
const profileImageDir = path.join(process.cwd(), 'Profile_Image');

// Import the Employee model (assuming the schema is set up)
// We'll define a minimal schema here just to connect to the collection
const EmployeeSchema = new mongoose.Schema({
    id: String,
    photoUrl: String
}, { strict: false });

const Employee = mongoose.models.Employee || mongoose.model('Employee', EmployeeSchema);

async function migrate() {
    console.log("🚀 Starting Profile Image Migration to S3...");

    // 1. Connect to MongoDB
    if (!process.env.MONGODB_URI) {
        console.error("❌ MONGODB_URI not found in .env.local");
        process.exit(1);
    }
    
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Connected to MongoDB.");

    // 2. Read Profile_Image Directory
    if (!fs.existsSync(profileImageDir)) {
        console.error(`❌ Directory not found: ${profileImageDir}`);
        process.exit(1);
    }

    const files = fs.readdirSync(profileImageDir);
    console.log(`📂 Found ${files.length} images to process.`);

    let successCount = 0;
    let failCount = 0;

    for (const filename of files) {
        // We expect files like "Profile_EMP100_Anirudha_Rajodiya.jpg"
        const match = filename.match(/Profile_([A-Z0-9]+)_/i);
        if (!match) {
            console.warn(`⚠️ Skipping ${filename} - Could not extract Employee ID.`);
            failCount++;
            continue;
        }

        const employeeId = match[1];
        const filePath = path.join(profileImageDir, filename);
        const fileContent = fs.readFileSync(filePath);
        const ext = path.extname(filename).toLowerCase();
        
        let contentType = 'image/jpeg';
        if (ext === '.png') contentType = 'image/png';
        if (ext === '.webp') contentType = 'image/webp';
        if (ext === '.heic') contentType = 'image/heic';

        const s3Key = `profiles/${employeeId}_${Date.now()}${ext}`;

        try {
            // 3. Upload to S3
            const command = new PutObjectCommand({
                Bucket: bucketName,
                Key: s3Key,
                Body: fileContent,
                ContentType: contentType,
            });

            await s3Client.send(command);
            
            const s3Url = `https://${bucketName}.s3.${process.env.AWS_REGION}.amazonaws.com/${s3Key}`;
            
            // 4. Update MongoDB
            const result = await Employee.findOneAndUpdate(
                { id: employeeId },
                { $set: { photoUrl: s3Url } }
            );

            if (result) {
                console.log(`✅ [${employeeId}] Success -> ${s3Url}`);
                successCount++;
            } else {
                console.warn(`⚠️ [${employeeId}] Uploaded to S3 but Employee not found in DB!`);
                failCount++;
            }

        } catch (err: any) {
            console.error(`❌ [${employeeId}] Failed to upload or update: ${err.message}`);
            failCount++;
        }
    }

    console.log("\n==================================");
    console.log(`Migration Complete! ✅ Success: ${successCount} | ❌ Failed: ${failCount}`);
    console.log("==================================");
    
    await mongoose.disconnect();
    process.exit(0);
}

migrate();
