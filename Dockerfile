# Imagen base ligera — sin Chromium, sin Puppeteer
FROM node:20-alpine

ENV NODE_ENV=production
ENV API_KEY=supersecretkey

WORKDIR /usr/src/app

# Instalar pnpm
RUN npm install -g pnpm

# Copiar manifiesto e instalar deps
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod

# Copiar código
COPY . .

EXPOSE 3000
CMD ["pnpm", "api"]
