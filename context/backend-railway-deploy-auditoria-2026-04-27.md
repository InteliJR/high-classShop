# Auditoria de Deploy do Backend no Railway (Docker)

Data: 27/04/2026
Escopo: Preparar **somente o backend** para deploy gratuito no Railway via `backend/Dockerfile`.

## Alterações realizadas

### 1) Ajuste do entrypoint de produção
- **Arquivo:** `backend/package.json`
- **Alteração:**
  - `start:prod`: `node dist/src/main.js` -> `node dist/main.js`
- **Motivo:**
  - O build real do NestJS no projeto gera `dist/main.js` (não `dist/src/main.js`).
  - Isso impediria o container de iniciar em produção.

### 2) Correções no Dockerfile para Railway
- **Arquivo:** `backend/Dockerfile`
- **Alterações:**
  - Adicionados placeholders de build:
    - `ENV DATABASE_URL="postgresql://user:password@localhost:5432/highclassdb?schema=public"`
    - `ENV DIRECT_URL="postgresql://user:password@localhost:5432/highclassdb?schema=public"`
  - Removido `COPY --from=builder /app/generated ./generated`.
  - Corrigido CMD:
    - `CMD ["node", "dist/src/main.js"]` -> `CMD ["node", "dist/main.js"]`
- **Motivo:**
  - `prisma generate` durante o build pode falhar sem variáveis mínimas de datasource.
  - A pasta `/app/generated` não existe neste projeto e poderia quebrar o `docker build`.
  - O comando de inicialização estava apontando para arquivo inexistente.

### 3) Remoção de log sensível de banco
- **Arquivo:** `backend/src/prisma/prisma.service.ts`
- **Alteração:**
  - Removido `console.log('URL DO BANCO SENDO USADA:', process.env.DATABASE_URL);`
- **Motivo:**
  - Evitar vazamento de credenciais no log de runtime/observabilidade.

### 4) Alinhamento do template de ambiente
- **Arquivo:** `backend/.env.example`
- **Alteração:**
  - Adicionado `DIRECT_URL` com exemplo.
- **Motivo:**
  - O `schema.prisma` usa `directUrl = env("DIRECT_URL")`; o template estava incompleto.

### 5) Documentação de deploy no Railway
- **Arquivo:** `backend/README.md`
- **Alteração:**
  - Seção nova: **Deploy no Railway (Docker)** com passos e variáveis obrigatórias.
- **Motivo:**
  - Facilitar deploy reproduzível e reduzir erro operacional.

## Validações executadas

1. **Build do backend (local):**
   - Comando: `npm run build`
   - Resultado: ✅ sucesso.

2. **Build da imagem Docker (local):**
   - Comando: `docker build -t highclass-backend-railway .` (em `backend/`)
   - Resultado: ✅ sucesso.

## Status para deploy via Docker no Railway

- Dockerfile válido: ✅
- Entrypoint de produção válido: ✅
- Prisma generate no build tratado: ✅
- Pasta inexistente removida do COPY: ✅
- Health endpoint disponível (`/api/health`): ✅

Conclusão: o backend está **apto** para deploy no Railway via Docker, desde que as variáveis de ambiente de produção sejam configuradas corretamente no painel do Railway.

## Observação de segurança importante

Foi identificado no arquivo local `backend/.env` a presença de segredos reais (DB, AWS, JWT, DocuSign, etc.).
Recomendação imediata:
- rotacionar essas credenciais no provedor;
- manter apenas placeholders no `.env.example`;
- usar apenas variáveis seguras no Railway.
