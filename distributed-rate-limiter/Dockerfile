FROM node:24
RUN apt-get update && apt-get install -y redis-server && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY . .
RUN npm install
EXPOSE 3000
CMD redis-server --daemonize yes && node server.js