"use client";

import { useAuth, OrgNode } from "@/context/AuthContext";
import {
    Search,
    ChevronDown,
    ChevronRight,
    User,
    Building2,
    Network,
    MoreHorizontal,
    Star,
    Shield,
    ZoomIn,
    ZoomOut,
    RotateCcw,
    Maximize2
} from "lucide-react";
import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

export default function HierarchyPage() {
    const { orgHierarchy } = useAuth();
    const [searchQuery, setSearchQuery] = useState("");
    const [zoomScale, setZoomScale] = useState(1);
    const containerRef = useRef<HTMLDivElement>(null);

    const rootNode = orgHierarchy.find(node => !node.parentId);

    const filteredNodes = searchQuery
        ? orgHierarchy.filter(n =>
            n.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            n.designation.toLowerCase().includes(searchQuery.toLowerCase())
        )
        : [];

    return (
        <div className="p-8 space-y-8 w-full min-h-screen">
            <header className="flex justify-between items-end">
                <div>
                    <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
                        <Network className="text-primary" size={24} />
                        Organizational Hierarchy
                    </h1>
                    <p className="text-sm text-zinc-400 mt-1 italic">Institutional Reporting Tree & Vector Registry</p>
                </div>
                <div className="relative w-72">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={14} />
                    <input
                        type="text"
                        placeholder="Search Profile or Node..."
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-2.5 pl-10 pr-4 text-xs text-white outline-none focus:border-primary/50 transition-all font-medium"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
            </header>

            {searchQuery && (
                <div className="card p-4 space-y-3">
                    <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest px-2">Search Results</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {filteredNodes.length > 0 ? (
                            filteredNodes.map(node => (
                                <NodeCard key={node.id} node={node} isCompact />
                            ))
                        ) : (
                            <p className="text-xs text-zinc-600 italic px-2">No matching nodes found in the registry.</p>
                        )}
                    </div>
                </div>
            )}

            <div className="flex justify-center pt-8 overflow-auto min-h-[600px] pb-20 custom-scrollbar relative bg-zinc-950/50 rounded-3xl border border-zinc-900" ref={containerRef}>
                {/* Floating Zoom Controls */}
                <div className="fixed bottom-10 right-10 flex flex-col gap-2 z-[100]">
                    <button onClick={() => setZoomScale(s => Math.min(s + 0.1, 2))} className="w-10 h-10 bg-zinc-900 border border-zinc-800 rounded-xl flex items-center justify-center text-zinc-400 hover:text-white hover:border-primary transition-all shadow-2xl">
                        <ZoomIn size={18} />
                    </button>
                    <button onClick={() => setZoomScale(s => Math.max(s - 0.1, 0.4))} className="w-10 h-10 bg-zinc-900 border border-zinc-800 rounded-xl flex items-center justify-center text-zinc-400 hover:text-white hover:border-primary transition-all shadow-2xl">
                        <ZoomOut size={18} />
                    </button>
                    <button onClick={() => setZoomScale(1)} className="w-10 h-10 bg-zinc-900 border border-zinc-800 rounded-xl flex items-center justify-center text-zinc-400 hover:text-white hover:border-primary transition-all shadow-2xl">
                        <RotateCcw size={16} />
                    </button>
                </div>

                {rootNode && (
                    <motion.div
                        initial={false}
                        animate={{ scale: zoomScale }}
                        className="flex flex-col items-center origin-top py-20"
                        style={{ width: "max-content", paddingLeft: "100px", paddingRight: "100px" }}
                    >
                        <OrgTree node={rootNode} allNodes={orgHierarchy} />
                    </motion.div>
                )}
            </div>
        </div>
    );
}

