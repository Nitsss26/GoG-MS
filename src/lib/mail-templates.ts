// --- HELPERS ---

export const formatDate = (dateStr: string) => {
    if (!dateStr) return "N/A";
    // Handle standard YYYY-MM-DD or ISO strings
    try {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return dateStr; // Return as-is if invalid date
        return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
    } catch (e) {
        return dateStr;
    }
};

/**
 * Wraps email content in a professional GoG OMS themed layout.
 */
const ProfessionalWrapper = (title: string, content: string, color: string = "#10b981") => {
    return `
        <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
            <!-- Header -->
            <div style="background-color: #0d0f12; padding: 24px; text-align: center; border-bottom: 4px solid ${color};">
                <img src="https://res.cloudinary.com/dwaepohvf/image/upload/v1774941478/euchwm1um5zuiz5l01vr.png" alt="Geeks of Gurukul" style="height: 32px; display: block; margin: 0 auto; filter: brightness(1.5);">
            </div>
            
            <!-- Body -->
            <div style="padding: 32px 24px;">
                <h1 style="color: #111827; font-size: 22px; font-weight: 800; margin: 0 0 16px 0; letter-spacing: -0.025em;">${title}</h1>
                <div style="color: #4b5563; font-size: 15px; line-height: 1.6;">
                    ${content}
                </div>
            </div>

            <!-- Footer -->
            <div style="background-color: #f9fafb; padding: 20px; text-align: center; border-top: 1px solid #f3f4f6;">
                <p style="color: #9ca3af; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.1em; margin: 0;">
                    &copy; 2026 Geeks of Gurukul
                </p>
            </div>
        </div>
    `;
};

/**
 * Creates a formatted data table for email details.
 */
const DataTable = (items: { label: string; value: any; color?: string }[]) => {
    return `
        <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
            ${items.map(item => `
                <tr>
                    <td style="padding: 10px 0; color: #10b981; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; width: 40%; border-bottom: 1px solid #f3f4f6;">${item.label}</td>
                    <td style="padding: 10px 0; color: ${item.color || '#111827'}; font-size: 14px; font-weight: 500; border-bottom: 1px solid #f3f4f6;">${item.value || 'N/A'}</td>
                </tr>
            `).join('')}
        </table>
    `;
};

/**
 * Recursively fetches all managers in the reporting line and adds global oversight roles (Founder, HR, AD).
 */
export const getAuthorityEmails = (employee: any, allEmployees: any[]) => {
    const authorities: Set<string> = new Set();

    // 1. Recursive Hierarchy Traversal
    const findManagers = (empId: string) => {
        const emp = allEmployees.find(e => e.id === empId);
        if (!emp || !emp.reportsTo) return;

        const managerIds = Array.isArray(emp.reportsTo) ? emp.reportsTo : [emp.reportsTo];
        managerIds.forEach((mId: string) => {
            const manager = allEmployees.find(e => e.id === mId);
            if (manager && manager.email) {
                authorities.add(manager.email.toLowerCase());
                findManagers(manager.id); // Recursively go up
            }
        });
    };

    if (employee && employee.id) {
        findManagers(employee.id);
    }

    // 2. Founders (Global Oversight)
    const founders = allEmployees.filter(e => e.role === "FOUNDER" && e.email).map(e => e.email!.toLowerCase());
    founders.forEach(email => authorities.add(email));

    // 3. HR (Global Oversight)
    const hrEmails = allEmployees.filter(e => e.role === "HR" && e.email).map(e => e.email!.toLowerCase());
    hrEmails.forEach(email => authorities.add(email));

    // 4. AD (Associate Director - Global Inclusion)
    const adEmails = allEmployees
        .filter(e => e.role === "AD" && e.email)
        .map(e => e.email!.toLowerCase());
    adEmails.forEach(email => authorities.add(email));

    // 5. Explicit HOI Inclusion for certain roles
    // If sender is Professor or OM, ensure ALL HOIs are fetched from the email field of the employees list
    if (employee?.role === "PROFESSOR" || employee?.role === "OM" || employee?.role === "MARKETING_TEAM" || employee?.role === "TECH_TEAM") {
        const hoiEmails = allEmployees
            .filter(e => e.role === "HOI" && e.email)
            .map(e => e.email!.toLowerCase());
        hoiEmails.forEach(email => authorities.add(email));
    }

    if (employee && employee.email) {
        authorities.add(employee.email.toLowerCase());
    }
    // Blacklist: Remove any @gog.com emails (internal test/placeholder accounts)
    return Array.from(authorities).filter(email => !email.endsWith('@gog.com'));
};

