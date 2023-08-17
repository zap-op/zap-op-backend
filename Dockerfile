FROM owasp/zap2docker-stable:2.13.0 as zap
FROM ubuntu:23.04

RUN apt-get update && \
    apt-get install -y git curl default-jre net-tools neovim wget fonts-liberation libgbm1 libgtk-3-0 libu2f-udev libvulkan1 libxkbcommon0 xdg-utils
RUN curl -fsSL https://deb.nodesource.com/setup_18.x | bash && \
    apt-get install -y nodejs && \
    npm install -g npm@latest

# Switch to root-less user
ARG USERNAME=ubuntu
RUN apt-get install -y sudo && \
    echo $USERNAME ALL=\(root\) NOPASSWD:ALL > /etc/sudoers.d/$USERNAME && \
    chmod 0440 /etc/sudoers.d/$USERNAME
USER $USERNAME
WORKDIR /home/$USERNAME/zap-op-backend

# Install Chrome
RUN wget https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb && \
    sudo dpkg -i google-chrome*.deb

# Build server
COPY . .
RUN npm install && \
    npm run build

# Get ZAP addons
COPY --from=zap /zap ./ZAP_2.13.0
RUN ./ZAP_2.13.0/zap.sh -cmd -addoninstallall -addonupdate

EXPOSE 8888

CMD ["npm", "run", "start"]