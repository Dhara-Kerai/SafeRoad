FROM node:20-alpine

WORKDIR /app

RUN addgroup -g 10001 saferoad && addgroup node saferoad

COPY package*.json ./
COPY tsconfig*.json ./
COPY src/prisma ./src/prisma

RUN npm ci

COPY . .

RUN npx prisma generate
RUN npm run build
RUN mkdir -p uploads && chown -R node:saferoad /app && chmod 2775 uploads

EXPOSE 8000

USER node

CMD ["sh", "-c", "umask 0002 && npx prisma migrate deploy && npm run start"]
