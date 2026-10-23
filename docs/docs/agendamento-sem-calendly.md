---
sidebar_position: 6
title: Agendamento sem Calendly
---

# Agendamento sem Calendly por e-mail

Sem Calendly ativo, o cliente usa **Solicitar reunião**, propõe uma data e hora futura e registra um pedido pendente. O especialista atribuído pode confirmar a sugestão ou **Alterar e confirmar**. A confirmação reserva o horário; o processo continua em `SCHEDULING` para permitir a reunião.

Conectar Calendly é opcional e não bloqueia cadastro, edição ou publicação de produtos. A capacidade `calendly_scheduling_available` vem do backend: exige uma URL HTTPS do domínio Calendly e uma conexão OAuth ativa. Uma URL residual, sozinha, não ativa esse caminho.

## Fluxo do cliente

1. Entre como cliente, abra o produto e escolha **Solicitar reunião**.
2. Informe a data e hora futura no modal. A interface mostra o fuso local; a API recebe e armazena um instante UTC em ISO 8601.
3. Após a criação, a página mostra o sucesso e tenta abrir o aplicativo padrão de e-mail com destinatário, assunto e corpo sugeridos. O pedido já está salvo como `PENDING/EMAIL`, com o horário proposto, junto ao processo `SCHEDULING`.
4. Use os fallbacks **Abrir aplicativo de e-mail**, **Abrir no Gmail**, **Copiar e-mail** ou **Acompanhar processo**. Eles continuam disponíveis após recarregar ou revisitar o produto enquanto o próprio pedido está pendente.

A abertura automática ocorre no máximo uma vez por pedido recém-criado. Reload, revisita e recuperação de duplicidade restauram o painel sem repetir essa tentativa. Falha do navegador, ausência de aplicativo padrão ou indisponibilidade do clipboard não desfazem o pedido; o endereço permanece visível e selecionável.

O assunto e o corpo são editáveis no compositor externo. A plataforma não captura nem persiste essas edições e não comprova que um e-mail foi enviado. Um `mailto:` ou link Gmail válido demonstra apenas que a composição foi preparada. Uma falha na criação não abre o compositor.

## Fluxo do especialista

No processo pendente por e-mail, o especialista atribuído vê a proposta, o e-mail do cliente e seu telefone, quando preenchido. Um número brasileiro normalizável também produz um atalho WhatsApp. Telefone ausente não produz ação; telefone inválido permanece como texto, sem link incorreto.

- **Confirmar horário** envia o instante proposto ao endpoint canônico do processo.
- **Alterar e confirmar** abre o seletor com a proposta existente e envia o horário escolhido. Sem edição efetiva, o instante ISO original é preservado.

Ambas as ações resultam em `Appointment=SCHEDULED` e `Process=SCHEDULING`. A primeira definição ou alteração antes da confirmação não consome a remarcação posterior: `specialist_rescheduled_at` e `specialist_rescheduled_from` continuam nulos. As notas preservam a proposta e o horário confirmado. O cliente passa a ver o horário efetivo, e os controles da reunião continuam disponíveis no processo.

Pedidos `PENDING/EMAIL` são propostas e não ocupam a agenda. A confirmação valida o conflito novamente sob trava de agenda. Se houver `409`, o especialista pode escolher outro horário no modal, que conserva a mensagem do erro. Dupla submissão do mesmo horário confirmado não cria registros ou histórico adicionais.

A remarcação de um compromisso já confirmado continua sendo uma ação separada, permitida uma vez ao especialista responsável. Ela preenche os dois campos de auditoria. A reunião e o avanço comercial seguem o fluxo existente.

## Contratos e privacidade

| Operação | Contrato |
|---|---|
| `POST /api/appointments/pending` | Cliente autenticado cria para si, com `scheduling_method=EMAIL`, produto/especialista e `appointment_datetime` futura. Retorna o appointment e o `process_id` criados atomicamente. |
| `GET /api/appointments/check` | Somente `CUSTOMER`; aceita `specialist_id`, `product_type` e `product_id`. A identidade vem do JWT; enviar `client_id` na query é inválido. |
| `POST /api/processes/:id/confirm-appointment` | Somente o especialista atribuído; aceita o horário sugerido ou outro futuro, confirma sob lock e mantém `SCHEDULING`. |
| `GET /api/specialists/:id/public-profile` | ID, nome comercial, especialidade, e-mail comercial, URL Calendly e booleano de capacidade. Não inclui documentos, telefone pessoal ou dados OAuth. |
| `GET/PATCH /api/users/:id` | Perfil privado: somente o próprio usuário ou `ADMIN`. Apenas especialista pode definir uma URL Calendly; `null` remove a URL. |