const getPriorityConfig = (category: string) => {
    const cat = (category || "").toLowerCase();
    if (cat.includes("hr") || cat.includes("account")) {
        return { label: "High Priority (Critical)", color: "#ef4444", time: "8 Hours" };
    }
    if (cat.includes("attendance") || cat.includes("others")) {
        return { label: "Medium Priority", color: "#3b82f6", time: "16 Hours" };
    }
    return { label: "Normal Priority", color: "#f59e0b", time: "24 Hours" };
};

// --- EMAIL TEMPLATES ---

export const getTicketTemplate = (ticket: any, type: 'raised' | 'resolved') => {
    const priority = getPriorityConfig(ticket.targetCategory);
    const title = type === 'raised' ? "Support Ticket Raised" : "Support Ticket Resolved";

    const fields = [
        { label: "Ticket ID", value: ticket.id },
        { label: "Priority", value: priority.label, color: priority.color },
        { label: "Subject", value: ticket.subject },
        { label: "Category", value: ticket.targetCategory },
        { label: "Raiser", value: ticket.employeeName },
        { label: "Date", value: formatDate(ticket.createdAt) }
    ];

    const content = DataTable(fields);

    if (type === 'resolved') {
        return {
            subject: `[TICKET RESOLVED] ${ticket.subject} - ${ticket.id}`,
            html: ProfessionalWrapper(title, content + `
                <div style="background-color: #ecfdf5; border-radius: 8px; padding: 16px; margin-top: 20px; border-left: 4px solid #10b981;">
                    <strong style="color: #065f46; font-size: 11px; text-transform: uppercase; display: block; margin-bottom: 4px;">Resolution Remarks by HR/HOI</strong>
                    <p style="margin: 0; color: #047857; font-size: 14px;">${ticket.resolutionNotes || 'The issue has been resolved successfully.'}</p>
                </div>
            `, "#10b981")
        };
    }

    return {
        subject: `[TICKET RAISED] ${ticket.subject} - ${ticket.id}`,
        html: ProfessionalWrapper(title, content + `
            <div style="background-color: #f8fafc; border-radius: 8px; padding: 16px; margin-top: 20px; border-left: 4px solid ${priority.color};">
                <p style="margin: 0; color: #475569; font-size: 13px;"><strong>Issue Summary:</strong> ${ticket.content}</p>
            </div>
            <p style="margin-top: 20px; color: ${priority.color}; font-size: 12px; font-weight: 700;">
                ⏱️ Resolution Commitment: This ticket is scheduled for resolution within ${priority.time}.
            </p>
        `, priority.color)
    };
};

