FROM node:22-alpine

ENV NODE_ENV=production
WORKDIR /app

COPY package.json package-lock.json ./
COPY client/package.json ./client/package.json
COPY server/package.json ./server/package.json
RUN npm ci --omit=dev --workspace=server --include-workspace-root=false

COPY server ./server
COPY database ./database

WORKDIR /app/server
EXPOSE 4000
USER node
CMD ["npm", "start"]