A consulta do próprio pedido retorna somente `{ exists: false }` ou `{ exists: true, appointment_id, process_id, appointment_status, scheduling_method, appointment_datetime }`, sem nomes ou contatos. Um pedido ativo duplicado responde `409/ACTIVE_PROCESS_EXISTS` com `error.details.existing_request` nesse mesmo formato mínimo, sem o discriminante `exists`. Outros conflitos não expõem IDs ou contatos do compromisso concorrente.

Os contatos do cliente aparecem na lista e no detalhe somente para o especialista atribuído ao pedido `PENDING/EMAIL` em `SCHEDULING` e continuam disponíveis para ele após a confirmação. Outros especialistas não podem listar ou abrir esse processo. As projeções de cliente não recebem os contatos privados nesse estado. O e-mail comercial do especialista é intencionalmente público para permitir a composição da mensagem.

O backend recusa a criação direta `SCHEDULED/PLATFORM` por `POST /api/appointments` nesse cenário. O caminho com Calendly ativo continua usando `CALENDLY` e não aceita horário enviado pelo cliente: o instante é resolvido na API autenticada do Calendly e, enquanto ela não retornar um horário válido, o pedido permanece `PENDING` sem reservar agenda para que o webhook assinado possa completá-lo. Se `CALENDLY_WEBHOOK_CALLBACK_URL` for configurada, `CALENDLY_WEBHOOK_SIGNING_KEY` é obrigatória; callbacks sem assinatura válida e fresca são rejeitados. A consultoria sem produto conserva o pedido `PENDING/EMAIL` sem data e exige sua definição na confirmação. Registros legados sem proposta continuam legíveis. `pending_expires_at` é metadado: não existe expiração automática nesta entrega.

## Validação local repetível

Use PostgreSQL local e o banco dedicado `bmfluxdb_email_scheduling_e2e`, com as migrations existentes aplicadas. A URL deve ser explícita, usar loopback (`localhost`, `127.0.0.1` ou `::1`) e nome de banco terminado em `email_scheduling_e2e`. O seed não carrega `.env` nem usa `DATABASE_URL` como fallback.

Configure as variáveis na sessão local, sem salvar ou publicar credenciais:

- `EMAIL_SCHEDULING_E2E_DATABASE_URL`;
- `EMAIL_SCHEDULING_E2E_CUSTOMER_EMAIL` e `EMAIL_SCHEDULING_E2E_CUSTOMER_PASSWORD`;
- `EMAIL_SCHEDULING_E2E_SPECIALIST_EMAIL` e `EMAIL_SCHEDULING_E2E_SPECIALIST_PASSWORD`;
- `EMAIL_SCHEDULING_E2E_OUTSIDER_EMAIL` e `EMAIL_SCHEDULING_E2E_OUTSIDER_PASSWORD`;
- `JWT_SECRET_ACCESS`, `JWT_SECRET_REFRESH`, `JWT_SECRET_REFERRAL` e `JWT_SECRET_ADVISOR` para o HTTP E2E; `JWT_SECRET_PASSWORD_RESET` pode ser dedicado ou usar o fallback existente.

Os três e-mails devem ser distintos e terminar em `.test`, domínio reservado para testes. As senhas exigem pelo menos seis caracteres e são armazenadas com bcrypt (custo 10). O seed não imprime URL, e-mails, senhas ou hashes.

```sh
rtk docker compose up -d db
rtk docker compose exec -T db pg_isready -U user -d bmfluxdb
# Crie o banco dedicado antes de aplicar as migrations.
rtk env DATABASE_URL="$EMAIL_SCHEDULING_E2E_DATABASE_URL" DIRECT_URL="$EMAIL_SCHEDULING_E2E_DATABASE_URL" npm --prefix backend exec -- prisma migrate deploy
rtk npm --prefix backend run seed:email-scheduling-e2e
rtk node -e 'if (!process.env.EMAIL_SCHEDULING_E2E_DATABASE_URL) process.exit(1)'
rtk npm --prefix backend run test:e2e -- --runInBand --runTestsByPath test/email-scheduling.e2e-spec.ts --json --outputFile=/tmp/email-scheduling-http-e2e.json
rtk node -e 'const r=require("/tmp/email-scheduling-http-e2e.json");if(!r.success||r.numPendingTests!==0)process.exit(1)'
```

