import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
    title: "GoG HR-MS | Modern HR Management",
    description: "Advanced Human Resource Management System with a modern UI",
    icons: {
        icon: "/favicon.ico",
    },
};

import { AuthProvider } from "@/context/AuthContext";
import SidebarWrapper from "@/components/SidebarWrapper";

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en" className="dark">
            <body className={`${inter.className} min-h-screen bg-background text-foreground flex overflow-hidden`}>
                <AuthProvider>
                    <SidebarWrapper children={children} />
                </AuthProvider>
            </body>
        </html>
    );
}
