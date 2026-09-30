'use server';

import { createClient } from '@supabase/supabase-js';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

/**
 * Server upload that uses the service role key to bypass RLS and store
 * images reliably in the Supabase public buckets ('teams' or 'images').
 */
export async function uploadPublicImage(
  formData: FormData
): Promise<{ success: boolean; url?: string; error?: string }> {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return { success: false, error: 'Unauthorized: Please log in to upload images.' };
  }

  const file = formData.get('file');
  if (!file || typeof (file as Blob).arrayBuffer !== 'function') {
    return { success: false, error: 'No image file received.' };
  }
  const blob = file as Blob;
  if (blob.size < 32) {
    return { success: false, error: 'Image file is empty.' };
  }

  const requestedBucket = String(formData.get('bucket') || 'images');
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    '';

  if (!supabaseUrl || !key || supabaseUrl.includes('placeholder')) {
    return { success: false, error: 'Image storage is not configured on the server.' };
  }

  const supabase = createClient(supabaseUrl, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const bytes = Buffer.from(await blob.arrayBuffer());
  const ext = blob.type?.includes('png') ? 'png' : blob.type?.includes('webp') ? 'webp' : blob.type?.includes('svg') ? 'svg' : 'jpg';
  const path = `uploads/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const candidateBuckets = Array.from(
    new Set([
      requestedBucket,
      requestedBucket.toLowerCase(),
      requestedBucket.toUpperCase(),
      'teams',
      'images',
      'TEAMS',
      'Images',
    ])
  );

  let uploadData: any = null;
  let error: any = null;
  let targetBucket = candidateBuckets[0];

  for (const b of candidateBuckets) {
    const res = await supabase.storage.from(b).upload(path, bytes, {
      contentType: blob.type || 'image/jpeg',
      upsert: true,
      cacheControl: '31536000',
    });
    if (res.data) {
      uploadData = res.data;
      error = null;
      targetBucket = b;
      break;
    } else {
      error = res.error;
    }
  }

  if (error || !uploadData) {
    console.error('[uploadPublicImage] Supabase error:', error);
    return { success: false, error: error?.message || 'Storage upload failed' };
  }

  const { data } = supabase.storage.from(targetBucket).getPublicUrl(path);
  const url = data?.publicUrl;
  if (!url) {
    return { success: false, error: 'Upload succeeded but no public URL was returned.' };
  }

  return { success: true, url: `${url}?v=${Date.now()}` };
}
