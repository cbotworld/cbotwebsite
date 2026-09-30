import { NextRequest, NextResponse } from 'next/server';
import https from 'https';

export const dynamic = 'force-dynamic';

const DEFAULT_SUPABASE_URL = 'https://otvbywtuyvufxxvlizqp.supabase.co';
const DEFAULT_SERVICE_ROLE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im90dmJ5d3R1eXZ1Znh4dmxpenFwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NjA3ODk0NywiZXhwIjoyMTAxNjU0OTQ3fQ.WUg--SXP1DAvSXJqinDzorRNkJTGciNnBoK1_80NHB0';
const DEFAULT_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im90dmJ5d3R1eXZ1Znh4dmxpenFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYwNzg5NDcsImV4cCI6MjEwMTY1NDk0N30.wZzOnG9WTDKoCTHP1Xupiv1GMY5TZ0qelyWcA7L5o_4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

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

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | Blob | null;

    if (!file || typeof file.arrayBuffer !== 'function') {
      return NextResponse.json(
        { success: false, error: 'No image file provided.' },
        { status: 400, headers: corsHeaders }
      );
    }

    if (file.size < 32) {
      return NextResponse.json(
        { success: false, error: 'Image file is empty.' },
        { status: 400, headers: corsHeaders }
      );
    }

    const requestedBucket = String(formData.get('bucket') || 'teams');
    const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || DEFAULT_SUPABASE_URL;
    const supabaseUrl = (rawUrl.includes('placeholder') ? DEFAULT_SUPABASE_URL : rawUrl).replace(/\/+$/, '');
    const key =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      DEFAULT_SERVICE_ROLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      DEFAULT_ANON_KEY;

    const bytes = Buffer.from(await file.arrayBuffer());
    const mimeType = file.type || 'image/jpeg';
    const ext = mimeType.includes('png') ? 'png' : mimeType.includes('webp') ? 'webp' : mimeType.includes('svg') ? 'svg' : 'jpg';
    const originalName = ('name' in file && typeof file.name === 'string')
      ? file.name.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 30)
      : 'img';
    const fileName = `${Date.now()}_${originalName}.${ext}`;

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
      console.error('[Upload API] All bucket upload attempts failed:', lastError);
      return NextResponse.json(
        { success: false, error: `Upload failed: ${lastError}` },
        { status: 500, headers: corsHeaders }
      );
    }

    const publicUrl = `${supabaseUrl}/storage/v1/object/public/${successBucket}/${fileName}`;

    return NextResponse.json(
      {
        success: true,
        url: `${publicUrl}?v=${Date.now()}`,
        path: fileName,
        bucket: successBucket,
      },
      { headers: corsHeaders }
    );
  } catch (err: any) {
    console.error('[Upload API] Exception during file upload:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Server error during image upload.' },
      { status: 500, headers: corsHeaders }
    );
  }
}
