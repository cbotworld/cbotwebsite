'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function createEdition(formData: FormData, organizerId: string) {
  const session = await getServerSession(authOptions);
  if (!session || ((session.user as any)?.role !== 'ORGANIZER' && (session.user as any)?.role !== 'SUPER_ADMIN')) {
    return { success: false, error: 'Unauthorized: Organizer access required.' };
  }
  try {
    const title = formData.get('title') as string;
    const theme = (formData.get('theme') as string) || 'Standard CBOT Theme';
    const description = formData.get('description') as string;
    const format = 'MULTI_FORMAT_ROUND';
    const prizePool = (formData.get('prizePool') as string) || '₹50,000 INR';
    const maxTeams = parseInt((formData.get('maxTeams') as string) || '16', 10);
    const rules = formData.get('rules') as string;

    const roundFormatsRaw = formData.get('roundFormats') as string;
    let roundFormats: string[] = ['SINGLES', 'DOUBLES', 'TRIPLES', 'SINGLES'];
    if (roundFormatsRaw) {
      try {
        roundFormats = JSON.parse(roundFormatsRaw);
      } catch (e) {}
    }

    const roundRulesRaw = formData.get('roundRules') as string;
    let roundRules: string[] = [];
    if (roundRulesRaw) {
      try {
        roundRules = JSON.parse(roundRulesRaw);
      } catch (e) {}
    }

    const perRoundBreakdown = roundFormats
      .map((fmt, idx) => `• Round ${idx + 1} (${fmt}): ${roundRules[idx] || 'Standard rules apply'}`)
      .join('\n');

    const rulesVal = rules
      ? `${rules}\n\nPer-Round Match Directives & Rules:\n${perRoundBreakdown}`
      : `Multi-Format Round Schedule & Rules:\n${perRoundBreakdown}`;

    const currentCount = await prisma.edition.count();
    const number = currentCount + 1; 
    const titleVal = title || `CBOT Edition #${number}`;

    const newEdition = await prisma.edition.create({
      data: {
        number,
        title: titleVal,
        slug: titleVal.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, ''),
        theme,
        themeDescription: description,
        format,
        status: 'REGISTRATION_OPEN',
        tournamentStartDate: new Date(Date.now() + 86400000 * 7),
        tournamentEndDate: new Date(Date.now() + 86400000 * 10),
        prizePool,
        maxTeams,
        rules: rulesVal,
        bannerImage: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&q=80&w=1200',
        organizerId,
      }
    });

    const defaultPatterns = await prisma.boardPattern.findMany({ take: roundFormats.length });
    if (defaultPatterns.length > 0) {
      for (let i = 0; i < roundFormats.length; i++) {
        const pattern = defaultPatterns[i % defaultPatterns.length];
        await prisma.editionBoardPattern.create({
          data: {
            editionId: newEdition.id,
            patternId: pattern.id,
            sequence: i + 1,
            matchFormat: roundFormats[i],
          }
        });
      }
    }

    revalidatePath('/dashboard/organizer');
    revalidatePath('/editions');

    return { success: true, edition: newEdition };
  } catch (error) {
    console.error('Failed to create edition:', error);
    return { success: false, error: 'Failed to create edition' };
  }
}

