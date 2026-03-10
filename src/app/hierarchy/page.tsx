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
    Maximize2,
    Briefcase,
    GraduationCap,
    Users
} from "lucide-react";
import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

export default function HierarchyPage() {
    const { orgHierarchy } = useAuth();
    const [searchQuery, setSearchQuery] = useState("");
    const [zoomScale, setZoomScale] = useState(0.8);
    const containerRef = useRef<HTMLDivElement>(null);
    const [canvasPos, setCanvasPos] = useState({ x: 0, y: 0 });
    const dragControls = useRef(null);

    const recenter = () => {
        setCanvasPos({ x: 0, y: 0 });
        setZoomScale(0.8);
    };

    const cSuiteNodes = orgHierarchy.filter(node => node.level === "C-Suite");

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

            <div className="flex justify-center pt-8 overflow-hidden min-h-[600px] h-[80vh] pb-20 cursor-grab active:cursor-grabbing touch-none relative bg-zinc-950/50 rounded-3xl border border-zinc-900" ref={containerRef}>
                {/* Floating Canvas Controls */}
                <div className="fixed bottom-10 right-10 flex flex-col gap-2 z-[100]">
                    <button onClick={() => setZoomScale(s => Math.min(s + 0.1, 2))} className="w-10 h-10 bg-zinc-950/80 backdrop-blur border border-zinc-800 rounded-xl flex items-center justify-center text-zinc-400 hover:text-white hover:border-primary transition-all shadow-2xl" title="Zoom In">
                        <ZoomIn size={18} />
                    </button>
                    <button onClick={() => setZoomScale(s => Math.max(s - 0.1, 0.4))} className="w-10 h-10 bg-zinc-950/80 backdrop-blur border border-zinc-800 rounded-xl flex items-center justify-center text-zinc-400 hover:text-white hover:border-primary transition-all shadow-2xl" title="Zoom Out">
                        <ZoomOut size={18} />
                    </button>
                    <button onClick={recenter} className="w-10 h-10 bg-zinc-950/80 backdrop-blur border border-zinc-800 rounded-xl flex items-center justify-center text-zinc-400 hover:text-white hover:border-primary transition-all shadow-2xl" title="Recenter View">
                        <RotateCcw size={16} />
                    </button>
                </div>

                {cSuiteNodes.length > 0 && (
                    <motion.div
                        drag
                        dragMomentum={false}
                        initial={false}
                        animate={{ 
                            scale: zoomScale,
                            x: canvasPos.x,
                            y: canvasPos.y 
                        }}
                        onDragEnd={(e, info) => {
                            setCanvasPos(prev => ({
                                x: prev.x + info.offset.x,
                                y: prev.y + info.offset.y
                            }));
                        }}
                        className="flex flex-col items-center origin-top py-20 z-10"
                        style={{ width: "max-content" }}
                    >
                        <OrgTree node={cSuiteNodes[0]} allNodes={orgHierarchy} overrideRoot={cSuiteNodes} />
                    </motion.div>
                )}
            </div>
        </div>
    );
}

