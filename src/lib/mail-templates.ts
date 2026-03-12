/**
 * Recursively fetches all managers in the reporting line.
 * Also includes HR and Founders as per requirements.
 */
export const getAuthorityEmails = (employee: any, allEmployees: any[]) => {
    const authorities: Set<string> = new Set();

    // 1. Recursive Hierarchy Traversal
    let current = employee;
    while (current && current.reportsTo) {
        const manager = allEmployees.find(e => e.id === current.reportsTo);
        if (manager && manager.email) {
            authorities.add(manager.email.toLowerCase());
            current = manager;
        } else {
            break;
        }
    }

    // 2. Founders
    const founders = allEmployees.filter(e => e.role === "FOUNDER").map(e => e.email.toLowerCase());
    founders.forEach(email => authorities.add(email));

    // 3. HR
    const hrEmails = allEmployees.filter(e => e.role === "HR").map(e => e.email.toLowerCase());
    hrEmails.forEach(email => authorities.add(email));

    // Ensure the employee's own email (initiator) is included in CC
    if (employee && employee.email) {
        authorities.add(employee.email.toLowerCase());
    }

    return Array.from(authorities);
};

// --- EMAIL TEMPLATES ---

export const getTicketTemplate = (ticket: any, type: 'raised' | 'resolved') => {
    if (type === 'raised') {
        return {
            subject: `[TICKET RAISED] ${ticket.subject} - ${ticket.id}`,
            html: `
                <div style="font-family: sans-serif; padding: 20px; color: #333;">
                    <h2 style="color: #10b981;">New Ticket Raised</h2>
                    <p><strong>Ticket ID:</strong> ${ticket.id}</p>
                    <p><strong>Raised By:</strong> ${ticket.employeeName}</p>
                    <p><strong>Category:</strong> ${ticket.targetCategory}</p>
                    <p><strong>Subject:</strong> ${ticket.subject}</p>
                    <div style="background: #f4f4f4; padding: 15px; border-radius: 8px; margin: 10px 0;">
                        <strong>Description:</strong><br/>
                        ${ticket.content}
                    </div>
                    <p>This is an automated mail from GOG OMS.</p>
                </div>
            `
        };
    } else {
        return {
            subject: `[TICKET RESOLVED] ${ticket.subject} - ${ticket.id}`,
            html: `
                <div style="font-family: sans-serif; padding: 20px; color: #333;">
                    <h2 style="color: #10b981;">Ticket Resolved</h2>
                    <p><strong>Ticket ID:</strong> ${ticket.id}</p>
                    <p><strong>Subject:</strong> ${ticket.subject}</p>
                    <div style="background: #e6fffa; padding: 15px; border-radius: 8px; margin: 10px 0;">
                        <strong>Resolution Notes:</strong><br/>
                        ${ticket.resolutionNotes || 'No notes provided.'}
                    </div>
                    <p>Status: <strong>RESOLVED</strong></p>
                    <p>Please check your dashboard for further details.</p>
                </div>
            `
        };
    }
};

export const getLeaveTemplate = (leave: any, status: 'Pending' | 'Approved' | 'Rejected') => {
    const statusColor = status === 'Approved' ? '#10b981' : status === 'Rejected' ? '#ef4444' : '#f59e0b';
    return {
        subject: `[LEAVE ${status.toUpperCase()}] ${leave.employeeName} - ${leave.startDate}`,
        html: `
            <div style="font-family: sans-serif; padding: 20px; color: #333;">
                <h2 style="color: ${statusColor};">Leave Request ${status}</h2>
                <p><strong>Employee:</strong> ${leave.employeeName}</p>
                <p><strong>Type:</strong> ${leave.type} (${leave.leaveType})</p>
                <p><strong>Duration:</strong> ${leave.startDate} to ${leave.endDate} (${leave.days} days)</p>
                <p><strong>Reason:</strong> ${leave.reason}</p>
                <p><strong>Current Status:</strong> <span style="color: ${statusColor}; font-weight: bold;">${status}</span></p>
                ${leave.lossOfPayDays ? `<p style="color: #ef4444;"><strong>Loss of Pay applied:</strong> ${leave.lossOfPayDays} days</p>` : ''}
            </div>
        `
    };
};

