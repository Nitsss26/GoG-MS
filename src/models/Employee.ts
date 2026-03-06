import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IEmployee extends Document {
    id: string; // custom id like FND001
    name: string;
    email: string;
    role: "FOUNDER" | "HR" | "AD" | "TL" | "HOI" | "OM" | "FACULTY" | "PROFESSOR";
    isOnboarded: boolean;
    dept: string;
    designation: string;
    status: "Active" | "On Leave" | "On Site" | "Resigned";
    joiningDate: string;
    salary: number;
    location: string;
    dateOfBirth?: string;
    gender?: string;
    bloodGroup?: string;
    phone?: string;
    address?: string;
    photoUrl?: string;
    chancesRemaining: number;
    reportsTo?: string;
    managerLevel?: string;
    password?: string;
    // Bank Details
    bankAccountName?: string;
    bankAccountNumber?: string;
    ifscCode?: string;
    upiId?: string;
    // Institutional Docs
    resumeUrl?: string;
    bachelorCertUrl?: string;
    masterCertUrl?: string;
    bachelorMarksheetUrl?: string;
    masterMarksheetUrl?: string;
    marksheet10Url?: string;
    marksheet12Url?: string;
    aadharCardUrl?: string;
    panCardUrl?: string;
    passportPhotoUrl?: string;
    bankPassbookUrl?: string;
    expLetterUrl?: string;
    // Additional Info
    fatherMotherName?: string;
    parentsPhone?: string;
    linkedinId?: string;
    collegeName?: string;
    bachelorQual?: string;
    masterQual?: string;
}

const EmployeeSchema: Schema = new Schema({
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    role: { type: String, required: true },
    isOnboarded: { type: Boolean, default: false },
    dept: { type: String, required: true },
    designation: { type: String, required: true },
    status: { type: String, default: "Active" },
    joiningDate: { type: String, required: true },
    salary: { type: Number, required: true },
    location: { type: String, required: true },
    dateOfBirth: { type: String },
    gender: { type: String },
    bloodGroup: { type: String },
    phone: { type: String },
    address: { type: String },
    photoUrl: { type: String },
    chancesRemaining: { type: Number, default: 3 },
    reportsTo: { type: String },
    managerLevel: { type: String },
    password: { type: String, default: "26082001" },
    // Bank Details
    bankAccountName: { type: String },
    bankAccountNumber: { type: String },
    ifscCode: { type: String },
    upiId: { type: String },
    // Institutional Docs
    resumeUrl: { type: String },
    bachelorCertUrl: { type: String },
    masterCertUrl: { type: String },
    bachelorMarksheetUrl: { type: String },
    masterMarksheetUrl: { type: String },
    marksheet10Url: { type: String },
    marksheet12Url: { type: String },
    aadharCardUrl: { type: String },
    panCardUrl: { type: String },
    passportPhotoUrl: { type: String },
    bankPassbookUrl: { type: String },
    expLetterUrl: { type: String },
    // Additional Info
    fatherMotherName: { type: String },
    parentsPhone: { type: String },
    linkedinId: { type: String },
    collegeName: { type: String },
    bachelorQual: { type: String },
    masterQual: { type: String },
}, { timestamps: true });

const Employee: Model<IEmployee> = mongoose.models.Employee || mongoose.model<IEmployee>('Employee', EmployeeSchema);
export default Employee;
