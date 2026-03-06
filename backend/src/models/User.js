const mongoose = require('mongoose');

const EducationSchema = new mongoose.Schema({
    degree: String,
    institution: String,
    yearOfPassing: String,
    percentage: String
});

const ExperienceSchema = new mongoose.Schema({
    company: String,
    role: String,
    duration: String,
    lastSalary: Number,
    payslipRef: String
});

const UserSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['ADMIN', 'EMPLOYEE'], default: 'EMPLOYEE' },
    isOnboarded: { type: Boolean, default: false },

    // Employee Specific Fields
    dept: { type: String },
    designation: { type: String },
    status: { type: String, enum: ['Active', 'On Leave', 'On Site', 'Resigned'], default: 'Active' },
    joiningDate: { type: Date },
    salary: { type: Number },
    location: { type: String },

    // Personal Details
    dateOfBirth: { type: Date },
    gender: { type: String },
    bloodGroup: { type: String },
    phone: { type: String },
    address: { type: String },
    emergencyContact: { type: String },
    maritalStatus: { type: String },
    nationality: { type: String },
    panNumber: { type: String },
    aadhaarNumber: { type: String },

    // Image References (Paths or Base64)
    passportImage: { type: String },
    panCardImage: { type: String },
    passbookImage: { type: String },

    // Bank Details
    bankName: { type: String },
    accountNumber: { type: String },
    ifscCode: { type: String },
    bankBranch: { type: String },

    education: [EducationSchema],
    experience: [ExperienceSchema]
}, { timestamps: true });

module.exports = mongoose.model('User', UserSchema);