export const getTicketForwardTemplate = (ticket: any, forwardedToName: string, forwardedByName: string, remarks: string) => {
    const title = "Ticket Forwarded";
    const color = "#6366f1"; // Indigo for forwarding

    const fields = [
        { label: "Ticket ID", value: ticket.id },
        { label: "Subject", value: ticket.subject },
        { label: "Forwarded To", value: forwardedToName },
        { label: "Forwarded By", value: forwardedByName },
        { label: "Date", value: new Date().toLocaleDateString() }
    ];

    const content = DataTable(fields);

    return {
        subject: `[FORWARDED] Ticket ${ticket.id} forwarded to ${forwardedToName}`,
        html: ProfessionalWrapper(title, content + `
            <div style="background-color: #f5f3ff; border-radius: 8px; padding: 16px; margin-top: 20px; border-left: 4px solid ${color};">
                <strong style="color: #5b21b6; font-size: 11px; text-transform: uppercase; display: block; margin-bottom: 4px;">Forwarding Remarks</strong>
                <p style="margin: 0; color: #4c1d95; font-size: 14px;">${remarks || 'No specific remarks provided.'}</p>
            </div>
            <p style="margin-top: 20px; color: #6b7280; font-size: 12px;">
                You have been assigned this ticket for review/resolution. Please check the portal for details.
            </p>
        `, color)
    };
};

export const getLeaveTemplate = (leave: any, status: 'Pending' | 'Approved' | 'Rejected' | 'Pending HOI Approval') => {
    const statusColor = status === 'Approved' ? '#10b981' : status === 'Rejected' ? '#ef4444' : '#f59e0b';
    const displayStatus = status === 'Pending HOI Approval' ? 'Awaiting HOI' : status === 'Pending' ? 'Awaiting HR' : status;
    const title = `Leave Request: ${displayStatus}`;

    const cleanReason = (leave.reason && leave.reason !== "undefined") ? leave.reason : "Professional reason not detailed";

    const content = DataTable([
        { label: "Employee Name", value: leave.employeeName },
        { label: "Leave Type", value: `${leave.type} (${leave.leaveType})` },
        { label: "Duration", value: `${formatDate(leave.startDate)} to ${formatDate(leave.endDate)} (${leave.days} days)` },
        { label: "Reason", value: cleanReason },
        { label: "Current Status", value: displayStatus.toUpperCase(), color: statusColor }
    ]);

    return {
        subject: `[LEAVE REQUEST] ${leave.employeeName} - ${formatDate(leave.startDate)}`,
        html: ProfessionalWrapper(title, content + 
            (leave.reasonForAction ? `
                <div style="background-color: #f8fafc; border-radius: 8px; padding: 16px; margin-top: 20px; border-left: 4px solid ${statusColor};">
                    <strong style="color: #475569; font-size: 11px; text-transform: uppercase; display: block; margin-bottom: 4px;">Decision Remarks</strong>
                    <p style="margin: 0; color: #1e293b; font-size: 14px;">${leave.reasonForAction}</p>
                </div>
            ` : '') +
            (leave.lossOfPayDays ? `<p style="color: #ef4444; font-weight: bold; margin-top: 10px;">⚠️ Loss of Pay (LOP): ${leave.lossOfPayDays} days applied.</p>` : ''), 
            statusColor)
    };
};

export const getMisbehaviourTemplate = (report: any) => {
    const title = "Disciplinary Notice";
    const content = DataTable([
        { label: "Employee", value: report.employeeName },
        { label: "Issue Type", value: report.type },
        { label: "Date Issued", value: formatDate(report.date) },
        { label: "Description", value: report.description }
    ]);
    return {
        subject: `[DISCIPLINARY NOTICE] ${report.type} Issue - ${report.employeeName}`,
        html: ProfessionalWrapper(title, content + `
            <p style="margin-top: 20px; font-weight: bold; color: #ef4444;">This notice has been appended to your performance records. Immediate rectification is expected.</p>
        `, "#ef4444")
    };
};

export const getPIPAddTemplate = (pip: any) => {
    const title = "Performance Plan (PIP)";
    const content = DataTable([
        { label: "Employee", value: pip.employeeName },
        { label: "Effective From", value: formatDate(pip.startDate) },
        { label: "Primary Reason", value: pip.reason }
    ]);
    return {
        subject: `[URGENT] Performance Improvement Plan (PIP) Notice - ${pip.employeeName}`,
        html: ProfessionalWrapper(title, content + `
            <div style="background-color: #fffbeb; border: 1px solid #fef3c7; padding: 16px; border-radius: 8px; margin-top: 20px;">
                <p style="margin: 0; font-size: 13px; line-height: 1.5; color: #92400e;"><strong>Official Disclaimer:</strong> ${pip.disclaimer}</p>
            </div>
        `, "#f59e0b")
    };
};

