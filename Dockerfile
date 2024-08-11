FROM archlinux:latest

RUN pacman -Sy               \
    --noconfirm              \
    wget


WORKDIR /
RUN wget --quiet https://nodejs.org/dist/v18.15.0/node-v18.15.0-linux-x64.tar.xz \
    && tar xf node-v18.15.0-linux-x64.tar.xz 

ENV PATH="/node-v18.15.0-linux-x64/bin:"${PATH}
RUN npm install typescript ts-node --save --global
ENV PATH="/node_modules/.bin:"${PATH}

ADD ./code /code/

WORKDIR /code
RUN find .
RUN npm install -f 
RUN npx tsc 

ADD ./entrypoint.sh /entrypoint.sh
RUN chmod 755  /entrypoint.sh

EXPOSE 8000

ENTRYPOINT ["/entrypoint.sh"]