export const getMisbehaviourTemplate = (report: any) => {
    return {
        subject: `[DISCIPLINARY NOTICE] ${report.type} Issue - ${report.employeeName}`,
        html: `
            <div style="font-family: sans-serif; padding: 20px; color: #333; border: 1px solid #ef4444; border-radius: 8px;">
                <h2 style="color: #ef4444;">Formal Disciplinary Notice</h2>
                <p>Dear ${report.employeeName},</p>
                <p>A <strong>${report.type} Issue</strong> has been reported regarding your conduct.</p>
                <div style="background: #fff5f5; padding: 15px; border-left: 4px solid #ef4444;">
                    <strong>Description:</strong><br/>
                    ${report.description}
                </div>
                <p><strong>Date:</strong> ${report.date}</p>
                <p>This entry has been recorded in your performance file. Please adhere to the organizational guidelines.</p>
            </div>
        `
    };
};

export const getPIPAddTemplate = (pip: any) => {
    return {
        subject: `[URGENT] Performance Improvement Plan (PIP) Enrollment - ${pip.employeeName}`,
        html: `
            <div style="font-family: sans-serif; padding: 20px; color: #333; background: #fffbeb; border: 1px solid #f59e0b;">
                <h2 style="color: #d97706;">Performance Improvement Plan Notice</h2>
                <p>Dear ${pip.employeeName},</p>
                <p>This is to inform you that you have been placed under a <strong>Performance Improvement Plan (PIP)</strong>.</p>
                <p><strong>Reason:</strong> ${pip.reason}</p>
                <p><strong>Start Date:</strong> ${pip.startDate}</p>
                <div style="background: #fff; padding: 10px; border: 1px solid #f59e0b; margin-top: 15px;">
                    <strong>Disclaimer:</strong><br/>
                    ${pip.disclaimer}
                </div>
                <p style="margin-top: 20px;">We expect immediate improvement in your performance metrics.</p>
            </div>
        `
    };
};

export const getReimbursementTemplate = (claim: any) => {
    return {
        subject: `[REIMBURSEMENT UPDATE] Status Changed to ${claim.status}`,
        html: `
            <div style="font-family: sans-serif; padding: 20px; color: #333;">
                <h2 style="color: #10b981;">Reimbursement Claim Update</h2>
                <p><strong>Claim ID:</strong> ${claim.id}</p>
                <p><strong>Description:</strong> ${claim.description}</p>
                <p><strong>Amount:</strong> ₹${claim.amount}</p>
                <p><strong>New Status:</strong> <strong>${claim.status}</strong></p>
                ${claim.rejectionReason ? `<p style="color: #ef4444;"><strong>Rejection Reason:</strong> ${claim.rejectionReason}</p>` : ''}
                ${claim.hrRemarks ? `<p><strong>HR Remarks:</strong> ${claim.hrRemarks}</p>` : ''}
            </div>
        `
    };
};

export const getMoMTemplate = (meeting: any, mom: any) => {
    return {
        subject: `[MoM] Minutes of Meeting - ${meeting.purpose}`,
        html: `
            <div style="font-family: sans-serif; padding: 20px; color: #333;">
                <h2 style="color: #10b981;">Minutes of Meeting (MoM)</h2>
                <p><strong>Meeting:</strong> ${meeting.purpose}</p>
                <p><strong>Date:</strong> ${meeting.date}</p>
                <div style="background: #f4f4f4; padding: 15px; border-radius: 8px;">
                    <strong>Discussion Summary:</strong><br/>
                    ${mom.content}
                </div>
                <div style="background: #e6fffa; padding: 15px; border-radius: 8px; margin-top: 10px;">
                    <strong>Final Decision:</strong><br/>
                    ${mom.decision}
                </div>
                <p style="margin-top: 15px;">This MoM has been shared with all relevant authorities.</p>
            </div>
        `
    };
};

