import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key';

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

/**
 * Returns the public URL for a team poster image from the 'teams' bucket.
 */
export function getTeamPosterUrl(filename: string): string {
  try {
    const { data } = supabase.storage.from('teams').getPublicUrl(filename);
    return data?.publicUrl || `/teams/${filename}`;
  } catch (e) {
    return `/teams/${filename}`;
  }
}

/**
 * Uploads an image file to Supabase Storage and returns the public URL.
 * Falls back to Data URL if storage bucket upload fails or is offline.
 */
export async function uploadImageToSupabase(file: File, bucket = 'teams'): Promise<string> {
  const fileExt = file.name.split('.').pop() || 'jpeg';
  const cleanFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
  const fileName = `${Date.now()}_${cleanFileName}`;

  try {
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: true,
      });

    if (error) {
      console.warn('Supabase storage upload error, using data URL fallback:', error.message);
      return await fileToDataUrl(file);
    }

    const { data: publicUrlData } = supabase.storage.from(bucket).getPublicUrl(data.path);
    return publicUrlData.publicUrl;
  } catch (err) {
    console.warn('Supabase storage upload exception:', err);
    return await fileToDataUrl(file);
  }
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (e) => reject(e);
    reader.readAsDataURL(file);
  });
}

