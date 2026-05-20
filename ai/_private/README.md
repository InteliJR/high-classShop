# `ai/_private/` — Conteúdo Sensível e Pessoal

> ⚠️ **TUDO nesta pasta (exceto este `README.md`) é IGNORADO pelo Git.**
> Regra em `ai/.gitignore`: `_private/*` + `!_private/README.md`.
>
> Nunca tente forçar commit de conteúdo aqui. Se precisar versionar algo, mova para outro diretório.

## O que vai aqui

Conteúdo que **NÃO** pode ir para o repositório público:

- `contrato/` — PDFs de contrato com o cliente, escopo formal, anexos comerciais
- `relatorios/sprintN/` — relatórios de sprint enviados ao cliente, com dados internos
- `feedbacks/` — feedbacks do cliente (PDFs, transcrições)
- `replanejamento/` — planos estratégicos internos, análises de risco com nomes
- `credenciais/` — chaves, tokens, dumps de banco para teste local

E áreas pessoais opcionais para cada dev:

- `_private/<seu-github-username>/` — anotações pessoais, rascunhos, templates de produtividade

Exemplos de uso de área pessoal:
- `_private/Messias-Olivindo/notas-cliente.md`
- `_private/C-Icaro/rascunho-arquitetura-branding.md`
- `_private/Ludelll/checklist-onboarding.md`

## Onde baixar o conteúdo formal

- **Contrato + ANP/escopo:** Google Drive da Inteli Junior (link no canal interno do squad)
- **Feedbacks de sprint:** Discord do squad — canal `#high-classshop`
- **Backups de banco:** Supabase → Database → Backups (acesso restrito a tech-leads)

## Regras

1. Nunca colar credencial, token ou senha em código versionado. Sempre `_private/` ou variável de ambiente.
2. Se você baixou um PDF do Drive para esta pasta, ele fica só na sua máquina — não compartilhe outros caminhos.
3. Área pessoal (`_private/<username>/`) é só sua. Não escreve nas dos outros.
4. Se mover algo daqui para fora, revise duas vezes se realmente pode ser público.
