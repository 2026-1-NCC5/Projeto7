FROM node:18-slim
WORKDIR /app


COPY backend/package*.json ./
RUN npm ci --only=production


COPY backend/ ./

ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "main.js"]
