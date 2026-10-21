"use client";
/**
 * Browser-side PDF (jsPDF + autotable) and Excel (.xlsx via ExcelJS) generation for the Workforce and Onboarding
 * exports. The data always comes from the server report APIs, which check permissions and mask sensitive values.
 * Libraries are loaded on demand so they do not slow down the pages.
 */
export type Col = { key: string; label: string; width?: number };
export type TableReport = { title: string; scope: string; generatedBy: string; generatedAt: string; cols: Col[]; rows: Record<string, any>[] };
export type KV = [string, string];
export type EmployeeReport = {
    employee: { id: string; name: string };
    info: KV[]; form: KV[]; banking: KV[];
    checklist: { item: string; status: string; mandatory: string; by: string; at: string; remarks: string }[];
    documents: { name: string; type: string; upload: string; verification: string; uploadedOn: string }[];
    history: KV[]; activity: { at: string; by: string; action: string; note: string }[];
};

const GREEN: [number, number, number] = [16, 150, 105];
const DARK: [number, number, number] = [24, 24, 27];
const MUTED: [number, number, number] = [113, 113, 122];
const todayYmd = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
const stamp = (iso: string) => new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
/** Empty → "—"; characters the built-in PDF font cannot draw are replaced */
const dash = (v: any) => (v === undefined || v === null || String(v).trim() === "" ? "—" : String(v).replace(/→/g, "->").replace(/[✓✔]/g, "Yes"));

export const fileNames = {
    workforce: (ext: "pdf" | "xlsx") => `GOG_Workforce_Report_${todayYmd()}.${ext}`,
    onboardingList: (ext: "pdf" | "xlsx") => `GOG_Onboarding_List_${todayYmd()}.${ext}`,
    onboarding: (id: string, ext: "pdf" | "xlsx") => `GOG_Onboarding_${id}.${ext}`,
};

