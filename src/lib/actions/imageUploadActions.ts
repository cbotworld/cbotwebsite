'use server';

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import https from 'https';

const DEFAULT_SUPABASE_URL = 'https://otvbywtuyvufxxvlizqp.supabase.co';
const DEFAULT_SERVICE_ROLE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im90dmJ5d3R1eXZ1Znh4dmxpenFwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NjA3ODk0NywiZXhwIjoyMTAxNjU0OTQ3fQ.WUg--SXP1DAvSXJqinDzorRNkJTGciNnBoK1_80NHB0';
const DEFAULT_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im90dmJ5d3R1eXZ1Znh4dmxpenFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYwNzg5NDcsImV4cCI6MjEwMTY1NDk0N30.wZzOnG9WTDKoCTHP1Xupiv1GMY5TZ0qelyWcA7L5o_4';

function uploadToSupabaseHttps(
  supabaseBaseUrl: string,
  key: string,
  bucket: string,
  fileName: string,
  buffer: Buffer,
  mimeType: string
): Promise<{ success: boolean; status: number; body?: string; error?: string }> {
  return new Promise((resolve) => {
    try {
      const url = new URL(`${supabaseBaseUrl}/storage/v1/object/${bucket}/${fileName}`);
      const options: https.RequestOptions = {
        hostname: url.hostname,
        port: 443,
        path: url.pathname,
        method: 'POST',
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
          'Content-Type': mimeType,
          'Content-Length': buffer.length,
          'x-upsert': 'true',
        },
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            resolve({ success: true, status: res.statusCode, body: data });
          } else {
            resolve({
              success: false,
              status: res.statusCode || 500,
              error: data || `HTTP ${res.statusCode}`,
            });
          }
        });
      });

      req.on('error', (err) => {
        resolve({ success: false, status: 500, error: err?.message || String(err) });
      });

      req.write(buffer);
      req.end();
    } catch (err: any) {
      resolve({ success: false, status: 500, error: err?.message || String(err) });
    }
  });
}

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
  const mimeType = blob.type || 'image/jpeg';
  const ext = mimeType.includes('png') ? 'png' : mimeType.includes('webp') ? 'webp' : mimeType.includes('svg') ? 'svg' : 'jpg';
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
    const res = await uploadToSupabaseHttps(supabaseUrl, key, b, fileName, bytes, mimeType);
    if (res.success) {
      successBucket = b;
      break;
    } else {
      lastError = `[${b}] ${res.status}: ${res.error}`;
    }
  }

  if (!successBucket) {
    console.error('[uploadPublicImage] Supabase upload failed:', lastError);
    return { success: false, error: `Storage upload failed: ${lastError}` };
  }

  const publicUrl = `${supabaseUrl}/storage/v1/object/public/${successBucket}/${fileName}`;

  return { success: true, url: `${publicUrl}?v=${Date.now()}` };
}
