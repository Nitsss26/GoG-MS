"use client";
import { useRef, useState } from "react";
import { Upload, Loader2, RefreshCw, Trash2, Eye, Palmtree, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { uploadToCloudinary } from "@/lib/cloudinary";
import { optimizeImage } from "@/lib/image-optimize";
import { HeaderBannerSample } from "./HeaderCelebration";
import CelebrationPreview from "./CelebrationPreview";
import { DEFAULTS, vacationBanner, vacationHeading } from "@/lib/celebration-themes";

/**
 * Holiday announcement form additions:
 *   HolidayImageField    — one optional image shown above the announcement text (HR and HOI)
 *   VacationBannerFields — optional Dashboard Vacation Banner (HR): shown in the dashboard header on the holiday's
 *                          approved days to the employees who have that holiday. Saved with the announcement.
 */
const btn = "inline-flex items-center justify-center gap-1.5 h-9 px-3 rounded-lg border text-[11px] font-bold whitespace-nowrap transition-colors disabled:opacity-50";
const lbl = "block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1.5";
const field = "w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-xs text-white outline-none focus:border-primary/50";
const up = async (f: File) => (await uploadToCloudinary(await optimizeImage(f))).secure_url;

export function HolidayImageField({ value, onChange, testId = "hol-img" }: { value: string; onChange: (u: string) => void; testId?: string }) {
    const file = useRef<HTMLInputElement>(null);
    const [busy, setBusy] = useState(false); const [err, setErr] = useState(""); const [zoom, setZoom] = useState(false);
    const pick = async (fl: FileList | null) => { if (!fl?.[0]) return; setBusy(true); setErr(""); try { onChange(await up(fl[0])); } catch { setErr("Upload failed."); } finally { setBusy(false); if (file.current) file.current.value = ""; } };
    return (
        <div data-testid={testId}>
            <label className={lbl}>Holiday Announcement Image <span className="normal-case tracking-normal font-medium text-zinc-500">(optional — shown above the announcement)</span></label>
            <input ref={file} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={e => pick(e.target.files)} data-testid={`${testId}-input`} />
            {value ? (
                <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-2 space-y-2">
                    <img src={value} alt="" className="block w-full h-auto max-h-48 object-contain rounded-lg" data-testid={`${testId}-thumb`} />
                    <div className="flex flex-wrap gap-1.5">
                        <button type="button" onClick={() => setZoom(true)} className={`${btn} h-8 border-zinc-700 bg-zinc-900 text-zinc-200`} data-testid={`${testId}-preview`}><Eye size={12} /> Preview</button>
                        <button type="button" onClick={() => file.current?.click()} disabled={busy} className={`${btn} h-8 border-zinc-700 bg-zinc-900 text-zinc-200`} data-testid={`${testId}-replace`}>{busy ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />} Replace</button>
                        <button type="button" onClick={() => onChange("")} className={`${btn} h-8 border-red-500/30 bg-red-500/10 text-red-300`} data-testid={`${testId}-remove`}><Trash2 size={12} /> Remove</button>
                    </div>
                </div>
            ) : (
                <button type="button" onClick={() => file.current?.click()} disabled={busy} data-testid={`${testId}-upload`} className="w-full border-2 border-dashed border-zinc-800 hover:border-primary/40 rounded-xl p-3 text-[11px] text-zinc-500 flex items-center justify-center gap-2">{busy ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />} Upload Image</button>
            )}
            {err && <p className="text-[11px] text-red-400 mt-1">{err}</p>}
            {zoom && value && (
                <div className="fixed inset-0 z-[140] bg-black/85 flex items-center justify-center p-4" onClick={() => setZoom(false)} role="dialog" aria-modal="true">
                    <img src={value} alt="" className="max-w-full max-h-full object-contain rounded-xl" />
                    <button type="button" onClick={() => setZoom(false)} className="absolute top-4 right-4 p-2 rounded-full bg-zinc-900 text-white" aria-label="Close"><X size={16} /></button>
                </div>
            )}
        </div>
    );
}

export type VacationBannerValue = {
    enabled: boolean; images: string[]; activeImage: string; heading: string; subheading: string;
    headingColor: string; textColor: string; bgColor: string; overlayColor: string; align: "left" | "center" | "right"; headingEdited?: boolean;
};
export const blankVacationBanner = (): VacationBannerValue => ({
    enabled: false, images: [], activeImage: "", heading: "", subheading: DEFAULTS.vacation.subheading,
    headingColor: DEFAULTS.vacation.headingColor, textColor: DEFAULTS.vacation.textColor, bgColor: DEFAULTS.vacation.bgColor, overlayColor: DEFAULTS.vacation.overlayColor, align: "left",
});

function Color({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
    return (
        <label className="block min-w-0"><span className={lbl}>{label}</span>
            <span className="flex items-center gap-2 h-10 px-2 bg-zinc-900 border border-zinc-800 rounded-xl">
                <input type="color" value={/^#[0-9a-f]{6}/i.test(value) ? value.slice(0, 7) : "#000000"} onChange={e => onChange(e.target.value)} className="w-8 h-7 bg-transparent border-0 p-0 cursor-pointer shrink-0" aria-label={label} />
                <input value={value} onChange={e => onChange(e.target.value)} className="flex-1 min-w-0 bg-transparent text-xs text-white outline-none font-mono" aria-label={`${label} value`} />
            </span>
        </label>
    );
}

export function VacationBannerFields({ value, onChange, holidayName, from, to }: { value: VacationBannerValue; onChange: (v: VacationBannerValue) => void; holidayName: string; from?: string; to?: string }) {
    const file = useRef<HTMLInputElement>(null);
    const [busy, setBusy] = useState(false); const [err, setErr] = useState(""); const [preview, setPreview] = useState(false);
    const v = value;
    const heading = v.headingEdited ? v.heading : vacationHeading(holidayName);
    const banner = vacationBanner({ ...v, heading }, holidayName);
    const set = (x: Partial<VacationBannerValue>) => onChange({ ...v, ...x });
    const upload = async (fl: FileList | null) => {
        if (!fl?.length) return; setBusy(true); setErr("");
        try { const urls: string[] = []; for (const f of Array.from(fl)) urls.push(await up(f)); onChange({ ...v, images: [...v.images, ...urls], activeImage: v.activeImage || urls[0] }); }
        catch { setErr("Upload failed."); } finally { setBusy(false); if (file.current) file.current.value = ""; }
    };
    const remove = (u: string) => { const images = v.images.filter(x => x !== u); set({ images, activeImage: v.activeImage === u ? images[0] || "" : v.activeImage }); };
    const dmy = (s?: string) => (s ? s.split("-").reverse().join("-") : "");
    return (
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.03] p-3 sm:p-4 space-y-3" data-testid="vac-banner">
            <label className="flex items-start gap-3 cursor-pointer">
                <input type="checkbox" className="w-4 h-4 mt-0.5" checked={v.enabled} onChange={e => set({ enabled: e.target.checked })} data-testid="vac-enable" />
                <span><span className="text-xs font-bold text-white flex items-center gap-1.5"><Palmtree size={13} className="text-emerald-300" /> Dashboard Vacation Banner</span>
                    <span className="block text-[11px] text-zinc-500">Shown in the dashboard header on the holiday days{from ? ` (${dmy(from)}${to && to !== from ? ` to ${dmy(to)}` : ""})` : ""}, only to employees who have this holiday.</span></span>
            </label>
            {v.enabled && (<>
                <div>
                    <p className={lbl}>Vacation Banner Images <span className="normal-case tracking-normal font-medium text-zinc-500">(optional — select the one to show)</span></p>
                    <input ref={file} type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple className="hidden" onChange={e => upload(e.target.files)} data-testid="vac-upload-input" />
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {v.images.map(u => (
                            <div key={u} className={cn("relative rounded-lg border p-1", v.activeImage === u ? "border-emerald-400" : "border-zinc-800")} data-testid="vac-image">
                                <button type="button" onClick={() => set({ activeImage: u })} className="block w-full" aria-label="Select this banner" data-testid="vac-select"><img src={u} alt="" className="w-full h-16 object-contain bg-zinc-950 rounded" /></button>
                                {v.activeImage === u && <span className="absolute top-1 left-1 inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-500 text-zinc-950" data-testid="vac-active"><Check size={9} /> Active</span>}
                                <button type="button" onClick={() => remove(u)} className="absolute top-1 right-1 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center" aria-label="Remove banner image"><X size={10} /></button>
                            </div>
                        ))}
                        <button type="button" onClick={() => file.current?.click()} disabled={busy} data-testid="vac-upload" className="h-[74px] rounded-lg border-2 border-dashed border-zinc-800 hover:border-emerald-500/40 text-[11px] text-zinc-500 flex flex-col items-center justify-center gap-1">{busy ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />} Upload</button>
                    </div>
                    {err && <p className="text-[11px] text-red-400 mt-1">{err}</p>}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="sm:col-span-2"><label className={lbl} htmlFor="vac-heading">Vacation Heading</label>
                        <input id="vac-heading" value={heading} onChange={e => set({ heading: e.target.value, headingEdited: true })} className={field} data-testid="vac-heading" maxLength={120} /></div>
                    <div className="sm:col-span-2"><label className={lbl} htmlFor="vac-sub">Vacation Subheading</label>
                        <input id="vac-sub" value={v.subheading} onChange={e => set({ subheading: e.target.value })} className={field} data-testid="vac-sub" maxLength={240} /></div>
                    <Color label="Heading Colour" value={v.headingColor} onChange={x => set({ headingColor: x })} />
                    <Color label="Text Colour" value={v.textColor} onChange={x => set({ textColor: x })} />
                    <Color label="Background Colour" value={v.bgColor} onChange={x => set({ bgColor: x })} />
                    <Color label="Overlay Colour" value={v.overlayColor} onChange={x => set({ overlayColor: x })} />
                    <div><label className={lbl} htmlFor="vac-align">Text Alignment</label>
                        <select id="vac-align" value={v.align} onChange={e => set({ align: e.target.value as any })} className={field} data-testid="vac-align"><option value="left">Left</option><option value="center">Center</option><option value="right">Right</option></select></div>
                </div>
                <div><p className={lbl}>Banner (dashboard header)</p><HeaderBannerSample banner={banner} testId="vac-sample" /></div>
                <button type="button" onClick={() => setPreview(true)} data-testid="vac-preview" className={`${btn} w-full sm:w-auto border-emerald-500/40 bg-emerald-500/10 text-emerald-200`}><Eye size={13} /> Preview Dashboard Banner</button>
                {preview && <CelebrationPreview title="Dashboard Vacation Banner" pages={false} onClose={() => setPreview(false)} onSave={() => setPreview(false)}
                    payload={{ date: from || "", banner, colleagues: [], birthdaySelf: false, effect: null }} />}
            </>)}
        </div>
    );
}

/** What the server stores (heading auto-generated unless HR edited it) */
export const vacationPayload = (v: VacationBannerValue, holidayName: string) => v.enabled ? {
    enabled: true, images: v.images, activeImage: v.activeImage, heading: v.headingEdited ? v.heading : vacationHeading(holidayName), subheading: v.subheading,
    headingColor: v.headingColor, textColor: v.textColor, bgColor: v.bgColor, overlayColor: v.overlayColor, align: v.align,
} : undefined;
