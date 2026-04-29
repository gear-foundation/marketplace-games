FROM node:20-alpine AS builder

WORKDIR /app

ARG VITE_NODE_ADDRESS=wss://rpc.vara.network
ARG VITE_PROGRAM_ID=0xbf54fe438121510a6e435686eb255af9106d5e74e5c0593142a7a9de29dad78f
ARG VITE_VOUCHER_BACKEND_URL=https://arcade-vara-production.up.railway.app
ARG VITE_ALLOWED_HOSTS=deep-sea-feast-vara.up.railway.app,arcade-vara.up.railway.app

ENV VITE_NODE_ADDRESS=$VITE_NODE_ADDRESS
ENV VITE_PROGRAM_ID=$VITE_PROGRAM_ID
ENV VITE_VOUCHER_BACKEND_URL=$VITE_VOUCHER_BACKEND_URL
ENV VITE_ALLOWED_HOSTS=$VITE_ALLOWED_HOSTS

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM nginx:1.27-alpine

ENV PORT=8080

COPY nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 8080