function saveBlob(blob: Blob, name: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** Fetch report JSON from the server; throws the server's message on failure */
export async function fetchReport(url: string, init?: RequestInit) {
    const res = await fetch(url, { cache: "no-store", ...init, headers: { "Content-Type": "application/json", ...(init?.headers || {}) } });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Could not prepare the report.");
    return data;
}

// ───────────────────────────── PDF ─────────────────────────────
async function newPdf(landscape: boolean, format: "a4" | "a3" = "a4") {
    const { jsPDF } = await import("jspdf");
    const autoTable = (await import("jspdf-autotable")).default;
    const doc = new jsPDF({ orientation: landscape ? "landscape" : "portrait", unit: "pt", format });
    return { doc, autoTable };
}
function pdfHeader(doc: any, title: string, lines: string[]) {
    const w = doc.internal.pageSize.getWidth();
    doc.setFillColor(...GREEN); doc.rect(0, 0, w, 6, "F");
    doc.setFont("helvetica", "bold"); doc.setFontSize(15); doc.setTextColor(...DARK); doc.text("GOG OMS", 36, 34);
    doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor(...MUTED); doc.text("Organisation Management System", 36, 46);
    doc.setFont("helvetica", "bold"); doc.setFontSize(13); doc.setTextColor(...GREEN); doc.text(title, w - 36, 34, { align: "right" });
    doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor(...MUTED);
    lines.forEach((l, i) => doc.text(l, w - 36, 47 + i * 11, { align: "right" }));
    doc.setDrawColor(228, 228, 231); doc.line(36, 60 + Math.max(0, lines.length - 1) * 11, w - 36, 60 + Math.max(0, lines.length - 1) * 11);
    return 72 + Math.max(0, lines.length - 1) * 11;
}
function pdfFooters(doc: any, label: string) {
    const n = doc.getNumberOfPages();
    const w = doc.internal.pageSize.getWidth(), h = doc.internal.pageSize.getHeight();
    for (let i = 1; i <= n; i++) {
        doc.setPage(i);
        doc.setFontSize(8); doc.setTextColor(...MUTED);
        doc.text(label, 36, h - 18);
        doc.text(`Page ${i} of ${n}`, w - 36, h - 18, { align: "right" });
    }
}
const tableStyle = {
    theme: "grid" as const,
    styles: { font: "helvetica", fontSize: 7.5, cellPadding: 3.5, textColor: DARK, lineColor: [228, 228, 231] as [number, number, number], lineWidth: 0.5, overflow: "linebreak" as const, valign: "top" as const },
    headStyles: { fillColor: GREEN, textColor: [255, 255, 255] as [number, number, number], fontStyle: "bold" as const, fontSize: 7.5 },
    alternateRowStyles: { fillColor: [244, 250, 247] as [number, number, number] },
    showHead: "everyPage" as const,
    margin: { left: 36, right: 36, top: 40, bottom: 34 },
};

export async function tablePdf(r: TableReport, fileName: string) {
    const landscape = r.cols.length > 7;
    const wide = r.cols.length > 12; // many columns: A3 landscape so nothing is squeezed
    const { doc, autoTable } = await newPdf(landscape, wide ? "a3" : "a4");
    const fontSize = wide ? 7 : 7.5;
    const y = pdfHeader(doc, r.title, [r.scope, `Generated ${stamp(r.generatedAt)} by ${r.generatedBy}`]);
    // Column widths: never narrower than the longest single word (IDs and dates never break),
    // the remaining space shared in proportion to the column's usual width; long text wraps on spaces.
    const usable = doc.internal.pageSize.getWidth() - 72;
    doc.setFont("helvetica", "normal"); doc.setFontSize(fontSize);
    const pad = 8;
    const minW = r.cols.map(c => {
        const words = [c.label, ...r.rows.map(row => String(row[c.key] ?? ""))].flatMap(v => v.split(/\s+/));
        doc.setFont("helvetica", "bold");
        const head = Math.max(...c.label.split(/\s+/).map(w => doc.getTextWidth(w)));
        doc.setFont("helvetica", "normal");
        return Math.max(head, ...words.map(w => doc.getTextWidth(w))) + pad;
    });
    const base = minW.reduce((a, b) => a + b, 0);
    const extra = Math.max(0, usable - base);
    const totalW = r.cols.reduce((a, c) => a + (c.width || 14), 0);
    const columnStyles: Record<number, any> = {};
    r.cols.forEach((c, i) => { columnStyles[i] = { cellWidth: base >= usable ? (minW[i] / base) * usable : minW[i] + extra * ((c.width || 14) / totalW) }; });
    autoTable(doc, {
        ...tableStyle, startY: y, styles: { ...tableStyle.styles, fontSize },
        headStyles: { ...tableStyle.headStyles, fontSize },
        head: [r.cols.map(c => c.label)], body: r.rows.map(row => r.cols.map(c => dash(row[c.key]))), columnStyles,
    });
    if (!r.rows.length) { doc.setFontSize(10); doc.setTextColor(...MUTED); doc.text("No records match the selected filters.", 36, y + 40); }
    pdfFooters(doc, `${r.title} · GOG OMS · Confidential`);
    doc.save(fileName);
}

export async function employeePdf(r: EmployeeReport, meta: { generatedBy: string; generatedAt: string }, fileName: string) {
    const { doc, autoTable } = await newPdf(false);
    let y = pdfHeader(doc, "Employee Onboarding Report", [`${r.employee.name} · ${r.employee.id}`, `Generated ${stamp(meta.generatedAt)} by ${meta.generatedBy}`]);
    const section = (n: number, title: string) => {
        if (y > doc.internal.pageSize.getHeight() - 90) { doc.addPage(); y = 44; }
        doc.setFont("helvetica", "bold"); doc.setFontSize(10.5); doc.setTextColor(...GREEN);
        doc.text(`${n}. ${title}`, 36, y + 6); y += 12;
    };
    const kv = (rows: KV[]) => {
        autoTable(doc, {
            ...tableStyle, startY: y, showHead: "never", body: rows.map(([k, v]) => [k, dash(v)]),
            columnStyles: { 0: { cellWidth: 170, fontStyle: "bold", textColor: [63, 63, 70], fillColor: [244, 250, 247] }, 1: { cellWidth: "auto" } },
            styles: { ...tableStyle.styles, fontSize: 8.5 }, alternateRowStyles: {},
        });
        y = (doc as any).lastAutoTable.finalY + 16;
    };
    const table = (head: string[], body: string[][], empty: string) => {
        if (!body.length) { doc.setFont("helvetica", "italic"); doc.setFontSize(8.5); doc.setTextColor(...MUTED); doc.text(empty, 36, y + 8); y += 22; return; }
        autoTable(doc, { ...tableStyle, startY: y, head: [head], body: body.map(r => r.map(dash)), styles: { ...tableStyle.styles, fontSize: 8 } });
        y = (doc as any).lastAutoTable.finalY + 16;
    };
    section(1, "Employee Information"); kv(r.info);
    section(2, "Submitted Onboarding Form"); kv(r.form);
    section(3, "Banking Details"); kv(r.banking);
    doc.setFont("helvetica", "italic"); doc.setFontSize(7.5); doc.setTextColor(...MUTED);
    doc.text("Account, PAN and Aadhaar numbers are masked. Full values are available to HR in the portal.", 36, y - 6); y += 6;
    section(4, "HR Verification Checklist");
    table(["Checklist Item", "Status", "Mandatory", "Verified By", "Date", "Remarks"], r.checklist.map(c => [c.item, c.status, c.mandatory, c.by, c.at, c.remarks]), "No checklist items.");
    section(5, "Documents");
    table(["Document", "Type", "Upload Status", "Verification", "Uploaded On"], r.documents.map(d => [d.name, d.type, d.upload, d.verification, d.uploadedOn]), "No documents.");
    doc.setFont("helvetica", "italic"); doc.setFontSize(7.5); doc.setTextColor(...MUTED);
    doc.text("Document files are not included in this report; open them through the portal (authorised access only).", 36, y - 6); y += 6;
    section(6, "Onboarding Status & History"); kv(r.history);
    table(["Date / Time", "By", "Activity", "Note"], r.activity.map(a => [a.at, a.by, a.action, a.note]), "No onboarding activity recorded yet.");
    pdfFooters(doc, `Onboarding report · ${r.employee.name} (${r.employee.id}) · Confidential`);
    doc.save(fileName);
}

// ───────────────────────────── Excel ─────────────────────────────
const HEAD_FILL = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FF10966A" } };
const ZEBRA_FILL = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FFF4FAF7" } };
const BORDER = { style: "thin" as const, color: { argb: "FFE4E4E7" } };
const isYmd = (v: any) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);

