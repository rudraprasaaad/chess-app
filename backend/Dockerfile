FROM node:24-alpine AS builder

WORKDIR /app

RUN npm install -g pnpm@10.14.0

COPY pnpm-workspace.yaml .
COPY pnpm-lock.yaml . 

RUN pnpm install --frozen-lockfile

COPY backend/ /app/backend/

WORKDIR /app/backend

RUN npx prisma generate

RUN pnpm run build


FROM node:24-alpine

WORKDIR /app

RUN npm install -g pnpm@10.14.0

COPY pnpm-workspace.yaml .
COPY pnpm-lock.yaml . 

RUN pnpm install --prod --no-frozen-lockfile --filter=@chess-app/backend 

COPY --from=builder /app/backend/dist ./backend/dist 

COPY --from=builder /app/backend/node_modules/@prisma/client ./backend/node_modules/@prisma/client 

WORKDIR /app/backend 

EXPOSE 4000

CMD ["node", "dist/index.js"]
