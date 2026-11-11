FROM nginx:1.27-alpine
# Bibliotecas baixadas no build: a página não depende de CDN em tempo de execução
ADD https://cdn.jsdelivr.net/npm/vue@3.5.13/dist/vue.global.prod.js /usr/share/nginx/html/vendor/vue.global.prod.js
ADD https://cdn.jsdelivr.net/npm/chart.js@4.4.7/dist/chart.umd.js /usr/share/nginx/html/vendor/chart.umd.js
RUN chmod 644 /usr/share/nginx/html/vendor/*.js
COPY index.html /usr/share/nginx/html/index.html