async function newWorkbook(meta: { title: string; scope?: string; generatedBy: string; generatedAt: string }) {
    const mod: any = await import("exceljs");
    const ExcelJS: any = mod.Workbook ? mod : (mod.default?.Workbook ? mod.default : (mod.default || mod));
    const wb = new ExcelJS.Workbook();
    wb.creator = "GOG OMS"; wb.created = new Date(meta.generatedAt);
    return wb;
}
/** A formatted table sheet: bold green header, frozen header row, filters, auto widths, real dates */
function addTableSheet(wb: any, name: string, cols: Col[], rows: Record<string, any>[]) {
    const ws = wb.addWorksheet(name, { views: [{ state: "frozen", ySplit: 1 }] });
    ws.columns = cols.map(c => ({ header: c.label, key: c.key, width: c.width || 16 }));
    rows.forEach(r => {
        const values: Record<string, any> = {};
        cols.forEach(c => { const v = r[c.key]; values[c.key] = isYmd(v) ? new Date(`${v}T00:00:00Z`) : (v ?? ""); });
        ws.addRow(values);
    });
    styleTable(ws, cols.length, rows.length);
    cols.forEach((c, i) => {
        // auto-fit: longest value (capped), never narrower than the header
        const longest = Math.max(c.label.length, ...rows.map(r => String(r[c.key] ?? "").length));
        ws.getColumn(i + 1).width = Math.min(60, Math.max(c.width || 10, longest + 2));
        if (rows.some(r => isYmd(r[c.key]))) ws.getColumn(i + 1).numFmt = "dd-mmm-yyyy";
    });
    if (cols.length) ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1 + rows.length, column: cols.length } };
    return ws;
}
function styleTable(ws: any, ncols: number, nrows: number) {
    const head = ws.getRow(1);
    head.font = { bold: true, color: { argb: "FFFFFFFF" } }; head.height = 20;
    for (let c = 1; c <= ncols; c++) { const cell = head.getCell(c); cell.fill = HEAD_FILL; cell.alignment = { vertical: "middle", wrapText: true }; cell.border = { top: BORDER, bottom: BORDER, left: BORDER, right: BORDER }; }
    for (let r = 2; r <= nrows + 1; r++) {
        const row = ws.getRow(r);
        for (let c = 1; c <= ncols; c++) {
            const cell = row.getCell(c);
            cell.alignment = { vertical: "top", wrapText: true }; cell.border = { top: BORDER, bottom: BORDER, left: BORDER, right: BORDER };
            if (r % 2 === 1) cell.fill = ZEBRA_FILL;
        }
    }
}
function addKvSheet(wb: any, name: string, rows: KV[]) {
    const ws = wb.addWorksheet(name, { views: [{ state: "frozen", ySplit: 1 }] });
    ws.columns = [{ header: "Field", key: "k", width: 30 }, { header: "Value", key: "v", width: 70 }];
    rows.forEach(([k, v]) => ws.addRow({ k, v: v || "" }));
    styleTable(ws, 2, rows.length);
    for (let r = 2; r <= rows.length + 1; r++) ws.getRow(r).getCell(1).font = { bold: true };
    return ws;
}
function addInfoSheet(wb: any, meta: { title: string; scope?: string; generatedBy: string; generatedAt: string }) {
    addKvSheet(wb, "Report Info", [["Report", meta.title], ["Scope", meta.scope || ""], ["Generated By", meta.generatedBy], ["Generated On", stamp(meta.generatedAt)], ["System", "GOG OMS — Organisation Management System"]]);
}
async function saveWorkbook(wb: any, fileName: string) {
    const buf = await wb.xlsx.writeBuffer();
    saveBlob(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), fileName);
}

