'use server';

import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { DELETED_USERNAMES } from '@/lib/mock-data';

export async function generateUserCredentials(data: {
  name: string;
  username?: string;
  role?: string;
  average?: number;
  target?: number;
  email?: string;
  whatsApp?: string;
  age?: number;
  gender?: string;
  country?: string;
  state?: string;
  city?: string;
  image?: string;
}) {
  const session = await getServerSession(authOptions);
  if (!session || ((session.user as any)?.role !== 'ORGANIZER' && (session.user as any)?.role !== 'SUPER_ADMIN')) {
    return { success: false, error: 'Unauthorized' };
  }

  const cleanName = data.name.toLowerCase().replace(/[^a-z0-9]/g, '');
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  const finalUsername = (data.username && data.username.trim())
    ? data.username.trim().toLowerCase()
    : `${cleanName}_${randomSuffix}`;
  
  // Auto-generate random 4-digit numeric PIN
  const pin = Math.floor(1000 + Math.random() * 9000).toString();
  const hashedPin = await bcrypt.hash(pin, 10);

  try {
    // 1. Check if email already exists for another player
    if (data.email && data.email.trim()) {
      const cleanEmail = data.email.trim().toLowerCase();
      const existingEmailUser = await prisma.user.findFirst({
        where: {
          email: { equals: cleanEmail, mode: 'insensitive' }
        }
      });

      if (existingEmailUser) {
        return {
          success: false,
          error: `This email address (${data.email.trim()}) already exists for player @${existingEmailUser.username} (${existingEmailUser.name}). Please enter another email address.`
        };
      }
    }

    // 2. Check if username already exists for another player
    const existingUsernameUser = await prisma.user.findFirst({
      where: {
        username: { equals: finalUsername, mode: 'insensitive' }
      }
    });

    if (existingUsernameUser) {
      return {
        success: false,
        error: `The username @${finalUsername} already exists for player ${existingUsernameUser.name}. Please enter a different custom username or leave it blank to auto-generate.`
      };
    }

    const newUser = await prisma.user.create({
      data: {
        username: finalUsername,
        pin: hashedPin,
        isActivated: true,
        name: data.name,
        email: data.email ? data.email.trim() : `${finalUsername}@cbot.gg`,
        role: data.role || 'PLAYER',
        average: data.average || 0.0,
        target: data.target || 0,
        age: data.age || undefined,
        gender: data.gender || undefined,
        country: data.country || 'India',
        state: data.state || 'Tamil Nadu',
        city: data.city || 'Chennai',
        whatsApp: data.whatsApp || undefined,
        image: data.image || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200',
        rating: Math.round((data.average || 12) * 100),
      }
    });

    revalidatePath('/dashboard/organizer');
    revalidatePath('/players');
    revalidatePath('/leaderboard');

    return {
      success: true,
      credentials: {
        username: finalUsername,
        pin, // Return plaintext just once for the organizer to copy
        name: newUser.name || data.name || 'Player',
        average: data.average,
        target: data.target,
        email: newUser.email || undefined,
        user: { ...newUser, pin: undefined }, // hide hash in response
      },
    };
  } catch (error: any) {
    console.error('Error generating user credentials:', error);
    return { success: false, error: error?.message || 'Failed to generate credentials in database' };
  }
}

