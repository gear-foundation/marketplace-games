FROM node:20-alpine AS builder

WORKDIR /app

ARG VITE_NODE_ADDRESS=wss://rpc.vara.network
ARG VITE_PROGRAM_ID=0xacc90a11efbb848c75cfd166b00c4bf3d702fd767f0930e9d2840bf091614f1b
ARG VITE_NETWORK=vara-mainnet
ARG VITE_VOUCHER_BACKEND_URL=https://arcade-vara-production.up.railway.app
ARG VITE_ALLOWED_HOSTS=robo-miner-production.up.railway.app

ENV VITE_NODE_ADDRESS=$VITE_NODE_ADDRESS
ENV VITE_PROGRAM_ID=$VITE_PROGRAM_ID
ENV VITE_NETWORK=$VITE_NETWORK
ENV VITE_VOUCHER_BACKEND_URL=$VITE_VOUCHER_BACKEND_URL
ENV VITE_ALLOWED_HOSTS=$VITE_ALLOWED_HOSTS

COPY package.json package-lock.json ./
RUN npm ci --legacy-peer-deps

COPY . .
RUN npm run build

FROM nginx:1.27-alpine

ENV PORT=8080

COPY nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 8080
