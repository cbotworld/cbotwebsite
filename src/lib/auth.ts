import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Username & PIN',
      credentials: {
        username: { label: 'Username', type: 'text', placeholder: 'striker_vikram' },
        pin: { label: '4-Digit PIN', type: 'password', placeholder: '1234' },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.pin) return null;

        const inputUsername = credentials.username.trim().toLowerCase();
        const inputPin = credentials.pin.trim();

        try {
          // Special fallback credentials for Organizer Carrom Balu
          if (
            inputUsername === 'balumaster' ||
            inputUsername === 'carrombalu' ||
            inputUsername === 'balu' ||
            inputUsername === 'carrom_balu'
          ) {
            if (inputPin === '2905' || inputPin === '9999') {
              return {
                id: 'usr_organizer_1',
                name: 'Carrom Balu',
                email: 'balumaster@cbot.gg',
                image: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200',
                username: 'balumaster',
                role: 'ORGANIZER',
                isActivated: true,
              };
            }
          }

          const rawInput = credentials.username.trim();
          const cleanInput = rawInput.replace(/^@/, '').toLowerCase();
          const withAt = `@${cleanInput}`;

          // Fast indexed lookup by username first (sub-millisecond execution)
          let foundUser = await prisma.user.findUnique({
            where: { username: cleanInput }
          });

          if (!foundUser) {
            // Fallback lookup for @mentions or name matching
            foundUser = await prisma.user.findFirst({
              where: {
                OR: [
                  { username: withAt },
                  { username: rawInput },
                  { name: { equals: rawInput, mode: 'insensitive' } },
                ]
              }
            });
          }

          if (foundUser) {
            let isPinValid = false;

            if (!foundUser.pin) {
              // If user has no PIN assigned yet in DB, set their PIN to inputPin and log in
              try {
                const hashed = await bcrypt.hash(inputPin, 10);
                await prisma.user.update({
                  where: { id: foundUser.id },
                  data: { pin: hashed, isActivated: true }
                });
              } catch (e) {}
              isPinValid = true;
            } else {
              const storedPin = foundUser.pin.trim();
              if (storedPin.startsWith('$2a$') || storedPin.startsWith('$2b$')) {
                isPinValid = await bcrypt.compare(inputPin, storedPin);
              } else {
                // Direct string match for plain text 4-digit PINs
                isPinValid = (inputPin === storedPin);
              }
            }

            if (!isPinValid) {
              return null;
            }

            // Auto-activate account on successful PIN authentication
            if (!foundUser.isActivated) {
              try {
                await prisma.user.update({
                  where: { id: foundUser.id },
                  data: { isActivated: true }
                });
              } catch (e) {}
            }

            return {
              id: foundUser.id,
              name: foundUser.name,
              email: foundUser.email || `${cleanInput}@cbot.gg`,
              image: foundUser.image,
              username: foundUser.username,
              role: foundUser.role || 'PLAYER',
              isActivated: true,
            };
          }
        } catch (err) {
          console.error('NextAuth authorize error:', err);
          return null;
        }

        return null;
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as any).role;
        token.id = user.id;
        token.username = (user as any).username;
        token.isActivated = (user as any).isActivated;
        token.hasCaptainDesk = false;
      }

      // Re-read role and captaincy on every call rather than only at sign-in:
      // starting a new tournament resets every captain to player, and that has
      // to reach the UI without making people log out and back in.
      if (token.id) {
        try {
          const fresh = await prisma.user.findUnique({
            where: { id: String(token.id) },
            select: {
              role: true,
              captainedTeams: { select: { id: true }, take: 1 },
            },
          });
          if (fresh) {
            const role = fresh.role || 'PLAYER';
            token.role = role;
            token.hasCaptainDesk =
              role === 'ORGANIZER' || role === 'SUPER_ADMIN'
                ? false
                : fresh.captainedTeams.length > 0;
          }
        } catch {
          // Leave the existing token alone if the lookup fails.
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).role = token.role;
        (session.user as any).id = token.id;
        (session.user as any).username = token.username;
        (session.user as any).isActivated = token.isActivated;
        (session.user as any).hasCaptainDesk = Boolean(token.hasCaptainDesk);
      }
      return session;
    },
  },
  pages: {
    signIn: '/login',
  },
  session: {
    strategy: 'jwt',
  },
  secret: process.env.NEXTAUTH_SECRET || 'cbot-pin-auth-secret-key-2026',
};
