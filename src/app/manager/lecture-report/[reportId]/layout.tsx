import { Inter, Outfit } from "next/font/google";

const inter = Inter({ subsets: ["latin"] });
const outfit = Outfit({ 
    weight: ["300", "400", "500", "600", "700", "800", "900"],
    subsets: ["latin"],
    variable: '--font-outfit',
});

export default function LQRLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <div className={`${inter.className} ${outfit.variable} min-h-screen bg-white text-zinc-900 overflow-y-auto selection:bg-indigo-100 selection:text-indigo-900`}>
            {/* Override any global dark theme styles */}
            <style dangerouslySetInnerHTML={{ __html: `
                html, body { 
                    background-color: white !important; 
                    color: #18181b !important;
                    height: auto !important;
                    overflow: auto !important;
                }
                .dark {
                    background-color: white !important;
                    color: #18181b !important;
                }
                ::-webkit-scrollbar { width: 8px; }
                ::-webkit-scrollbar-track { background: #f4f4f5; }
                ::-webkit-scrollbar-thumb { background: #d4d4d8; border-radius: 4px; }
                ::-webkit-scrollbar-thumb:hover { background: #a1a1aa; }
            `}} />
            <div className="max-w-[1000px] mx-auto min-h-screen shadow-[0_0_50px_rgba(0,0,0,0.05)] bg-white">
                {children}
            </div>
        </div>
    );
}
