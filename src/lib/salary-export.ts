/**
 * CLIENT: PDF / Excel downloads for My Salary & Payable Days and Employee Salary Management.
 * Uses the libraries already in the project (xlsx, jspdf, jspdf-autotable). Figures are exactly what the page shows.
 */

type Calc = any;
const dmy = (ymd?: string) => (ymd ? ymd.split("-").reverse().join("-") : "");
const n = (v: number) => (Number.isInteger(v) ? String(v) : (Math.round(v * 100) / 100).toString());
/** the standard PDF font has no arrows / rupee glyphs */
const pdfText = (v: any) => String(v ?? "").replace(/→/g, "->").replace(/−/g, "-").replace(/₹/g, "Rs. ").replace(/[^\x09\x0A\x0D\x20-\x7E -ÿ–—‘’“”•…]/g, "");
const fileSafe = (s: string) => s.replace(/[^A-Za-z0-9]+/g, "_").replace(/^_|_$/g, "");

function dayRows(calc: Calc) {
    return (calc?.days || []).map((d: any) => ({
        Date: dmy(d.date), Day: d.weekday, "Clock-In": d.clockIn || "", "Clock-Out": d.clockOut || "",
        Attendance: d.attendance === "—" ? "" : d.attendance, Leave: d.leave || "", Holiday: d.holiday ? "Holiday" : d.weeklyOff ? "Weekly Off" : "",
        "Payable Status": d.payableStatus, "Payable Value": d.payableStatus === "Not Employed" ? "" : d.payable,
        "Records Said": d.correction ? `${d.basePayableStatus} — ${d.baseReason}` : "",
        "HR Correction": d.correction ? `${d.correction.direction === "TO_NON_PAYABLE" ? "Marked non-payable" : "Marked payable"} by ${d.correction.correctedByName} (${d.correction.correctedByRole}) — ${d.correction.correctionCategory}: ${d.correction.correctionReason || ""}` : "",
        Reason: d.correction ? "" : d.reason, Penalties: (d.penalties || []).join("; "),
    }));
}
function summaryRows(calc: Calc) {
    return [
        ["Total Days", calc.totalDays], ["Working Days", calc.workingDays], ["Payable Days", calc.payableDays], ["Non-Payable Days", calc.nonPayableDays ?? calc.lopDays],
        ["Paid Leaves", calc.paidLeaves], ["Unpaid Leaves", calc.unpaidLeaves], ["Penalty Deduction (days)", calc.penaltyDays],
        ["Dress Code Deduction (days)", calc.dressCodeDeductionDays], ["Active Flags", calc.activeFlags],
        ["Days marked payable by HR", calc.correctedDays || 0], ["Days marked non-payable by HR", calc.hrDeductedDays || 0],
        ["Provisional", calc.provisional ? `Yes (as of ${dmy(calc.asOf)})` : "No"],
    ];
}
function penaltyRows(calc: Calc) {
    return (calc?.penalties || []).map((p: any) => ({
        Date: dmy(p.date), Type: p.typeLabel, Instance: p.instance ?? "", Level: p.levelLabel || "", Deduction: p.deduction,
        "Deducted Days": p.deductedDays || 0, Status: p.status,
        "Removed By": p.removal?.removedByName || "", "Removal Reason": p.removal?.removalReason || "",
    }));
}