export const getReimbursementTemplate = (claim: any) => {
    const statusColor = claim.status?.includes('Rejected') ? '#ef4444' : '#10b981';
    const title = "Reimbursement Update";

    // Comprehensive fields from claim
    const fields = [
        { label: "Claim ID", value: claim.id },
        { label: "Employee", value: claim.employeeName },
        { label: "Expense Type", value: claim.type },
        { label: "Exp. Period", value: claim.monthYear },
        { label: "Claimed Amount", value: `₹${claim.amount || 0}`, color: "#111827" }
    ];

    if (claim.approvedAmount !== undefined && claim.status.includes('Approved')) {
        fields.push({ label: "Approved Amount", value: `₹${claim.approvedAmount}`, color: "#10b981" });
    }

    fields.push({ label: "Description", value: claim.description });
    fields.push({ label: "Status", value: claim.status.toUpperCase(), color: statusColor });

    const content = DataTable(fields);

    let feedback = "";
    if (claim.driveLink || (claim.proofUrls && claim.proofUrls.length > 0)) {
        feedback += `
            <div style="margin-top: 20px; padding: 16px; background-color: #f8fafc; border-radius: 8px;">
                <strong style="font-size: 12px; color: #64748b; text-transform: uppercase; display: block; margin-bottom: 8px;">Supporting Proofs</strong>
                ${claim.driveLink ? `<a href="${claim.driveLink}" style="color: #10b981; font-size: 14px; text-decoration: none; display: block; margin-bottom: 4px;">📂 Google Drive Folder ↗</a>` : ''}
                ${(claim.proofUrls || []).map((url: string, i: number) => `<a href="${url}" style="color: #10b981; font-size: 14px; text-decoration: none; display: block; margin-bottom: 4px;">📄 View Bill ${i + 1} ↗</a>`).join('')}
            </div>
        `;
    }

    if (claim.rejectionReason) feedback += `<p style="color: #ef4444; margin-top: 15px; font-weight: 600;">⚠️ Rejection Reason: ${claim.rejectionReason}</p>`;
    if (claim.hrRemarks) feedback += `<p style="color: #4b5563; margin-top: 5px; font-style: italic;">Note: ${claim.hrRemarks}</p>`;

    return {
        subject: `[REIMBURSEMENT] ${claim.status.toUpperCase()} - ${claim.id}`,
        html: ProfessionalWrapper(title, content + feedback, statusColor)
    };
};

export const getMeetingTemplate = (meeting: any, user: any) => {
    const title = "New Meeting Scheduled";
    const statusColor = "#10b981"; // Professional Green

    const fields = [
        { label: "Meeting ID", value: meeting.id },
        { label: "Organizer", value: meeting.employeeName },
        { label: "Purpose", value: meeting.purpose },
        { label: "Date", value: formatDate(meeting.date) }, // DD-MM-YYYY via helper
        { label: "Time", value: meeting.time },
        { label: "Target", value: meeting.targetName }
    ];

    if (meeting.googleLink) {
        fields.push({ label: "Meeting Link", value: `<a href="${meeting.googleLink}" style="color: #10b981; font-weight: bold; text-decoration: none;">Join Meeting ↗</a>` });
    }

    const content = DataTable(fields);

    return {
        subject: `[MEETING] ${meeting.purpose} - ${formatDate(meeting.date)}`,
        html: ProfessionalWrapper(title, content + `
            <div style="background-color: #f8fafc; border-radius: 8px; padding: 16px; margin-top: 20px; border-left: 4px solid ${statusColor};">
                <strong style="color: #475569; font-size: 11px; text-transform: uppercase; display: block; margin-bottom: 4px;">Meeting Agenda</strong>
                <p style="margin: 0; color: #1e293b; font-size: 14px;">${meeting.agenda || 'Regular Institutional Sync'}</p>
            </div>
            <p style="margin-top: 20px; color: #64748b; font-size: 12px;">
                Please ensure you join via the <strong>Meetings Portal</strong> to record your attendance.
            </p>
        `, statusColor)
    };
};

