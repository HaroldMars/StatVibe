# StatVibe — production image. No build step, no dependencies.
FROM node:20-alpine

WORKDIR /app

# App source (there are no dependencies to install)
COPY package.json ./
COPY server.js ./
COPY public ./public

ENV NODE_ENV=production
ENV PORT=4173
ENV HOST=0.0.0.0
# Point at your Ollama host; leave default to reach a sidecar on the same network.
ENV OLLAMA_HOST=http://host.docker.internal:11434
# IMPORTANT: override this in your deployment.
ENV ADMIN_TOKEN=change-me-in-production

EXPOSE 4173

# Container health check hits the app's own endpoint.
HEALTHCHECK --interval=30s --timeout=4s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:'+(process.env.PORT||4173)+'/api/health',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

CMD ["node", "server.js"]
