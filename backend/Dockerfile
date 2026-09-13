FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
COPY tsconfig*.json ./
COPY src/prisma ./src/prisma

RUN npm ci

COPY . .

RUN npx prisma generate
RUN npm run build
RUN mkdir -p uploads && chown -R node:node /app

EXPOSE 8000

USER node

CMD ["sh", "-c", "npx prisma migrate deploy && npm run start"]
