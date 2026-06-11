import axios from "axios";

// Cloudinary Fallback Variables
const CLOUD_NAME = "dtkim5oeu";
const UPLOAD_PRESET = "GOG-MS";
const CLOUDINARY_UPLOAD_URL = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/auto/upload`;

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
 * Uploads a file, prioritizing AWS S3 (via Pre-Signed URL).
 * Falls back to Cloudinary if S3 fails or is unavailable.
 * Supports progress tracking.
 */
export async function uploadToCloudinary(
    file: File, 
    onProgress?: (progress: number) => void
): Promise<CloudinaryUploadResult> {
    
    // --- ATTEMPT 1: AWS S3 UPLOAD ---
    try {
        console.log(`[UPLOAD] Requesting S3 Pre-signed URL for ${file.name}...`);
        
        // 1. Get the pre-signed URL from our backend API
        const presignRes = await fetch('/api/upload/s3', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                filename: file.name,
                contentType: file.type || 'application/octet-stream'
            })
        });

        if (presignRes.ok) {
            const { uploadUrl, fileUrl, filename } = await presignRes.json();

            // 2. Upload directly to S3 via PUT request
            console.log(`[UPLOAD] Uploading to S3: ${filename}`);
            
            await axios.put(uploadUrl, file, {
                headers: {
                    'Content-Type': file.type || 'application/octet-stream',
                },
                onUploadProgress: (progressEvent) => {
                    if (onProgress && progressEvent.total) {
                        const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                        onProgress(percentCompleted);
                    }
                },
            });

            console.log(`[UPLOAD] S3 Upload Successful: ${fileUrl}`);

            // Return a result that matches the existing Cloudinary interface
            // so we don't break existing components.
            return {
                secure_url: fileUrl,
                public_id: filename,
                format: file.type ? file.type.split('/')[1] : 'unknown',
                bytes: file.size,
                original_filename: file.name
            };
        } else {
            console.warn(`[UPLOAD] Failed to get S3 presigned URL (Status: ${presignRes.status}). Falling back to Cloudinary.`);
        }
    } catch (s3Error: any) {
        console.error(`[UPLOAD] S3 Upload Error: ${s3Error.message}. Falling back to Cloudinary.`);
    }

    // --- ATTEMPT 2: CLOUDINARY FALLBACK ---
    console.log(`[UPLOAD] Uploading to Cloudinary Fallback...`);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", UPLOAD_PRESET);

    const res = await axios.post(CLOUDINARY_UPLOAD_URL, formData, {
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
 * Upload multiple files.
 * Returns an array of upload results.
 */
export async function uploadMultipleToCloudinary(files: File[]): Promise<CloudinaryUploadResult[]> {
    return Promise.all(files.map(file => uploadToCloudinary(file)));
}
