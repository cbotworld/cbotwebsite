'use server';

import { createClient } from '@supabase/supabase-js';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

/**
 * Organizer/server upload that uses the service role when available so RLS
 * cannot silently fall back to a data-URL the homepage will strip.
 */
export async function uploadPublicImage(
  formData: FormData
): Promise<{ success: boolean; url?: string; error?: string }> {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!session?.user || (role !== 'ORGANIZER' && role !== 'SUPER_ADMIN')) {
    return { success: false, error: 'Unauthorized' };
  }

  const file = formData.get('file');
  if (!file || typeof (file as Blob).arrayBuffer !== 'function') {
    return { success: false, error: 'No image file received' };
  }
  const blob = file as Blob;
  if (blob.size < 32) {
    return { success: false, error: 'Image file is empty' };
  }

  const requestedBucket = String(formData.get('bucket') || 'images');
  const bucket = requestedBucket === 'teams' ? 'teams' : 'images';

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  if (!supabaseUrl || !key || supabaseUrl.includes('placeholder')) {
    return { success: false, error: 'Image storage is not configured on the server.' };
  }

  const supabase = createClient(supabaseUrl, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const bytes = Buffer.from(await blob.arrayBuffer());
  const path = `cms/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.jpg`;
  const { error } = await supabase.storage.from(bucket).upload(path, bytes, {
    contentType: 'image/jpeg',
    upsert: true,
    cacheControl: '3600',
  });
  if (error) {
    return { success: false, error: error.message };
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  const url = data?.publicUrl;
  if (!url) {
    return { success: false, error: 'Upload succeeded but no public URL was returned.' };
  }
  return { success: true, url: `${url}?v=${Date.now()}` };
}