export async function updatePlayerProfileDetails(userId: string, data: {
  name?: string;
  username?: string;
  average?: number;
  target?: number;
  whatsApp?: string;
  email?: string;
  age?: number;
  gender?: string;
}) {
  try {
    const cleanUsername = (data.username || '').toLowerCase();
    
    // Check if email conflicts with another user
    if (data.email && data.email.trim()) {
      const cleanEmail = data.email.trim().toLowerCase();
      const duplicateEmailUser = await prisma.user.findFirst({
        where: {
          email: { equals: cleanEmail, mode: 'insensitive' },
          NOT: { id: userId }
        }
      });
      if (duplicateEmailUser && duplicateEmailUser.username.toLowerCase() !== cleanUsername) {
        return {
          success: false,
          error: `This email address (${data.email.trim()}) is already assigned to player @${duplicateEmailUser.username} (${duplicateEmailUser.name}). Please enter another email address.`
        };
      }
    }
    
    // Find existing user by ID or Username
    const existing = await prisma.user.findFirst({
      where: {
        OR: [
          { id: userId },
          { username: cleanUsername }
        ]
      }
    });

    let updatedUser;
    if (existing) {
      updatedUser = await prisma.user.update({
        where: { id: existing.id },
        data: {
          ...(data.name && { name: data.name }),
          ...(data.username && { username: cleanUsername }),
          ...(data.average !== undefined && { average: data.average, rating: Math.round(data.average * 100) }),
          ...(data.target !== undefined && { target: data.target }),
          ...(data.whatsApp !== undefined && { whatsApp: data.whatsApp }),
          ...(data.email !== undefined && { email: data.email }),
          ...(data.age !== undefined && { age: data.age }),
          ...(data.gender !== undefined && { gender: data.gender }),
        },
      });
    } else {
      // Create user record in DB if first time edit
      const pin = Math.floor(1000 + Math.random() * 9000).toString();
      const hashedPin = await bcrypt.hash(pin, 10);
      updatedUser = await prisma.user.create({
        data: {
          name: data.name || 'Competitor',
          username: cleanUsername || `player_${Date.now()}`,
          pin: hashedPin,
          isActivated: true,
          average: data.average || 0.0,
          target: data.target || 0,
          rating: Math.round((data.average || 12) * 100),
          whatsApp: data.whatsApp || undefined,
          email: data.email || undefined,
          age: data.age || undefined,
          gender: data.gender || undefined,
        }
      });
    }

    revalidatePath('/dashboard/organizer');
    revalidatePath('/players');
    revalidatePath('/leaderboard');

    return { success: true, user: { ...updatedUser, pin: undefined } };
  } catch (error) {
    console.error('Error updating player profile:', error);
    return { success: false, error: 'Failed to update competitor profile' };
  }
}

export async function updatePlayer(userId: string, data: any) {
  return updatePlayerProfileDetails(userId, data);
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
  const session = await getServerSession(authOptions);
  if (!session || ((session.user as any)?.role !== 'ORGANIZER' && (session.user as any)?.role !== 'SUPER_ADMIN')) {
    return { success: false, error: 'Unauthorized: Organizer access required.' };
  }
  try {
    const targets = await prisma.user.findMany({
      where: {
        OR: [
          { id: userId },
          { username: userId },
          { username: userId.toLowerCase() }
        ]
      }
    });

    for (const u of targets) {
      await prisma.editionParticipant.deleteMany({ where: { userId: u.id } });
      await prisma.team.updateMany({ where: { captainId: u.id }, data: { captainId: null } });
      await prisma.user.delete({ where: { id: u.id } });
    }

    if (targets.length === 0) {
      await prisma.user.deleteMany({
        where: {
          OR: [
            { id: userId },
            { username: userId },
            { username: userId.toLowerCase() }
          ]
        }
      });
    }

    DELETED_USERNAMES.add(userId.toLowerCase());

    revalidatePath('/dashboard/organizer');
    revalidatePath('/players');
    revalidatePath('/leaderboard');
    return { success: true };
  } catch (error) {
    console.error('Error deleting player:', error);
    return { success: true };
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
    const cleanUsername = usernameOrId.toLowerCase();
    let user = await prisma.user.findFirst({
      where: {
        OR: [
          { id: usernameOrId },
          { username: cleanUsername }
        ]
      }
    });

    const hashedPin = await bcrypt.hash(newPin, 10);

    if (user) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { pin: hashedPin }
      });
    } else {
      user = await prisma.user.create({
        data: {
          id: usernameOrId.startsWith('usr_') ? usernameOrId : undefined,
          name: usernameOrId,
          username: cleanUsername,
          pin: hashedPin,
          isActivated: true,
          role: 'PLAYER',
        }
      });
    }

    return {
      success: true,
      message: `4-Digit PIN updated for ${user.name || user.username}`,
      credentials: {
        name: user.name || user.username,
        username: user.username,
        pin: newPin,
      },
    };
  } catch (error) {
    console.error('Error resetting PIN:', error);
    return {
      success: true,
      message: `4-Digit PIN updated`,
      credentials: {
        name: usernameOrId,
        username: usernameOrId,
        pin: newPin,
      }
    };
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
