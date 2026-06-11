// Client-side image resize utility. Reads a File from a file input,
// draws it into a canvas at a max width, and returns a JPEG data URL.
// Used for admin stadium photo uploads so we don't blow past Vercel's
// 4.5 MB request body limit or bloat KV storage.

export async function resizeImageToDataUrl(
  file: File,
  options: { maxWidth?: number; maxHeight?: number; quality?: number } = {},
): Promise<string> {
  const maxWidth = options.maxWidth ?? 1400;
  const maxHeight = options.maxHeight ?? 900;
  const quality = options.quality ?? 0.78;

  if (!file.type.startsWith('image/')) {
    throw new Error('Not an image file');
  }

  const dataUrl = await readFileAsDataUrl(file);
  const img = await loadImage(dataUrl);

  const scale = Math.min(1, maxWidth / img.width, maxHeight / img.height);
  const targetWidth = Math.round(img.width * scale);
  const targetHeight = Math.round(img.height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable in this browser');
  ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

  return canvas.toDataURL('image/jpeg', quality);
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to decode image'));
    img.src = src;
  });
}

export function estimateDataUrlBytes(dataUrl: string): number {
  // Rough — base64 inflates 4 bytes per 3 source bytes, minus the header.
  const i = dataUrl.indexOf(',');
  if (i < 0) return dataUrl.length;
  return Math.floor((dataUrl.length - i - 1) * 3 / 4);
}
