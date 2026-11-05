FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
COPY server/package*.json server/
COPY client/package*.json client/
RUN npm ci
RUN npm ci --prefix client
COPY client client
RUN npm run build --prefix client

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
COPY server/package*.json server/
RUN npm ci --omit=dev --prefix server
COPY server server
COPY --from=build /app/client/dist client/dist
EXPOSE 3000
CMD ["node", "server/src/index.js"]
