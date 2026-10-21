import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    /* config options here */
    serverExternalPackages: ["@ffmpeg-installer/ffmpeg", "fluent-ffmpeg"],
    images: {
        remotePatterns: [
            {
                protocol: 'https',
                hostname: 'gog-oms.s3.ap-south-1.amazonaws.com',
                port: '',
                pathname: '/**',
            },
            {
                protocol: 'https',
                hostname: 'gog-oms.s3.amazonaws.com',
                port: '',
                pathname: '/**',
            }
        ],
    }
};

export default nextConfig;