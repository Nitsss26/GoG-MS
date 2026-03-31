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
                <img src="data:image/png;base64,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" alt="Geeks of Gurukul" style="height: 32px; display: block; margin: 0 auto; filter: brightness(1.5);">
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
 * Recursively fetches all managers in the reporting line.
 */
export const getAuthorityEmails = (employee: any, allEmployees: any[]) => {
    const authorities: Set<string> = new Set();
    let current = employee;

    // 1. Recursive Hierarchy Traversal
    while (current && current.reportsTo) {
        const managerId = Array.isArray(current.reportsTo) ? current.reportsTo[0] : current.reportsTo;
        const manager = allEmployees.find(e => e.id === managerId);
        if (manager && manager.email) {
            authorities.add(manager.email.toLowerCase());
            current = manager;
        } else {
            break;
        }
    }

    // 2. Founders (Restore oversight)
    const founders = allEmployees.filter(e => e.role === "FOUNDER" && e.email).map(e => e.email!.toLowerCase());
    founders.forEach(email => authorities.add(email));

    // 3. HR (Restore oversight)
    const hrEmails = allEmployees.filter(e => e.role === "HR" && e.email).map(e => e.email!.toLowerCase());
    hrEmails.forEach(email => authorities.add(email));

    if (employee && employee.email) {
        authorities.add(employee.email.toLowerCase());
    }
    return Array.from(authorities);
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
                    <strong style="color: #065f46; font-size: 11px; text-transform: uppercase; display: block; margin-bottom: 4px;">Resolution Summary</strong>
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

export const getLeaveTemplate = (leave: any, status: 'Pending' | 'Approved' | 'Rejected') => {
    const statusColor = status === 'Approved' ? '#10b981' : status === 'Rejected' ? '#ef4444' : '#f59e0b';
    const title = `Leave Request ${status}`;

    const cleanReason = (leave.reason && leave.reason !== "undefined") ? leave.reason : "Professional reason not detailed";

    const content = DataTable([
        { label: "Employee Name", value: leave.employeeName },
        { label: "Leave Type", value: `${leave.type} (${leave.leaveType})` },
        { label: "Duration", value: `${formatDate(leave.startDate)} to ${formatDate(leave.endDate)} (${leave.days} days)` },
        { label: "Reason", value: cleanReason },
        { label: "Current Status", value: status.toUpperCase(), color: statusColor }
    ]);

    return {
        subject: `[LEAVE ${status.toUpperCase()}] ${leave.employeeName} - ${formatDate(leave.startDate)}`,
        html: ProfessionalWrapper(title, content + (leave.lossOfPayDays ?
            `<p style="color: #ef4444; font-weight: bold; margin-top: 10px;">⚠️ Loss of Pay (LOP): ${leave.lossOfPayDays} days applied.</p>` : ''), statusColor)
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
    const content = DataTable([
        { label: "Claim ID", value: claim.id },
        { label: "Employee", value: claim.employeeName },
        { label: "Expense Type", value: claim.type },
        { label: "Exp. Period", value: claim.monthYear },
        { label: "Total Amount", value: `₹${claim.amount || 0}`, color: "#111827" },
        { label: "Description", value: claim.description },
        { label: "Status", value: claim.status.toUpperCase(), color: "#ef4444" }
    ]);

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
    const title = "Additional Responsibility Assigned";
    const content = DataTable([
        { label: "Assigned To", value: resp.employeeName },
        { label: "Description", value: resp.description },
        { label: "Effective Date", value: formatDate(resp.date) },
        { label: "Perf. Points", value: `+${resp.points} Points` }
    ]);
    return {
        subject: `[RESPONSIBILITY] New Mandate Assigned - ${resp.employeeName}`,
        html: ProfessionalWrapper(title, content + `
            <p style="margin-top: 20px; color: #10b981; font-weight: bold;">We appreciate your dedication towards taking on more impact within the organization.</p>
        `, "#10b981")
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
