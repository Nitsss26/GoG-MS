"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { 
    Download, FileText, Image as ImageIcon, Video, Mic, 
    Search, Filter, Loader2, HardDrive, Calendar, User, 
    MapPin, CheckCircle2, AlertCircle
} from "lucide-react";
import { cn } from "@/lib/utils";
import { downloadFile } from "@/lib/download-utils";

interface Asset {
    url: string;
    empId: string;
    name?: string;
    category: string;
    date: string;
    college?: string;
    fileName: string;
}

const CATEGORIES = [
    "All",
    "Profile Image",
    "Attendance",
    "Lecture Recording",
    "Lecture Photo",
    "Onboarding Doc",
    "Leave Proof",
    "Ticket Attachment",
    "Reimbursement Proof"
];

export default function AssetExportPage() {
    const { user } = useAuth();
    const [assets, setAssets] = useState<Asset[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState("All");
    const [searchQuery, setSearchQuery] = useState("");
    const [isDownloadingAll, setIsDownloadingAll] = useState(false);

    useEffect(() => {
        fetchAssets();
    }, []);

    const fetchAssets = async () => {
        try {
            const res = await fetch("/api/tech-lead/assets");
            const data = await res.json();
            if (data.success) {
                setAssets(data.assets);
            }
        } catch (error) {
            console.error("Failed to fetch assets:", error);
        } finally {
            setLoading(false);
        }
    };

    const filteredAssets = assets.filter(asset => {
        const matchesTab = activeTab === "All" || asset.category === activeTab;
        const matchesSearch = 
            asset.empId.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (asset.name && asset.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
            asset.fileName.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (asset.college && asset.college.toLowerCase().includes(searchQuery.toLowerCase()));
        return matchesTab && matchesSearch;
    });

    const handleDownload = async (asset: Asset) => {
        // Extract extension from URL
        const extension = asset.url.split('.').pop()?.split('?')[0] || 'jpg';
        await downloadFile(asset.url, `${asset.fileName}.${extension}`);
    };

    const handleDownloadAll = async () => {
        if (!confirm(`Are you sure you want to download ${filteredAssets.length} assets? This may take a while.`)) return;
        
        setIsDownloadingAll(true);
        for (const asset of filteredAssets) {
            await handleDownload(asset);
            // Small delay to prevent browser throttling
            await new Promise(r => setTimeout(r, 500));
        }
        setIsDownloadingAll(false);
    };

    if (user?.role !== "TL" && user?.role !== "FOUNDER") {
        return (
            <div className="flex items-center justify-center min-h-screen bg-[#0a0a0b] text-zinc-500">
                <AlertCircle className="mr-2" /> Access Restricted to Tech Lead
            </div>
        );
    }

    return (
        <div className="flex-1 bg-[#0a0a0b] p-8 overflow-y-auto custom-scrollbar">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
                <div className="space-y-2">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
                            <HardDrive className="text-primary" size={24} />
                        </div>
                        <div>
                            <h1 className="text-3xl font-black text-white tracking-tight italic uppercase">Asset Migration Hub</h1>
                            <p className="text-xs text-zinc-500 font-bold uppercase tracking-widest">Cloudinary to S3 Export Portal</p>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <div className="relative group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 group-focus-within:text-primary transition-colors" size={16} />
                        <input 
                            type="text" 
                            placeholder="Search by EmpID, Name, or College..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="bg-zinc-900/50 border border-zinc-800 text-white text-xs rounded-2xl pl-12 pr-6 py-3 w-72 focus:outline-none focus:border-primary/50 transition-all"
                        />
                    </div>
                    <button 
                        onClick={handleDownloadAll}
                        disabled={isDownloadingAll || filteredAssets.length === 0}
                        className="flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground text-[10px] font-black uppercase tracking-widest rounded-2xl hover:opacity-90 active:scale-95 transition-all disabled:opacity-50"
                    >
                        {isDownloadingAll ? <Loader2 className="animate-spin" size={14} /> : <Download size={14} />}
                        Export {filteredAssets.length} Assets
                    </button>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex items-center gap-2 mb-8 overflow-x-auto pb-4 custom-scrollbar no-scrollbar">
                {CATEGORIES.map(cat => (
                    <button
                        key={cat}
                        onClick={() => setActiveTab(cat)}
                        className={cn(
                            "px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all border",
                            activeTab === cat 
                                ? "bg-primary/10 border-primary/50 text-primary" 
                                : "bg-zinc-900/50 border-zinc-800 text-zinc-500 hover:text-white hover:border-zinc-700"
                        )}
                    >
                        {cat}
                    </button>
                ))}
            </div>

            {/* Asset Grid */}
            {loading ? (
                <div className="flex flex-col items-center justify-center py-32 text-zinc-600 gap-4">
                    <Loader2 className="animate-spin" size={48} />
                    <p className="text-xs font-bold uppercase tracking-[0.2em]">Aggregating Cloudinary Data...</p>
                </div>
            ) : filteredAssets.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-32 text-zinc-600 bg-zinc-900/20 border border-dashed border-zinc-800 rounded-[2rem]">
                    <HardDrive size={48} className="mb-4 opacity-20" />
                    <p className="text-xs font-bold uppercase tracking-[0.2em]">No assets found for this category</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {filteredAssets.map((asset, idx) => (
                        <div key={idx} className="group bg-zinc-900/40 border border-zinc-800/50 rounded-3xl p-5 hover:border-primary/30 transition-all">
                        <div className="relative group/preview mb-4">
                            <div className={cn(
                                "w-full h-32 rounded-2xl flex items-center justify-center overflow-hidden border border-white/5",
                                asset.category.includes("Recording") ? "bg-red-500/10" :
                                asset.category.includes("Image") || asset.category.includes("Photo") || asset.category.includes("Attendance") ? "bg-blue-500/10" :
                                "bg-emerald-500/10"
                            )}>
                                {(() => {
                                    const url = asset.url.toLowerCase();
                                    const ext = url.split('.').pop()?.split('?')[0] || "";
                                    
                                    const isImage = 
                                        ["jpg", "jpeg", "png", "webp", "gif", "svg"].includes(ext) ||
                                        (url.includes("cloudinary") && (url.includes("/image/upload") || url.includes("/image/authenticated")));
                                    
                                    const isVideo = ["mp4", "webm", "ogg"].includes(ext) || url.includes("/video/upload");
                                    const isAudio = ["mp3", "wav", "ogg"].includes(ext) || url.includes("/video/upload") && asset.category.includes("Recording");
                                    const isPdf = ext === "pdf" || url.includes(".pdf");

                                    if (isImage) {
                                        return <img src={asset.url} alt="" className="w-full h-full object-cover opacity-60 group-hover/preview:opacity-100 transition-opacity" />;
                                    } else if (isVideo) {
                                        return <Video className="text-blue-400 opacity-40" size={32} />;
                                    } else if (isAudio || asset.category.includes("Recording")) {
                                        return <Mic className="text-red-400 opacity-40" size={32} /> ;
                                    } else if (isPdf) {
                                        return <div className="flex flex-col items-center gap-2">
                                            <FileText className="text-emerald-400 opacity-40" size={32} />
                                            <span className="text-[8px] font-bold text-emerald-500/50 uppercase tracking-widest">PDF Document</span>
                                        </div>;
                                    } else {
                                        return <div className="flex flex-col items-center gap-2">
                                            <FileText className="text-zinc-500 opacity-40" size={32} />
                                            <span className="text-[8px] font-bold text-zinc-500/50 uppercase tracking-widest">File</span>
                                        </div>;
                                    }
                                })()}
                            </div>
                            
                            <button 
                                onClick={() => handleDownload(asset)}
                                className="absolute inset-0 m-auto w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-2xl opacity-0 group-hover:opacity-100 scale-50 group-hover:scale-100 transition-all duration-300"
                            >
                                <Download size={20} />
                            </button>
                        </div>

                        <div className="space-y-3">
                            <div>
                                <p className="text-[10px] font-black text-primary uppercase tracking-widest mb-1">{asset.category}</p>
                                <h3 className="text-xs font-bold text-white truncate max-w-full italic">{asset.fileName}</h3>
                            </div>

                            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/5">
                                <div className="flex items-center gap-1.5">
                                    <User size={10} className="text-zinc-500" />
                                    <span className="text-[9px] font-bold text-zinc-400">{asset.empId}</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <Calendar size={10} className="text-zinc-500" />
                                    <span className="text-[9px] font-bold text-zinc-400">{asset.date}</span>
                                </div>
                                {asset.college && (
                                    <div className="flex items-center gap-1.5 col-span-2">
                                        <MapPin size={10} className="text-zinc-500" />
                                        <span className="text-[9px] font-bold text-zinc-400 truncate">{asset.college}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                        </div>
                    ))}
                </div>
            )}
            
            {/* Footer Stats */}
            <div className="mt-12 p-8 bg-zinc-900/20 border border-zinc-800 rounded-[2.5rem] flex items-center justify-between">
                <div className="flex items-center gap-6">
                    <div className="flex flex-col">
                        <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Total Assets Scan</span>
                        <span className="text-xl font-black text-white italic">{assets.length} Files</span>
                    </div>
                    <div className="w-px h-10 bg-zinc-800" />
                    <div className="flex flex-col">
                        <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Mapped Status</span>
                        <div className="flex items-center gap-2">
                            <CheckCircle2 size={12} className="text-emerald-500" />
                            <span className="text-xs font-bold text-white uppercase italic">Ready for S3</span>
                        </div>
                    </div>
                </div>
                <p className="text-[9px] font-black text-zinc-600 uppercase tracking-[0.4em] italic">GoG Tech Ops Unit — Restricted Access</p>
            </div>
        </div>
    );
}
