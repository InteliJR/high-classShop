# Passo 1: Imagem Base para construir o projeto
FROM node:20-alpine

# Passo 2: Diretório de trabalho dentro do container
WORKDIR /app

# Passo 3: Copiar os arquivos de dependências
COPY package*.json ./

# Passo 4: Instalar as dependências
RUN npm install

# Passo 5: Copiar o resto do código fonte
COPY . .

# Passo 6: Expor a porta que o servidor de desenvolvimento usa
EXPOSE 5173

# Passo 7: Comando para iniciar o servidor de desenvolvimento do Vite
CMD ["npm", "run", "dev"]