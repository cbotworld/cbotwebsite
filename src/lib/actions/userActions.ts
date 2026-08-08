'use server';

import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function generateUserCredentials(data: {
  name: string;
  role: string;
  country?: string;
  state?: string;
  city?: string;
  whatsApp?: string;
  image?: string;
}) {
  const session = await getServerSession(authOptions);
  if (!session || ((session.user as any)?.role !== 'ORGANIZER' && (session.user as any)?.role !== 'SUPER_ADMIN')) {
    return { success: false, error: 'Unauthorized' };
  }

  const cleanName = data.name.toLowerCase().replace(/[^a-z0-9]/g, '');
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  const username = `${cleanName}_${randomSuffix}`;
  
  // Auto-generate random 4-digit numeric PIN
  const pin = Math.floor(1000 + Math.random() * 9000).toString();
  const hashedPin = await bcrypt.hash(pin, 10);

  try {
    const newUser = await prisma.user.create({
      data: {
        username,
        pin: hashedPin,
        isActivated: true,
        name: data.name,
        email: `${username}@cbot.gg`,
        role: data.role,
        country: data.country || 'India',
        state: data.state || 'Tamil Nadu',
        city: data.city || 'Chennai',
        whatsApp: data.whatsApp || '+91 98765 43210',
        image: data.image || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200',
        rating: 1200,
      }
    });

    return {
      success: true,
      credentials: {
        username,
        pin, // Return plaintext just once for the organizer to copy
        name: data.name,
        role: data.role,
        user: { ...newUser, pin: undefined }, // hide hash in response
      },
    };
  } catch (error) {
    return { success: false, error: 'Failed to generate credentials' };
  }
}

export async function updatePlayer(userId: string, data: any) {
  try {
    const updated = await prisma.user.update({
      where: { id: userId },
      data,
    });
    return { success: true, user: { ...updated, pin: undefined } };
  } catch (error) {
    return { success: false, error: 'Player not found or update failed' };
  }
}

export async function togglePlayerActivation(userId: string) {
  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return { success: false, error: 'Player not found' };

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { isActivated: !user.isActivated },
    });
    
    return { success: true, isActivated: updated.isActivated, user: { ...updated, pin: undefined } };
  } catch (error) {
    return { success: false, error: 'Operation failed' };
  }
}

export async function deletePlayer(userId: string) {
  try {
    const deleted = await prisma.user.delete({ where: { id: userId } });
    return { success: true, deleted: { ...deleted, pin: undefined } };
  } catch (error) {
    return { success: false, error: 'Player not found or deletion failed' };
  }
}

export async function resetUserPin(usernameOrId: string, newPin: string) {
  const session = await getServerSession(authOptions);
  if (!session || ((session.user as any)?.role !== 'ORGANIZER' && (session.user as any)?.role !== 'SUPER_ADMIN')) {
    return { success: false, error: 'Unauthorized' };
  }

  if (!/^\d{4}$/.test(newPin)) {
    return { success: false, error: 'PIN must be exactly 4 digits' };
  }

  try {
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { id: usernameOrId },
          { username: usernameOrId.toLowerCase() }
        ]
      }
    });

    if (!user) {
      return { success: false, error: 'User not found' };
    }

    const hashedPin = await bcrypt.hash(newPin, 10);
    await prisma.user.update({
      where: { id: user.id },
      data: { pin: hashedPin }
    });

    return { success: true, message: `4-Digit PIN updated for ${user.name}` };
  } catch (error) {
    return { success: false, error: 'Operation failed' };
  }
}

export async function activateUserAccount(username: string, oldPin: string, newPin: string) {
  if (!/^\d{4}$/.test(newPin)) {
    return { success: false, error: 'New PIN must be exactly 4 digits' };
  }

  try {
    const user = await prisma.user.findUnique({
      where: { username: username.toLowerCase() }
    });

    if (!user) {
      return { success: false, error: 'User account not found' };
    }

    const isValid = await bcrypt.compare(oldPin, user.pin);
    if (!isValid) {
      return { success: false, error: 'Current PIN is incorrect' };
    }

    const hashedPin = await bcrypt.hash(newPin, 10);
    await prisma.user.update({
      where: { id: user.id },
      data: {
        pin: hashedPin,
        isActivated: true
      }
    });

    return { success: true, message: 'Account activated successfully!' };
  } catch (error) {
    return { success: false, error: 'Operation failed' };
  }
}
