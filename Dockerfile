# Build stage - Sunspot (Go binary)
FROM golang:1.24-bookworm AS sunspot-builder

# Install git for cloning
RUN apt-get update && apt-get install -y git

# Clone and build sunspot
WORKDIR /build
RUN git clone https://github.com/reilabs/sunspot.git
WORKDIR /build/sunspot/go
RUN go build -o sunspot .

# Dependencies stage - Install Node dependencies
FROM node:20-bookworm AS deps
WORKDIR /app

# Copy package files
COPY app/package.json app/package-lock.json* ./

# Install dependencies
RUN npm install

# Builder stage - Build Next.js
FROM node:20-bookworm AS builder
WORKDIR /app

# Copy dependencies
COPY --from=deps /app/node_modules ./node_modules
COPY app/ ./

# Build Next.js in standalone mode
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# Runner stage - Production image
FROM node:20-bookworm-slim AS runner
WORKDIR /app

# Install runtime dependencies (git needed for noirup)
RUN apt-get update && apt-get install -y \
    curl \
    bash \
    ca-certificates \
    git \
    && rm -rf /var/lib/apt/lists/*

# Install nargo (Noir compiler) - MUST match local version (1.0.0-beta.18)
ENV NARGO_HOME=/root/.nargo
ENV PATH="${NARGO_HOME}/bin:${PATH}"
RUN curl -L https://raw.githubusercontent.com/noir-lang/noirup/refs/heads/main/install | bash
RUN /root/.nargo/bin/noirup -v 1.0.0-beta.18

# Copy sunspot binary
COPY --from=sunspot-builder /build/sunspot/go/sunspot /usr/local/bin/sunspot

# Copy circuits with pre-compiled artifacts (already compiled locally with matching nargo version)
COPY circuits/ /circuits/

# Create symlink for circuit access from app
RUN ln -sf /circuits /app/../circuits

# Set up Next.js production
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Copy Next.js build artifacts
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Verify tools are installed
RUN nargo --version && sunspot --help | head -1

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:3000/api/prove || exit 1

EXPOSE 3000

CMD ["node", "server.js"]
