import fs from 'fs';
import path from 'path';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const s3Client = new S3Client({
    region: process.env.AWS_REGION as string,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID as string,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY as string,
    },
});

const BUCKET_NAME = process.env.AWS_BUCKET_NAME || 'gog-oms';

const LectureReportSchema = new mongoose.Schema({
    facultyId: String,
    date: String,
    courseName: String,
    lectureNumber: Number,
    classPhotoUrl: String,
    recordingUrl: String
}, { strict: false });

const LectureReport = mongoose.models.LectureReport || mongoose.model('LectureReport', LectureReportSchema);

async function uploadToS3(filePath: string, s3Key: string, contentType: string) {
    const fileContent = fs.readFileSync(filePath);
    await s3Client.send(new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: s3Key,
        Body: fileContent,
        ContentType: contentType,
    }));
    return `https://${BUCKET_NAME}.s3.amazonaws.com/${s3Key}`;
}

function getContentType(ext: string) {
    ext = ext.toLowerCase();
    if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
    if (ext === '.png') return 'image/png';
    if (ext === '.mp4') return 'video/mp4';
    if (ext === '.mp3') return 'audio/mpeg';
    if (ext === '.aac') return 'audio/aac';
    if (ext === '.heic') return 'image/heic';
    if (ext === '.3gp') return 'video/3gpp';
    return 'application/octet-stream';
}

function getSuffixIndex(filename: string): number {
    const match = filename.match(/\((\d+)\)\.[^.]+$/);
    if (match) {
        return parseInt(match[1]); // (1) is 1, (2) is 2, etc.
    }
    return 0; // base file
}

async function main() {
    await mongoose.connect(process.env.MONGODB_URI as string);
    console.log('✅ Connected to MongoDB.');

    const imagesDir = path.join(__dirname, '../Lecture Report/Images');
    const audioDir = path.join(__dirname, '../Lecture Report/Audio');

    const imageFiles = fs.existsSync(imagesDir) ? fs.readdirSync(imagesDir) : [];
    const audioFiles = fs.existsSync(audioDir) ? fs.readdirSync(audioDir) : [];

    console.log(`Found ${imageFiles.length} image files and ${audioFiles.length} audio/video files.`);

    const reports = await LectureReport.find({}).sort({ date: 1, facultyId: 1, courseName: 1, lectureNumber: 1 });
    
    // Group by signature: date_facultyId_courseName
    const groups: Record<string, any[]> = {};
    for (const r of reports) {
        const sig = `${r.date}_${r.facultyId}_${r.courseName.replace(/ /g, '_')}`; // We might need to match carefully
        if (!groups[sig]) groups[sig] = [];
        groups[sig].push(r);
    }

    let successCount = 0;

    for (const [sig, records] of Object.entries(groups)) {
        const date = records[0].date;
        const facultyId = records[0].facultyId;
        const courseName = records[0].courseName;

        // Try to find matching files. The files have names like: 2026-04-08_EMP111_Lecture_Photo_Java_Programming (1).jpg
        // Note: the courseName in file might have underscores instead of spaces, or symbols replaced.
        // Let's just find files that start with date_facultyId
        
        const matchingImages = imageFiles.filter(f => f.startsWith(`${date}_${facultyId}_Lecture_Photo`));
        const matchingAudios = audioFiles.filter(f => f.startsWith(`${date}_${facultyId}_Lecture_Recording`));

        // Sort them
        matchingImages.sort((a, b) => getSuffixIndex(a) - getSuffixIndex(b));
        matchingAudios.sort((a, b) => getSuffixIndex(a) - getSuffixIndex(b));

        // Now map them to records
        // records are ordered by lectureNumber (1, 2, 3...)
        for (let i = 0; i < records.length; i++) {
            const record = records[i];
            let updated = false;

            if (i < matchingImages.length && record.classPhotoUrl?.includes('cloudinary.com')) {
                const file = matchingImages[i];
                const filePath = path.join(imagesDir, file);
                const s3Key = `lecture-reports/images/${Date.now()}-${file.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
                console.log(`Uploading Image [Lec ${record.lectureNumber}]: ${file}`);
                const url = await uploadToS3(filePath, s3Key, getContentType(path.extname(file)));
                record.classPhotoUrl = url;
                updated = true;
            }

            if (i < matchingAudios.length && record.recordingUrl?.includes('cloudinary.com')) {
                const file = matchingAudios[i];
                const filePath = path.join(audioDir, file);
                const s3Key = `lecture-reports/recordings/${Date.now()}-${file.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
                console.log(`Uploading Recording [Lec ${record.lectureNumber}]: ${file}`);
                const url = await uploadToS3(filePath, s3Key, getContentType(path.extname(file)));
                record.recordingUrl = url;
                updated = true;
            }

            if (updated) {
                await record.save();
                successCount++;
            }
        }
    }

    console.log(`\n🎉 MIGRATION COMPLETE! Updated ${successCount} database records successfully.`);
    process.exit(0);
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
