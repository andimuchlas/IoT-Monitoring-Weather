FROM oven/bun:1-alpine AS base
WORKDIR /app

# Install dependencies
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile

# Copy application source
COPY . .

EXPOSE 3001

CMD ["bun", "run", "start"]