export const getAdditionalResponsibilityTemplate = (resp: any) => {
    return {
        subject: `[NEW RESPONSIBILITY] Additional Responsibilities Assigned - ${resp.employeeName}`,
        html: `
            <div style="font-family: sans-serif; padding: 20px; color: #333;">
                <h2 style="color: #10b981;">Additional Responsibility Assigned</h2>
                <p>Dear ${resp.employeeName},</p>
                <p>You have been assigned the following additional responsibilities:</p>
                <div style="background: #f4f4f4; padding: 15px; border-radius: 8px;">
                    ${resp.description}
                </div>
                <p><strong>Effective Date:</strong> ${resp.date}</p>
                <p><strong>Performance Points:</strong> ${resp.points}</p>
                <p>Thank you for your contribution to the organization.</p>
            </div>
        `
    };
};

export const getMarkAsPresentTemplate = (req: any, status: 'Pending' | 'Approved' | 'Rejected') => {
    const statusColor = status === 'Approved' ? '#10b981' : status === 'Rejected' ? '#ef4444' : '#f59e0b';
    return {
        subject: `[ATTENDANCE APPEAL] ${status.toUpperCase()} - ${req.employeeName} (${req.date})`,
        html: `
            <div style="font-family: sans-serif; padding: 20px; color: #333; border: 1px solid ${statusColor}; border-radius: 8px;">
                <h2 style="color: ${statusColor};">Attendance Appeal ${status}</h2>
                <p><strong>Employee:</strong> ${req.employeeName} (${req.employeeId})</p>
                <p><strong>Date:</strong> ${req.date}</p>
                <div style="background: #f8fafc; padding: 15px; border-radius: 6px; margin: 10px 0;">
                    <strong>Reason:</strong> ${req.reason}
                </div>
                ${req.proofUrls?.length ? `<p><strong>Proofs attached:</strong> ${req.proofUrls.length} files</p>` : ''}
                <p><strong>Final Decision:</strong> <span style="color: ${statusColor}; font-weight: bold;">${status}</span></p>
                ${status === 'Approved' ? '<p style="color: #10b981;">Note: Attendance has been marked as Present with a Late Clock-in flag.</p>' : ''}
                <p style="font-size: 11px; color: #666; margin-top: 20px;">This is an automated response from GOG Attendance Systems.</p>
            </div>
        `
    };
};

export const getOverrideTemplate = (req: any, status: 'Pending' | 'Approved' | 'Rejected') => {
    const statusColor = status === 'Approved' ? '#10b981' : status === 'Rejected' ? '#ef4444' : '#f59e0b';
    return {
        subject: `[ATTENDANCE OVERRIDE] ${status.toUpperCase()} - Requested by ${req.requestedByName} for ${req.employeeName}`,
        html: `
            <div style="font-family: sans-serif; padding: 20px; color: #333; border: 1px solid #6366f1; border-radius: 8px;">
                <h2 style="color: #6366f1;">Attendance Override ${status}</h2>
                <p><strong>Target Employee:</strong> ${req.employeeName} (${req.employeeId})</p>
                <p><strong>Requested By:</strong> ${req.requestedByName}</p>
                <p><strong>Reason for Override:</strong> ${req.reason}</p>
                <div style="background: #f5f3ff; padding: 15px; border-radius: 6px; margin: 10px 0;">
                    <strong>Official Communication Log:</strong> This request has been logged in the Founder's communication log for compliance.
                </div>
                <p><strong>Status:</strong> <span style="color: ${statusColor}; font-weight: bold;">${status}</span></p>
                <p style="font-size: 11px; color: #666; margin-top: 20px;">GoG OMS Override Management</p>
            </div>
        `
    };
};

