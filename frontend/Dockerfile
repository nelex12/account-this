# Этап 1: Сборка React-приложения
FROM node:20-alpine AS build
WORKDIR /app

# Копируем настройки пакетов и устанавливаем зависимости
COPY package*.json ./
RUN npm install

# Копируем весь код и собираем
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