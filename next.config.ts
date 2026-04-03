import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    /* config options here */
    serverExternalPackages: ["@ffmpeg-installer/ffmpeg", "fluent-ffmpeg"]
};

export default nextConfig;