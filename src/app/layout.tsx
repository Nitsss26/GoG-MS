// import type { Metadata } from "next";
// import { Inter } from "next/font/google";
// import "./globals.css";

// const inter = Inter({ subsets: ["latin"] });

// export const metadata: Metadata = {
//     title: "GoG OMS",
//     description: "Advanced Operations Management System with a modern UI",
//     icons: {
//         icon: "/favicon.ico",
//     },
// };

// import { AuthProvider } from "@/context/AuthContext";
// import SidebarWrapper from "@/components/SidebarWrapper";

// export default function RootLayout({
//     children,
// }: Readonly<{
//     children: React.ReactNode;
// }>) {
//     return (
//         <html lang="en" className="dark">
//             <body className={`${inter.className} min-h-screen bg-background text-foreground flex overflow-hidden`}>
//                 <AuthProvider>
//                     <SidebarWrapper children={children} />
//                 </AuthProvider>
//             </body>
//         </html>
//     );
// }


import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import SidebarWrapper from "@/components/SidebarWrapper";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
    title: "GoG OMS",
    description: "Advanced Operations Management System with a modern UI",
    icons: {
        icon: "/favicon.ico",
    },
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en" className="dark">
            <head>
                {/* --- THE ULTIMATE KILL SWITCH FOR THE 'N' ICON --- */}
                <style>{`
                    nextjs-portal, 
                    #nextjs-dev-overlay, 
                    #nextjs-build-indicator,
                    [data-nextjs-indicator],
                    [data-nextjs-toast] {
                        display: none !important;
                        visibility: hidden !important;
                        opacity: 0 !important;
                        pointer-events: none !important;
                    }
                `}</style>
            </head>
            <body className={`${inter.className} min-h-screen bg-background text-foreground flex overflow-hidden`}>
                <AuthProvider>
                    <SidebarWrapper>
                        {children}
                    </SidebarWrapper>
                </AuthProvider>
            </body>
        </html>
    );
}