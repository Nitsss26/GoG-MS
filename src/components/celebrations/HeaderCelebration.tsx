"use client";
import { useState, type ReactNode } from "react";
import { Cake, PartyPopper, Palmtree } from "lucide-react";
import type { BannerData } from "@/lib/celebration-themes";
import { useCelebration } from "./GlobalCelebrationEffects";

/**
 * Vacation, festival and the employee's OWN birthday banner sit in the background of the dashboard's
 * "Welcome back" header (the uploaded image fills the header, a dark fade on the text side keeps it readable).
 * A colleague's birthday is NOT shown here — it stays a separate banner on the dashboard.
 */
export const isHeaderKind = (k?: string) => k === "vacation" || k === "festival" || k === "birthday-self";

/** Today's header banner (dashboard only) */
export function useHeaderBanner(): BannerData | null {
    const { data } = useCelebration();
    return data?.banner && isHeaderKind(data.banner.kind) ? data.banner : null;
}

const ICON = { "birthday-self": Cake, festival: PartyPopper, vacation: Palmtree } as Record<string, typeof Cake>;
const EMOJI: Record<string, string> = { "birthday-self": "🎂" };   // festival / vacation: icon (works for every festival)

/** Background layers — placed inside a `relative` header; never catch clicks */
export function HeaderBannerBackground({ banner, rounded }: { banner: BannerData; rounded?: boolean }) {
    const [bad, setBad] = useState(false);
    return (
        <div aria-hidden="true" className={`absolute inset-0 overflow-hidden pointer-events-none ${rounded ? "rounded-2xl" : ""}`} style={{ background: banner.bgColor || "#0a0a0b" }} data-testid="header-banner-bg">
            {banner.imageUrl && !bad && <img src={banner.imageUrl} alt="" onError={() => setBad(true)} className="absolute inset-0 w-full h-full object-cover object-center" data-testid="header-banner-image" />}
            {banner.overlayColor && <div className="absolute inset-0" style={{ background: banner.overlayColor, opacity: 0.6 }} />}
            {/* readable text side */}
            <div className="absolute inset-0" style={{ background: banner.align === "right"
                ? "linear-gradient(270deg, rgba(10,10,11,0.9) 0%, rgba(10,10,11,0.55) 45%, rgba(10,10,11,0.05) 80%)"
                : banner.align === "center"
                    ? "radial-gradient(ellipse at center, rgba(10,10,11,0.75) 0%, rgba(10,10,11,0.3) 70%)"
                    : "linear-gradient(90deg, rgba(10,10,11,0.92) 0%, rgba(10,10,11,0.6) 40%, rgba(10,10,11,0.05) 78%)" }} />
        </div>
    );
}

function Photo({ url, name, size }: { url?: string; name?: string; size: number }) {
    const [bad, setBad] = useState(false);
    return url && !bad
        ? <img src={url} alt={name || ""} onError={() => setBad(true)} className="rounded-full object-cover border-2 border-white/70 shadow-lg shrink-0" style={{ width: size, height: size }} data-testid="cel-photo" />
        : <span className="rounded-full bg-white/15 border-2 border-white/60 text-white font-black flex items-center justify-center shrink-0" style={{ width: size, height: size, fontSize: size * 0.4 }} data-testid="cel-photo-placeholder">{(name || "?").trim()[0]?.toUpperCase()}</span>;
}

/** The celebration line under "Welcome back, …" (e.g. "🪔 It's Your Diwali Vacation!") */
export function HeaderBannerLine({ banner, welcome, compact }: { banner: BannerData; welcome?: string; compact?: boolean }) {
    const Icon = ICON[banner.kind] || PartyPopper;
    const bday = banner.kind === "birthday-self";
    // own birthday: the welcome already says "Happy Birthday, …!" → show the template greeting only if it says more
    const heading = bday && welcome && banner.heading.trim().toLowerCase() === welcome.trim().toLowerCase() ? "" : banner.heading;
    const person = bday && banner.person ? [banner.person.designation, banner.person.college].filter(Boolean).join(" · ") : "";
    const justify = banner.align === "center" ? "center" : banner.align === "right" ? "flex-end" : "flex-start";
    return (
        <div className="min-w-0" data-testid="header-banner-line">
            {heading && (
                <p className="flex items-center gap-2 mt-1 font-serif italic font-bold leading-tight [overflow-wrap:anywhere]" style={{ color: banner.headingColor || "#fcd34d", fontSize: compact ? 16 : 22, justifyContent: justify, textShadow: "0 2px 10px rgba(0,0,0,0.6)" }} data-testid="cel-heading">
                    <span className="not-italic shrink-0" aria-hidden="true">{EMOJI[banner.kind] || <Icon size={18} />}</span>{heading}
                </p>
            )}
            {person && <p className="text-xs font-semibold mt-0.5 [overflow-wrap:anywhere]" style={{ color: banner.textColor || "#e4e4e7" }} data-testid="cel-person">{person}</p>}
            {banner.subheading && <p className="text-xs mt-0.5 opacity-90 [overflow-wrap:anywhere]" style={{ color: banner.textColor || "#e4e4e7" }} data-testid="cel-subheading">{banner.subheading}</p>}
        </div>
    );
}

/** Greeting block with the optional birthday photo (left / right / none) */
export function HeaderGreeting({ banner, children, compact }: { banner: BannerData | null; children: ReactNode; compact?: boolean }) {
    if (!banner) return <>{children}</>;
    const textAlign = banner.align === "center" ? "center" : banner.align === "right" ? "right" : "left";
    const pos = banner.kind === "birthday-self" ? (banner.photoPosition || "right") : "none";
    const photo = pos !== "none" && <Photo url={banner.person?.photoUrl} name={banner.person?.name} size={compact ? 48 : 56} />;
    return (
        <div className="relative flex items-center gap-3 min-w-0 flex-1" style={{ justifyContent: banner.align === "center" ? "center" : banner.align === "right" ? "flex-end" : "flex-start" }}>
            {pos !== "right" && photo}
            <div className="min-w-0" style={{ textAlign }}>{children}</div>
            {pos === "right" && photo}
        </div>
    );
}

/** The header exactly as on the dashboard — used for the samples in Celebration Management / holiday form */
export function HeaderBannerSample({ banner, label = "Dashboard", testId }: { banner: BannerData; label?: string; testId?: string }) {
    const welcome = banner.kind === "birthday-self" ? `Happy Birthday, ${String(banner.person?.name || "Rahul").split(/\s+/)[0]}!` : "Welcome back, Rahul Sharma";
    return (
        <div className="relative rounded-2xl border border-white/10 px-4 sm:px-6 py-4 sm:py-5 min-h-[96px] flex items-center" data-testid={testId} data-kind={banner.kind}>
            <HeaderBannerBackground banner={banner} rounded />
            <HeaderGreeting banner={banner} compact>
                <p className="text-[10px] text-zinc-300 uppercase tracking-widest font-bold">{label}</p>
                <p className="text-lg sm:text-xl font-extrabold text-white tracking-tight [overflow-wrap:anywhere]">{welcome}</p>
                <HeaderBannerLine banner={banner} welcome={welcome} compact />
            </HeaderGreeting>
        </div>
    );
}