export const getMoMTemplate = (meeting: any, mom: any) => {
    const title = "Minutes of Meeting (MoM)";
    const content = DataTable([
        { label: "Purpose", value: meeting.purpose },
        { label: "Meeting Date", value: formatDate(meeting.date) },
        { label: "Location/Mode", value: "Institutional Platform" }
    ]);
    return {
        subject: `[MoM] Minutes of Meeting - ${meeting.purpose}`,
        html: ProfessionalWrapper(title, content + `
            <div style="margin-top: 20px; border-top: 1px solid #f3f4f6; padding-top: 16px;">
                <h3 style="font-size: 14px; text-transform: uppercase; color: #111827;">Discussion Points</h3>
                <div style="background-color: #f9fafb; padding: 12px; border-radius: 6px; font-size: 14px;">${mom.content}</div>
                <h3 style="font-size: 14px; text-transform: uppercase; color: #10b981; margin-top: 16px;">Final Decision</h3>
                <div style="background-color: #ecfdf5; padding: 12px; border-radius: 6px; font-size: 14px; color: #065f46; font-weight: 600;">${mom.decision}</div>
            </div>
        `, "#10b981")
    };
};

export const getAdditionalResponsibilityTemplate = (resp: any) => {
    const title = `Additional Responsibility ${resp.status || 'Assigned'}`;
    const statusColor = resp.status === 'Approved' ? '#10b981' : resp.status === 'Rejected' ? '#ef4444' : '#f59e0b';
    
    const content = DataTable([
        { label: "Employee Name", value: resp.employeeName },
        { label: "Description", value: resp.description },
        { label: "Effective Date", value: formatDate(resp.date) },
        { label: "Perf. Points", value: `${resp.points >= 0 ? '+' : ''}${resp.points} Points`, color: statusColor },
        { label: "Current Status", value: (resp.status || "Assigned").toUpperCase(), color: statusColor }
    ]);

    let footer = "";
    if (resp.status === 'Approved') {
        footer = `
            <div style="background-color: #ecfdf5; border: 1px solid #d1fae5; padding: 16px; border-radius: 8px; margin-top: 20px;">
                <p style="margin: 0; font-size: 13px; line-height: 1.5; color: #065f46;"><strong>Congratulations!</strong> This responsibility has been officially approved. The points have been added to your performance leaderboard.</p>
            </div>
        `;
    } else if (!resp.status || resp.status === "Pending") {
        footer = `
            <p style="margin-top: 20px; color: #10b981; font-weight: bold;">We appreciate your dedication towards taking on more impact within the organization. This request is currently awaiting Founder approval.</p>
        `;
    }

    return {
        subject: `[RESPONSIBILITY ${resp.status?.toUpperCase() || 'ASSIGNED'}] ${resp.description} - ${resp.employeeName}`,
        html: ProfessionalWrapper(title, content + footer, statusColor)
    };
};

export const getMarkAsPresentTemplate = (req: any, status: 'Pending' | 'Approved' | 'Rejected') => {
    const statusColor = status === 'Approved' ? '#10b981' : status === 'Rejected' ? '#ef4444' : '#f59e0b';
    const title = `Attendance Appeal ${status}`;
    const content = DataTable([
        { label: "Employee", value: `${req.employeeName} (${req.employeeId})` },
        { label: "Appeal Date", value: formatDate(req.date) },
        { label: "Stated Reason", value: req.reason },
        { label: "Status", value: status.toUpperCase(), color: statusColor }
    ]);
    return {
        subject: `[ATTENDANCE APPEAL] ${status.toUpperCase()} - ${req.employeeName}`,
        html: ProfessionalWrapper(title, content + (status === 'Approved' ?
            '<p style="color: #10b981; font-size: 13px; margin-top: 10px;">The record has been updated with a "Late Clock-in" flag for HR compliance.</p>' : ''), statusColor)
    };
};

