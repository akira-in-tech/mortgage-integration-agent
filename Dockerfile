# Temporal's native bridge publishes glibc-compatible binaries. Keeping both
# stages on Debian slim prevents a build that succeeds but fails at runtime on
# Alpine's musl libc with a missing gnu_get_libc_version symbol.
FROM node:24-bookworm-slim AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:24-bookworm-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist
EXPOSE 3000
CMD ["node", "dist/main"]
