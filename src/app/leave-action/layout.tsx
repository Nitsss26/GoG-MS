import type { Metadata } from "next";

/** Leave e-mail Accept / Reject page: the link carries a one-time token, so it is never sent on as a referrer or indexed */
export const metadata: Metadata = {
    title: "Leave Request — GOG OMS",
    referrer: "no-referrer",
    robots: { index: false, follow: false },
};

export default function LeaveActionLayout({ children }: { children: React.ReactNode }) {
    return children;
}