export async function exportEmployeeMonth(kind: "pdf" | "xlsx", o: { employee: any; monthLabel: string; month: string; calc: Calc }) {
    const name = `Payable_Days_${fileSafe(o.employee?.name || o.employee?.id || "Employee")}_${o.month}`;
    if (kind === "xlsx") {
        const XLSX = await import("xlsx");
        const wb = XLSX.utils.book_new();
        const info = [["Employee", o.employee?.name], ["Employee ID", o.employee?.id], ["Designation", o.employee?.designation || ""], ["Department", o.employee?.dept || ""], ["College / Location", o.employee?.locationName || ""], ["Month", o.monthLabel], [], ...summaryRows(o.calc)];
        const s1 = XLSX.utils.aoa_to_sheet(info); s1["!cols"] = [{ wch: 30 }, { wch: 40 }];
        XLSX.utils.book_append_sheet(wb, s1, "Summary");
        const rows = dayRows(o.calc);
        const s2 = XLSX.utils.json_to_sheet(rows); s2["!cols"] = Object.keys(rows[0] || { a: 1 }).map(k => ({ wch: Math.min(60, Math.max(k.length, ...rows.map((r: any) => String(r[k] ?? "").length)) + 2) }));
        XLSX.utils.book_append_sheet(wb, s2, "Day-wise");
        const pr = penaltyRows(o.calc);
        if (pr.length) { const s3 = XLSX.utils.json_to_sheet(pr); XLSX.utils.book_append_sheet(wb, s3, "Penalties"); }
        XLSX.writeFile(wb, `${name}.xlsx`);
        return;
    }
    const { jsPDF } = await import("jspdf");
    const autoTable = (await import("jspdf-autotable")).default;
    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
    const W = doc.internal.pageSize.getWidth(), M = 28;
    doc.setFillColor(16, 185, 129); doc.roundedRect(M, M, W - 2 * M, 46, 6, 6, "F");
    doc.setTextColor(255, 255, 255); doc.setFont("helvetica", "bold"); doc.setFontSize(15);
    doc.text(pdfText(`Salary & Payable Days — ${o.monthLabel}`), M + 14, M + 20);
    doc.setFontSize(9); doc.setFont("helvetica", "normal");
    doc.text(pdfText(`${o.employee?.name || ""} (${o.employee?.id || ""})${o.employee?.designation ? ` · ${o.employee.designation}` : ""}${o.employee?.dept ? ` · ${o.employee.dept}` : ""}${o.employee?.locationName ? ` · ${o.employee.locationName}` : ""}`), M + 14, M + 36);
    const sum = summaryRows(o.calc);
    autoTable(doc, {
        startY: M + 56, margin: { left: M, right: M }, theme: "grid",
        head: [sum.slice(0, 6).map(r => pdfText(r[0]))], body: [sum.slice(0, 6).map(r => pdfText(r[1]))],
        styles: { fontSize: 8, halign: "center", cellPadding: 4 }, headStyles: { fillColor: [24, 24, 27], textColor: [255, 255, 255] },
        bodyStyles: { fontStyle: "bold", fontSize: 11 },
    });
    autoTable(doc, {
        startY: (doc as any).lastAutoTable.finalY + 4, margin: { left: M, right: M }, theme: "grid",
        head: [sum.slice(6).map(r => pdfText(r[0]))], body: [sum.slice(6).map(r => pdfText(r[1]))],
        styles: { fontSize: 8, halign: "center", cellPadding: 4 }, headStyles: { fillColor: [63, 63, 70], textColor: [255, 255, 255] },
    });
    const rows = dayRows(o.calc);
    const cols = ["Date", "Day", "Clock-In", "Clock-Out", "Attendance", "Leave", "Payable Status", "Payable Value", "Reason / HR Correction", "Penalties"];
    autoTable(doc, {
        startY: (doc as any).lastAutoTable.finalY + 12, margin: { left: M, right: M }, theme: "grid",
        head: [cols],
        body: rows.map((r: any) => [r.Date, r.Day, r["Clock-In"], r["Clock-Out"], r.Attendance || r.Holiday, r.Leave, r["Payable Status"], r["Payable Value"], pdfText(r["HR Correction"] ? `${r["HR Correction"]} | Records: ${r["Records Said"]}` : r.Reason), pdfText(r.Penalties)]),
        styles: { fontSize: 7, cellPadding: 3, valign: "middle", overflow: "linebreak" },
        headStyles: { fillColor: [26, 56, 82], textColor: [224, 242, 254], fontSize: 7.5 },
        columnStyles: { 0: { cellWidth: 52 }, 1: { cellWidth: 28 }, 2: { cellWidth: 40 }, 3: { cellWidth: 44 }, 6: { cellWidth: 62, fontStyle: "bold" }, 7: { cellWidth: 36, halign: "center" }, 8: { cellWidth: 250 } },
        didParseCell: (h: any) => {
            if (h.section !== "body") return;
            const st = rows[h.row.index]?.["Payable Status"];
            const corr = !!rows[h.row.index]?.["HR Correction"];
            const fill: Record<string, [number, number, number]> = { "Payable": [220, 252, 231], "Non-Payable": [254, 226, 226], "Partly Payable": [254, 243, 199], "Upcoming": [244, 244, 245], "Not Employed": [244, 244, 245] };
            if (h.column.index === 6 && fill[st]) h.cell.styles.fillColor = fill[st];
            if (corr && h.column.index === 8) h.cell.styles.fillColor = [237, 233, 254];
        },
    });
    const pr = penaltyRows(o.calc);
    if (pr.length) {
        autoTable(doc, {
            startY: (doc as any).lastAutoTable.finalY + 12, margin: { left: M, right: M }, theme: "grid",
            head: [["Date", "Penalty Type", "#", "Level", "Deduction", "Deducted Days", "Status", "Removed By / Reason"]],
            body: pr.map((p: any) => [p.Date, p.Type, p.Instance, p.Level, pdfText(p.Deduction), p["Deducted Days"], p.Status, pdfText(p["Removed By"] ? `${p["Removed By"]}: ${p["Removal Reason"]}` : "")]),
            styles: { fontSize: 7.5, cellPadding: 3 }, headStyles: { fillColor: [127, 29, 29], textColor: [255, 255, 255] },
        });
    }
    stampPages(doc, W, M);
    doc.save(`${name}.pdf`);
}

