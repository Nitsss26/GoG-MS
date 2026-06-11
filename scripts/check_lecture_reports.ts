import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const LectureReportSchema = new mongoose.Schema({
    facultyId: String,
    date: String,
    courseName: String,
    lectureNumber: Number,
    classPhotoUrl: String,
    recordingUrl: String
}, { strict: false });

const LectureReport = mongoose.models.LectureReport || mongoose.model('LectureReport', LectureReportSchema);

async function main() {
    await mongoose.connect(process.env.MONGODB_URI as string);
    const reports = await LectureReport.find({}).lean();
    console.log(`Total Lecture Reports: ${reports.length}`);
    
    // Check an example
    const emp111 = reports.filter((r: any) => r.facultyId === 'EMP111' && r.date === '2026-04-08');
    console.log(`Reports for EMP111 on 2026-04-08:`);
    emp111.forEach((r: any) => console.log(`  - course: ${r.courseName}, lec: ${r.lectureNumber}, photo: ${r.classPhotoUrl}, rec: ${r.recordingUrl}`));

    // Check how many have cloudinary URLs
    const cloudinaryPhotos = reports.filter((r: any) => r.classPhotoUrl?.includes('cloudinary.com')).length;
    const cloudinaryRecs = reports.filter((r: any) => r.recordingUrl?.includes('cloudinary.com')).length;

    console.log(`Cloudinary Photos: ${cloudinaryPhotos}`);
    console.log(`Cloudinary Recordings: ${cloudinaryRecs}`);
    
    process.exit(0);
}

main().catch(console.error);
