import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    devIndicators: {
        appIsrStatus: false,
        buildActivity: false, // Hides the "N" build pulse
        // @ts-ignore - Some versions use this for the bottom-right overlay
        overlay: false,
    },
    /* config options here */
};

export default nextConfig;