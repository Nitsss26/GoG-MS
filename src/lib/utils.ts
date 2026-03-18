import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}
export function getDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
    const R = 6371; // Radius of Earth in KM
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

export function resolveImageUrl(url?: string): string {
    if (!url) return "";
    if (url.includes("drive.google.com")) {
        // Extract ID from various Google Drive URL formats
        const idMatch = url.match(/id=([^&]+)/) || url.match(/\/d\/([^/]+)/);
        if (idMatch && idMatch[1]) {
            return `https://docs.google.com/uc?export=view&id=${idMatch[1]}`;
        }
    }
    return url;
}