export const getOverrideTemplate = (req: any, status: 'Pending' | 'Approved' | 'Rejected') => {
    const statusColor = status === 'Approved' ? '#10b981' : status === 'Rejected' ? '#ef4444' : '#f59e0b';
    const title = `Attendance Override Request ${status}`;
    const content = DataTable([
        { label: "Target Employee", value: req.employeeName },
        { label: "Requested By", value: req.requestedByName },
        { label: "Reasoning", value: req.reason },
        { label: "Override Status", value: status.toUpperCase(), color: statusColor }
    ]);
    return {
        subject: `[OVERRIDE] Attendance System Manual Update - ${status.toUpperCase()}`,
        html: ProfessionalWrapper(title, content + `
            <p style="font-size: 11px; padding: 12px; background: #f8fafc; border-radius: 4px; margin-top: 10px; color: #64748b;">This log has been recorded in the executive communication history.</p>
        `, "#6366f1")
    };
};

export const getWorkScheduleTemplate = (schedule: any, isAdmin: boolean) => {
    const title = "Work Schedule Update";
    const content = DataTable([
        { label: "Employee", value: schedule.employeeName },
        { label: "Assigned By", value: schedule.assignedByName },
        { label: "Effective", value: "Immediately" }
    ]);
    return {
        subject: `[SCHEDULE] New Timing Assignment Update`,
        html: ProfessionalWrapper(title, content + `
            <p style="margin-top: 15px;">Your daily timings and location assignments have been revised. Please check the <strong>Institutional Portal Dashboard</strong> for day-wise breakdown.</p>
        `, "#10b981")
    };
};

export const getHolidayTemplate = (holiday: any, status: 'Proposed' | 'Approved') => {
    const title = `${status} Holiday Notice`;
    const content = DataTable([
        { label: "Holiday Name", value: holiday.name },
        { label: "Event Date", value: formatDate(holiday.date) },
        { label: "Classification", value: holiday.category },
        { label: "Public Status", value: status }
    ]);
    return {
        subject: `[HOLIDAY ${status.toUpperCase()}] ${holiday.name} - ${formatDate(holiday.date)}`,
        html: ProfessionalWrapper(title, content + (holiday.customMessage ? `<div style="background-color: #ecfdf5; padding: 12px; border-radius: 6px; margin-top: 10px; color: #065f46;">${holiday.customMessage}</div>` : ''), "#10b981")
    };
};

export const getDressCodeWarningTemplate = (employee: any, defaults: number) => {
    const title = "Dress Code Violation";
    const content = DataTable([
        { label: "Employee", value: employee.name },
        { label: "Total Defaults", value: `${defaults} of 3`, color: "#ef4444" }
    ]);
    return {
        subject: `[OFFICIAL WARNING] Policy Violation Notice - ${employee.name}`,
        html: ProfessionalWrapper(title, content + `
            <div style="background-color: #fef2f2; border: 1px solid #fee2e2; padding: 16px; border-radius: 8px; margin-top: 15px;">
                <p style="margin: 0; color: #b91c1c; font-size: 14px; line-height: 1.6;">
                    <strong>Mandatory Protocol:</strong> White Shirt, Black Formal Pants, Black Blazer, and Formal Shoes. <br/>
                    <span style="font-weight: 800; text-transform: uppercase;">Final Warning:</span> Reaching 3 defaults will result in restricted attendance access.
                </p>
            </div>
        `, "#ef4444")
    };
};

