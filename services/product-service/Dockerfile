FROM node:22-alpine

RUN npm install -g pnpm

WORKDIR /app

COPY package.json pnpm-lock.yaml* ./

RUN pnpm install

# Copiar código fuente
COPY . .

RUN pnpm prisma generate

EXPOSE 3000

CMD ["pnpm", "run", "dev"]