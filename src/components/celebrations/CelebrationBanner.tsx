"use client";
import { useEffect, useRef, useState } from "react";
import { Cake, PartyPopper, Palmtree, Sparkles } from "lucide-react";
import type { BannerData, ColleagueBirthday } from "@/lib/celebration-themes";

/**
 * The dashboard header banner (birthday / festival / vacation) — the same component on the live dashboard and in
 * every preview. An uploaded image is a background: name, designation and photo are separate HTML layers on top
 * (never edited into the image). The whole image is shown (no cropping); on narrow screens the text sits under it.
 */
const ICON = { "birthday-self": Cake, "birthday-colleague": Cake, festival: PartyPopper, vacation: Palmtree } as const;

function Photo({ url, name, size }: { url?: string; name?: string; size: number }) {
    const [bad, setBad] = useState(false);
    return url && !bad
        ? <img src={url} alt={name || ""} onError={() => setBad(true)} className="rounded-full object-cover border-2 border-white/70 shadow-lg shrink-0" style={{ width: size, height: size }} data-testid="cel-photo" />
        : <span className="rounded-full bg-white/15 border-2 border-white/60 text-white font-black flex items-center justify-center shrink-0" style={{ width: size, height: size, fontSize: size * 0.4 }} data-testid="cel-photo-placeholder">{(name || "?").trim()[0]?.toUpperCase()}</span>;
}

export default function CelebrationBanner({ banner, testId = "celebration-banner" }: { banner: BannerData; testId?: string }) {
    const box = useRef<HTMLDivElement>(null);
    const [w, setW] = useState(800);
    useEffect(() => {
        const el = box.current; if (!el) return;
        const ro = new ResizeObserver(() => setW(el.clientWidth)); ro.observe(el); setW(el.clientWidth);
        return () => ro.disconnect();
    }, []);
    const narrow = w < 560;
    const Icon = ICON[banner.kind] || Sparkles;
    const align = banner.align || "left";
    const isBday = banner.kind === "birthday-self" || banner.kind === "birthday-colleague";
    const photoPos = isBday ? (banner.photoPosition || "right") : "none";
    const photoSize = narrow ? 56 : w < 900 ? 72 : 88;
    const textAlign = align === "center" ? "center" : align === "right" ? "right" : "left";
    const justify = align === "center" ? "center" : align === "right" ? "flex-end" : "flex-start";

    const text = (
        <div className="min-w-0" style={{ textAlign }}>
            <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.2em] opacity-80" style={{ color: banner.textColor, justifyContent: justify }}>
                <Icon size={12} /> {banner.kind === "vacation" ? "Holiday" : banner.kind === "festival" ? "Celebration" : banner.kind === "birthday-self" ? "Your Birthday" : "Birthday"}
            </p>
            <h2 className="font-extrabold tracking-tight leading-tight mt-1 [overflow-wrap:anywhere]" style={{ color: banner.headingColor || banner.textColor, fontSize: narrow ? 20 : w < 900 ? 24 : 30 }} data-testid="cel-heading">{banner.heading}</h2>
            {isBday && banner.person && (banner.person.designation || banner.person.college) && (
                <p className="text-xs font-semibold mt-1 opacity-90 [overflow-wrap:anywhere]" style={{ color: banner.textColor }} data-testid="cel-person">{[banner.person.designation, banner.person.college].filter(Boolean).join(" · ")}</p>
            )}
            {banner.subheading && <p className="text-sm mt-1.5 opacity-90 [overflow-wrap:anywhere]" style={{ color: banner.textColor }} data-testid="cel-subheading">{banner.subheading}</p>}
        </div>
    );
    const content = (
        <div className="flex items-center gap-4 w-full" style={{ flexDirection: photoPos === "center" ? "column" : photoPos === "left" ? "row" : "row-reverse", justifyContent: photoPos === "none" ? justify : "space-between" }}>
            {photoPos !== "none" && <Photo url={banner.person?.photoUrl} name={banner.person?.name} size={photoSize} />}
            <div className="min-w-0 flex-1" style={photoPos === "none" ? { maxWidth: narrow ? "100%" : "75%" } : undefined}>{text}</div>
        </div>
    );

    return (
        <div ref={box} className="relative w-full rounded-2xl overflow-hidden border border-white/10 shadow-xl" style={{ background: banner.bgColor || "#14532d" }} data-testid={testId} data-kind={banner.kind}>
            {banner.imageUrl ? (
                <>
                    <div className="relative">
                        {/* the whole uploaded image (no crop) */}
                        <img src={banner.imageUrl} alt="" className="block w-full h-auto max-h-[340px] object-contain mx-auto" data-testid="cel-image" />
                        {!narrow && <>
                            <div className="absolute inset-0" style={{ background: banner.overlayColor || "rgba(0,0,0,0.25)" }} />
                            <div className="absolute inset-0 flex items-center px-8 py-5">{content}</div>
                        </>}
                    </div>
                    {narrow && <div className="px-4 py-4">{content}</div>}
                </>
            ) : (
                <div className="relative px-4 sm:px-8 py-5 sm:py-7" style={{ backgroundImage: `radial-gradient(circle at 85% 20%, rgba(255,255,255,0.12), transparent 45%), linear-gradient(135deg, rgba(255,255,255,0.06), transparent)` }}>
                    {content}
                </div>
            )}
        </div>
    );
}

/** Several colleagues' birthdays: one compact strip (instead of changing the header for each) */
export function ColleagueBirthdays({ list }: { list: ColleagueBirthday[] }) {
    if (!list.length) return null;
    return (
        <div className="rounded-2xl border border-pink-500/20 bg-pink-500/[0.05] p-3" data-testid="cel-colleagues">
            <p className="text-[10px] font-black uppercase tracking-widest text-pink-300 flex items-center gap-1.5 mb-2"><Cake size={12} /> Birthdays Today</p>
            <div className="flex gap-2 overflow-x-auto pb-1">
                {list.map(c => (
                    <div key={c.id} className="flex items-center gap-2.5 shrink-0 rounded-xl border border-zinc-800 bg-zinc-900/70 pl-1.5 pr-3 py-1.5" data-testid="cel-colleague">
                        <Photo url={c.photoUrl} name={c.name} size={34} />
                        <div className="min-w-0"><p className="text-xs font-bold text-white whitespace-nowrap">Happy Birthday, {c.name}!</p><p className="text-[10px] text-zinc-400 whitespace-nowrap">{[c.designation, c.college].filter(Boolean).join(" · ")}</p></div>
                    </div>
                ))}
            </div>
        </div>
    );
}