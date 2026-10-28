FROM node:20-alpine AS base
WORKDIR /repo
RUN apk add --no-cache openssl

FROM base AS deps
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared-types/package.json packages/shared-types/package.json
RUN npm ci

FROM deps AS build
COPY packages/shared-types packages/shared-types
COPY prisma prisma
COPY apps/api apps/api
RUN npm run build --workspace=@trabalho/shared-types
RUN npx prisma generate --schema=prisma/schema.prisma
RUN npm run build --workspace=@trabalho/api

FROM node:20-alpine AS runtime
WORKDIR /repo
RUN apk add --no-cache openssl
ENV NODE_ENV=production
COPY --from=build /repo/node_modules ./node_modules
COPY --from=build /repo/packages/shared-types ./packages/shared-types
COPY --from=build /repo/prisma ./prisma
COPY --from=build /repo/apps/api/package.json ./apps/api/package.json
COPY --from=build /repo/apps/api/dist ./apps/api/dist
WORKDIR /repo/apps/api
EXPOSE 4000
CMD ["sh", "-c", "npx prisma migrate deploy --schema=../../prisma/schema.prisma && node dist/server.js"]