export async function exportEmployeeList(kind: "pdf" | "xlsx", o: { rows: any[]; monthLabel: string; month: string; summary: any }) {
    const name = `Employee_Salary_${o.month}`;
    const data = o.rows.map(r => ({
        "Employee ID": r.id, Name: r.name, Department: r.dept, Designation: r.designation, College: r.locationName,
        "Payable Days": r.payableDays, "Non-Payable Days": r.nonPayableDays, "Penalty Days": r.penaltyDays,
        "HR +Payable": r.correctedDays || 0, "HR -Payable": r.hrDeductedDays || 0, "Active Flags": r.activeFlags,
        "Pending Tickets": r.tickets?.pending || 0, "Resolved Tickets": r.tickets?.resolved || 0,
    }));
    if (kind === "xlsx") {
        const XLSX = await import("xlsx");
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(data);
        ws["!cols"] = Object.keys(data[0] || { a: 1 }).map(k => ({ wch: Math.min(40, Math.max(k.length, ...data.map((r: any) => String(r[k] ?? "").length)) + 2) }));
        XLSX.utils.book_append_sheet(wb, ws, "Employees");
        const s = o.summary || {};
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["Month", o.monthLabel], ["Total Employees", s.totalEmployees], ["Total Payable Days", s.totalPayableDays], ["Total Non-Payable Days", s.totalNonPayableDays], ["Pending Tickets", s.pendingTickets], ["Resolved Tickets", s.resolvedTickets], ["Penalty Deduction (days)", s.totalPenaltyDays], ["HR Corrections", s.corrections]]), "Summary");
        XLSX.writeFile(wb, `${name}.xlsx`);
        return;
    }
    const { jsPDF } = await import("jspdf");
    const autoTable = (await import("jspdf-autotable")).default;
    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
    const W = doc.internal.pageSize.getWidth(), M = 28;
    doc.setFillColor(99, 102, 241); doc.roundedRect(M, M, W - 2 * M, 40, 6, 6, "F");
    doc.setTextColor(255, 255, 255); doc.setFont("helvetica", "bold"); doc.setFontSize(15);
    doc.text(pdfText(`Employee Salary Management — ${o.monthLabel}`), M + 14, M + 25);
    const s = o.summary || {};
    autoTable(doc, {
        startY: M + 50, margin: { left: M, right: M }, theme: "grid",
        head: [["Employees", "Payable Days", "Non-Payable Days", "Pending Tickets", "Resolved Tickets", "Penalty Days", "HR Corrections"]],
        body: [[s.totalEmployees, s.totalPayableDays, s.totalNonPayableDays, s.pendingTickets, s.resolvedTickets, s.totalPenaltyDays, s.corrections].map(v => v ?? "")],
        styles: { fontSize: 9, halign: "center" }, headStyles: { fillColor: [24, 24, 27], textColor: [255, 255, 255] }, bodyStyles: { fontStyle: "bold", fontSize: 11 },
    });
    const cols = ["Employee ID", "Name", "Department", "College", "Payable Days", "Non-Payable Days", "Penalty Days", "HR +Payable", "HR -Payable", "Pending Tickets"];
    autoTable(doc, {
        startY: (doc as any).lastAutoTable.finalY + 12, margin: { left: M, right: M }, theme: "grid",
        head: [cols], body: data.map((r: any) => cols.map(c => pdfText(r[c]))),
        styles: { fontSize: 7.5, cellPadding: 3 }, headStyles: { fillColor: [26, 56, 82], textColor: [224, 242, 254] },
        didParseCell: (h: any) => {
            if (h.section !== "body") return;
            if (h.column.index === 4) h.cell.styles.fillColor = [220, 252, 231];
            if (h.column.index === 5 && Number(data[h.row.index]["Non-Payable Days"]) > 0) h.cell.styles.fillColor = [254, 226, 226];
            if (h.column.index === 9 && Number(data[h.row.index]["Pending Tickets"]) > 0) h.cell.styles.fillColor = [254, 243, 199];
        },
    });
    stampPages(doc, W, M);
    doc.save(`${name}.pdf`);
}

function stampPages(doc: any, W: number, M: number) {
    const pages = doc.getNumberOfPages();
    for (let i = 1; i <= pages; i++) {
        doc.setPage(i); doc.setFontSize(7); doc.setTextColor(150, 150, 150);
        doc.text(`GOG OMS · Generated ${new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} · Page ${i} of ${pages}`, W - M, doc.internal.pageSize.getHeight() - 12, { align: "right" });
    }
}