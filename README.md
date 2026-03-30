# 📘 High-class Shop

<!--
Breve descrição do projeto, incluindo o objetivo, nome do cliente e o setor envolvido.
-->

Exemplo: _Aplicação web para gestão de kprocessos internos da Empresa X, no setor de logística._

Acesse a solução por meio deste [🔗 Link](https://www.nasa.gov/)

---

## 📄 Documentação

A documentação completa do projeto pode ser acessada através do link abaixo:  

**[High-class Shop Docs](https://intelijr.github.io/high-classShop/)**

> A documentação é mantida utilizando o [Docusaurus](https://docusaurus.io/). Para informações sobre como configurar e manter a documentação, consulte o [guia de configuração](./docs/README.md).

---

## 🚀 Tecnologias Utilizadas

* Frontend: React, TypeScript, Vite, TailwindCSS

* Backend: Node.js, Nest.js, TypeScript, Prisma ORM

* Banco de Dados: PostgreSQL

* Ambiente de Desenvolvimento: Docker

* Hospedagem: AWS (S3, CloudFront, Lightsail)
---

## 🛠️ Como Rodar o Projeto

### Pré-requisitos 

* [Git](https://git-scm.com/downloads)
* [Docker Desktop](https://www.docker.com/products/docker-desktop/)
* [Node.js](https://nodejs.org/en)

<!-- Passos para rodar o projeto.   -->
```bash
# 1. Clone o repositório
git clone https://github.com/InteliJR/high-classShop.git

# 2. Acesse o diretório do projeto
cd high-classShop

# 3. Inicie todo o ambiente (Banco, Backend e Frontend) com Docker Compose.
# O --build é recomendado na primeira vez para construir as imagens.
docker-compose up --build -d

# 4. Instale as dependências do Backend
cd backend
npm install

# 5. Instale as dependências do Frontend
cd ../frontend
npm install

# 6. Sincronize o Banco de Dados com as Migrations
# Este comando lê as 'plantas baixas' do banco e cria as tabelas.
cd ../backend
npx prisma migrate dev
```

🌐 Acesse o Frontend (site) em: http://localhost:5173

⚙️ Acesse o Backend (API) em: http://localhost:3000

🗂️ Para visualizar o banco de dados, na pasta backend, rode o comando: npx prisma studio

## 📆 Comando úteis

```bash
# Ligar o ambiente em segundo plano
docker-compose up -d

# Desligar o ambiente
docker-compose down

# Ver os logs (mensagens) do backend em tempo real
docker-compose logs -f backend

# Ver os logs do frontend
docker-compose logs -f frontend
```

---



## 🗂️ Estrutura de Diretórios

```bash
.
├── .github/                       # Configurações de CI/CD e templates de PR
│
├── backend/                       # Código backend (Node.js, Python, etc)
│
├── frontend/                      # Código frontend (React, Next.js, etc)
│
├── docs/                          # Documentação Docusaurus
│   ├── docs/
│   │   ├── visao-produto.md       # Documento elaborado pela área de Visão de Produto
│   │   ├── design.md              # Documento elaborado pela área de Design
│   │   ├── desenvolvimento.md     # Documento elaborado pela área de Desenvolvimento
│
├── .gitignore                     # Arquivos ignorados pelo Git
└── README.md                      # Este documento
```

---

## 👥 Time do Projeto

Conheça quem participou do desenvolvimento deste projeto:

- **Nome da Pessoa 1**  
  [![GitHub](https://img.shields.io/badge/GitHub-100000?style=for-the-badge&logo=github&logoColor=white)](https://github.com/usuario1)
  [![LinkedIn](https://img.shields.io/badge/LinkedIn-blue?style=for-the-badge&logo=linkedin&logoColor=white)](https://linkedin.com/in/usuario1)

- **Nome da Pessoa 2**  
  [![GitHub](https://img.shields.io/badge/GitHub-100000?style=for-the-badge&logo=github&logoColor=white)](https://github.com/usuario2)
  [![LinkedIn](https://img.shields.io/badge/LinkedIn-blue?style=for-the-badge&logo=linkedin&logoColor=white)](https://linkedin.com/in/usuario2)

- **Nome da Pessoa 3**  
  [![GitHub](https://img.shields.io/badge/GitHub-100000?style=for-the-badge&logo=github&logoColor=white)](https://github.com/usuario3)
  [![LinkedIn](https://img.shields.io/badge/LinkedIn-blue?style=for-the-badge&logo=linkedin&logoColor=white)](https://linkedin.com/in/usuario3)
