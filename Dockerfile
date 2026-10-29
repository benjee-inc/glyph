FROM caddy:2-alpine
COPY Caddyfile /etc/caddy/Caddyfile
COPY index.html style.css app.js favicon.ico robots.txt /srv/
COPY assets /srv/assets
