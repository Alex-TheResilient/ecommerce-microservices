FROM node:22-alpine

RUN npm install -g pnpm

WORKDIR /app

COPY package.json pnpm-lock.yaml* ./

RUN pnpm install

# Copiar código fuente
COPY . .

RUN ln -s /usr/lib/libssl.so.3 /lib/libssl.so.3

RUN pnpm prisma generate

EXPOSE 3000

CMD ["pnpm", "run", "dev"]