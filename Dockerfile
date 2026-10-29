FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY server.js ./
COPY index.html style.css app.js favicon.ico robots.txt ./public/
COPY assets ./public/assets
EXPOSE 8080
CMD ["node", "server.js"]