export const getRatingTemplate = (rating: any) => {
    const title = "Performance Assessment";
    const stars = Array.from({ length: 5 }).map((_, i) => `<span style="color: ${i < rating.score ? '#f59e0b' : '#d1d5db'}; font-size: 24px;">★</span>`).join('');

    const content = DataTable([
        { label: "Evaluation Period", value: rating.period },
        { label: "Aggregate Score", value: `${rating.score} / 5`, color: "#b91c1c" },
        { label: "Evaluator", value: rating.ratedByName }
    ]);

    return {
        subject: `[SCORE] Academic/Perf Assessment Result: ${rating.score}/5`,
        html: ProfessionalWrapper(title, `
            <div style="text-align: center; margin-bottom: 20px;">
                <div style="display: inline-block; background: #fff7ed; padding: 10px 20px; border-radius: 100px; border: 1px solid #ffedd5;">
                    ${stars}
                </div>
            </div>
            ${content}
            ${rating.comment ? `
            <div style="background-color: #f8fafc; padding: 16px; border-radius: 8px; margin-top: 15px; border-left: 4px solid #64748b;">
                <strong style="color: #334155; font-size: 12px; text-transform: uppercase;">Direct Feedback</strong>
                <p style="margin: 5px 0 0 0; color: #475569; font-style: italic;">"${rating.comment}"</p>
            </div>` : ''}
            ${rating.screenshotUrl ? `
            <div style="margin-top: 20px; padding: 16px; background-color: #f0fdf4; border-radius: 8px; border: 1px dashed #22c55e;">
                <strong style="color: #166534; font-size: 11px; text-transform: uppercase; display: block; margin-bottom: 8px;">1:1 Session Proof (Attached)</strong>
                <a href="${rating.screenshotUrl}" style="color: #10b981; font-size: 13px; font-weight: 700; text-decoration: none;">View Screenshot Online ↗</a>
            </div>` : ''}
        `, "#10b981")
    };
};

export const getAnnouncementTemplate = (ann: any) => {
    const catColor = ann.category === "Urgent" ? "#ef4444" : "#10b981";
    const title = ann.title;

    return {
        subject: `[ANNOUNCEMENT] ${ann.title}`,
        html: ProfessionalWrapper(title, `
            <p style="color: #6b7280; font-size: 12px; margin-bottom: 12px;">Published on ${formatDate(ann.createdAt)} | Category: ${ann.category}</p>
            <div style="line-height: 1.8; color: #1f2937;">${ann.content.replace(/\n/g, '<br/>')}</div>
            ${ann.imageUrls?.length > 0 ? `<div style="margin-top: 20px;">${ann.imageUrls.map((url: string) => `<img src="${url}" style="width: 100%; border-radius: 8px; margin-bottom: 12px; border: 1px solid #f3f4f6; object-fit: cover; max-height: 300px;"/>`).join('')}</div>` : ''}
            <p style="font-size: 12px; color: #9ca3af; margin-top: 24px;">Issued by: ${ann.createdBy}</p>
        `, catColor)
    };
};

export const getSOPUpdateTemplate = (sop: any, type: string) => {
    const typeColor = type === 'new' ? '#10b981' : type === 'updated' ? '#f59e0b' : '#ef4444';
    const title = `SOP ${type.toUpperCase()}`;

    const content = DataTable([
        { label: "Document Title", value: sop.title },
        { label: "Version No.", value: `v${sop.version}` },
        { label: "Initiated By", value: sop.changedBy || "Admin" }
    ]);

    return {
        subject: `[POLICY] Standard Operating Procedure Update - ${sop.title}`,
        html: ProfessionalWrapper(title, content + `
            <div style="background-color: #f3f4f6; padding: 16px; border-radius: 8px; margin-top: 20px;">
                <strong style="font-size: 12px; color: #4b5563; text-transform: uppercase;">Changelog</strong>
                <p style="margin: 4px 0 0 0; color: #111827; font-size: 14px;">${sop.changelog || "Reference documentation library for details."}</p>
            </div>
        `, typeColor)
    };
};

