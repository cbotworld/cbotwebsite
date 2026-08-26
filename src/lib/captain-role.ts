import { prisma } from '@/lib/prisma';

const CAPTAIN = 'CAPTAIN';
const PLAYER = 'PLAYER';

/**
 * Keeps `User.role` in step with team captaincy.
 *
 * Promotion only touches players, so an organizer who also captains a team keeps
 * their higher role. An outgoing captain drops back to player unless they still
 * captain another team.
 */
export async function syncCaptainRole(opts: {
  newCaptainId?: string | null;
  previousCaptainId?: string | null;
}) {
  const newCaptainId = opts.newCaptainId || null;
  const previousCaptainId = opts.previousCaptainId || null;

  if (newCaptainId) {
    await prisma.user.updateMany({
      where: { id: newCaptainId, role: PLAYER },
      data: { role: CAPTAIN },
    });
  }

  if (previousCaptainId && previousCaptainId !== newCaptainId) {
    const stillCaptains = await prisma.team.findFirst({
      where: { captainId: previousCaptainId },
      select: { id: true },
    });
    if (!stillCaptains) {
      await prisma.user.updateMany({
        where: { id: previousCaptainId, role: CAPTAIN },
        data: { role: PLAYER },
      });
    }
  }
}
