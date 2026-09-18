FROM node:22-bookworm-slim

WORKDIR /app

# Poppler is required by ResumeScanner.js for scanned-PDF OCR on Linux.
RUN apt-get update \
    && apt-get install -y --no-install-recommends poppler-utils \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

ENV NODE_ENV=production

EXPOSE 10000

CMD ["node", "server.js"]
