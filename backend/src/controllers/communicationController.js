const { Notice, JobPosting } = require('../models/Communications');

// --- Notice Section ---

// Get All Notices
exports.getNotices = async (req, res) => {
    try {
        const notices = await Notice.find().sort({ createdAt: -1 });
        res.json(notices);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
};

// Create Notice (Admin Only)
exports.createNotice = async (req, res) => {
    try {
        const newNotice = new Notice({
            ...req.body,
            createdBy: req.user.id
        });
        const notice = await newNotice.save();
        res.json(notice);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
};

// --- Recruitment Section ---

// Get All Job Postings
exports.getJobPostings = async (req, res) => {
    try {
        const postings = await JobPosting.find().sort({ postedAt: -1 });
        res.json(postings);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
};

// Create Job Posting (Admin Only)
exports.createJobPosting = async (req, res) => {
    try {
        const newPosting = new JobPosting(req.body);
        const posting = await newPosting.save();
        res.json(posting);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
};
