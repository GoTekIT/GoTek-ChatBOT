# Frontend Dockerfile for GoTek Chatbot
FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig.json vite.config.ts index.html ./
COPY src ./src
COPY public ./public

RUN npm run build

# Nginx production serving stage
FROM nginx:alpine AS runner

COPY --from=builder /app/dist /usr/share/nginx/html
COPY <<EOF /etc/nginx/conf.d/default.conf
server {
    listen 80;
    server_name localhost;

    location / {
        root /usr/share/nginx/html;
        index index.html index.htm;
        try_files \$uri \$uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://backend:4317/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
    }

    location /widget-api/ {
        proxy_pass http://backend:4317/widget-api/;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
    }

    location ~ ^/(widget\.js|sdk\.js) {
        proxy_pass http://backend:4317;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
    }
}
EOF

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
