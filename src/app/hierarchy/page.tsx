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
            (n.name?.toLowerCase() || "").includes(searchQuery.toLowerCase()) ||
            (n.designation?.toLowerCase() || "").includes(searchQuery.toLowerCase())
        )
        : [];

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
                className="relative overflow-hidden rounded-[2rem] border border-zinc-800/40 bg-zinc-900/10 backdrop-blur-xl p-6 sm:p-8 group"
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

                <div className="relative flex flex-col md:flex-row items-center gap-6 md:gap-10">
                    <div className="flex flex-col items-center md:items-start shrink-0">
                        <div className="flex items-center gap-2 mb-2">
                            <div className="px-3 py-1 rounded-full bg-zinc-950/80 border border-primary/50 text-[9px] font-black text-primary uppercase tracking-[0.2em] shadow-[0_0_15px_rgba(var(--primary),0.4)] backdrop-blur-md">
                                Est. 26 March 2023
                            </div>
                        </div>
                        <h2 className="text-xl sm:text-2xl font-black tracking-tight text-center md:text-left uppercase">
                            <span className="bg-gradient-to-br from-white via-zinc-400 to-zinc-600 bg-clip-text text-transparent">Foundation</span>{' '}
                            <span className="text-primary drop-shadow-[0_0_8px_rgba(var(--primary),0.5)]">Day</span>
                        </h2>
                    </div>

                    <div className="hidden md:block h-12 w-px bg-zinc-800/60" />

                    <div className="flex-1 space-y-3 text-center md:text-left">
                        <h3 className="text-sm sm:text-lg font-bold text-white tracking-tight">
                            Founded with a dream to empower <span className="bg-gradient-to-r from-[#FF9933] via-[#FFFFFF] to-[#138808] bg-clip-text text-transparent drop-shadow-sm font-black tracking-widest px-1">BHARAT</span>
                        </h3>
                        <p className="text-[11px] sm:text-sm text-zinc-400 font-medium italic leading-relaxed max-w-3xl">
                            "To our incredible team: You are the <span className="text-zinc-200">pillars</span> of this company and the heartbeat of our mission. Every day your passion turns our vision into reality. We are honored to build the future of our nation together with you."
                        </p>
                    </div>

                    <div className="shrink-0 flex flex-col items-center md:items-end gap-1.5">
                        <div className="flex -space-x-1.5">
                            {[1, 2, 3, 4, 5].map(i => (
                                <motion.div 
                                    key={i} 
                                    initial={{ scale: 0.8 }}
                                    animate={{ scale: 1 }}
                                    transition={{ delay: i * 0.1, repeat: Infinity, repeatType: 'reverse', duration: 2 }}
                                    className="w-6 h-6 rounded-full border border-zinc-800 bg-zinc-950 flex items-center justify-center shadow-lg"
                                >
                                    <Star size={10} className="text-amber-500 fill-amber-500/40" />
                                </motion.div>
                            ))}
                        </div>
                        <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">With Love & Gratitude</span>
                    </div>
                </div>
            </motion.div>

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

            <div className="flex justify-center pt-8 sm:pt-12 overflow-hidden min-h-[500px] h-[75vh] sm:h-[80vh] pb-20 cursor-grab active:cursor-grabbing touch-none relative bg-zinc-950/30 sm:rounded-3xl border-y sm:border border-zinc-900 -mx-4 sm:mx-0" ref={containerRef}>
                {/* Floating Canvas Controls */}
                <div className="fixed bottom-6 right-6 sm:bottom-10 sm:right-10 flex flex-col gap-2 z-[100]">
                    <button onClick={() => setZoomScale(s => Math.min(s + 0.1, 2))} className="w-9 h-9 sm:w-10 sm:h-10 bg-zinc-900/90 backdrop-blur border border-zinc-800 rounded-xl flex items-center justify-center text-zinc-400 hover:text-white hover:border-primary transition-all shadow-2xl" title="Zoom In">
                        <ZoomIn size={16} />
                    </button>
                    <button onClick={() => setZoomScale(s => Math.max(s - 0.1, 0.4))} className="w-9 h-9 sm:w-10 sm:h-10 bg-zinc-900/90 backdrop-blur border border-zinc-800 rounded-xl flex items-center justify-center text-zinc-400 hover:text-white hover:border-primary transition-all shadow-2xl" title="Zoom Out">
                        <ZoomOut size={16} />
                    </button>
                    <button onClick={recenter} className="w-9 h-9 sm:w-10 sm:h-10 bg-zinc-900/90 backdrop-blur border border-zinc-800 rounded-xl flex items-center justify-center text-zinc-400 hover:text-white hover:border-primary transition-all shadow-2xl" title="Recenter View">
                        <RotateCcw size={14} />
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
            <div className="flex flex-col items-center gap-8 sm:gap-16 relative">

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
                            <div className="w-[3px] h-8 bg-zinc-500/60" />
                        </div>
                    ))}

                    {/* Master Vertical Line Dropping To Next Level */}
                    <div className="absolute -bottom-16 left-1/2 -translate-x-[1.5px] w-[3px] h-8 bg-zinc-500/60" />
                </div>

                <div className="h-8" /> {/* Spacer for lines */}

                {/* Horizontal line connecting all Leadership nodes */}
                {(leadershipNodes.length > 0) && (
                    <div className="relative flex flex-row gap-6 sm:gap-12 relative">
                        {leadershipNodes.map((ln, i) => (
                            <div key={ln.id} className="relative flex flex-col items-center">
                                {/* Horizontal Line segments for Leadership */}
                                {leadershipNodes.length > 1 && (
                                    <>
                                        {i !== 0 && <div className="absolute top-[-32px] sm:top-[-48px] left-0 w-1/2 h-[3px] bg-zinc-500/60" />}
                                        {i !== leadershipNodes.length - 1 && <div className="absolute top-[-32px] sm:top-[-48px] right-0 w-1/2 h-[3px] bg-zinc-500/60" />}
                                    </>
                                )}
                                <div className="absolute -top-8 sm:-top-12 left-1/2 -translate-x-[1.5px] w-[3px] h-8 sm:h-12 bg-zinc-500/60" />
                                <NodeCard node={ln} />
                                <div className="w-[3px] h-6 sm:h-10 bg-zinc-500/60" />
                            </div>
                        ))}
                    </div>
                )}


                {/* HOI Layer and their specific reportees */}
                {hoiNodes.length > 0 && (
                    <div className="flex flex-row gap-8 sm:gap-16 items-start justify-center pt-8 relative">
                        {hoiNodes.map((hn, i) => {
                            const myOMs = allNodes.filter(n => n.parentId === hn.id && n.level === "OM");
                            const myFaculty = allNodes.filter(n => n.parentId === hn.id && n.level === "Faculty");

                            return (
                                <div key={hn.id} className="relative flex flex-col items-center gap-8">
                                    {/* Horizontal Line segments for HOIs */}
                                    {hoiNodes.length > 1 && (
                                        <>
                                            {i !== 0 && <div className="absolute top-[-32px] left-0 w-1/2 h-[3px] bg-zinc-500/60" />}
                                            {i !== hoiNodes.length - 1 && <div className="absolute top-[-32px] right-0 w-1/2 h-[3px] bg-zinc-500/60" />}
                                        </>
                                    )}
                                    {/* Vertical line up to top level bridge */}
                                    <div className="absolute -top-8 left-1/2 -translate-x-[1.5px] w-[3px] h-8 bg-zinc-500/60" />

                                    <div className="flex flex-col items-center group relative pt-4">
                                        <NodeCard node={hn} />
                                        {(myOMs.length > 0 || myFaculty.length > 0) && (
                                            <div className="w-[3px] h-10 bg-amber-500/40 shadow-[0_0_10px_rgba(245,158,11,0.2)]" />
                                        )}
                                    </div>

                                    {/* Specific Reportees for this HOI */}
                                    {(myOMs.length > 0 || myFaculty.length > 0) && (
                                        <div className="flex flex-col gap-6 items-center relative">
                                            {/* Sub-bridge for this HOI's groups */}
                                            {myOMs.length > 0 && myFaculty.length > 0 && (
                                                <div className="absolute top-0 left-1/4 right-1/4 h-[2px] bg-amber-500/30" />
                                            )}

                                            <div className="flex flex-row gap-6 items-start">
                                                {/* Operation Managers Group for this HOI */}
                                                {myOMs.length > 0 && (
                                                    <div className="relative border border-indigo-500/20 bg-indigo-500/5 rounded-2xl p-2.5 sm:p-4 pt-8 flex flex-col items-center shadow-xl w-max min-w-[140px]">
                                                        <div className="absolute -top-2 px-2 py-0.5 bg-zinc-950 border border-indigo-500/30 text-indigo-400 text-[7px] sm:text-[8px] font-black uppercase tracking-widest rounded-lg z-20 whitespace-nowrap">OMs</div>
                                                        <div className={cn(
                                                            "grid gap-1.5 sm:gap-2",
                                                            myOMs.length > 3 ? "grid-cols-2" : "grid-cols-1"
                                                        )}>
                                                            {myOMs.map(child => (
                                                                <NodeCard key={child.id} node={child} isCompact />
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Faculty Group for this HOI */}
                                                {myFaculty.length > 0 && (
                                                    <div className="relative border border-rose-500/20 bg-rose-500/5 rounded-2xl p-2.5 sm:p-4 pt-8 flex flex-col items-center shadow-xl w-max min-w-[140px]">
                                                        <div className="absolute -top-2 px-2 py-0.5 bg-zinc-950 border border-rose-500/30 text-rose-400 text-[7px] sm:text-[8px] font-black uppercase tracking-widest rounded-lg z-20 whitespace-nowrap">Faculty</div>
                                                        <div className={cn(
                                                            "grid gap-1.5 sm:gap-2",
                                                            myFaculty.length > 4 ? "grid-cols-2 lg:grid-cols-3" : (myFaculty.length > 2 ? "grid-cols-2" : "grid-cols-1")
                                                        )}>
                                                            {myFaculty.map(child => (
                                                                <NodeCard key={child.id} node={child} isCompact />
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
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
        "Leadership": "from-purple-400/30 to-purple-600/30 border-purple-500/40 text-purple-400",
        "GrowthManager": "from-orange-400/40 to-orange-600/40 border-orange-500/60 text-orange-400 shadow-[0_0_20px_rgba(249,115,22,0.4)]",
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
                "group relative bg-zinc-950 border rounded-xl transition-all shadow-xl hover:shadow-primary/5 min-w-[130px] sm:min-w-[210px]",
                isCompact ? "p-1 sm:p-2 border-zinc-800" : "p-2 sm:p-3 border-zinc-800/80 hover:border-primary/50",
                node.level === "C-Suite" ? "animate-[pulse_3s_infinite] border-amber-500/60 shadow-[0_0_30px_rgba(245,158,11,0.6)] ring-1 ring-amber-500/30" :
                    node.designation === "Growth Manager" ? "border-orange-500/60 shadow-[0_0_30px_rgba(249,115,22,0.6)] ring-1 ring-orange-500/30 font-black" :
                        node.level === "Management" ? "border-blue-500/50 shadow-[0_0_30px_rgba(59,130,246,0.6)] ring-1 ring-blue-500/20" :
                            node.level === "Leadership" ? "border-purple-500/50 shadow-[0_0_30px_rgba(139,92,246,0.6)] ring-1 ring-purple-500/20" : ""
            )}
        >
            <div className={cn(
                "absolute inset-0 bg-gradient-to-br opacity-5 rounded-xl",
                node.designation === "Growth Manager" ? colors["GrowthManager"] : colors[node.level]
            )} />

            <div className="relative flex items-center gap-1.5 sm:gap-2">
                <div className={cn(
                    "w-6 h-6 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center font-bold text-xs sm:text-base border shrink-0",
                    node.level === "C-Suite" ? "bg-amber-500/10 border-amber-500/20 text-amber-500" : "bg-zinc-900 border-zinc-800 text-primary"
                )}>
                    {node.photoInitial}
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1 break-all">
                        <h3 className="text-[8px] sm:text-[10px] font-black text-white uppercase tracking-wider line-clamp-1" style={{ wordSpacing: '0.25em' }}>{node?.name || "Unknown"}</h3>
                        {/* Mock PIP Indicator */}
                        {node?.dept === "Sales" && node?.level === "Faculty" && (
                            <span className="w-1 h-1 rounded-full bg-red-500 shadow-[0_0_5px_rgba(239,68,68,0.5)] animate-pulse" title="Under Performance Improvement Plan (PIP)" />
                        )}
                    </div>
                    <p className="text-[7px] sm:text-[9px] text-zinc-500 font-bold truncate tracking-wide">{node?.designation || "No Designation"}</p>
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

            <div className="mt-2 sm:mt-3 flex items-center justify-between">
                <div className={cn(
                    "flex items-center gap-1 text-[7px] sm:text-[8px] font-black uppercase tracking-[0.1em] sm:tracking-[0.2em] px-1.5 sm:px-2 py-0.5 rounded-full border",
                    node.designation === "Growth Manager" ? colors["GrowthManager"] : (node?.level ? colors[node.level] : "text-zinc-500 border-zinc-700")
                )}>
                    {node.designation === "Growth Manager" ? <Star size={10} /> : (node?.level ? levelIcon[node.level] : <User size={10} />)}
                    <span className="truncate max-w-[40px] sm:max-w-none">{node.designation === "Growth Manager" ? "Growth" : (node?.level || "N/A")}</span>
                </div>
                <div className="text-[7px] sm:text-[9px] text-zinc-700 font-bold uppercase tracking-tight sm:tracking-widest">
                    {(node.level === "Management" || node.level === "Leadership") ? "" : (node?.dept || "")}
                </div>
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
