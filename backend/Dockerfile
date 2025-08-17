FROM node:24-alpine AS builder

WORKDIR /app

RUN npm install -g pnpm@10.14.0

COPY pnpm-workspace.yaml .
COPY pnpm-lock.yaml .
COPY backend/package.json ./backend/package.json

RUN pnpm install --frozen-lockfile

COPY backend/ /app/backend/

WORKDIR /app/backend
RUN npx prisma generate
RUN pnpm run build

FROM node:24-alpine

WORKDIR /app/backend

COPY --from=builder /app/backend/dist ./dist
COPY --from=builder /app/backend/package.json .
COPY --from=builder /app/backend/node_modules ./node_modules
COPY --from=builder /app/backend/node_modules/@prisma/client ./node_modules/@prisma/client

EXPOSE 4000

CMD ["node", "dist/index.js"]
