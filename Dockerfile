FROM node:14 AS build-env

WORKDIR /app

COPY src/dist/app.js src/package*.json ./
RUN npm ci --only=production

FROM gcr.io/distroless/nodejs:14

WORKDIR /app

COPY --from=build-env /app ./
EXPOSE 8080

CMD [ "app.js" ]