export const getWorkScheduleTemplate = (schedule: any, isAdmin: boolean) => {
    return {
        subject: `[WORK SCHEDULE] Location & Timing Assignment Update`,
        html: `
            <div style="font-family: sans-serif; padding: 20px; color: #333;">
                <h2 style="color: #10b981;">Work Schedule Assignment</h2>
                <p>Dear ${schedule.employeeName},</p>
                <p>Your work location and timing schedule has been updated.</p>
                <p><strong>Effective immediately.</strong></p>
                <div style="background: #f4f4f4; padding: 15px; border-radius: 8px;">
                    <strong>Schedule Details:</strong><br/>
                    Please view the 'Work Schedule' section on your dashboard for day-wise details and clock-in/out timings.
                </div>
                <p><strong>Assigned By:</strong> ${schedule.assignedByName}</p>
                <p>Status: ${schedule.approvedByHR ? 'Approved' : 'Pending HR Approval'}</p>
            </div>
        `
    };
};

export const getHolidayTemplate = (holiday: any, status: 'Proposed' | 'Approved') => {
    return {
        subject: `[HOLIDAY ${status.toUpperCase()}] ${holiday.name} - ${holiday.date}`,
        html: `
            <div style="font-family: sans-serif; padding: 20px; color: #333;">
                <h2 style="color: #10b981;">New Holiday ${status}</h2>
                <p><strong>Holiday:</strong> ${holiday.name}</p>
                <p><strong>Date:</strong> ${holiday.date}</p>
                <p><strong>Category:</strong> ${holiday.category}</p>
                <p><strong>Status:</strong> ${status}</p>
                ${holiday.customMessage ? `<div style="background: #e6fffa; padding: 10px; border-radius: 5px;">${holiday.customMessage}</div>` : ''}
            </div>
        `
    };
};

export const getDressCodeWarningTemplate = (employee: any, defaults: number) => {
    return {
        subject: `[WARNING] Dress Code Policy Violation - ${employee.name}`,
        html: `
            <div style="font-family: sans-serif; padding: 20px; color: #333; background: #fff5f5; border: 1px solid #ef4444;">
                <h2 style="color: #ef4444;">Dress Code Violation Warning</h2>
                <p>Dear ${employee.name},</p>
                <p>This is a formal warning regarding your adherence to the organizational dress code policy.</p>
                <p>You have now reached <strong>${defaults}</strong> dress code defaults.</p>
                <p style="color: #ef4444; font-weight: bold;">Note: After 3 defaults, you will be restricted from marking attendance as a defaulter.</p>
                <p>Please ensure strict compliance with the formal dress code (White shirt, Black pants, Black blazer, Formal shoes) moving forward.</p>
            </div>
        `
    };
};

export const getRatingTemplate = (rating: any) => {
    return {
        subject: `[PERFORMANCE RATING] Bi-weekly Score: ${rating.score}/5 - ${rating.period}`,
        html: `
            <div style="font-family: sans-serif; padding: 20px; color: #333;">
                <h2 style="color: #10b981;">New Performance Rating Issued</h2>
                <p>Dear ${rating.employeeName},</p>
                <p>You have received a new performance rating for the period: <strong>${rating.period}</strong>.</p>
                <div style="background: #fdf2f2; padding: 15px; border-radius: 8px; margin: 20px 0; border: 1px solid #fee2e2;">
                    <p style="font-size: 18px; margin: 0;">Rating: <strong style="color: #b91c1c;">${rating.score} / 5</strong></p>
                    <div style="margin-top: 10px;">
                        ${Array.from({ length: 5 }).map((_, i) => `<span style="color: ${i < rating.score ? '#f59e0b' : '#d1d5db'}; font-size: 24px;">★</span>`).join('')}
                    </div>
                </div>
                ${rating.comment ? `
                <div style="background: #f4f4f4; padding: 15px; border-radius: 8px;">
                    <strong>Feedback/Remarks:</strong><br/>
                    ${rating.comment}
                </div>` : ''}
                <p style="margin-top: 20px;">Rated By: ${rating.ratedByName}</p>
                <p style="font-size: 11px; color: #666;">This rating influences your position on the global GoG Leaderboard.</p>
            </div>
        `
    };
};

