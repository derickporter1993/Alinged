# Stage 1: Build client
FROM node:20-alpine AS client-build
WORKDIR /app
COPY package.json package-lock.json ./
COPY client/package.json client/
COPY server/package.json server/
COPY shared/ shared/
RUN npm ci --workspace=client
COPY client/ client/
RUN npm run build --workspace=client

# Stage 2: Build server
FROM node:20-alpine AS server-build
WORKDIR /app
COPY package.json package-lock.json ./
COPY client/package.json client/
COPY server/package.json server/
COPY shared/ shared/
RUN npm ci --workspace=server
COPY server/ server/
RUN npm run build --workspace=server

# Stage 3: Production
FROM node:20-alpine
WORKDIR /app

# Install production dependencies only
COPY package.json package-lock.json ./
COPY client/package.json client/
COPY server/package.json server/
RUN npm ci --workspace=server --omit=dev

# Copy built artifacts
COPY --from=server-build /app/server/dist server/dist
COPY --from=server-build /app/server/src/schema.sql server/src/schema.sql
COPY --from=client-build /app/client/dist client/dist
COPY shared/ shared/

# Create data directory for SQLite
RUN mkdir -p /data

ENV NODE_ENV=production
ENV PORT=3001
ENV DB_PATH=/data/hivemind.db
ENV CORS_ORIGIN=*

EXPOSE 3001

CMD ["node", "server/dist/index.js"]
