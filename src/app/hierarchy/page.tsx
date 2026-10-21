"use client";

import { useAuth } from "@/context/AuthContext";
import { Search, Network, Heart } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import OrgChart, { OrgCanvas, PersonCard } from "@/components/org/OrgChart";
import { buildOrgChart, toOrgPerson, type OrgPerson } from "@/lib/org-chart";

/**
 * Organization Chart — generated from the existing Employee records (/api/employees).
 * Onboarding, designation, department, HOI (reportsTo) or status changes show up automatically:
 * the list is re-read on open, every 30 s and whenever the tab regains focus. Nothing is stored for the chart.
 */
export default function HierarchyPage() {
    const { employees, orgHierarchy } = useAuth();
    const [searchQuery, setSearchQuery] = useState("");
    const [live, setLive] = useState<any[] | null>(null);
    const [highlightId, setHighlightId] = useState<string | null>(null);

    const load = useCallback(async () => {
        try {
            const r = await fetch("/api/employees", { cache: "no-store" });
            const d = await r.json();
            if (r.ok && Array.isArray(d)) setLive(d.filter((e: any) => e?.id && e.id !== "HOI"));
        } catch { /* keep the last good list */ }
    }, []);
    useEffect(() => {
        load();
        const t = setInterval(load, 30000);
        const onFocus = () => load();
        window.addEventListener("focus", onFocus);
        return () => { clearInterval(t); window.removeEventListener("focus", onFocus); };
    }, [load]);

    const data = useMemo(() => {
        const src: any[] = live || employees || [];
        // Keep the Org Chart display corrections that already exist in orgHierarchy (name / designation / hidden entries)
        const nodeById = new Map(orgHierarchy.map(n => [n.id, n]));
        const knownIds = new Set((employees || []).map((e: any) => e.id));
        const ctxById = new Map((employees || []).map((e: any) => [e.id, e]));
        const people = src
            .filter(e => nodeById.has(e.id) || !knownIds.has(e.id))
            .map(e => {
                // apply a correction only where orgHierarchy deliberately differs from the stored record; otherwise live data wins
                const n = nodeById.get(e.id); const ctx: any = ctxById.get(e.id);
                const fix: { name?: string; designation?: string } = {};
                if (n && ctx && n.name !== ctx.name) fix.name = n.name;
                if (n && ctx && n.designation !== (ctx.designation || ctx.role)) fix.designation = n.designation;
                return toOrgPerson(e, fix);
            });
        const status = new Map(src.map(e => [String(e.id), String(e.status || "Active")]));
        return buildOrgChart(people, id => status.get(id) || "Active");
    }, [live, employees, orgHierarchy]);

    const everyone = useMemo(() => {
        const m = new Map<string, OrgPerson>();
        [...data.executives, ...data.techLeads, ...data.ads, ...data.hrHeads, ...data.hrExecutives, ...data.techTeam, ...data.marketingTeam,
            ...data.hois.flatMap(h => [h.person, ...h.members]), ...data.clch, ...data.noHoi].forEach(p => m.set(p.id, p));
        return [...m.values()];
    }, [data]);

    const q = searchQuery.trim().toLowerCase();
    const filteredNodes = q ? everyone.filter(p => p.name.toLowerCase().includes(q) || p.designation.toLowerCase().includes(q) || p.id.toLowerCase().includes(q)).slice(0, 24) : [];

    // Everyone is already visible: just highlight and scroll to the card
    const reveal = (id: string) => {
        setHighlightId(id);
        setTimeout(() => document.querySelector(`[data-testid="org-canvas"] [data-person="${CSS.escape(id)}"]`)?.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" }), 350);
        setTimeout(() => setHighlightId(h => (h === id ? null : h)), 3500);
    };

    return (
        <div className="p-4 sm:p-8 space-y-6 sm:space-y-8 w-full min-h-screen">
            <header className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
                <div>
                    <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2">
                        <Network className="text-primary" size={20} />
                        Hierarchy
                    </h1>
                    <p className="text-[10px] sm:text-sm text-zinc-400 mt-1 font-medium">Reporting Structure & Team Grid</p>
                </div>
                <div className="relative w-full sm:w-72">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={14} />
                    <input
                        type="text"
                        placeholder="Search Profile or Role..."
                        data-testid="org-search"
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-2 sm:py-2.5 pl-10 pr-4 text-[11px] sm:text-xs text-white outline-none focus:border-primary/50 transition-all font-medium"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
            </header>

            {/* Emotional Mission Tribute Card */}
            <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                className="relative overflow-hidden rounded-[2.5rem] border border-zinc-800/40 bg-zinc-900/10 backdrop-blur-xl p-8 sm:p-10 group min-h-[240px] flex flex-col justify-center font-[family-name:var(--font-outfit)]"
            >
                {/* Indian Flag Themed Background Images */}
                <div className="absolute inset-0 flex opacity-40 pointer-events-none overflow-hidden">
                    <div className="relative flex-1 h-full">
                        <img src="/3rd-DUl4iLCT (1).jpg" alt="" className="absolute inset-0 w-full h-full object-cover grayscale opacity-50" />
                        <div className="absolute inset-0 bg-[#FF9933] mix-blend-overlay opacity-90" />
                        <div className="absolute inset-0 bg-[#FF9933]/20" />
                    </div>
                    <div className="relative flex-1 h-full border-x border-white/10">
                        <img src="/1000201940-BTIBz6UW.jpg" alt="" className="absolute inset-0 w-full h-full object-cover grayscale opacity-50" />
                        <div className="absolute inset-0 bg-white mix-blend-overlay opacity-60" />
                        <div className="absolute inset-0 bg-white/10" />
                    </div>
                    <div className="relative flex-1 h-full">
                        <img src="/Birthday-2.avif" alt="" className="absolute inset-0 w-full h-full object-cover grayscale opacity-50" />
                        <div className="absolute inset-0 bg-[#138808] mix-blend-overlay opacity-90" />
                        <div className="absolute inset-0 bg-[#138808]/20" />
                    </div>
                </div>

                {/* Subtle Decorative Elements */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl -mr-16 -mt-16" />
                <div className="absolute bottom-0 left-0 w-32 h-32 bg-amber-500/5 rounded-full blur-3xl -ml-16 -mb-16" />

                <div className="relative grid grid-cols-1 md:grid-cols-3 items-center gap-6 md:gap-4 h-full">
                    {/* Orange Side: Foundation Info */}
                    <div className="flex flex-col items-center md:items-start">
                        <div className="flex items-center gap-2 mb-2">
                            <div className="px-3 py-1 rounded-full bg-zinc-950/80 border border-primary/50 text-[9px] font-black text-primary uppercase tracking-[0.2em] shadow-[0_0_15px_rgba(var(--primary),0.4)] backdrop-blur-md">
                                Est. 26 March 2023
                            </div>
                        </div>
                        <h2 className="text-xl sm:text-3xl font-black tracking-tight text-center md:text-left uppercase">
                            <span className="bg-gradient-to-br from-white via-zinc-400 to-zinc-600 bg-clip-text text-transparent">Foundation</span>{' '}
                            <span className="text-primary drop-shadow-[0_0_8px_rgba(var(--primary),0.5)]">Day</span>
                        </h2>
                    </div>

                    {/* White Side: Mission Statement */}
                    <div className="flex flex-col space-y-4 text-center">
                        <h3 className="text-sm sm:text-xl font-extrabold text-white tracking-tight leading-tight">
                            Founded with a dream to empower <span className="bg-gradient-to-r from-[#FF9933] via-[#FFFFFF] to-[#138808] bg-clip-text text-transparent drop-shadow-sm font-black tracking-widest px-1">BHARAT</span>
                        </h3>
                        <p className="text-[11px] sm:text-[15px] text-zinc-200 font-medium italic leading-relaxed">
                            "To our incredible team: You are the <span className="text-primary font-black">pillars</span> of this company and the heartbeat of our mission. Every day your passion turns our vision into reality. We are honored to build the future of our nation together with you."
                        </p>
                    </div>

                    {/* Green Side: Gratitude & Heart */}
                    <div className="flex flex-col items-center md:items-end gap-3">
                        <motion.div 
                            animate={{ scale: [1, 1.2, 1] }}
                            transition={{ repeat: Infinity, duration: 1.5 }}
                            className="w-12 h-12 rounded-2xl bg-zinc-950/80 border border-red-500/20 flex items-center justify-center shadow-[0_0_20px_rgba(239,68,68,0.2)] backdrop-blur-md mb-1"
                        >
                            <Heart size={24} className="text-red-500 fill-red-500/40" />
                        </motion.div>
                        <span className="text-[11px] font-black text-zinc-400 uppercase tracking-[0.2em] text-center md:text-right">With Love & Gratitude</span>
                    </div>
                </div>
            </motion.div>

            {searchQuery && (
                <div className="card p-4 space-y-3" data-testid="org-search-results">
                    <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest px-2">Search Results · click to locate in the chart</p>
                    <div className="flex flex-wrap gap-3">
                        {filteredNodes.length > 0 ? (
                            filteredNodes.map(p => (
                                <button key={p.id} onClick={() => reveal(p.id)} className="text-left rounded-2xl hover:opacity-90" data-testid="org-search-hit">
                                    <PersonCard p={p} />
                                </button>
                            ))
                        ) : (
                            <p className="text-xs text-zinc-600 italic px-2">No matching employees found.</p>
                        )}
                    </div>
                </div>
            )}

            <OrgCanvas>
                <OrgChart data={data} highlightId={highlightId} />
            </OrgCanvas>
        </div>
    );
}