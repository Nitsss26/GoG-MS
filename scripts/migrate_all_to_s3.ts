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

const AttendanceSchema = new mongoose.Schema({
    employeeId: { type: String, required: true },
    date: { type: String, required: true },
    dressCodeImageUrl: { type: String }
}, { strict: false });

const LeaveRequestSchema = new mongoose.Schema({
    employeeId: { type: String },
    startDate: { type: String },
    appliedAt: { type: String },
    proofUrls: [String]
}, { strict: false });

const ReimbursementClaimSchema = new mongoose.Schema({
    employeeId: { type: String },
    date: { type: String },
    proofUrls: [String]
}, { strict: false });

const Attendance = mongoose.models.Attendance || mongoose.model('Attendance', AttendanceSchema);
const LeaveRequest = mongoose.models.LeaveRequest || mongoose.model('LeaveRequest', LeaveRequestSchema);
const ReimbursementClaim = mongoose.models.ReimbursementClaim || mongoose.model('ReimbursementClaim', ReimbursementClaimSchema);

async function uploadFile(dirPath: string, filename: string, empId: string, folderPrefix: string): Promise<string | null> {
    const filePath = path.join(dirPath, filename);
    const fileContent = fs.readFileSync(filePath);
    const ext = path.extname(filename).toLowerCase();
    
    let contentType = 'image/jpeg';
    if (ext === '.png') contentType = 'image/png';
    else if (ext === '.pdf') contentType = 'application/pdf';
    else if (ext === '.mp4') contentType = 'video/mp4';
    else if (ext === '.heic') contentType = 'image/heic';

    const safeName = filename.replace(/[^a-z0-9._-]/gi, '_');
    const s3Key = `${folderPrefix}/${empId}_${Date.now()}_${safeName}`;

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

async function migrate() {
    if (!process.env.MONGODB_URI) {
        console.error("❌ MONGODB_URI not found");
        process.exit(1);
    }
    
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Connected to MongoDB.");

    let totalUploaded = 0;
    let totalUpdated = 0;
    let totalFailed = 0;

    // --- PHASE 1: ATTENDANCE ---
    console.log("\n======================================");
    console.log("🚀 PHASE 1: Migrating Attendance...");
    console.log("======================================");
    const attendanceDir = path.join(process.cwd(), 'Attendance');
    if (fs.existsSync(attendanceDir)) {
        const files = fs.readdirSync(attendanceDir);
        for (const file of files) {
            // e.g. "2026-03-13_EMP111_Attendance.jpg"
            const match = file.match(/^(\d{4}-\d{2}-\d{2})_([A-Z0-9]+)_/i);
            if (!match) continue;
            
            const date = match[1];
            const empId = match[2];

            const attendanceRecords = await Attendance.find({ employeeId: empId, date: date });
            
            if (attendanceRecords.length > 0) {
                const s3Url = await uploadFile(attendanceDir, file, empId, 'attendance');
                if (s3Url) {
                    // Update all matching (usually just 1)
                    for (const record of attendanceRecords) {
                        record.dressCodeImageUrl = s3Url;
                        await record.save();
                        totalUpdated++;
                    }
                    totalUploaded++;
                } else {
                    totalFailed++;
                }
            } else {
                console.warn(`⚠️ No DB Attendance found for ${empId} on ${date}. File not linked: ${file}`);
                // Optional: We can still upload it even if DB record is not found.
                const s3Url = await uploadFile(attendanceDir, file, empId, 'attendance_unlinked');
                if (s3Url) totalUploaded++;
                else totalFailed++;
            }
        }
    } else {
        console.warn(`⚠️ Attendance directory not found at ${attendanceDir}`);
    }

    // --- PHASE 2: LEAVE PROOFS ---
    console.log("\n======================================");
    console.log("🚀 PHASE 2: Migrating Leave Proofs...");
    console.log("======================================");
    const leaveDir = path.join(process.cwd(), 'LeaveProof');
    if (fs.existsSync(leaveDir)) {
        const files = fs.readdirSync(leaveDir);
        const groups: Record<string, string[]> = {};
        for (const file of files) {
            const match = file.match(/^(\d{4}-\d{2}-\d{2})_([A-Z0-9]+)_/i);
            if (match) {
                const key = `${match[1]}_${match[2]}`;
                if (!groups[key]) groups[key] = [];
                groups[key].push(file);
            }
        }

        for (const [key, groupFiles] of Object.entries(groups)) {
            const [dateStr, empId] = key.split('_');
            const leaves = await LeaveRequest.find({ employeeId: empId, startDate: dateStr }).sort({ appliedAt: 1 });

            groupFiles.sort();
            
            if (leaves.length === 1) {
                const newUrls: string[] = [];
                for (const file of groupFiles) {
                    const s3Url = await uploadFile(leaveDir, file, empId, 'leaves');
                    if (s3Url) { newUrls.push(s3Url); totalUploaded++; } else totalFailed++;
                }
                leaves[0].proofUrls = newUrls;
                await leaves[0].save();
                totalUpdated++;
            } else if (leaves.length > 1) {
                for (let i = 0; i < groupFiles.length; i++) {
                    const s3Url = await uploadFile(leaveDir, groupFiles[i], empId, 'leaves');
                    if (!s3Url) { totalFailed++; continue; }
                    totalUploaded++;

                    if (leaves[i]) {
                        leaves[i].proofUrls = [s3Url];
                        await leaves[i].save();
                        totalUpdated++;
                    }
                }
            } else {
                console.warn(`⚠️ No DB LeaveRequest found for ${empId} on ${dateStr}. Group: ${groupFiles.length} files`);
                for (const file of groupFiles) {
                    const s3Url = await uploadFile(leaveDir, file, empId, 'leaves_unlinked');
                    if (s3Url) totalUploaded++; else totalFailed++;
                }
            }
        }
    } else {
        console.warn(`⚠️ LeaveProof directory not found at ${leaveDir}`);
    }

    // --- PHASE 3: REIMBURSEMENTS ---
    console.log("\n======================================");
    console.log("🚀 PHASE 3: Migrating Reimbursements...");
    console.log("======================================");
    const reimbDir = path.join(process.cwd(), 'Reimbursement');
    if (fs.existsSync(reimbDir)) {
        const files = fs.readdirSync(reimbDir);
        const groups: Record<string, string[]> = {};
        for (const file of files) {
            const match = file.match(/^(\d{4}-\d{2}-\d{2})_([A-Z0-9]+)_/i);
            if (match) {
                const key = `${match[1]}_${match[2]}`;
                if (!groups[key]) groups[key] = [];
                groups[key].push(file);
            }
        }

        for (const [key, groupFiles] of Object.entries(groups)) {
            const [dateStr, empId] = key.split('_');
            const claims = await ReimbursementClaim.find({ employeeId: empId, date: dateStr }).sort({ _id: 1 });

            groupFiles.sort();

            if (claims.length === 1) {
                const newUrls: string[] = [];
                for (const file of groupFiles) {
                    const s3Url = await uploadFile(reimbDir, file, empId, 'reimbursements');
                    if (s3Url) { newUrls.push(s3Url); totalUploaded++; } else totalFailed++;
                }
                claims[0].proofUrls = newUrls;
                await claims[0].save();
                totalUpdated++;
            } else if (claims.length > 1) {
                for (let i = 0; i < groupFiles.length; i++) {
                    const s3Url = await uploadFile(reimbDir, groupFiles[i], empId, 'reimbursements');
                    if (!s3Url) { totalFailed++; continue; }
                    totalUploaded++;

                    if (claims[i]) {
                        claims[i].proofUrls = [s3Url];
                        await claims[i].save();
                        totalUpdated++;
                    }
                }
            } else {
                console.warn(`⚠️ No DB ReimbursementClaim found for ${empId} on ${dateStr}. Group: ${groupFiles.length} files`);
                for (const file of groupFiles) {
                    const s3Url = await uploadFile(reimbDir, file, empId, 'reimbursements_unlinked');
                    if (s3Url) totalUploaded++; else totalFailed++;
                }
            }
        }
    } else {
        console.warn(`⚠️ Reimbursement directory not found at ${reimbDir}`);
    }


    console.log("\n======================================");
    console.log(`🎉 MEGA MIGRATION COMPLETE!`);
    console.log(`✅ Uploaded to S3: ${totalUploaded}`);
    console.log(`🎫 Database Records Updated: ${totalUpdated}`);
    console.log(`❌ Failed: ${totalFailed}`);
    console.log("======================================");
    
    await mongoose.disconnect();
    process.exit(0);
}

migrate();
