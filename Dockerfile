FROM node:22-alpine AS service
WORKDIR /app
COPY package*.json ./
COPY client/package.json ./client/
COPY services/auth-service/package.json ./services/auth-service/
COPY services/catalog-service/package.json ./services/catalog-service/
COPY services/booking-service/package.json ./services/booking-service/
COPY services/notification-service/package.json ./services/notification-service/
COPY services/shortener-service/package.json ./services/shortener-service/
COPY services/gateway/package.json ./services/gateway/
RUN npm ci
COPY shared ./shared
COPY services ./services
COPY client ./client
RUN npm run build
USER node
CMD ["node", "services/gateway/server.js"]
FROM nginx:1.27-alpine AS gateway
COPY infra/nginx.conf /etc/nginx/nginx.conf
COPY --from=service /app/client/dist /usr/share/nginx/html