export async function updateEdition(editionId: string, formData: FormData) {
  const session = await getServerSession(authOptions);
  if (!session || ((session.user as any)?.role !== 'ORGANIZER' && (session.user as any)?.role !== 'SUPER_ADMIN')) {
    return { success: false, error: 'Unauthorized: Organizer access required.' };
  }
  try {
    const title = formData.get('title') as string;
    const theme = (formData.get('theme') as string) || 'Standard CBOT Theme';
    const description = formData.get('description') as string;
    const prizePool = (formData.get('prizePool') as string) || '₹1,00,000 INR';
    const maxTeams = parseInt((formData.get('maxTeams') as string) || '16', 10);
    const rules = formData.get('rules') as string;

    const roundFormatsRaw = formData.get('roundFormats') as string;
    let roundFormats: string[] = ['SINGLES', 'DOUBLES', 'TRIPLES', 'SINGLES'];
    if (roundFormatsRaw) {
      try {
        roundFormats = JSON.parse(roundFormatsRaw);
      } catch (e) {}
    }

    const roundRulesRaw = formData.get('roundRules') as string;
    let roundRules: string[] = [];
    if (roundRulesRaw) {
      try {
        roundRules = JSON.parse(roundRulesRaw);
      } catch (e) {}
    }

    const perRoundBreakdown = roundFormats
      .map((fmt, idx) => `• Round ${idx + 1} (${fmt}): ${roundRules[idx] || 'Standard rules apply'}`)
      .join('\n');

    const rulesVal = rules
      ? `${rules}\n\nPer-Round Match Directives & Rules:\n${perRoundBreakdown}`
      : `Multi-Format Round Schedule & Rules:\n${perRoundBreakdown}`;

    const updatedEdition = await prisma.edition.update({
      where: { id: editionId },
      data: {
        title,
        slug: title ? title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '') : undefined,
        theme,
        themeDescription: description,
        prizePool,
        maxTeams,
        rules: rulesVal,
      }
    });

    const defaultPatterns = await prisma.boardPattern.findMany({ take: roundFormats.length });
    if (defaultPatterns.length > 0) {
      await prisma.editionBoardPattern.deleteMany({ where: { editionId } });
      for (let i = 0; i < roundFormats.length; i++) {
        const pattern = defaultPatterns[i % defaultPatterns.length];
        await prisma.editionBoardPattern.create({
          data: {
            editionId: updatedEdition.id,
            patternId: pattern.id,
            sequence: i + 1,
            matchFormat: roundFormats[i],
          }
        });
      }
    }

    revalidatePath('/dashboard/organizer');
    revalidatePath('/editions');
    revalidatePath(`/editions/${updatedEdition.slug}`);

    return { success: true, edition: updatedEdition };
  } catch (error) {
    console.error('Failed to update edition:', error);
    return { success: false, error: 'Failed to update edition' };
  }
}

export async function updateEditionStatus(editionId: string, status: string) {
  try {
    const updated = await prisma.edition.update({
      where: { id: editionId },
      data: { status }
    });
    
    revalidatePath('/dashboard/organizer');
    revalidatePath(`/editions/${updated.slug}`);
    
    return { success: true, status: updated.status };
  } catch (error) {
    console.error('Failed to update edition status:', error);
    return { success: false, error: 'Edition not found or update failed' };
  }
}

export async function getEditions() {
  try {
    const editions = await prisma.edition.findMany({
      orderBy: { number: 'desc' },
      include: {
        teams: true,
        participants: true,
        matches: true
      }
    });
    return { success: true, editions };
  } catch (error) {
    console.error('Failed to fetch editions:', error);
    return { success: false, error: 'Failed to fetch editions' };
  }
}

