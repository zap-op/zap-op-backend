FROM owasp/zap2docker-stable:2.12.0 as zap
FROM ubuntu:latest

RUN apt-get update && apt-get upgrade -y
RUN apt-get install -y git curl default-jre net-tools neovim
RUN curl -fsSL https://deb.nodesource.com/setup_18.x | bash
RUN apt-get install -y nodejs

WORKDIR /zap-op-backend

# Build server
COPY . .
RUN npm install -g npm@latest && npm install && npm run build

# Get ZAP addons
COPY --from=zap /zap ./ZAP_2.12.0
RUN ./ZAP_2.12.0/zap.sh -cmd -addoninstallall -addonupdate

EXPOSE 8888

CMD ["npm", "run", "start"]