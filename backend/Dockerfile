FROM node:20-alpine AS builder

WORKDIR /app

ENV DATABASE_URL="postgresql://user:password@localhost:5432/highclassdb?schema=public"
ENV DIRECT_URL="postgresql://user:password@localhost:5432/highclassdb?schema=public"

COPY package*.json ./
RUN npm ci

COPY . .
RUN npx prisma generate && npm run build
RUN npm prune --omit=dev

FROM node:20-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package*.json ./

EXPOSE 3000

CMD ["node", "dist/main.js"]