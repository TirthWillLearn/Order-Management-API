# ---------- BUILD STAGE ----------
FROM node:18-alpine AS builder

WORKDIR /app

# Copy dependency files
COPY package*.json ./

# Install all deps (including dev for build)
RUN npm ci

# Copy source code
COPY . .

# Build TypeScript → dist/
RUN npm run build


# ---------- PRODUCTION STAGE ----------
FROM node:18-alpine

WORKDIR /app

# Copy only package files
COPY package*.json ./

# Install ONLY production dependencies
RUN npm ci --only=production

# Copy built files from builder
COPY --from=builder /app/dist ./dist

# Expose port
EXPOSE 10000

# Start app
CMD ["node", "dist/app.js"]