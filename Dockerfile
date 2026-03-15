FROM node:20-bookworm-slim

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    build-essential \
    ca-certificates \
    cmake \
    curl \
    ffmpeg \
    pkg-config \
    wget \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

ARG WHISPER_MODEL_NAME=small
ENV WHISPER_MODEL_NAME=${WHISPER_MODEL_NAME}
ENV WHISPER_AUTO_DOWNLOAD=false

RUN chmod +x node_modules/nodejs-whisper/cpp/whisper.cpp/models/download-ggml-model.sh \
  && cd node_modules/nodejs-whisper/cpp/whisper.cpp/models \
  && ./download-ggml-model.sh "${WHISPER_MODEL_NAME}" \
  && cd .. \
  && cmake -B build \
  && cmake --build build --config Release

RUN npm run build

ENV NODE_ENV=production

EXPOSE 3000

CMD ["npm", "run", "start"]