export const getBirthdayTemplate = (employee: any) => {
    const title = `Happy Birthday, ${employee.name}!`;
    return {
        subject: `🎂 Happy Birthday ${employee.name}! - Geeks of Gurukul`,
        html: ProfessionalWrapper(title, `
            <p style="text-align: center; font-size: 16px;">Wishing you a fantastic day filled with joy and celebration. <br/> We are proud to have you in the <strong>Geeks of Gurukul</strong> family!</p>
            <div style="text-align: center; font-size: 60px; margin: 30px 0;">🎉🎂✨</div>
            <p style="text-align: center; color: #10b981; font-weight: 800; font-size: 18px;">Enjoy your special day!</p>
        `, "#10b981")
    };
};

export const getScheduleChangeTemplate = (actor: any, employee: any, date: string, oldSchedule: any, newSchedule: any) => {
    const title = "On-Demand Schedule Change";
    const content = DataTable([
        { label: "Employee Name", value: employee?.name || "Employee" },
        { label: "Override Date", value: date },
        { label: "Updated By", value: actor?.name || "Manager" },
        { label: "Role", value: actor?.role || "Admin" }
    ]);

    const comparison = `
        <div style="background-color: #f3f4f6; padding: 16px; border-radius: 8px; margin-top: 20px; display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
            <div>
                <strong style="font-size: 11px; color: #6b7280; text-transform: uppercase;">Previous Schedule</strong>
                <p style="margin: 4px 0 0 0; color: #4b5563; font-size: 13px;">Location: ${oldSchedule.location}</p>
                <p style="margin: 2px 0 0 0; color: #4b5563; font-size: 13px;">Time: ${oldSchedule.in} - ${oldSchedule.out}</p>
            </div>
            <div>
                <strong style="font-size: 11px; color: #10b981; text-transform: uppercase;">Updated Schedule</strong>
                <p style="margin: 4px 0 0 0; color: #111827; font-size: 13px; font-weight: 700;">Location: ${newSchedule.location}</p>
                <p style="margin: 2px 0 0 0; color: #111827; font-size: 13px; font-weight: 700;">Time: ${newSchedule.clockInTime} - ${newSchedule.clockOutTime}</p>
            </div>
        </div>
        <p style="font-size: 12px; color: #9ca3af; margin-top: 16px; font-style: italic;">Note: This is a manual override for the specified date only. Standard weekly schedules remain unchanged.</p>
    `;

    return {
        subject: `[SCHEDULE OVERRIDE] ${employee?.name} - ${date}`,
        html: ProfessionalWrapper(title, content + comparison, "#3b82f6")
    };
};


export const getMeetingWarningTemplate = (meeting: any, employee: any) => {
    const title = "Meeting Absence Warning";
    const content = DataTable([
        { label: "Employee", value: employee.name },
        { label: "Meeting Title", value: meeting.purpose },
        { label: "Scheduled Date", value: formatDate(meeting.date) },
        { label: "Scheduled Time", value: meeting.time + " (IST)" },
        { label: "Violation Status", value: "UNAUTHORISED ABSENCE", color: "#ef4444" }
    ]);

    return {
        subject: `[WARNING] Unauthorised Absence from Scheduled Sync - ${meeting.purpose}`,
        html: ProfessionalWrapper(title, content + `
            <div style="background-color: #fef2f2; border: 1px solid #fee2e2; padding: 16px; border-radius: 8px; margin-top: 15px;">
                <p style="margin: 0; color: #b91c1c; font-size: 14px; line-height: 1.6;">
                    <strong>Mandatory Protocol:</strong> Attendance in scheduled departmental syncs is mandatory. Our records indicate you did not join the session and failed to provide a genuine reason within the stipulated 1-hour grace period.
                </p>
                <p style="margin: 10px 0 0 0; color: #b91c1c; font-size: 13px; font-weight: 700; text-transform: uppercase;">
                    This incident has been logged and reported to HR and the Founders.
                </p>
            </div>
        `, "#ef4444")
    };
};
