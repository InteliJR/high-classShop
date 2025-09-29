# Passo 1: Comece com uma imagem base oficial do Node.js
FROM node:20-alpine

# Passo 2: Defina o diretório de trabalho dentro do container
WORKDIR /usr/src/app

# Passo 3: Copie os arquivos de dependências
# Isso otimiza o build, pois as dependências só são reinstaladas se o package.json mudar.
COPY package*.json ./

# Passo 4: Instale as dependências do projeto
RUN npm install

# Passo 5: Copie o resto do código da sua aplicação
COPY . .

# Passo 6: Compile o código TypeScript para JavaScript
RUN npm run build

# Passo 7: Exponha a porta que a aplicação usa para o Docker
EXPOSE 3000

# Passo 8: Defina o comando para iniciar a aplicação quando o container rodar
CMD [ "node", "dist/main" ]