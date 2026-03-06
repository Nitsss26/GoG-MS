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

/**
 * Upload a file to Cloudinary using unsigned preset.
 * Supports images (JPG, PNG, WEBP) and PDFs.
 */
export async function uploadToCloudinary(file: File): Promise<CloudinaryUploadResult> {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", UPLOAD_PRESET);

    const res = await fetch(UPLOAD_URL, { method: "POST", body: formData });

    if (!res.ok) {
        const err = await res.text();
        throw new Error(`Upload failed: ${err}`);
    }

    return res.json();
}

/**
 * Upload multiple files to Cloudinary.
 * Returns an array of upload results.
 */
export async function uploadMultipleToCloudinary(files: File[]): Promise<CloudinaryUploadResult[]> {
    return Promise.all(files.map(uploadToCloudinary));
}
