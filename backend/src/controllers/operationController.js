const { OrgNode, Asset } = require('../models/Operations');

// --- Org Hierarchy Section ---

// Get Hierarchy
exports.getHierarchy = async (req, res) => {
    try {
        const nodes = await OrgNode.find();
        res.json(nodes);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
};

// Add Hierarchy Node (Admin Only)
exports.addNode = async (req, res) => {
    try {
        const newNode = new OrgNode(req.body);
        const node = await newNode.save();
        res.json(node);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
};

// --- Asset Section ---

// Get All Assets
exports.getAssets = async (req, res) => {
    try {
        const assets = await Asset.find().populate('assignedTo', 'name email');
        res.json(assets);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
};

// Add Asset
exports.addAsset = async (req, res) => {
    try {
        const newAsset = new Asset(req.body);
        const asset = await newAsset.save();
        res.json(asset);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
};

// Assign/Update Asset
exports.updateAsset = async (req, res) => {
    try {
        let asset = await Asset.findById(req.params.id);
        if (!asset) return res.status(404).json({ msg: 'Asset not found' });

        asset = await Asset.findByIdAndUpdate(
            req.params.id,
            { $set: req.body },
            { new: true }
        );
        res.json(asset);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
};