export async function addOrUpdateEditionTeam(data: {
  editionId: string;
  name: string;
  tag: string;
  captainId?: string;
  description?: string;
  playerUserIds?: string[];
}) {
  const session = await getServerSession(authOptions);
  if (!session || ((session.user as any)?.role !== 'ORGANIZER' && (session.user as any)?.role !== 'SUPER_ADMIN')) {
    return { success: false, error: 'Unauthorized: Organizer access required.' };
  }
  try {
    const existing = await prisma.team.findFirst({
      where: { editionId: data.editionId, name: data.name }
    });

    let teamRecord;
    if (existing) {
      teamRecord = await prisma.team.update({
        where: { id: existing.id },
        data: {
          tag: data.tag,
          captainId: data.captainId || existing.captainId,
          description: data.description || existing.description,
        },
        include: {
          captain: true,
          members: { include: { user: true } },
        }
      });
    } else {
      teamRecord = await prisma.team.create({
        data: {
          editionId: data.editionId,
          name: data.name,
          tag: data.tag || data.name.substring(0, 3).toUpperCase(),
          captainId: data.captainId || undefined,
          description: data.description || 'Theme-assigned CBOT Team',
          logo: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&q=80&w=200',
        },
        include: {
          captain: true,
          members: { include: { user: true } },
        }
      });
    }

    if (data.captainId) {
      await prisma.user.update({
        where: { id: data.captainId },
        data: { role: 'CAPTAIN' }
      });
    }

    if (data.playerUserIds && data.playerUserIds.length > 0) {
      await prisma.editionParticipant.updateMany({
        where: { teamId: teamRecord.id },
        data: { teamId: null }
      });

      for (const uId of data.playerUserIds) {
        const existingParticipant = await prisma.editionParticipant.findFirst({
          where: { editionId: data.editionId, userId: uId }
        });

        if (existingParticipant) {
          await prisma.editionParticipant.update({
            where: { id: existingParticipant.id },
            data: { teamId: teamRecord.id }
          });
        } else {
          await prisma.editionParticipant.create({
            data: {
              editionId: data.editionId,
              userId: uId,
              teamId: teamRecord.id,
              status: 'REGISTERED'
            }
          });
        }
      }
    }

    revalidatePath('/dashboard/organizer');
    revalidatePath('/teams');

    return { success: true, team: teamRecord, isNew: !existing };
  } catch (error) {
    console.error('Failed to add/update team:', error);
    return { success: false, error: 'Failed to add/update team' };
  }
}

export async function updateTeamRosterAndCaptain(data: {
  teamId: string;
  name: string;
  tag: string;
  captainId: string;
  playerUserIds: string[];
}) {
  const session = await getServerSession(authOptions);
  if (!session || ((session.user as any)?.role !== 'ORGANIZER' && (session.user as any)?.role !== 'SUPER_ADMIN')) {
    return { success: false, error: 'Unauthorized: Organizer access required.' };
  }
  try {
    const team = await prisma.team.findUnique({
      where: { id: data.teamId }
    });
    if (!team) return { success: false, error: 'Team not found' };

    const updatedTeam = await prisma.team.update({
      where: { id: data.teamId },
      data: {
        name: data.name,
        tag: data.tag,
        captainId: data.captainId || undefined,
      },
      include: {
        captain: true,
        members: { include: { user: true } },
      }
    });

    if (data.captainId) {
      await prisma.user.update({
        where: { id: data.captainId },
        data: { role: 'CAPTAIN' }
      });
    }

    if (data.playerUserIds) {
      await prisma.editionParticipant.updateMany({
        where: { teamId: data.teamId },
        data: { teamId: null }
      });

      for (const uId of data.playerUserIds) {
        const existingParticipant = await prisma.editionParticipant.findFirst({
          where: { editionId: team.editionId, userId: uId }
        });

        if (existingParticipant) {
          await prisma.editionParticipant.update({
            where: { id: existingParticipant.id },
            data: { teamId: data.teamId }
          });
        } else {
          await prisma.editionParticipant.create({
            data: {
              editionId: team.editionId,
              userId: uId,
              teamId: data.teamId,
              status: 'REGISTERED'
            }
          });
        }
      }
    }

    revalidatePath('/dashboard/organizer');
    revalidatePath('/teams');

    return { success: true, team: updatedTeam };
  } catch (error) {
    console.error('Failed to update team roster and captain:', error);
    return { success: false, error: 'Failed to update team details' };
  }
}

export async function getEditionBySlug(slug: string) {
  try {
    const edition = await prisma.edition.findUnique({
      where: { slug },
      include: {
        teams: {
          include: {
            members: { include: { user: true } },
            captain: true
          }
        },
        participants: { include: { user: true } },
        matches: {
          include: {
            team1: true,
            team2: true,
            winner: true
          }
        },
        leagueStandings: true
      }
    });
    if (!edition) return { success: false, error: 'Edition not found' };
    return { success: true, edition };
  } catch (error) {
    console.error('Failed to fetch edition:', error);
    return { success: false, error: 'Failed to fetch edition' };
  }
}
