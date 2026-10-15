# Stage 1 — build the static SPA.
FROM node:24-alpine AS build
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
# In the container the /api path is proxied to the real API by nginx below,
# so the built app talks to the seeded database instead of local fixtures.
ENV VITE_USE_MOCK=false
RUN pnpm build

# Stage 2 — serve dist with nginx; /api proxies to the compose `api` service.
FROM nginx:1.29-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
