const mongoose = require('mongoose');

const MONGODB_URI = "mongodb+srv://mlrd:mlrdtestdb@cluster0.yzhly.mongodb.net/GoG-MS";

const employeeSchema = new mongoose.Schema({
    id: String, name: String, email: String, role: String, photoUrl: String,
    isOnboarded: Boolean, dept: String, designation: String, status: String,
    joiningDate: String, salary: Number, location: String, dateOfBirth: String,
    phone: String, gender: String, bloodGroup: String, reportsTo: [String],
    managerLevel: String, chancesRemaining: { type: Number, default: 3 },
    password: { type: String, default: "26082001" },
    fatherMotherName: String, parentsPhone: String, address: String,
    bankAccountName: String, bankAccountNumber: String, ifscCode: String, upiId: String,
    resumeUrl: String, bachelorCertUrl: String, masterCertUrl: String,
    bachelorMarksheetUrl: String, masterMarksheetUrl: String,
    marksheet10Url: String, marksheet12Url: String, aadharCardUrl: String,
    panCardUrl: String, passportPhotoUrl: String, bankPassbookUrl: String,
    expLetterUrl: String, linkedinId: String, collegeName: String,
    bachelorQual: String, masterQual: String
});

const Employee = mongoose.models.Employee || mongoose.model('Employee', employeeSchema);

