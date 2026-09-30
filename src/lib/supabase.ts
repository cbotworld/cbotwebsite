import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://cbot-supabase-f44128-62-72-41-216.sslip.io';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_secret_d097a3a0261f8f48670ef1_48ff9a68';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const STORAGE_BUCKET = 'images';

/**
 * Returns the public URL for a file in Supabase Storage (images bucket).
 */
export function getPublicUrl(path: string): string {
  try {
    const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path);
    return data?.publicUrl || `/teams/${path}`;
  } catch (e) {
    return `/teams/${path}`;
  }
}

export function getAppBaseUrl(): string {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }
  if (process.env.NEXTAUTH_URL && !process.env.NEXTAUTH_URL.includes('localhost')) {
    return process.env.NEXTAUTH_URL.replace(/\/+$/, '');
  }
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/+$/, '');
  }
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL.replace(/\/+$/, '')}`;
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL.replace(/\/+$/, '')}`;
  }
  return 'https://www.cbotworld.com';
}

/**
 * Converts any direct Supabase storage URL or relative path to an absolute
 * /api/storage proxy URL so mobile apps (React Native/iOS/Android) and web browsers
 * can load images over HTTPS without ATS or relative-path errors.
 */
export function toStorageProxyUrl(url?: string | null): string {
  if (!url) return '';
  const trimmed = url.trim();
  if (trimmed.startsWith('data:') || trimmed.startsWith('blob:')) return trimmed;
  const baseUrl = getAppBaseUrl();

  if (trimmed.includes('/storage/v1/object/public/')) {
    const parts = trimmed.split('/storage/v1/object/public/');
    return `${baseUrl}/api/storage/${parts[1]}`;
  }
  if (trimmed.startsWith('/api/storage/')) {
    return `${baseUrl}${trimmed}`;
  }
  if (trimmed.startsWith('api/storage/')) {
    return `${baseUrl}/${trimmed}`;
  }
  if (trimmed.startsWith('/teams/')) {
    return `${baseUrl}${trimmed}`;
  }
  if (/^[a-zA-Z0-9_-]+\.(jpg|jpeg|png|webp|svg)$/i.test(trimmed)) {
    return `${baseUrl}/api/storage/teams/${trimmed}`;
  }
  return trimmed;
}

/**
 * Returns the public URL for a team poster image from the 'teams' bucket.
 */
export function getTeamPosterUrl(filename: string): string {
  try {
    const { data } = supabase.storage.from('teams').getPublicUrl(filename);
    const raw = data?.publicUrl || `/teams/${filename}`;
    return toStorageProxyUrl(raw);
  } catch (e) {
    return `/teams/${filename}`;
  }
}

/**
 * Uploads an image file to Supabase Storage and returns the public URL.
 * Always resizes/compresses first (max edge 1000px, target ≤350KB JPEG).
 * Falls back to a compressed Data URL only if storage upload fails.
 */
export async function uploadImageToSupabase(file: File, bucket = 'teams'): Promise<string> {
  const compressed = await compressImageFile(file, {
    maxEdge: 1000,
    quality: 0.78,
    maxBytes: 350_000,
  });

  // 1. Prefer uploading via server-side /api/upload endpoint (service role powered, bypasses RLS)
  try {
    if (typeof window !== 'undefined') {
      const formData = new FormData();
      formData.append('file', compressed, file.name || 'image.jpg');
      formData.append('bucket', bucket);

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        const json = await res.json();
        if (json.success && json.url) {
          return json.url;
        }
      }
    }
  } catch (apiErr) {
    console.warn('[uploadImageToSupabase] /api/upload endpoint error, falling back to client:', apiErr);
  }

  // 2. Direct client upload fallback
  const fileName = `${Date.now()}_${(file.name || 'image')
    .replace(/\.[^.]+$/, '')
    .replace(/[^a-zA-Z0-9.-]/g, '_')
    .slice(0, 40)}.jpg`;

  try {
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(fileName, compressed, {
        cacheControl: '31536000',
        upsert: true,
        contentType: 'image/jpeg',
      });

    if (error) {
      throw new Error(error.message);
    }

    const { data: publicUrlData } = supabase.storage.from(bucket).getPublicUrl(data.path);
    const publicUrl = publicUrlData?.publicUrl;
    if (!publicUrl) throw new Error('No public URL returned from storage');
    return `${publicUrl}?v=${Date.now()}`;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Storage upload failed';
    throw new Error(message);
  }
}

/** Compress a browser File/Blob to JPEG under maxBytes. */
export async function compressImageFile(
  file: Blob,
  opts: { maxEdge: number; quality: number; maxBytes: number } = {
    maxEdge: 1000,
    quality: 0.78,
    maxBytes: 350_000,
  },
): Promise<Blob> {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return file;
  }

  // Leave tiny SVGs alone — rasterizing them loses quality for logos.
  if ((file.type || '').includes('svg') && file.size < 80_000) {
    return file;
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return file;
  }

  const scale = Math.min(1, opts.maxEdge / Math.max(bitmap.width, bitmap.height, 1));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    bitmap.close();
    return file;
  }

  // White backdrop so transparent PNGs don't turn black as JPEG
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  let quality = opts.quality;
  let blob: Blob | null = null;
  for (let i = 0; i < 8; i++) {
    blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), 'image/jpeg', quality),
    );
    if (!blob) break;
    if (blob.size <= opts.maxBytes || quality <= 0.4) break;
    quality = Math.max(0.4, quality - 0.08);
  }
  return blob || file;
}

/** If a pasted value is a huge data-URI, compress it before saving. */
export async function normalizeUploadedImageValue(value: string): Promise<string> {
  const trimmed = (value || '').trim();
  if (!trimmed.startsWith('data:image/')) return trimmed;
  if (trimmed.length < 120_000) return trimmed; // ~90KB — already fine

  try {
    const res = await fetch(trimmed);
    const blob = await res.blob();
    const compressed = await compressImageFile(blob);
    // Prefer uploading compressed blob to storage when possible
    const file = new File([compressed], `pasted-${Date.now()}.jpg`, { type: 'image/jpeg' });
    return await uploadImageToSupabase(file);
  } catch {
    return trimmed;
  }
}

/**
 * Uploads a recorded match video blob to Supabase Storage and returns the public URL.
 */
export async function uploadMatchVideoToSupabase(videoBlob: Blob, matchId: string): Promise<string> {
  const ext = videoBlob.type.includes('mp4') ? 'mp4' : 'webm';
  const fileName = `recordings/${matchId.toLowerCase()}_${Date.now()}.${ext}`;

  try {
    const { data, error } = await supabase.storage
      .from('teams')
      .upload(fileName, videoBlob, {
        contentType: videoBlob.type || 'video/webm',
        cacheControl: '86400',
        upsert: true,
      });

    if (error) {
      console.warn('Supabase video upload error:', error.message);
      return '';
    }

    const { data: publicUrlData } = supabase.storage.from('teams').getPublicUrl(data.path);
    return publicUrlData.publicUrl;
  } catch (err) {
    console.warn('Supabase video upload exception:', err);
    return '';
  }
}

