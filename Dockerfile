FROM ubuntu:22.04

WORKDIR /usr/src/app

COPY . .
EXPOSE 8888

RUN apt-get update

RUN apt-get install -y curl unzip
RUN curl -LJo ZAP_2.11.1.zip https://github.com/zaproxy/zaproxy/releases/download/v2.11.1/ZAP_2.11.1_Core.zip
RUN unzip -o ZAP_2.11.1.zip && rm -rf ZAP_2.11.1.zip

RUN apt-get install -y default-jre

RUN curl -fsSL https://deb.nodesource.com/setup_18.x | bash
RUN apt-get install -y nodejs && npm install -g npm@latest
RUN npm install

CMD ["npm", "start"]