const newEmployees = [
    {
        id: "EMP501", name: "Suman Rajak", email: "suman@geeksofgurukul.com", role: "PROFESSOR",
        designation: "SDE & Professor", status: "Active", isOnboarded: true,
        dateOfBirth: "22/02/2001", password: "22022001", phone: "6295861588",
        bloodGroup: "B+", dept: "IIT", location: "IIT",
        fatherMotherName: "Biswanath Rajak", parentsPhone: "8972337294",
        address: "AMLAGORA , GARHBETA , PASCHIM MEDINIPUR , PIN - 721121",
        bachelorQual: "B.Tech (ECE): Bankura Unnayani Institute of Engineering",
        masterQual: "M.Tech (Control System) : IIT Kharagpur",
        collegeName: "IIT", linkedinId: "linkedin.com/in/suman-rajak-264137225",
        bankAccountNumber: "42262692885", ifscCode: "SBIN0000202", bankAccountName: "Suman Rajak",
        upiId: "rajaksuman56@oksbi",
        resumeUrl: "https://drive.google.com/open?id=1ZZQvqKUXmv03fzndCECTKQa31lXxuTIg",
        bachelorCertUrl: "https://drive.google.com/open?id=1Pbw95x2HvXLYHANdhNeNCXbnfglbpNLs",
        masterCertUrl: "https://drive.google.com/open?id=1myxb1UDH97HhDB__vfWX4fOqKRuaMik8",
        marksheet10Url: "https://drive.google.com/open?id=1MyhVPpy-zpVVwDi3PfaN_lOTTvKEh1uB",
        marksheet12Url: "https://drive.google.com/open?id=1lkWOlJ0zhHtQK6wMenaVRYHFLpzBQbpj",
        aadharCardUrl: "https://drive.google.com/open?id=1vy_xag1-WfeQsGxuIaEIe-qzZtSfMMje",
        panCardUrl: "https://drive.google.com/open?id=1EtOL15K7buZ7MkffUIdVj-2FCJJYQHPs",
        passportPhotoUrl: "https://drive.google.com/open?id=1mowA0YVj0XIACM9m7FEq8Da8VdRhGtkF",
        bankPassbookUrl: "https://drive.google.com/open?id=1STGEnG9p67CFedva2xlzT4w3mSSeiF_T",
        bachelorMarksheetUrl: "https://drive.google.com/open?id=15-ZYsSixbFdQi0yoHMwC9xSZT1JlzHbH",
        masterMarksheetUrl: "https://drive.google.com/open?id=1K-9WwEimPULbyh69Tf8r9XEsKQ0iIo1h",
        joiningDate: "2024-03-13", salary: 50000, reportsTo: ["FND001"]
    },
    {
        id: "OM501", name: "Abhishek Tiwari", email: "abhishek.tiwari@geeksofgurukul.com", role: "OM",
        designation: "Operation Manager", status: "Active", isOnboarded: true,
        dateOfBirth: "05/05/2000", password: "05052000", phone: "7999284901",
        bloodGroup: "A+", dept: "Operations", location: "Other College",
        fatherMotherName: "NIRBHAY TIWARI", parentsPhone: "8989961318",
        address: "103 BALAJI APPARTEMENT MAHABALI NAGAR KOLAR ROAD BHOPAL",
        bachelorQual: "B.TECH (IT)", masterQual: "MBA",
        collegeName: "Other College", linkedinId: "linkedin.com/in/abhishek-tiwari-b632601a6/",
        bankAccountNumber: "903110110013943", ifscCode: "BKID0009031", bankAccountName: "ABHISHEK TIWARI",
        upiId: "7999284901@YBL",
        resumeUrl: "https://drive.google.com/open?id=1WRdpCgVd0Ph0PSXmfzbjt_C3AQryKqoT",
        bachelorCertUrl: "https://drive.google.com/open?id=1JUQnbPzuG7De8bPqYNwvBNH4weE6POJ2",
        marksheet10Url: "https://drive.google.com/open?id=1wxIpd9KgKyVegoGqCTOqq1bdKAzQyFUp",
        marksheet12Url: "https://drive.google.com/open?id=1bHrBPwBcXiHVbguXW6KQadqVABwgchLn",
        aadharCardUrl: "https://drive.google.com/open?id=1AnZDGT3w7lU50LBuJUteICAtSDU6IMnG",
        panCardUrl: "https://drive.google.com/open?id=1g4l2tIIusMQ31QzqdT4MBPqbgPP7dI5q",
        passportPhotoUrl: "https://drive.google.com/open?id=1isZBpoAP3_JhPi2wcfLobIAJu9dzQQh6",
        bankPassbookUrl: "https://drive.google.com/open?id=14lLDNRqx54i4a0l6YkF2tNeZboCLaTqC",
        expLetterUrl: "https://drive.google.com/open?id=1jGDIRxvPjgayBSVs8V_I2tUDOxL9a63n",
        bachelorMarksheetUrl: "https://drive.google.com/open?id=1DlFFBOJraYX7Sfb1vHnQ0JKIUUX2kbtX",
        joiningDate: "2024-03-13", salary: 35000, reportsTo: ["FND001"]
    },
    {
        id: "EMP502", name: "Vipul Kumar Gond", email: "vipul.gond@geeksofgurukul.com", role: "PROFESSOR",
        designation: "SDE & Professor", status: "Active", isOnboarded: true,
        dateOfBirth: "01/09/2001", password: "01092001", phone: "9565006194",
        bloodGroup: "O+", dept: "IIT", location: "IIT",
        fatherMotherName: "Rajesh Prasad Gond", parentsPhone: "7651967219",
        address: "Jalalabad , Ghazipur , Uttar Pradesh",
        bachelorQual: "B.Tech", collegeName: "IIT", linkedinId: "www.linkedin.com/in/vipul1877",
        bankAccountNumber: "415302011017116", ifscCode: "UBIN0541532", bankAccountName: "VIPUL KUMAR GOND",
        upiId: "9565096194@ybl",
        resumeUrl: "https://drive.google.com/open?id=1VFSGJ5D3akYI7xBCzvXMXnDDp6iEX8vb",
        bachelorCertUrl: "https://drive.google.com/open?id=1VZKUFmTG8ikCH7KWAG_0-7bDK20vV1Fa",
        marksheet10Url: "https://drive.google.com/open?id=1jfP4q9079EtGQIGYOgnzcAzIcGKc4bmP",
        marksheet12Url: "https://drive.google.com/open?id=1NeVk7D5bqoplTrQbNXj7PNAdFjUD6XlF",
        aadharCardUrl: "https://drive.google.com/open?id=1Ucsdsl-7QF0NvxcPmXVLIUoqusk33Kxp",
        panCardUrl: "https://drive.google.com/open?id=1ddaq1rUJT6Ychup4uvegT-Xqcw0TAo9E",
        passportPhotoUrl: "https://drive.google.com/open?id=1eylzoHxJLgtupBlE6tzc8VcCANO7PzmW",
        bankPassbookUrl: "https://drive.google.com/open?id=1YIHTGExb7fjN2cyFZBo1d_h9tTP2zR-U",
        expLetterUrl: "https://drive.google.com/open?id=1ikZ25fUJcVa_BGAe94OO6WFbf6Qf4S6b",
        bachelorMarksheetUrl: "https://drive.google.com/open?id=1-s_UUS9KLTxQkq8pQYqgmfDSevU4z1R-",
        joiningDate: "2024-03-13", salary: 50000, reportsTo: ["FND001"]
    },
    {
        id: "OM502", name: "Shriyansh Shrivastava", email: "shriyansh@geeksofgurukul.com", role: "OM",
        designation: "Operation Manager", status: "Active", isOnboarded: true,
        dateOfBirth: "04/08/2004", password: "04082004", phone: "9617923667",
        bloodGroup: "A-", dept: "Operations", location: "Other College",
        fatherMotherName: "Raju Shrivastava", parentsPhone: "9981324819",
        address: "Bijora Jaisinagar Sagar 470125",
        bachelorQual: "B. Tech.(CSE)", masterQual: "no",
        collegeName: "Other College", linkedinId: "https://www.linkedin.com/in/shriyansh-shrivastva-1828542a6",
        bankAccountNumber: "3711597326", ifscCode: "CBIN0284173", bankAccountName: "Shriyansh Shrivastava",
        upiId: "9617923667@ybl",
        resumeUrl: "https://drive.google.com/open?id=1iel7lOQ9Nv2FsmX83kiAhT_GTGJazvI-",
        bachelorCertUrl: "https://drive.google.com/open?id=13EnhUyjeRmnf6eZm0mfuUtje4ERyWv0R",
        masterCertUrl: "https://drive.google.com/open?id=1D6Otk6I3ZP3duE0bo9wVAvnrdvDZCoQh",
        marksheet10Url: "https://drive.google.com/open?id=1OFZ_TmzdJRIHCoG7XsoFtK-tR_H95Ax8",
        marksheet12Url: "https://drive.google.com/open?id=1SpIJh4QRb94q0sFS8dZ9qnFAPYcgJHwc",
        aadharCardUrl: "https://drive.google.com/open?id=1_ft2TMtx06V8OOVq6OJFWzfQl2qasyI2",
        panCardUrl: "https://drive.google.com/open?id=1hqRY16DOS_NsqW5Ov1z1XVkGdXY1e9Wm",
        passportPhotoUrl: "https://drive.google.com/open?id=143dM0jjj65w3Zjwrww4YOuBJkNxxRN-W",
        bankPassbookUrl: "https://drive.google.com/open?id=1Xgz9JIEDmU8jDYAbIauZM-sjE6DBUx1B",
        bachelorMarksheetUrl: "https://drive.google.com/open?id=1cmCGWhWP5xKlVPTjPx-IMWLeKp58dpBF",
        masterMarksheetUrl: "https://drive.google.com/open?id=1djOZNZlQmTbwOq4kddQPqNNpEAKZBBd1",
        joiningDate: "2024-03-13", salary: 35000, reportsTo: ["FND001"]
    }
];

async function seed() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log("Connected to MongoDB");

        for (const emp of newEmployees) {
            await Employee.findOneAndUpdate({ email: emp.email }, emp, { upsert: true, new: true });
            console.log(`Upserted: ${emp.name} (${emp.id})`);
        }

        await mongoose.disconnect();
        console.log("Seeding completed");
        process.exit(0);
    } catch (error) {
        console.error("Error seeding:", error);
        process.exit(1);
    }
}

seed();
