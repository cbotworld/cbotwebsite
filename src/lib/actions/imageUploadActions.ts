'use server';

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

const DEFAULT_SUPABASE_URL = 'https://otvbywtuyvufxxvlizqp.supabase.co';
const DEFAULT_SERVICE_ROLE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im90dmJ5d3R1eXZ1Znh4dmxpenFwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NjA3ODk0NywiZXhwIjoyMTAxNjU0OTQ3fQ.WUg--SXP1DAvSXJqinDzorRNkJTGciNnBoK1_80NHB0';
const DEFAULT_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im90dmJ5d3R1eXZ1Znh4dmxpenFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYwNzg5NDcsImV4cCI6MjEwMTY1NDk0N30.wZzOnG9WTDKoCTHP1Xupiv1GMY5TZ0qelyWcA7L5o_4';

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
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || DEFAULT_SUPABASE_URL;
  const supabaseUrl = (rawUrl.includes('placeholder') ? DEFAULT_SUPABASE_URL : rawUrl).replace(/\/+$/, '');
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    DEFAULT_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    DEFAULT_ANON_KEY;

  const bytes = Buffer.from(await blob.arrayBuffer());
  const ext = blob.type?.includes('png') ? 'png' : blob.type?.includes('webp') ? 'webp' : blob.type?.includes('svg') ? 'svg' : 'jpg';
  const fileName = `uploads/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const candidateBuckets = Array.from(
    new Set([
      requestedBucket,
      requestedBucket.toLowerCase(),
      'teams',
      'images',
      'TEAMS',
      'Images',
    ])
  );

  let successBucket: string | null = null;
  let lastError: string = '';

  for (const b of candidateBuckets) {
    try {
      const uploadEndpoint = `${supabaseUrl}/storage/v1/object/${b}/${fileName}`;
      const uploadRes = await fetch(uploadEndpoint, {
        method: 'POST',
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
          'Content-Type': blob.type || 'image/jpeg',
          'Content-Length': String(bytes.length),
          'x-upsert': 'true',
        },
        body: new Uint8Array(bytes),
      });

      if (uploadRes.ok) {
        successBucket = b;
        break;
      } else {
        const errText = await uploadRes.text();
        lastError = `[${b}] ${uploadRes.status}: ${errText}`;
      }
    } catch (err: any) {
      lastError = err?.message || String(err);
    }
  }

  if (!successBucket) {
    console.error('[uploadPublicImage] Supabase upload failed:', lastError);
    return { success: false, error: `Storage upload failed: ${lastError}` };
  }

  const publicUrl = `${supabaseUrl}/storage/v1/object/public/${successBucket}/${fileName}`;

  return { success: true, url: `${publicUrl}?v=${Date.now()}` };
}
