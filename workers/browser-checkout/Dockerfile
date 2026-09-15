FROM mcr.microsoft.com/playwright:v1.58.2-noble
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts
COPY . .
ENV NODE_ENV=production PORT=8080 DATA_DIR=/data
EXPOSE 8080
CMD ["sh", "-c", "mkdir -p \"$DATA_DIR\" && exec flock -n -F \"$DATA_DIR/.worker.lock\" node server.mjs"]
