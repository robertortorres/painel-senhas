FROM nginx:1.27-alpine
# Vue baixado no build: a página não depende de CDN em tempo de execução
ADD https://cdn.jsdelivr.net/npm/vue@3.5.13/dist/vue.global.prod.js /usr/share/nginx/html/vendor/vue.global.prod.js
RUN chmod 644 /usr/share/nginx/html/vendor/vue.global.prod.js
COPY index.html /usr/share/nginx/html/index.html
