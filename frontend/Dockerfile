# Этап 1: Сборка React-приложения
# Node 24 LTS (Node 20 поддерживается только до апреля 2026); Vite 8 требует Node 20.19+ или 22.12+
FROM node:24-alpine AS build
WORKDIR /app

# Копируем настройки пакетов и ставим зависимости строго по package-lock.json
COPY package*.json ./
RUN npm ci

# Копируем весь код (без node_modules — см. .dockerignore) и собираем
COPY . .
RUN npm run build

# Этап 2: Раздача через Nginx
FROM nginx:alpine
RUN rm -rf /usr/share/nginx/html/*

# Копируем готовый билд (из папки dist) из первого этапа
COPY --from=build /app/dist /usr/share/nginx/html

# Копируем конфиг Nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
