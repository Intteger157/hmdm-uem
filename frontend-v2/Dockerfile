FROM node:22-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
# npm ci fails when lock file was generated on another OS (optional native bindings).
RUN npm install --no-audit --no-fund

COPY . .
RUN npm run build

FROM nginx:1.27-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