export async function tableExcel(r: TableReport, sheetName: string, fileName: string) {
    const wb = await newWorkbook(r);
    addTableSheet(wb, sheetName, r.cols, r.rows);
    addInfoSheet(wb, r);
    await saveWorkbook(wb, fileName);
}

export async function employeeExcel(r: EmployeeReport, meta: { generatedBy: string; generatedAt: string }, fileName: string) {
    const m = { title: `Employee Onboarding Report — ${r.employee.name} (${r.employee.id})`, generatedBy: meta.generatedBy, generatedAt: meta.generatedAt };
    const wb = await newWorkbook(m);
    addKvSheet(wb, "Employee Information", r.info);
    addKvSheet(wb, "Submitted Form Details", r.form);
    addKvSheet(wb, "Banking Details", [...r.banking, ["Note", "Account, PAN and Aadhaar numbers are masked. Full values are available to HR in the portal."]]);
    addTableSheet(wb, "HR Verification Checklist",
        [{ key: "item", label: "Checklist Item", width: 30 }, { key: "status", label: "Status", width: 12 }, { key: "mandatory", label: "Mandatory", width: 11 },
         { key: "by", label: "Verified By", width: 22 }, { key: "at", label: "Date", width: 22 }, { key: "remarks", label: "Remarks", width: 30 }], r.checklist);
    addTableSheet(wb, "Documents",
        [{ key: "name", label: "Document", width: 32 }, { key: "type", label: "Type", width: 14 }, { key: "upload", label: "Upload Status", width: 15 },
         { key: "verification", label: "Verification", width: 14 }, { key: "uploadedOn", label: "Uploaded On", width: 14 }], r.documents);
    const hist = addKvSheet(wb, "Onboarding History", r.history);
    // activity log below the status table
    const start = r.history.length + 3;
    const headRow = hist.getRow(start);
    ["Date / Time", "By / Activity / Note"].forEach((h, i) => { const c = headRow.getCell(i + 1); c.value = h; c.font = { bold: true, color: { argb: "FFFFFFFF" } }; c.fill = HEAD_FILL; });
    if (!r.activity.length) hist.getRow(start + 1).getCell(1).value = "No onboarding activity recorded yet.";
    r.activity.forEach((a, i) => {
        const row = hist.getRow(start + 1 + i);
        row.getCell(1).value = a.at;
        row.getCell(2).value = [a.by, a.action, a.note].filter(Boolean).join(" — ");
        row.getCell(2).alignment = { wrapText: true, vertical: "top" };
    });
    addInfoSheet(wb, m);
    await saveWorkbook(wb, fileName);
}
