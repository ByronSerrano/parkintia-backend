FROM node:20-alpine

WORKDIR /app

# Copiar package.json
COPY package.json ./

# Eliminar package-lock.json y generar uno nuevo limpio
RUN rm -f package-lock.json && npm install

# Copiar resto del código
COPY . .

EXPOSE 3001

CMD ["npm", "run", "start:dev"]