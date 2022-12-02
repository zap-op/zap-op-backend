FROM ubuntu:latest
EXPOSE 8888

RUN apt-get update && apt-get upgrade -y
RUN apt-get install -y curl unzip git default-jre
RUN curl -fsSL https://deb.nodesource.com/setup_18.x | bash
RUN apt-get install -y nodejs

WORKDIR /usr/src/zap-op-backend
COPY . .

RUN curl -LJo ZAP_2.12.0_Core.zip https://github.com/zaproxy/zaproxy/releases/download/v2.12.0/ZAP_2.12.0_Core.zip
RUN unzip -o ZAP_2.12.0_Core.zip && rm -rf ZAP_2.12.0_Core.zip

RUN npm install -g npm@latest && npm install
CMD ["npm", "start"]