function OrgTree({ node, allNodes }: { node: OrgNode, allNodes: OrgNode[] }) {
    const children = allNodes.filter(n => n.parentId === node.id);
    const [isExpanded, setIsExpanded] = useState(true);

    // Special handling for Shared Leadership Matrix (C-Suite -> Leadership -> HOIs)
    if (node.level === "C-Suite") {
        const leadershipNodes = allNodes.filter(n => n.level === "Leadership");
        const hoiNodes = allNodes.filter(n => n.level === "HOI");

        return (
            <div className="flex flex-col items-center gap-16 relative">
                <NodeCard node={node} hasChildren />

                {/* Vertical line from CEO */}
                <div className="w-0.5 h-16 bg-zinc-700/50" />

                {/* Horizontal line connecting all Leadership nodes */}
                <div className="relative flex gap-32 pt-16 -mt-16">
                    <div className="absolute top-0 left-0 right-0 h-0.5 bg-zinc-700/50"
                        style={{ width: `calc(100% - ${100 / leadershipNodes.length}%)`, left: `${50 / leadershipNodes.length}%` }} />

                    {leadershipNodes.map(ln => (
                        <div key={ln.id} className="relative flex flex-col items-center">
                            {/* Vertical line from shared CEO bar to this leader */}
                            <div className="absolute -top-16 left-1/2 -translate-x-1/2 w-0.5 h-16 bg-zinc-700/50" />
                            <NodeCard node={ln} />
                            {/* Vertical line from leader to the shared HOI matrix bar */}
                            <div className="w-0.5 h-16 bg-zinc-700/50" />
                        </div>
                    ))}
                </div>

                {/* THE MATRIX BRIDGE: A shared horizontal bar for all HOIs */}
                <div className="relative -mt-16 pt-16 flex gap-32">
                    <div className="absolute top-0 left-0 right-0 h-0.5 bg-zinc-700/50"
                        style={{ width: `calc(100% - ${100 / hoiNodes.length}%)`, left: `${50 / hoiNodes.length}%` }} />

                    {hoiNodes.map(hn => (
                        <div key={hn.id} className="relative">
                            <div className="absolute -top-16 left-1/2 -translate-x-1/2 w-0.5 h-16 bg-zinc-700/50" />
                            <OrgTree node={hn} allNodes={allNodes} />
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    // Default recursive rendering for HOI -> OM -> Faculty
    return (
        <div className="flex flex-col items-center gap-12 relative">
            <div className="relative">
                <NodeCard node={node} hasChildren={children.length > 0} isExpanded={isExpanded} onToggle={() => setIsExpanded(!isExpanded)} />

                {isExpanded && children.length > 0 && (
                    <div className="absolute left-1/2 -bottom-12 w-0.5 h-12 bg-zinc-700/50" />
                )}
            </div>

            {isExpanded && children.length > 0 && (
                <div className="flex gap-24 relative pt-12">
                    {/* Horizontal Connector Line */}
                    {children.length > 1 && (
                        <div className="absolute top-0 left-0 right-0 flex justify-center">
                            <div className="h-0.5 bg-zinc-700/50" style={{
                                width: `calc(100% - ${100 / children.length}%)`,
                                left: `${50 / children.length}%`
                            }} />
                        </div>
                    )}

                    {children.map((child, index) => (
                        <div key={child.id} className="relative">
                            {/* Vertical line to child */}
                            <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-0.5 h-12 bg-zinc-700/50" />
                            <OrgTree node={child} allNodes={allNodes} />
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

function NodeCard({ node, isCompact, hasChildren, isExpanded, onToggle }: {
    node: OrgNode,
    isCompact?: boolean,
    hasChildren?: boolean,
    isExpanded?: boolean,
    onToggle?: () => void
}) {
    const colors = {
        "C-Suite": "from-amber-400/30 to-amber-600/30 border-amber-500/40 text-amber-500",
        "Leadership": "from-blue-400/30 to-blue-600/30 border-blue-500/40 text-blue-400",
        "HOI": "from-emerald-400/30 to-emerald-600/30 border-emerald-500/40 text-emerald-400",
        "OM": "from-indigo-400/30 to-indigo-600/30 border-indigo-500/40 text-indigo-400",
        "Faculty": "from-rose-400/30 to-pink-600/30 border-rose-500/40 text-rose-400"
    };

    const levelIcon = {
        "C-Suite": <Star size={10} />,
        "Leadership": <Shield size={10} />,
        "HOI": <Building2 size={10} />,
        "OM": <Network size={10} />,
        "Faculty": <User size={10} />
    };

    return (
        <motion.div
            layout
            className={cn(
                "group relative bg-zinc-950 border rounded-2xl transition-all shadow-xl hover:shadow-primary/5 min-w-[260px]",
                isCompact ? "p-3 border-zinc-800" : "p-5 border-zinc-800/80 hover:border-primary/50",
                node.level === "C-Suite" ? "animate-pulse-slow border-amber-500/40 shadow-[0_0_30px_rgba(245,158,11,0.1)]" : ""
            )}
        >
            <div className={cn(
                "absolute inset-0 bg-gradient-to-br opacity-5 rounded-2xl",
                colors[node.level]
            )} />

            <div className="relative flex items-center gap-3">
                <div className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center font-bold text-lg border",
                    node.level === "C-Suite" ? "bg-amber-500/10 border-amber-500/20 text-amber-500" : "bg-zinc-900 border-zinc-800 text-primary"
                )}>
                    {node.photoInitial}
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 break-all">
                        <h3 className="text-xs font-bold text-white uppercase tracking-tight line-clamp-1">{node.name}</h3>
                        {/* Mock PIP Indicator */}
                        {node.dept === "Sales" && node.level === "Faculty" && (
                            <span className="w-1.5 h-1.5 rounded-full bg-red-500 shadow-[0_0_5px_rgba(239,68,68,0.5)] animate-pulse" title="Under Performance Improvement Plan (PIP)" />
                        )}
                    </div>
                    <p className="text-[10px] text-zinc-400 font-medium truncate">{node.designation}</p>
                </div>

                {/* Action Menu for Admin/HR */}
                {typeof window !== 'undefined' && (localStorage.getItem('currentUser') && JSON.parse(localStorage.getItem('currentUser')!).role === 'Admin') && node.level !== "C-Suite" && (
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute right-2 top-2 flex flex-col gap-1">
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                const reason = prompt(`Initiate PIP for ${node.name}. Enter reason:`);
                                if (reason) {
                                    alert(`${node.name} has been enrolled in PIP for: ${reason}`);
                                }
                            }}
                            className="bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 p-1 rounded transition-colors"
                            title="Initiate PIP Protocol"
                        >
                            <Shield size={10} />
                        </button>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                const confirm = window.confirm(`Initiate Promotion Workflow for ${node.name}? This will escalate their rank in the hierarchy cluster.`);
                                if (confirm) {
                                    alert(`${node.name}'s promotion workflow initiated. HR pending formal sign-off.`);
                                }
                            }}
                            className="bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 p-1 rounded transition-colors"
                            title="Promote Role Segment"
                        >
                            <User size={10} />
                        </button>
                    </div>
                )}
            </div>

            <div className="mt-3 flex items-center justify-between">
                <div className={cn(
                    "flex items-center gap-1 text-[8px] font-black uppercase tracking-[0.2em] px-2 py-0.5 rounded-full border",
                    colors[node.level]
                )}>
                    {levelIcon[node.level]}
                    {node.level}
                </div>
                <div className="text-[9px] text-zinc-600 font-bold uppercase tracking-widest">{node.dept}</div>
            </div>

            {hasChildren && onToggle && (
                <button
                    onClick={onToggle}
                    className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-500 hover:text-white hover:border-primary transition-all z-20"
                >
                    {isExpanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
                </button>
            )}
        </motion.div>
    );
}
