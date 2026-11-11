# syntax=docker/dockerfile:1

# ==============================================================================
# Base image with required system libraries for Prisma and Alpine Linux
# ==============================================================================
FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

# ==============================================================================
# Install dependencies
# ==============================================================================
FROM base AS deps
WORKDIR /app

COPY package.json package-lock.json* ./
COPY prisma ./prisma/

RUN npm ci

# ==============================================================================
# Build application
# ==============================================================================
FROM base AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build-time arguments (can be supplied in Dokploy build args or default safely)
ARG DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder"
ARG DIRECT_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder"
ARG NEXTAUTH_SECRET="build-secret-placeholder-replaced-at-runtime"
ARG NEXTAUTH_URL="http://localhost:3006"
ARG NEXT_PUBLIC_SUPABASE_URL=""
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY=""
ARG NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION=""

ENV DATABASE_URL=${DATABASE_URL}
ENV DIRECT_URL=${DIRECT_URL}
ENV NEXTAUTH_SECRET=${NEXTAUTH_SECRET}
ENV NEXTAUTH_URL=${NEXTAUTH_URL}
ENV NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL}
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=${NEXT_PUBLIC_SUPABASE_ANON_KEY}
ENV NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION=${NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION}

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Generate Prisma Client for the Linux container environment
RUN npx prisma generate

# Build Next.js standalone bundle
RUN npm run build

# ==============================================================================
# Production runner image (minimal size, non-root user)
# ==============================================================================
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3006
ENV HOSTNAME="0.0.0.0"

# Install curl for Docker healthcheck and bash for entrypoint
RUN apk add --no-cache curl bash openssl libc6-compat

# Create secure non-root system user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy static assets and public directory
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/static ./.next/static

# Copy Next.js standalone build
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./

# Copy Prisma schema and generated engines into standalone node_modules
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma/client ./node_modules/@prisma/client

# Copy entrypoint script
COPY docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh && \
    chown nextjs:nodejs ./docker-entrypoint.sh

USER nextjs

EXPOSE 3006

# Container healthcheck for Dokploy / Traefik
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD curl -f http://127.0.0.1:3006/api/health || exit 1

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "server.js"]

