// Cloudinary Upload Utility — Unsigned upload with preset GOG-MS
const CLOUD_NAME = "dwaepohvf";
const UPLOAD_PRESET = "GOG-MS";
const UPLOAD_URL = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/auto/upload`;

export interface CloudinaryUploadResult {
    secure_url: string;
    public_id: string;
    format: string;
    width?: number;
    height?: number;
    bytes: number;
    original_filename: string;
}

import axios from "axios";

/**
 * Upload a file to Cloudinary using unsigned preset.
 * Supports images (JPG, PNG, WEBP) and PDFs.
 * Added onProgress support for real-time tracking.
 */
export async function uploadToCloudinary(
    file: File, 
    onProgress?: (progress: number) => void
): Promise<CloudinaryUploadResult> {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", UPLOAD_PRESET);

    const res = await axios.post(UPLOAD_URL, formData, {
        headers: { "Content-Type": "multipart/form-data" },
        onUploadProgress: (progressEvent) => {
            if (onProgress && progressEvent.total) {
                const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                onProgress(percentCompleted);
            }
        },
    });

    return res.data;
}

/**
 * Upload multiple files to Cloudinary.
 * Returns an array of upload results.
 */
export async function uploadMultipleToCloudinary(files: File[]): Promise<CloudinaryUploadResult[]> {
    return Promise.all(files.map(file => uploadToCloudinary(file)));
}
