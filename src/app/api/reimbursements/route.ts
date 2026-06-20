import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { ReimbursementClaim, Employee } from '@/models/Schemas';

// const N8N_WEBHOOK_URL = "https://gog.app.n8n.cloud/webhook/reimbursement";
const N8N_WEBHOOK_URL = "https://n8n.geeksofgurukul.com/webhook/reimbursement";
async function triggerN8n(claim: any, action: string) {
    try {
        await dbConnect();
        
        // Fetch employee details to enrich the data
        const employee = await Employee.findOne({ id: claim.employeeId });
        const empData = employee?.toObject ? employee.toObject() : employee;

        // Parse Expense Month and Year from monthYear
        // Format could be "YYYY-MM" (from <input type="month">) or "Month YYYY"
        let expenseMonth = "";
        let expenseYear = "";
        if (claim.monthYear) {
            if (claim.monthYear.includes("-")) {
                const [y, m] = claim.monthYear.split("-");
                const date = new Date(parseInt(y), parseInt(m) - 1);
                expenseMonth = date.toLocaleString('en-IN', { month: 'long' });
                expenseYear = y;
            } else {
                const parts = claim.monthYear.split(" ");
                if (parts.length === 2) {
                    expenseMonth = parts[0];
                    expenseYear = parts[1];
                }
            }
        }

        const d = new Date();
        const pad = (n: number) => n.toString().padStart(2, '0');
        const timestamp = `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;

        // Prepare links - Combine Google Drive link and Proof Image URLs
        // Format as raw URLs on new lines so Google Sheets can hyperlink them
        const allLinks = [];
        if (claim.driveLink) allLinks.push(claim.driveLink);
        if (claim.proofUrls && claim.proofUrls.length > 0) {
            claim.proofUrls.forEach((url: string) => allLinks.push(url));
        }

        // Precisely mapped payload for Google Sheets via n8n
        const payload = {
            "Timestamp": timestamp,
            "Name": empData?.name || claim.employeeName || "",
            "Email": empData?.email || claim.email || "",
            "Mobile": empData?.phone || claim.phone || "",
            "Expense Month (Month in which expenses occurred)": expenseMonth,
            "Expense Year (Year in which expenses occurred)": expenseYear,
            "Invoice\n\nUse online Invoice Generator and Generate Invoice \n\nBill To: SKILLSCAN EDTECH PRIVATE LIMITED\n\nSample Invoice is given below ": "",
            "Google Drive Folder Link containing all the Bills\n\nPlease note that no reimbursement will be done without proper bills. Screenshots are not considered as bills.\n\nNote: Name the Folder as Reimbursement_Employee_Name_Month\n": allLinks.join("\n"),
            "Bank Account Number": empData?.accountNumber || empData?.bankAccountNumber || empData?.bank_account_number || "",
            "IFSC Code": empData?.ifscCode || empData?.ifsc_code || "",
            "Bank Account Holder Name": empData?.account_holder_name || empData?.bankAccountName || empData?.name || "",
            "Total Expense Amount": claim.amount || 0,
            "Any additional Remarks": claim.description || "",
            "Approved Amount": claim.status === "Approved" ? claim.amount : "",
            "Status": claim.status || "Pending",
            "action": action
        };

        await fetch(N8N_WEBHOOK_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
    } catch (error) {
        console.error("Failed to trigger n8n webhook:", error);
    }
}

export async function GET(req: Request) {
    try {
        await dbConnect();
        const { searchParams } = new URL(req.url);
        const userId = searchParams.get('userId');
        const role = searchParams.get('role');

        let query = {};
        if (role !== 'HR' && role !== 'FOUNDER' && userId) {
            query = { employeeId: userId };
        }

        const claims = await ReimbursementClaim.find(query).sort({ date: -1 });
        return NextResponse.json(claims);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        await dbConnect();
        const body = await req.json();
        const claim = await ReimbursementClaim.create(body);
        
        // Trigger n8n on new submission
        await triggerN8n(claim.toObject ? claim.toObject() : claim, "submission");
        
        return NextResponse.json(claim);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function PUT(req: Request) {
    try {
        await dbConnect();
        const body = await req.json();
        const { id, ...updates } = body;
        const claim = await ReimbursementClaim.findOneAndUpdate({ id }, updates, { new: true });
        
        if (claim) {
            // Trigger n8n on status update (Approved/Rejected)
            await triggerN8n(claim.toObject ? claim.toObject() : claim, claim.status.toLowerCase());
        }
        
        return NextResponse.json(claim);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