O seed cria ou atualiza três usuários sintéticos e dois carros ativos atribuídos ao especialista sem Calendly. Os IDs-base são fixos:

| Fixture | UUID no namespace de navegador |
|---|---|
| Cliente | `c848f474-6492-4ac1-8a7d-000000000001` |
| Especialista atribuído | `c848f474-6492-4ac1-8a7d-000000000002` |
| Especialista não atribuído | `c848f474-6492-4ac1-8a7d-000000000003` |
| Produto A | `c848f474-6492-4ac1-8a7d-000000000101` |
| Produto B | `c848f474-6492-4ac1-8a7d-000000000102` |

O HTTP E2E usa outro prefixo, `8c26e2a3-fd13-447a-9b6c`, e deriva aliases `local+http@dominio.test` dos e-mails da sessão. Assim ele não limpa pedidos feitos com o seed de navegador. Ele inicializa o `AppModule` real, autentica as três identidades pelo login e usa guards, validação, serializer e prefixo reais. Somente fronteiras externas (SES/S3/DocuSign), recuperação de jobs e o timer de rate limit são neutralizados; autenticação, autorização, transações e persistência não são simuladas. No ambiente Jest desse E2E, a fronteira `isomorphic-dompurify`/SVG é substituída por um stub *fail-closed*: qualquer chamada ao sanitizador falha imediatamente. Portanto, o HTTP E2E não comprova a sanitização; a implementação de produção e os testes próprios do sanitizador continuam usando a dependência real. Sem a URL explícita, o grupo HTTP é pulado; o gate dedicado exige zero testes pulados.

O teste cobre criação pendente, identidade derivada do JWT, IDOR de GET/PATCH, bypass direto, contato autorizado na lista/detalhe, duplicidade, conflito sem PII, confirmação alterada e inalterada, idempotência e estados/cardinalidade no banco. O seed também é executado duas vezes pelo teste para comprovar a idempotência dos IDs-base.

A limpeza resolve os IDs gerados de appointments/processes apenas a partir dos usuários/produtos determinísticos e valida ambos os participantes, método e vínculos antes de excluir qualquer registro. Histórico, processo e appointment são apagados nessa ordem dentro de uma transação; tokens são limitados aos usuários da fixture. Contrato, proposta, reunião, `Product` ou vínculo inesperado interrompem o reset integralmente. Usuários e carros são atualizados por ID; nunca são truncados ou apagados. Rodar novamente o seed reinicia somente os pedidos desse namespace.

## Checklist de navegador e gates

Inicie backend e frontend do source atual, apontando ambos para o banco dedicado. No backend, use `NOTIFICATIONS_ENABLED=false` para evitar entrega de notificações; no frontend, `VITE_API_BASE_URL=http://localhost:3000/api`. Use contextos independentes para cliente, especialista atribuído e usuário não atribuído.

1. No produto A, crie a proposta futura e capture status/payload do POST e do check. Inspecione destinatário, assunto e corpo dos links `mailto:`/Gmail sem afirmar envio externo.
2. Recarregue e revisite o produto: os fallbacks persistem e não ocorre outra tentativa automática de abrir e-mail.
3. Como especialista atribuído, veja proposta, e-mail, telefone e WhatsApp; altere e confirme. Confirme `SCHEDULED`, processo `SCHEDULING` e controles da reunião.
4. Repita no produto B confirmando a sugestão sem alteração.
5. Como não atribuído, tente ler o processo/lista, confirmar e acessar/editar o perfil privado do cliente: as operações retornam `403`, sem contatos e sem alterações.
6. Repita o caminho crítico em viewport móvel e por teclado, observando foco, labels, anúncio de sucesso/erro e retorno de foco do modal.

Após cada confirmação, consulte o banco em modo somente leitura usando os IDs-base acima e os IDs retornados pelo POST. Exija exatamente um appointment e um processo por produto, vínculo recíproco correto, `appointment_datetime` efetiva, `SCHEDULED/SCHEDULING` e ambos os campos de remarcação nulos. A aparência do navegador sozinha não comprova essas condições.

O gate de concorrência PostgreSQL usa `POSTGRES_CONCURRENCY_TEST_URL` no banco dedicado e executa `src/features/appointments/appointments-concurrency.postgres.spec.ts` com `--runInBand`; confira zero skips no resultado JSON. Depois execute sequencialmente os testes/builds de backend e frontend e o lint. Limite Jest a dois workers ou `--runInBand`, Vitest a dois workers/forks, e verifique `rtk free -h` antes das suites amplas. Preserve somente evidência sem credenciais ou PII no repositório.
