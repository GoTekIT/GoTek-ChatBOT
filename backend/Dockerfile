# Backend Dockerfile for GoTek Chatbot
FROM node:22-alpine AS builder

WORKDIR /app

# Copy dependency definitions
COPY package*.json ./
RUN npm ci

# Copy source code and configurations
COPY tsconfig.json ./
COPY src ./src
COPY db ./db
COPY public ./public
COPY scripts ./scripts

# Typecheck and build
RUN npx tsc --noEmit

# Production runtime stage
FROM node:22-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=4317
ENV HOST=0.0.0.0

# Install production dependencies only
COPY package*.json ./
RUN npm ci --omit=dev

# Copy application files
COPY --from=builder /app/src ./src
COPY --from=builder /app/db ./db
COPY --from=builder /app/public ./public
COPY --from=builder /app/scripts ./scripts

EXPOSE 4317

CMD ["npx", "tsx", "src/index.ts"]