function OrgTree({ node, allNodes, overrideRoot }: { node: OrgNode, allNodes: OrgNode[], overrideRoot?: OrgNode[] }) {
    const children = allNodes.filter(n => n.parentId === node.id);
    const [isExpanded, setIsExpanded] = useState(true);

    // Special handling for the very top level (CEO, COO, CTO)
    if (overrideRoot && node.id === overrideRoot[0].id) {
        const leadershipNodes = allNodes.filter(n => n.level === "Management");
        const hoiNodes = allNodes.filter(n => n.level === "Leadership");
        
        // --- MATRIX AGGREGATION ---
        // All OMs and Faculty report to ALL HOIs now
        const sharedOMs = allNodes.filter(n => n.level === "OM");
        const sharedFaculty = allNodes.filter(n => n.level === "Faculty");

        return (
            <div className="flex flex-col items-center gap-12 relative">

                {/* Top Level Roots Container */}
                <div className="flex gap-4 relative">
                    {/* Horizontal Connector Line for Roots */}
                    {overrideRoot.length > 1 && (
                        <div className="absolute -bottom-8 left-0 right-0 h-0.5 bg-zinc-700/40"
                            style={{ width: `calc(100% - ${100 / overrideRoot.length}%)`, left: `${50 / overrideRoot.length}%` }} />
                    )}

                    {overrideRoot.map((root, i) => (
                        <div key={root.id} className="relative flex flex-col items-center">
                            <NodeCard node={root} hasChildren />
                            {/* Vertical Line Drop from Root to Connector */}
                            <div className="w-0.5 h-8 bg-zinc-700/40" />
                        </div>
                    ))}

                    {/* Master Vertical Line Dropping To Next Level */}
                    <div className="absolute -bottom-16 left-1/2 -translate-x-1/2 w-0.5 h-8 bg-zinc-700/40" />
                </div>

                <div className="h-8" /> {/* Spacer for lines */}

                {/* Horizontal line connecting all Leadership nodes */}
                {(leadershipNodes.length > 0) && (
                    <div className="relative flex gap-12 relative">
                        {leadershipNodes.length > 1 && (
                            <div className="absolute top-0 left-0 right-0 h-0.5 bg-zinc-700/40"
                                style={{ width: `calc(100% - ${100 / leadershipNodes.length}%)`, left: `${50 / leadershipNodes.length}%` }} />
                        )}

                        {leadershipNodes.map(ln => (
                            <div key={ln.id} className="relative flex flex-col items-center">
                                <div className="absolute -top-8 left-1/2 -translate-x-1/2 w-0.5 h-8 bg-zinc-700/40" />
                                <NodeCard node={ln} />
                                <div className="w-0.5 h-8 bg-zinc-700/40" />
                            </div>
                        ))}
                    </div>
                )}


                {/* THE MATRIX BRIDGE: Connecting all HOIs to a shared block */}
                {hoiNodes.length > 0 && (
                    <div className="flex flex-col items-center relative gap-8 pt-8">
                        {/* Horizontal Bridge Line Connecting all HOIs */}
                        <div className="absolute top-0 left-0 right-0 flex items-center justify-center">
                             <div className="h-0.5 bg-zinc-700/40" 
                                style={{ 
                                    width: `calc(100% - ${100 / hoiNodes.length}%)`, 
                                    left: `${50 / hoiNodes.length}%` 
                                }} />
                        </div>

                        {/* HOI Row */}
                        <div className="flex gap-8 items-center justify-center">
                            {hoiNodes.map(hn => (
                                <div key={hn.id} className="relative flex flex-col items-center">
                                    {/* Vertical line up to bridge/leadership */}
                                    <div className="absolute -top-8 left-1/2 -translate-x-1/2 w-0.5 h-8 bg-zinc-700/40" />
                                    <NodeCard node={hn} />
                                    {/* Vertical line down to Shared Matrix Bar */}
                                    <div className="w-0.5 h-8 bg-zinc-700/40" />
                                </div>
                            ))}
                        </div>

                        {/* SHARED MATRIX CONNECTOR BAR */}
                        <div className="relative w-full flex justify-center">
                            <div className="absolute top-0 left-0 right-0 h-0.5 bg-amber-500/20 shadow-[0_0_10px_rgba(245,158,11,0.1)]"
                                style={{ 
                                    width: `calc(100% - ${100 / hoiNodes.length}%)`, 
                                    left: `${50 / hoiNodes.length}%` 
                                }} />
                            {/* Master central drop from bridge to reportees */}
                            <div className="w-0.5 h-8 bg-amber-500/30 shadow-[0_0_10px_rgba(245,158,11,0.2)]" />
                        </div>

                        {/* THE SHARED REPORTEES BLOCK (Centered & Symmetric) */}
                        <div className="flex lg:flex-row flex-col gap-8 items-start relative pb-20">
                            {/* Operation Managers Group */}
                            {sharedOMs.length > 0 && (
                                <div className="relative border border-indigo-500/20 bg-indigo-500/5 rounded-2xl p-4 pt-8 flex flex-col items-center shadow-[0_10px_40px_rgba(79,70,229,0.05)]">
                                    <div className="absolute -top-8 left-1/2 -translate-x-1/2 w-0.5 h-8 bg-zinc-700/40" />
                                    <div className="absolute -top-3 px-3 py-1 bg-zinc-950 border border-indigo-500/30 text-indigo-400 text-[8px] font-black uppercase tracking-widest rounded-full shadow-lg z-20">Operation Managers</div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        {sharedOMs.map(child => (
                                            <div key={child.id} className="relative">
                                                <NodeCard node={child} />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Faculty Group */}
                            {sharedFaculty.length > 0 && (
                                <div className="relative border border-rose-500/20 bg-rose-500/5 rounded-2xl p-4 pt-8 flex flex-col items-center shadow-[0_10px_40px_rgba(244,63,94,0.05)]">
                                    <div className="absolute -top-8 left-1/2 -translate-x-1/2 w-0.5 h-8 bg-zinc-700/40" />
                                    <div className="absolute -top-3 px-3 py-1 bg-zinc-950 border border-rose-500/30 text-rose-400 text-[8px] font-black uppercase tracking-widest rounded-full shadow-lg z-20">Professors & Faculty</div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                                        {sharedFaculty.map(child => (
                                            <div key={child.id} className="relative">
                                                <NodeCard node={child} />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        );
    }

    // If it's a leaf node that was already aggregated, return null.
    // Otherwise, this should not be reached in the new Matrix structure.
    return null;
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
        "Management": "from-blue-400/30 to-blue-600/30 border-blue-500/40 text-blue-400",
        "Leadership": "from-emerald-400/30 to-emerald-600/30 border-emerald-500/40 text-emerald-400",
        "OM": "from-indigo-400/30 to-indigo-600/30 border-indigo-500/40 text-indigo-400",
        "Faculty": "from-rose-400/30 to-pink-600/30 border-rose-500/40 text-rose-400"
    };

    const levelIcon = {
        "C-Suite": <Star size={10} />,
        "Management": <Shield size={10} />,
        "Leadership": <Briefcase size={10} />,
        "OM": <Network size={10} />,
        "Faculty": <GraduationCap size={10} />
    };

    return (
        <motion.div
            layout
            className={cn(
                "group relative bg-zinc-950 border rounded-xl transition-all shadow-xl hover:shadow-primary/5 min-w-[210px]",
                isCompact ? "p-2 border-zinc-800" : "p-3 border-zinc-800/80 hover:border-primary/50",
                node.level === "C-Suite" ? "animate-pulse-slow border-amber-500/40 shadow-[0_0_20px_rgba(245,158,11,0.1)]" : ""
            )}
        >
            <div className={cn(
                "absolute inset-0 bg-gradient-to-br opacity-5 rounded-xl",
                colors[node.level]
            )} />

            <div className="relative flex items-center gap-2">
                <div className={cn(
                    "w-8 h-8 rounded-lg flex items-center justify-center font-bold text-base border",
                    node.level === "C-Suite" ? "bg-amber-500/10 border-amber-500/20 text-amber-500" : "bg-zinc-900 border-zinc-800 text-primary"
                )}>
                    {node.photoInitial}
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1 break-all">
                        <h3 className="text-[10px] font-bold text-white uppercase tracking-tight line-clamp-1">{node.name}</h3>
                        {/* Mock PIP Indicator */}
                        {node.dept === "Sales" && node.level === "Faculty" && (
                            <span className="w-1 h-1 rounded-full bg-red-500 shadow-[0_0_5px_rgba(239,68,68,0.5)] animate-pulse" title="Under Performance Improvement Plan (PIP)" />
                        )}
                    </div>
                    <p className="text-[9px] text-zinc-400 font-medium truncate">{node.designation}</p>
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
