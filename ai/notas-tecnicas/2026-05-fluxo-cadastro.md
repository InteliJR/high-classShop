# Fluxo de cadastro CUSTOMER - validacao manual

Data da validacao: 2026-06-04

Escopo executado:
- Cadastro direto na landing/login page
- Cadastro via link convite: nao executado neste ciclo, porque a TASK 2.7 nao estava pronta no fluxo testado
- Cadastro com campos parciais
- Login do CUSTOMER cadastrado
- Catalogo, perfil, consultoria/agendamento e tentativa de acesso ao contrato

## Ambiente

- Frontend local em `http://localhost:5173`
- Backend local em `http://localhost:3000/api`
- Prisma client regenerado localmente para destravar o backend
- Email de boas-vindas validado no log do backend

## Resultados por cenario

| Cenario | Entrada | Request / Response | Banco | UI final | Resultado |
| --- | --- | --- | --- | --- | --- |
| A - completo | `name=Ana`, `surname=Silva`, `email=ana.silva.20260604@example.com`, `cpf=98765432100`, `rg=1234567`, `password=Senha123`, `civil_state=SINGLE` | `POST /api/auth/register` com payload limpo de CPF/RG. Response `201` com `Conta criada com sucesso`. | `User` criado com `role=CUSTOMER`, `is_active=true`, `address_id=null`, `consultant_id=null`. | Redirecionou para login apos alert de sucesso. | Concluido |
| B - parcial sem RG | `name=Carla`, `surname=Moura`, `email=carla.moura.20260604@example.com`, `cpf=12345678909`, `password=Senha123`, `civil_state=DIVORCED` | Nenhuma request. O formulario bloqueou antes da API. | Nenhuma alteracao. | Mensagem visivel: `RG e obrigatorio`. | Bloqueado no frontend |
| C - email duplicado | `email=ana.silva.20260604@example.com`, `cpf=12345678909`, `rg=7654321`, `password=Senha123`, `civil_state=MARRIED` | `POST /api/auth/register` com payload valido. Response `401` e mensagem `This user already exists`. | Nenhuma alteracao. | Alert nativo com `This user already exists`. | Concluido como duplicado |

Observacao do cenario A:
- A primeira tentativa usou um CPF de teste que ja existia no banco local e retornou conflito de CPF. O CPF final usado para validar o fluxo foi `98765432100`.

## Validacao apos login do CUSTOMER A

| Area | O que foi testado | Resultado |
| --- | --- | --- |
| Login | `POST /api/auth/login` com o usuario criado | `201`, `access_token` retornado, redirecionamento para `/customer/home` |
| Catalogo | acesso a `/catalog/cars` | Funciona, lista produtos e mantem autenticacao |
| Perfil | acesso a `/profile` | Funciona, dados carregam corretamente |
| Edicao de perfil | `PATCH /api/users/:id` | Funciona com `rg=123456789`; response `200` |
| Consultoria | acesso a `/customer/consultoria` e acao em `Solicitar Reunião` | Funciona ate a criacao do agendamento pendente; backend criou `appointment` e `process` com status `SCHEDULING` |
| Contrato | tentativa de acesso a rota de criacao de contrato como CUSTOMER | Nao disponivel para CUSTOMER; a rota redireciona/volta para catalogo |

## Evidencias capturadas

- Cadastro A: request `POST /api/auth/register` com payload `{"name":"Ana","surname":"Silva","email":"ana.silva.20260604@example.com","cpf":"98765432100","rg":"1234567","password":"Senha123","civil_state":"SINGLE"}` e response `201`.
- Login A: request `POST /api/auth/login` com `email=ana.silva.20260604@example.com` e response `201` com `access_token`.
- Perfil: `PATCH /api/users/0a13f453-15a8-4bdd-a40f-c29fad33dc22` com `{"name":"Ana","surname":"SilvaX","cpf":"98765432100","rg":"123456789"}` e response `200`.
- Consultoria: `POST /api/appointments/pending` com `client_id=0a13f453-15a8-4bdd-a40f-c29fad33dc22`, `specialist_id=4e62d6b1-dda2-47a9-8f02-4e6f93a3a41e`, `notes="Consultoria solicitada pelo cliente"` e criacao de `appointment` + `process`.

## Bugs / gaps encontrados

1. **Alta** - o cadastro aceita RG com 7 digitos, mas a edicao de perfil exige RG com 9-10 digitos. Isso quebra o ciclo apos o primeiro login e precisa virar issue.
2. **Alta** - o cenario B pedido pela task, cadastro parcial sem RG, nao existe hoje no formulario. O frontend bloqueia com `RG e obrigatorio` antes de chamar a API.
3. **Media/Alta** - a geracao de contrato nao esta acessivel para CUSTOMER. O fluxo validado hoje para o cliente para em consultoria/processos, sem uma acao de contrato exposta.
4. **Media** - a sincronizacao completa de Calendly nao foi fechada no ambiente local. O agendamento pendente foi criado, mas o modal exibiu aviso de permissao/integração e nao foi possivel concluir o evento externo neste navegador.

## Email de boas-vindas

- Validado no backend por log: email de boas-vindas enviado com sucesso para `ana.silva.20260604@example.com`.

## Conclusao

- O fluxo A existe e funciona ate login, catalogo, perfil e criacao de consultoria pendente.
- O fluxo B nao e executavel como pedido porque falta suporte a cadastro sem RG.
- O fluxo C funciona como duplicidade de email e retorna `401`.
- O ponto mais critico encontrado e a divergencia de validacao de RG entre cadastro e edicao de perfil.

## Decisao recomendada

- Abrir issues separadas para os bugs de RG e para a ausencia do cenario parcial sem RG.
- Tratar a geracao de contrato no fluxo CUSTOMER como gap de produto, nao como validacao concluida.