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
              try {
                const hashed = await bcrypt.hash('2905', 10);
                await prisma.user.upsert({
                  where: { username: 'balumaster' },
                  update: { role: 'ORGANIZER', name: 'Carrom Balu', pin: hashed, isActivated: true },
                  create: {
                    id: 'usr_organizer_1',
                    username: 'balumaster',
                    name: 'Carrom Balu',
                    role: 'ORGANIZER',
                    pin: hashed,
                    isActivated: true,
                  }
                });
              } catch (e) {}

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

          // Search database
          const foundUser = await prisma.user.findUnique({
            where: { username: inputUsername }
          });

          if (foundUser && foundUser.pin) {
            let isPinValid = false;

            // Check if stored PIN is a valid bcrypt hash
            if (foundUser.pin.startsWith('$2a$') || foundUser.pin.startsWith('$2b$')) {
              isPinValid = await bcrypt.compare(inputPin, foundUser.pin);
            } else {
              // Direct string match for plain text 4-digit PINs
              isPinValid = (inputPin === foundUser.pin);
            }

            if (!isPinValid || !foundUser.isActivated) {
              return null;
            }

            return {
              id: foundUser.id,
              name: foundUser.name,
              email: foundUser.email || `${foundUser.username}@cbot.gg`,
              image: foundUser.image,
              username: foundUser.username,
              role: foundUser.role,
              isActivated: foundUser.isActivated,
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
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).role = token.role;
        (session.user as any).id = token.id;
        (session.user as any).username = token.username;
        (session.user as any).isActivated = token.isActivated;
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
