"use client";

import Link from "next/link";
import { ShieldOff } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

/** Shown in place of a page that HR blocked for the employee's role (Admin → Role Management) */
function NoAccess() {
    const from = useSearchParams().get("from") || "";
    return (
        <div className="p-6 sm:p-10 flex justify-center w-full" data-testid="no-access">
            <div className="max-w-md w-full rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 text-center space-y-3">
                <div className="mx-auto w-12 h-12 rounded-xl bg-red-500/10 border border-red-500/25 flex items-center justify-center text-red-300"><ShieldOff size={22} /></div>
                <h1 className="text-lg font-bold text-white">This page is not available for your role</h1>
                <p className="text-sm text-zinc-400">HR has turned off access to this module for your role. If you need it, please contact HR.</p>
                {from && <p className="text-[11px] text-zinc-600 [overflow-wrap:anywhere]">{from}</p>}
                <Link href="/" className="inline-flex px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-bold">Go to Dashboard</Link>
            </div>
        </div>
    );
}

export default function NoAccessPage() {
    return <Suspense fallback={null}><NoAccess /></Suspense>;
}