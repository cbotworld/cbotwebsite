import { NextRequest, NextResponse } from 'next/server';
import http from 'http';
import https from 'https';

export const dynamic = 'force-dynamic';

const DEFAULT_SUPABASE_URL = 'http://cbot-supabase-f44128-62-72-41-216.sslip.io';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path } = await params;
    if (!path || path.length === 0) {
      return new NextResponse('Not found', { status: 404 });
    }

    const relativePath = path.join('/');
    const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || DEFAULT_SUPABASE_URL;
    const baseUrl = rawUrl.replace(/\/+$/, '');
    const targetUrl = new URL(`${baseUrl}/storage/v1/object/public/${relativePath}`);

    const isHttps = targetUrl.protocol === 'https:';
    const transport = isHttps ? https : http;
    const port = targetUrl.port ? parseInt(targetUrl.port, 10) : isHttps ? 443 : 80;

    return new Promise<NextResponse>((resolve) => {
      const options: http.RequestOptions = {
        hostname: targetUrl.hostname,
        port: port,
        path: targetUrl.pathname + targetUrl.search,
        method: 'GET',
        ...(isHttps ? { rejectUnauthorized: false } : {}),
      };

      const req = transport.request(options, (res) => {
        if (!res.statusCode || res.statusCode < 200 || res.statusCode >= 300) {
          resolve(new NextResponse('Asset not found', { status: res.statusCode || 404 }));
          return;
        }

        const chunks: Buffer[] = [];
        res.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
        res.on('end', () => {
          const bodyBuffer = Buffer.concat(chunks);
          const contentType = res.headers['content-type'] || 'image/jpeg';
          const cacheControl = 'public, max-age=31536000, immutable';

          resolve(
            new NextResponse(bodyBuffer, {
              status: 200,
              headers: {
                'Content-Type': contentType,
                'Cache-Control': cacheControl,
                'Access-Control-Allow-Origin': '*',
              },
            })
          );
        });
      });

      req.on('error', (err) => {
        resolve(new NextResponse(`Fetch error: ${err.message}`, { status: 502 }));
      });

      req.end();
    });
  } catch (error: any) {
    return new NextResponse(`Server error: ${error.message}`, { status: 500 });
  }
}
