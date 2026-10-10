FROM node:22-bookworm-slim AS build
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
RUN npm ci
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN mkdir -p public && npm run build
FROM node:22-bookworm-slim AS runtime
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends python3 python3-pip poppler-utils ca-certificates && python3 -m pip install --break-system-packages --no-cache-dir PyMuPDF Pillow && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production HOSTNAME=0.0.0.0 PORT=3000 TAX_REFEREE_DATA_DIR=/app/data/runtime TAX_REFEREE_DB_PATH=/app/data/runtime/tax_referee.db
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
RUN mkdir -p data/runtime && chown -R node:node data/runtime
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node","server.js"]
