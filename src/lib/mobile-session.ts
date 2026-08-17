import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';

export function userIdFromBearer(request: NextRequest): string | null {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  try {
    const decoded = Buffer.from(authHeader.slice(7), 'base64').toString('utf8');
    const userId = decoded.split(':')[0];
    return userId || null;
  } catch {
    return null;
  }
}

export async function userFromBearer(request: NextRequest) {
  const userId = userIdFromBearer(request);
  if (!userId) return null;
  return prisma.user.findUnique({ where: { id: userId } });
}
