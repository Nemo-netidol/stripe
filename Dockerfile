FROM node:18

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm install

RUN npm install -g nodemon

RUN npm install dotenv


COPY index.js ./

EXPOSE 8000

CMD ["nodemon", "-L", "index.js"]