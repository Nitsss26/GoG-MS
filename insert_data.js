const { MongoClient } = require('mongodb');

const uri = 'mongodb+srv://mlrd:mlrdtestdb@cluster0.yzhly.mongodb.net/GoG-MS';
const client = new MongoClient(uri);

async function run() {
    try {
        await client.connect();
        const db = client.db('GoG-MS');
        const employees = db.collection('employees');
        const workSchedules = db.collection('workschedules');

        const newEmployees = [
            {
                id: "EMP503",
                name: "Mayank Choudhary",
                email: "mayank.choudhary@geeksofgurukul.com",
                role: "PROFESSOR",
                isOnboarded: true,
                dept: "Technical",
                designation: "SDE & Professor",
                status: "Active",
                joiningDate: "2026-03-14",
                salary: 50000,
                location: "bansal-kokta",
                dateOfBirth: "30/10/2002",
                bloodGroup: "B+",
                phone: "7023260900",
                address: "Global green colony behind Gita bhavan, Rasuliya, Narmadapuram, 461001 Madhya Pradesh",
                password: "30102002",
                bankAccountName: "Mayank Choudhary",
                bankAccountNumber: "2382101011872",
                ifscCode: "CNRB0002382",
                upiId: "7023260900@ptsbi",
                resumeUrl: "https://drive.google.com/open?id=1D9agRktKhDag8lp3svd8C7GDtsrjwKjd",
                bachelorCertUrl: "https://drive.google.com/open?id=1bsWwWLibCHz9-Jcy0LecVl3KvkExO7iL",
                bachelorMarksheetUrl: "https://drive.google.com/open?id=1qvSTvfns2tyxcOLjPWoQlF94ad3dr3W4",
                marksheet10Url: "https://drive.google.com/open?id=1es4KN7xTYMtefT_i_7zny3Hy4FGyUF-P",
                marksheet12Url: "https://drive.google.com/open?id=1dsXH1YzB9urhufAGbJ-ayt58U0I7HBHq",
                aadharCardUrl: "https://drive.google.com/open?id=1S1SWBCDC_ZDl7EYi7kwPz7Wpwl4N9P9L",
                panCardUrl: "https://drive.google.com/open?id=1WhiVt20NXYkw5xk-SyF-mEjH1r94mV1v",
                passportPhotoUrl: "https://drive.google.com/open?id=1N9VOQLHM5tb1_KlW3wjC-WB59Zpl6UXO",
                bankPassbookUrl: "https://drive.google.com/open?id=1b_vGgzVO63D0RAJtxOykzjhQazLfn-eq",
                fatherMotherName: "Ghanshyam Choudhary",
                parentsPhone: "9424420001",
                linkedinId: "https://www.linkedin.com/in/mayank-choudhary-0bb93a368/",
                collegeName: "IIT",
                bachelorQual: "B.Tech (CSE) : IIT Guwahati"
            },
            {
                id: "EMP504",
                name: "Priyanka kumawat",
                email: "priyanka.kumawat@geeksofgurukul.com",
                role: "PROFESSOR",
                isOnboarded: true,
                dept: "Technical",
                designation: "SDE & Professor",
                status: "Active",
                joiningDate: "2026-03-14",
                salary: 50000,
                location: "bansal-kokta",
                dateOfBirth: "18/10/2001",
                bloodGroup: "A+",
                phone: "7073216278",
                address: "Ninder, bhopakal ki dhani ,harmada , jaipur rajasthan",
                password: "18102001",
                bankAccountName: "Priyanka kumawat",
                bankAccountNumber: "42208053308",
                ifscCode: "SBIN0000202",
                upiId: "priyankakumawat227@ybl",
                resumeUrl: "https://drive.google.com/open?id=1oldCiI7OrJm-gPxx02ulKG6DbaKWFWqU",
                bachelorCertUrl: "https://drive.google.com/open?id=1Qvj3_XMo8InAsiXxlCCNS3CnnmmWdL5g",
                masterCertUrl: "https://drive.google.com/open?id=17kJpLI_PT_4-Oj4GwrRpomCREiSoGlch",
                bachelorMarksheetUrl: "https://drive.google.com/open?id=1_I40ZEd1TP1pUrWRCRdvcmvCF31q3Lv-",
                masterMarksheetUrl: "https://drive.google.com/open?id=1hgsDjZuTsOrScwTlmT3Xz-vB8E6PgM9n",
                marksheet10Url: "https://drive.google.com/open?id=1p_zk3cJJKVs_a-eLoTvjarY4q7jRzcTM",
                marksheet12Url: "https://drive.google.com/open?id=10KREN7Tby0xh14W1WHcW8F_ViLJQFA8w",
                aadharCardUrl: "https://drive.google.com/open?id=10-UMxhsBEhPewYom9Y_QQb3FAZk0u63E",
                panCardUrl: "https://drive.google.com/open?id=1AFqTXr2jiZ7K-gHVaBOdw79d4SKwkSU9",
                passportPhotoUrl: "https://drive.google.com/open?id=1nTUiLtzr4_1AUXT-f05aM3jJkF4qRJ0C",
                bankPassbookUrl: "https://drive.google.com/open?id=1F5LSXLFy8AtdLqz_uuLOUclCtCdfmTlT",
                fatherMotherName: "Keshav kumawat",
                parentsPhone: "9829048587",
                linkedinId: "https://www.linkedin.com/in/priyanka-kumawat-7177092a3",
                collegeName: "IIT",
                bachelorQual: "B.Sc.: Bhawani niketan",
                masterQual: "M.Sc.: IIT Kharagpur"
            },
            {
                id: "EMP505",
                name: "Siddhant Shrivastava",
                email: "siddhants.shrivastav@geeksofgurukul.com",
                role: "PROFESSOR",
                isOnboarded: true,
                dept: "Technical",
                designation: "SDE & Professor",
                status: "Active",
                joiningDate: "2026-03-14",
                salary: 50000,
                location: "sage-indore",
                dateOfBirth: "05/06/2001",
                bloodGroup: "B+",
                phone: "9406826293",
                address: "shubham colony , royal city Kareli",
                password: "05062001",
                bankAccountName: "siddhant shrivastav",
                bankAccountNumber: "943810110009438",
                ifscCode: "BKID0009438",
                upiId: "9406826293@ybl",
                resumeUrl: "https://drive.google.com/open?id=1Qp_b4aFZ1NKnTIygy30HgGwCO8uTQFus",
                bachelorCertUrl: "https://drive.google.com/open?id=1ZhXPP6TAvCOuuPkM1VJKgN-Rfn0l3C7c",
                bachelorMarksheetUrl: "https://drive.google.com/open?id=1h6_yNm1zVian82LPdixWNAMr2CW7F8I9",
                marksheet10Url: "https://drive.google.com/open?id=17O5MURAOlM5jFNbSJ3rW-CIAlnKRD1On",
                marksheet12Url: "https://drive.google.com/open?id=1oqt3R6WqJx_a8Hz_7TB3wU_WdMjCvclN",
                aadharCardUrl: "https://drive.google.com/open?id=1P-w4TyiSw04cU2kI9BeOP9gLisrV5ZGw",
                panCardUrl: "https://drive.google.com/open?id=1lO8Oz96VC9NlFPoylcJ4h2lpwblBRILQ",
                passportPhotoUrl: "https://drive.google.com/open?id=1rje29eAN8D_7Bip43yDM43vEL1PxquDg",
                bankPassbookUrl: "https://drive.google.com/open?id=1eh61qoVvU_EpeTRGiwlbToR96rQCWiTY",
                fatherMotherName: "Rajesh Shrivastava",
                parentsPhone: "9424643276",
                linkedinId: "https://www.linkedin.com/in/siddhant-ss",
                collegeName: "IIT",
                bachelorQual: "B.Tech (EEE) IIT GUWAHATI"
            }
        ];

        console.log('Inserting employees...');
        for (const emp of newEmployees) {
            await employees.updateOne({ id: emp.id }, { $set: emp }, { upsert: true });
            console.log(`Inserted/Updated ${emp.name} (${emp.id})`);
        }

        const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
        const schedules = [
            { id: "EMP503", name: "Mayank Choudhary", location: "bansal-kokta", in: "09:30", out: "16:20" },
            { id: "EMP504", name: "Priyanka kumawat", location: "bansal-kokta", in: "09:30", out: "16:20" },
            { id: "EMP505", name: "Siddhant Shrivastava", location: "sage-indore", in: "09:30", out: "16:00" }
        ];

        console.log('Inserting schedules...');
        for (const sched of schedules) {
            for (const day of days) {
                await workSchedules.updateOne(
                    { employeeId: sched.id, date: day },
                    {
                        $set: {
                            employeeId: sched.id,
                            employeeName: sched.name,
                            date: day,
                            location: sched.location,
                            clockInTime: sched.in,
                            clockOutTime: sched.out,
                            status: "Approved",
                            assignedBy: "SYSTEM"
                        }
                    },
                    { upsert: true }
                );
            }
            console.log(`Updated schedules for ${sched.name} (${sched.id})`);
        }

        console.log('All operations completed successfully.');

    } finally {
        await client.close();
    }
}

run().catch(console.dir);
