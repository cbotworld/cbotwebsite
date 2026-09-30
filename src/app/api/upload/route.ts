import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

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
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const key =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      '';

    if (!supabaseUrl || !key || supabaseUrl.includes('placeholder')) {
      return NextResponse.json(
        { success: false, error: 'Supabase storage is not configured on the server.' },
        { status: 500, headers: corsHeaders }
      );
    }

    const supabase = createClient(supabaseUrl, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

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
        requestedBucket.toUpperCase(),
        'teams',
        'images',
        'TEAMS',
        'Images',
      ])
    );

    let uploadData: any = null;
    let uploadError: any = null;
    let targetBucket = candidateBuckets[0];

    for (const b of candidateBuckets) {
      const result = await supabase.storage.from(b).upload(fileName, bytes, {
        contentType: file.type || 'image/jpeg',
        cacheControl: '31536000',
        upsert: true,
      });
      if (result.data) {
        uploadData = result.data;
        uploadError = null;
        targetBucket = b;
        break;
      } else {
        uploadError = result.error;
      }
    }

    if (uploadError || !uploadData) {
      console.error('[Upload API] Supabase storage upload error:', uploadError);
      return NextResponse.json(
        { success: false, error: uploadError?.message || 'Storage upload failed' },
        { status: 500, headers: corsHeaders }
      );
    }

    const { data: publicUrlData } = supabase.storage.from(targetBucket).getPublicUrl(uploadData.path);
    const publicUrl = publicUrlData?.publicUrl;

    if (!publicUrl) {
      return NextResponse.json(
        { success: false, error: 'Failed to retrieve public URL from storage.' },
        { status: 500, headers: corsHeaders }
      );
    }

    return NextResponse.json(
      {
        success: true,
        url: `${publicUrl}?v=${Date.now()}`,
        path: uploadData.path,
        bucket: targetBucket,
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
