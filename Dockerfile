FROM mcr.microsoft.com/playwright:v1.58.2-jammy

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

ENV NODE_ENV=production

RUN mkdir -p /app/output/results \
    /app/output/logs \
    /app/output/screenshots \
    /app/output/debug \
    /app/output/report

CMD ["npm", "run", "start:validated"]
