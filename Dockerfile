FROM node:22-alpine AS service
WORKDIR /app
COPY package*.json ./
COPY frontend/package.json ./frontend/
COPY backend/services/auth-service/package.json ./backend/services/auth-service/
COPY backend/services/catalog-service/package.json ./backend/services/catalog-service/
COPY backend/services/booking-service/package.json ./backend/services/booking-service/
COPY backend/services/notification-service/package.json ./backend/services/notification-service/
COPY backend/services/gateway/package.json ./backend/services/gateway/
RUN npm ci
COPY backend/shared ./backend/shared
COPY backend/services ./backend/services
COPY frontend ./frontend
RUN npm run build
USER node
CMD ["node", "backend/services/gateway/server.js"]
FROM nginx:1.27-alpine AS gateway
COPY backend/infra/nginx.conf /etc/nginx/nginx.conf
COPY --from=service /app/frontend/dist /usr/share/nginx/html
