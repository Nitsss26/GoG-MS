"use client";
/**
 * Banner images are resized before upload (max 1920 px wide, JPEG / WebP ~85 %) so dashboards load fast.
 * GIF / SVG and images that are already small are uploaded unchanged.
 */
export async function optimizeImage(file: File, maxW = 1920): Promise<File> {
    try {
        if (!/^image\/(jpeg|png|webp)$/i.test(file.type)) return file;
        const url = URL.createObjectURL(file);
        const img = await new Promise<HTMLImageElement>((ok, bad) => { const i = new Image(); i.onload = () => ok(i); i.onerror = bad; i.src = url; });
        URL.revokeObjectURL(url);
        if (img.naturalWidth <= maxW && file.size < 600 * 1024) return file;
        const scale = Math.min(1, maxW / img.naturalWidth);
        const c = document.createElement("canvas");
        c.width = Math.round(img.naturalWidth * scale); c.height = Math.round(img.naturalHeight * scale);
        c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
        const type = file.type === "image/png" ? "image/webp" : file.type;
        const blob: Blob | null = await new Promise(ok => c.toBlob(b => ok(b), type, 0.85));
        if (!blob || blob.size >= file.size) return file;
        return new File([blob], file.name.replace(/\.(png|jpe?g|webp)$/i, type === "image/webp" ? ".webp" : ".jpg"), { type });
    } catch { return file; }
}
