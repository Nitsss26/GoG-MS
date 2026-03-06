const mongoose = require('mongoose');

// Notice Schema
const NoticeSchema = new mongoose.Schema({
    title: { type: String, required: true },
    content: { type: String, required: true },
    category: {
        type: String,
        enum: ['General', 'Policy', 'Event', 'Urgent'],
        default: 'General'
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdAt: { type: Date, default: Date.now }
}, { timestamps: true });

const Notice = mongoose.model('Notice', NoticeSchema);

// Job Posting Schema
const JobPostingSchema = new mongoose.Schema({
    title: { type: String, required: true },
    dept: { type: String, required: true },
    type: {
        type: String,
        enum: ['Full-time', 'Part-time', 'Contract'],
        required: true
    },
    location: { type: String, required: true },
    description: { type: String, required: true },
    status: { type: String, enum: ['Active', 'Closed'], default: 'Active' },
    postedAt: { type: Date, default: Date.now }
}, { timestamps: true });

const JobPosting = mongoose.model('JobPosting', JobPostingSchema);

module.exports = { Notice, JobPosting };
