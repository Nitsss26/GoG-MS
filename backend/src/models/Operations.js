const mongoose = require('mongoose');

// OrgNode Schema (Recursive Hierarchy)
const OrgNodeSchema = new mongoose.Schema({
    name: { type: String, required: true },
    designation: { type: String, required: true },
    level: {
        type: String,
        enum: ['C-Suite', 'Leadership', 'HOI', 'OM', 'Faculty'],
        required: true
    },
    parentId: { type: mongoose.Schema.Types.ObjectId, ref: 'OrgNode' },
    photoInitial: { type: String },
    dept: { type: String }
}, { timestamps: true });

const OrgNode = mongoose.model('OrgNode', OrgNodeSchema);

// Asset Schema (Inventory)
const AssetSchema = new mongoose.Schema({
    name: { type: String, required: true },
    type: {
        type: String,
        enum: ['Laptop', 'SIM', 'Peripheral', 'Key', 'Other'],
        required: true
    },
    serialNumber: { type: String, required: true, unique: true },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    status: {
        type: String,
        enum: ['Available', 'Assigned', 'Maintenance', 'Lost'],
        default: 'Available'
    },
    procurementDate: { type: Date, default: Date.now }
}, { timestamps: true });

const Asset = mongoose.model('Asset', AssetSchema);

module.exports = { OrgNode, Asset };
