"use client";

import { useState } from "react";
import { X, XCircle, Loader2, AlertTriangle, ImagePlus, Trash2 } from "lucide-react";
import { uploadToCloudinary } from "@/lib/cloudinary";
import { cn } from "@/lib/utils";
import { DRESS_CODE_REASONS } from "@/lib/dress-code-reasons";

/**
 * Dress code → Reject: the reviewer picks the reason(s) (Footwear / Blazer / Waistcoat / Grooming / Full Attire /
 * Other + text) and optional remarks. Saving the rejection does NOT email the employee — the rejection email is sent
 * from HR → Email Management (Send Email).
 */
export default function DressCodeRejectDialog({ employeeName, date, onCancel, onConfirm }: {
    employeeName?: string; date?: string;
    onCancel: () => void;
    onConfirm: (r: { reasons: string[]; other: string; remarks: string; photoUrl?: string }) => Promise<{ ok: boolean; error?: string } | void>;
}) {
    const [reasons, setReasons] = useState<string[]>([]);
    const [other, setOther] = useState("");
    const [remarks, setRemarks] = useState("");
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    // optional photo (sent with the rejection email)
    const [photo, setPhoto] = useState<{ url: string; name: string } | null>(null);
    const [uploading, setUploading] = useState(false);
    const pickPhoto = async (file?: File) => {
        if (!file) return;
        if (!/^image\/(jpeg|png|webp)$/i.test(file.type)) return setError("Choose a JPG, PNG or WEBP photo.");
        if (file.size > 5 * 1024 * 1024) return setError("The photo must be smaller than 5 MB.");
        setUploading(true); setError("");
        try { const up = await uploadToCloudinary(file); setPhoto({ url: up.secure_url, name: file.name }); }
        catch { setError("Could not upload the photo. Please try again."); }
        finally { setUploading(false); }
    };
    const toggle = (r: string) => setReasons(p => (p.includes(r) ? p.filter(x => x !== r) : [...p, r]));

    const submit = async () => {
        if (!reasons.length) return setError("Select at least one rejection reason.");
        if (reasons.includes("Other") && other.trim().length < 2) return setError('Please write the reason for "Other".');
        if (uploading) return setError("Please wait — the photo is still uploading.");
        setSaving(true); setError("");
        const r = await onConfirm({ reasons, other: reasons.includes("Other") ? other.trim() : "", remarks: remarks.trim(), ...(photo ? { photoUrl: photo.url } : {}) });
        setSaving(false);
        if (r && !r.ok) setError(r.error || "Could not save the rejection.");
    };

    return (
        <div className="fixed inset-0 z-[120] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" data-testid="dress-reject-dialog">
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md shadow-2xl">
                <div className="px-5 py-3 border-b border-zinc-800 flex items-center gap-2">
                    <XCircle size={18} className="text-red-400" />
                    <h2 className="text-base font-bold text-white">Reject Dress Code</h2>
                    <button onClick={onCancel} className="ml-auto text-zinc-500 hover:text-white" aria-label="Close"><X size={18} /></button>
                </div>
                <div className="p-5 space-y-4">
                    {(employeeName || date) && <p className="text-xs text-zinc-400">{employeeName}{date ? ` · ${date.split("-").reverse().join("-")}` : ""}</p>}
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2">Reason for rejection (one or more)</p>
                        <div className="grid grid-cols-2 gap-2">
                            {DRESS_CODE_REASONS.map(r => (
                                <label key={r} className={cn("flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-bold cursor-pointer select-none",
                                    reasons.includes(r) ? "border-red-500/40 bg-red-500/10 text-red-300" : "border-zinc-800 bg-zinc-950 text-zinc-300 hover:border-zinc-600")}>
                                    <input type="checkbox" checked={reasons.includes(r)} onChange={() => toggle(r)} className="accent-red-500" data-testid={`dress-reason-${r}`} /> {r}
                                </label>
                            ))}
                        </div>
                    </div>
                    {reasons.includes("Other") && (
                        <input value={other} onChange={e => setOther(e.target.value)} maxLength={300} placeholder="Write the reason" data-testid="dress-reason-other-text"
                            className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-white outline-none focus:border-zinc-600" />
                    )}
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2">Additional remarks (optional)</p>
                        <textarea value={remarks} onChange={e => setRemarks(e.target.value)} maxLength={1000} rows={3} data-testid="dress-reject-remarks"
                            className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-white outline-none focus:border-zinc-600 resize-none" />
                    </div>
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2">Photo (optional) — sent with the rejection email</p>
                        {photo ? (
                            <div className="flex items-center gap-3 p-2 rounded-lg border border-zinc-800 bg-zinc-950" data-testid="dress-reject-photo">
                                <img src={photo.url} alt="" className="w-14 h-14 object-cover rounded-md border border-zinc-800" />
                                <span className="text-[11px] text-zinc-300 truncate flex-1">{photo.name}</span>
                                <button onClick={() => setPhoto(null)} className="text-zinc-500 hover:text-red-400" aria-label="Remove photo"><Trash2 size={14} /></button>
                            </div>
                        ) : (
                            <label className={cn("flex items-center justify-center gap-2 px-3 py-3 rounded-lg border border-dashed text-xs font-bold cursor-pointer", uploading ? "border-zinc-700 text-zinc-500" : "border-zinc-700 text-zinc-300 hover:border-zinc-500")}>
                                {uploading ? <><Loader2 size={14} className="animate-spin" /> Uploading…</> : <><ImagePlus size={14} /> Upload photo</>}
                                <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" disabled={uploading} data-testid="dress-reject-photo-input"
                                    onChange={e => { pickPhoto(e.target.files?.[0]); e.target.value = ""; }} />
                            </label>
                        )}
                    </div>
                    <p className="text-[11px] text-zinc-500">No email is sent now. Send the rejection email from HR → Email Management.</p>
                    {error && <p className="text-xs text-red-400 flex items-center gap-1.5"><AlertTriangle size={12} /> {error}</p>}
                </div>
                <div className="px-5 py-3 border-t border-zinc-800 flex justify-end gap-2">
                    <button onClick={onCancel} className="px-4 py-2 rounded-lg text-xs font-bold text-zinc-300 border border-zinc-700 hover:border-zinc-500">Cancel</button>
                    <button onClick={submit} disabled={saving || uploading} data-testid="dress-reject-confirm" className="px-4 py-2 rounded-lg text-xs font-bold bg-red-600 text-white hover:bg-red-500 disabled:opacity-50 flex items-center gap-1.5">
                        {saving && <Loader2 size={12} className="animate-spin" />} Reject Dress Code
                    </button>
                </div>
            </div>
        </div>
    );
}