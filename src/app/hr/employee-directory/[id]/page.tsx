"use client";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ShieldAlert } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import EmployeeSheet from "@/components/directory/EmployeeSheet";

/**
 * HR / HR Executive → Employee Directory → View: the employee's complete profile on its own page
 * (same content as before: profile A–H, documents, attendance, HR edit, profile photo, Excel / PDF).
 */
export default function EmployeeDirectoryProfilePage() {
    const { user } = useAuth();
    const router = useRouter();
    const params = useParams<{ id: string }>();
    const id = decodeURIComponent(String(params?.id || ""));
    const allowed = !!user && (user.role === "HR" || user.role === "FOUNDER");
    if (!user) return null;
    if (!allowed) {
        return (
            <div className="h-[70vh] flex flex-col items-center justify-center space-y-4 p-6 text-center">
                <div className="w-16 h-16 bg-amber-500/10 rounded-full flex items-center justify-center text-amber-500"><ShieldAlert size={32} /></div>
                <div className="max-w-xs space-y-2">
                    <h2 className="text-base font-bold text-white">Restricted</h2>
                    <p className="text-xs text-zinc-400">The Employee Directory is available to HR and HR Executive only.</p>
                </div>
                <Link href="/" className="btn-primary py-2.5 px-6 text-xs">Return to Dashboard</Link>
            </div>
        );
    }
    const back = () => (window.history.length > 1 ? router.back() : router.push("/hr/employee-directory"));
    return (
        <div className="p-3 sm:p-6 w-full min-w-0 [contain:inline-size]" data-testid="emp-profile-page">
            <EmployeeSheet asPage employeeId={id} onClose={back} />
        </div>
    );
}