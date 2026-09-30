import { NextRequest, NextResponse } from 'next/server';

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
    const ext = file.type?.includes('png') ? 'png' : file.type?.includes('webp') ? 'webp' : file.type?.includes('svg') ? 'svg' : 'jpg';
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
      try {
        const uploadEndpoint = `${supabaseUrl}/storage/v1/object/${b}/${fileName}`;
        const uploadRes = await fetch(uploadEndpoint, {
          method: 'POST',
          headers: {
            apikey: key,
            Authorization: `Bearer ${key}`,
            'Content-Type': file.type || 'image/jpeg',
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