export const getAnnouncementTemplate = (ann: any) => {
    const catColor = ann.category === "Urgent" ? "#ef4444" : "#10b981";
    return {
        subject: `[ANNOUNCEMENT] ${ann.title}`,
        html: `
            <div style="font-family: sans-serif; padding: 20px; color: #333; border-top: 4px solid ${catColor};">
                <h2 style="color: ${catColor};">${ann.title}</h2>
                <p style="color: #666; font-size: 12px;">Category: ${ann.category} | Date: ${ann.createdAt || new Date().toISOString().split('T')[0]}</p>
                <div style="background: #fff; padding: 15px; border: 1px solid #eee; border-radius: 8px; margin: 15px 0; line-height: 1.6;">
                    ${ann.content.replace(/\n/g, '<br/>')}
                </div>
                ${ann.imageUrls && ann.imageUrls.length > 0 ? `
                <div style="margin-top: 20px;">
                    ${ann.imageUrls.map((url: string) => `<img src="${url}" style="max-width: 100%; border-radius: 8px; margin-bottom: 10px; border: 1px solid #eee;" />`).join('')}
                </div>` : ''}
                <p style="margin-top: 20px; font-size: 12px; color: #999;">Published By: ${ann.createdBy}</p>
            </div>
        `
    };
};

export const getSOPUpdateTemplate = (sop: any, type: 'new' | 'updated' | 'deleted' | 'unknown') => {
    const typeLabel = type.toUpperCase();
    const typeColor = type === 'new' ? '#10b981' : type === 'updated' ? '#f59e0b' : '#ef4444';

    return {
        subject: `[SOP ${typeLabel}] Documentation Change - ${sop.title}`,
        html: `
            <div style="font-family: sans-serif; padding: 20px; color: #333;">
                <h2 style="color: ${typeColor};">SOP Documentation ${typeLabel}</h2>
                <p>An SOP document has been <strong>${type}</strong> by <strong>${sop.changedBy || sop.changedByRole || 'Admin'}</strong>.</p>
                <div style="background: #f8fafc; padding: 15px; border-left: 4px solid ${typeColor}; border-radius: 4px; margin: 15px 0;">
                    <p style="margin: 0;"><strong>Title:</strong> ${sop.title}</p>
                    <p style="margin: 5px 0 0 0;"><strong>Version:</strong> v${sop.version}</p>
                </div>
                ${sop.changelog ? `
                <div style="background: #f4f4f4; padding: 15px; border-radius: 8px; margin: 15px 0;">
                    <strong>What's Changed:</strong><br/>
                    ${sop.changelog}
                </div>` : ''}
                <p>Please review the updated SOPs in the Documentation section of your dashboard.</p>
                <p style="font-size: 11px; color: #666; margin-top: 20px;">GoG OMS Documentation Control System</p>
            </div>
        `
    };
};

export const getBirthdayTemplate = (employee: any) => {
    return {
        subject: `🎂 Happy Birthday ${employee.name}! - Geeks of Gurukul`,
        html: `
            <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px; border: 1px solid #e5e7eb; border-radius: 16px; background-color: #ffffff; text-align: center;">
                <div style="margin-bottom: 24px;">
                    <img src="https://i.ibb.co/dJVbhnf7/logo-2.png" alt="GoG Logo" style="height: 40px; margin: 0 auto;">
                </div>
                <h1 style="color: #10b981; font-size: 28px; font-weight: 800; margin-bottom: 16px;">Happy Birthday, ${employee.name}! 🥳</h1>
                <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin-bottom: 24px;">
                    On behalf of everyone at <strong>Geeks of Gurukul</strong>, we wish you a fantastic day filled with joy, laughter, and your favorite things. We are grateful for your hard work and contribution to our team.
                </p>
                <div style="font-size: 80px; margin: 32px 0;">🎂</div>
                <p style="color: #9ca3af; font-size: 14px; margin-top: 40px; border-top: 1px solid #f3f4f6; pt: 20px;">
                    Wishing you a great year ahead!<br/>
                    <strong>The GoG Management Team</strong>
                </p>
            </div>
        `
    };
};
