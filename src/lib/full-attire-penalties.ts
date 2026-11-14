/**
 * SERVER-ONLY: Full Attire rejections as Dress-Code-style penalties.
 * A rejected Full Attire photo (HR → Full Attire → Reject) counts like a rejected dress code photo: numbered per
 * professor and calendar month (date order, from the Dress Code policy start), 1st / 2nd → warning, 3rd → 10 %,
 * 4th → 20 %, 5th and later → 30 % fine of one day's gross salary (src/lib/attendance-policy.ts → dressLadder).
 * Used by Salary / Payable Days (src/lib/salary-module.ts) and the Full Attire email (src/lib/email-management.ts).
 * Flag id: FATTIRE:<review id> (a FlagRemoval with this id takes it out, like other flags).
 */
import { FullAttireReview, FullAttireSubmission } from '@/models/FullAttire';
import { FlagRemoval } from '@/models/SalaryModule';
import { isNewPolicy } from '@/lib/attendance-policy';

export type FullAttireRejection = { flagId: string; reviewId: string; employeeId: string; date: string; at: string; reasons: string };

/** IST calendar date of an ISO time */
const istYmd = (iso: string) => { const t = Date.parse(iso); return Number.isFinite(t) ? new Date(t + 5.5 * 3600000).toISOString().slice(0, 10) : ''; };

/** Rejected Full Attire photos of these professors whose verification date (IST, submission time) is in [from, to] */
export async function fullAttireRejections(ids: string[], from: string, to: string): Promise<FullAttireRejection[]> {
    if (!ids.length) return [];
    const revs: any[] = await FullAttireReview.find({ professorId: { $in: ids }, status: 'rejected' }).select('id submissionId professorId reasons other reviewedAt').lean();
    if (!revs.length) return [];
    const subs: any[] = await FullAttireSubmission.find({ id: { $in: Array.from(new Set(revs.map(r => r.submissionId))) } }).select('id submittedAt').lean();
    const at = new Map(subs.map(s => [s.id, String(s.submittedAt || '')]));
    return revs
        .map(r => {
            const t = at.get(r.submissionId) || '';
            return { flagId: `FATTIRE:${r.id}`, reviewId: String(r.id), employeeId: String(r.professorId), date: istYmd(t), at: t, reasons: [...(Array.isArray(r.reasons) ? r.reasons : []), r.other].filter(Boolean).join(', ') };
        })
        .filter(x => x.date && x.date >= from && x.date <= to);
}

/** Instance number (1, 2, 3 …) of each rejection within its professor's month; removed flags and pre-policy dates are skipped */
export function numberFullAttire(list: FullAttireRejection[], removed: Set<string> = new Set()) {
    const out = new Map<string, number>();
    const sorted = [...list].sort((a, b) => a.date.localeCompare(b.date) || a.at.localeCompare(b.at) || a.reviewId.localeCompare(b.reviewId));
    const n = new Map<string, number>();
    for (const r of sorted) {
        if (!isNewPolicy(r.date) || removed.has(r.flagId)) continue;
        const k = `${r.employeeId}|${r.date.slice(0, 7)}`;
        n.set(k, (n.get(k) || 0) + 1);
        out.set(r.reviewId, n.get(k)!);
    }
    return out;
}

/** Instance numbers for the given review ids (counted over each professor's whole month) */
export async function fullAttireInstanceNumbers(rows: { reviewId: string; employeeId: string; date: string }[]) {
    const out = new Map<string, number>();
    const keys = Array.from(new Set(rows.filter(r => r.date).map(r => `${r.employeeId}|${r.date.slice(0, 7)}`)));
    for (const k of keys) {
        const [employeeId, month] = k.split('|');
        const all = await fullAttireRejections([employeeId], `${month}-01`, `${month}-31`);
        const rem: any[] = all.length ? await FlagRemoval.find({ flagId: { $in: all.map(x => x.flagId) } }).select('flagId').lean() : [];
        numberFullAttire(all, new Set(rem.map(x => x.flagId))).forEach((v, id) => out.set(id, v));
    }
    return out;
}