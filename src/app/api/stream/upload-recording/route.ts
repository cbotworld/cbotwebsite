import { NextResponse } from 'next/server';

/** Disabled — mobile app streams to YouTube directly; no video upload via Vercel. */
export async function POST() {
  return NextResponse.json(
    { success: false, error: 'Recording upload via website is disabled. Use the mobile app.' },
    { status: 410 }
  );
}
