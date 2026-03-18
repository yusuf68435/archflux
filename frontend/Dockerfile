FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm install --legacy-peer-deps

# Build the application
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Dummy build-time env vars (replaced at runtime)
ENV STRIPE_SECRET_KEY=sk_dummy_buildtime
ENV NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_dummy_buildtime
ENV NEXTAUTH_SECRET=dummy_build_secret
ENV NEXTAUTH_URL=http://localhost:3000
ENV GOOGLE_CLIENT_ID=dummy
ENV GOOGLE_CLIENT_SECRET=dummy

RUN npm run build

# Production image
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
