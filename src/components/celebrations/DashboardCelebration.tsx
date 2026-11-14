"use client";
import CelebrationBanner, { ColleagueBirthdays } from "./CelebrationBanner";
import { useCelebration } from "./GlobalCelebrationEffects";
import { isHeaderKind } from "./HeaderCelebration";

/**
 * Dashboard only: a colleague's birthday / new member welcome banner, the other welcomes of today + the colleagues' birthday strip.
 * Vacation / festival / own birthday banners are shown in the "Welcome back" header instead (HeaderCelebration).
 */
export default function DashboardCelebration() {
    const { data } = useCelebration();
    const card = data?.banner && !isHeaderKind(data.banner.kind) ? data.banner : null;
    const welcomes = data?.welcomes || [];
    if (!data || (!card && !data.colleagues?.length && !welcomes.length)) return null;
    return (
        <div className="space-y-3" data-testid="dashboard-celebration">
            {card && <CelebrationBanner banner={card} />}
            {welcomes.map((w, i) => <CelebrationBanner key={i} banner={w} testId="celebration-welcome" />)}
            {data.colleagues?.length > 0 && <ColleagueBirthdays list={data.colleagues} />}
        </div>
    );
}

/** "Welcome back, …" → "Happy Birthday, …!" on the employee's own birthday (dashboard) */
export function useWelcomeText(name?: string) {
    const { data } = useCelebration();
    if (data?.birthdaySelf) return `Happy Birthday, ${String(data.banner?.person?.name || name || "").split(/\s+/)[0]}!`;
    if (data?.banner?.kind === "welcome-self") return `Welcome, ${String(data.banner.person?.name || name || "").split(/\s+/)[0]}!`;
    return `Welcome back, ${name || ""}`;
}