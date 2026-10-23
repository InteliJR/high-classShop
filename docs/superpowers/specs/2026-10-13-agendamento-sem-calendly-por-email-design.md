# Agendamento sem Calendly por e-mail

## Contexto e problema

Quando o especialista não tem uma integração ativa com o Calendly, a página de produto oferece hoje dois fluxos incompatíveis:

- o fluxo por e-mail cria um agendamento `PENDING/EMAIL` sem data e abre um `mailto:`;
- o fluxo pela plataforma coleta data e hora, mas cria um agendamento `SCHEDULED/PLATFORM`, pulando a confirmação do especialista e sem abrir o cliente de e-mail.

O backend reforça essa divisão ao rejeitar data em agendamentos `EMAIL`. Além disso, o especialista não vê o telefone do cliente enquanto o pedido está pendente, a disponibilidade de Calendly é inferida de fontes diferentes no frontend e no backend, e existem respostas públicas que expõem dados pessoais além do necessário.

## Objetivo

Unificar o caso sem Calendly em um único pedido de reunião: o cliente propõe data e hora, o sistema registra o pedido pendente, oferece a composição de um e-mail ao especialista e mantém o processo rastreável. O especialista recebe os contatos do cliente, podendo confirmar a sugestão ou alterar a data e confirmar.

## Fora de escopo

- enviar e-mail pelo servidor ou garantir que o usuário concluiu o envio no aplicativo externo;
- sincronizar reuniões por e-mail com calendários externos;
- criar novos estados ou novas tabelas para o agendamento;
- implementar expiração automática dos pedidos pendentes;
- alterar o fluxo já conectado ao Calendly, exceto por tornar a detecção da conexão consistente;
- refatorações sem relação direta com privacidade ou com esse fluxo.

## Decisão de produto

Na ausência de Calendly, haverá uma única ação, **Solicitar reunião**. Ela abre o seletor de data e hora e, após a confirmação do cliente:

1. cria atomicamente o `Appointment` com `status=PENDING`, `scheduling_method=EMAIL` e `appointment_datetime` preenchido;
2. cria o `Process` associado no estágio `SCHEDULING`;
3. apresenta o sucesso dentro da aplicação e tenta abrir o cliente padrão com um `mailto:`;
4. mantém alternativas visíveis para abrir novamente o cliente padrão, abrir o Gmail Web, copiar o e-mail do especialista e acompanhar o processo, inclusive após recarregar ou revisitar a página.

O horário pendente é uma proposta, não uma reserva. Ele não bloqueia o horário do especialista. Somente a confirmação transforma a proposta em compromisso e deve validar conflitos novamente.

## Fluxo do cliente

### Especialista com Calendly ativo

O comportamento permanece o atual: a interface oferece o fluxo Calendly e o backend só aceita `scheduling_method=CALENDLY` se a capacidade estiver ativa para o especialista.

### Especialista sem Calendly ativo

1. O cliente autenticado seleciona um produto e aciona **Solicitar reunião**.
2. O modal exige uma data/hora futura e exibe o fuso horário local usado na apresentação.
3. O frontend envia a data em ISO 8601 para `POST /appointments/pending` com `scheduling_method=EMAIL`.
4. Após `201`, a página mostra o estado de sucesso antes de iniciar a navegação externa. O painel também é reconstruído após reload ou revisita quando a consulta autenticada encontra o próprio pedido `PENDING/EMAIL` com data.
5. O e-mail pré-preenchido contém:
   - destinatário: e-mail profissional do especialista;
   - assunto: interesse no produto e nome do produto;
   - corpo: nome do cliente, produto, data/hora sugerida com fuso e um texto editável de interesse.
6. A tentativa automática de `mailto:` é complementar e ocorre no máximo uma vez para o appointment recém-criado, controlada pelo ID em memória/sessão. Ela nunca se repete por rerender, reload, retorno do histórico ou recuperação de duplicidade. O pedido criado continua válido se o navegador bloquear a navegação ou se não houver aplicativo padrão configurado.
7. A tela mantém as ações de fallback **Abrir aplicativo de e-mail**, **Abrir no Gmail**, **Copiar e-mail** e **Acompanhar processo**. O Gmail usa `https://mail.google.com/mail/?view=cm&fs=1...` em nova aba com `noopener noreferrer`; não há tentativa de detectar o provedor do usuário.

Erros de criação nunca abrem o cliente de e-mail. Um `409` só é tratado como pedido já existente quando o backend devolver o código de erro específico desse caso. Nesse caso, a resposta autorizada traz o snapshot mínimo do próprio pedido e a UI recupera o painel de sucesso, sem autoabrir o e-mail. Um processo ativo de outro método ou estágio apenas orienta o cliente a acompanhá-lo. Conflitos genéricos continuam sendo exibidos como erro.

O assunto e o corpo são sugestões editáveis somente no compositor externo; a aplicação não captura nem persiste esse texto. Um helper puro monta os links, remove CR/LF de destinatário e assunto, limita o comprimento dos valores e aplica percent-encoding separado. O corpo preserva as quebras de linha intencionais.

## Fluxo do especialista

No card do processo em `SCHEDULING`, o especialista atribuído vê:

- data e hora propostas pelo cliente;
- e-mail do cliente;
- telefone do cliente, quando preenchido;
- atalho para WhatsApp somente quando o telefone puder ser normalizado para um número válido;
- ação **Confirmar horário**;
- ação **Alterar e confirmar** com seletor de data/hora.

As duas ações usam o endpoint canônico de confirmação do processo. Confirmar a sugestão envia a própria `appointment_datetime`; alterar e confirmar envia o novo horário. Em ambos os casos, o `Appointment` é atualizado para `SCHEDULED`, enquanto o `Process` permanece em `SCHEDULING`. Esse estado é necessário para iniciar ou entrar na reunião; o processo só avança no fluxo já existente após a conversa/reunião e a associação de produto quando ela for exigida.

A alteração feita antes da primeira confirmação não consome nem preenche os campos de uma remarcação posterior. Os campos de auditoria de remarcação passam a ser usados apenas depois de um horário já confirmado. Se a data for alterada na confirmação, a proposta original e o horário confirmado são anexados ao histórico/notas do processo; a UI do cliente passa a mostrar o horário efetivamente confirmado.

## Modelo de dados e regras

Não haverá migração. O modelo existente representa o fluxo:

- `Appointment.status = PENDING`;
- `Appointment.scheduling_method = EMAIL`;
- `Appointment.appointment_datetime = horário proposto`;
- `Process.status = SCHEDULING`.

Para novos pedidos `EMAIL` com produto, `appointment_datetime` é obrigatório, deve ser uma data ISO válida e futura. Em consultoria sem produto ele permanece opcional e deve ser informado pelo especialista na confirmação. Registros legados `EMAIL` sem data continuam legíveis e aparecem ao especialista como pedido sem horário definido, exigindo **Alterar e confirmar**.

Um único helper de domínio define compromissos que ocupam agenda e é usado na criação direta, confirmação, callback Calendly e reagendamento. Pedidos `PENDING/EMAIL` não entram nesse predicado porque são propostas não confirmadas. Continuam ocupando agenda:

- agendamentos `SCHEDULED`;
- agendamentos `PENDING/CALENDLY` com `calendly_sync_status=SYNCED` e horário;
- registros legados pendentes com horário e sem método definido, preservando compatibilidade.

Na confirmação, o backend adquire o lock já usado para a agenda do especialista, relê o compromisso dentro da transação, valida conflito para o horário escolhido e só então atualiza agendamento e processo. Respostas de conflito não retornam IDs de clientes, processos ou agendamentos concorrentes.

O campo existente `pending_expires_at` continua sendo preenchido, mas a expiração automática e seus efeitos sobre `Appointment` e `Process` permanecem fora desta entrega porque não existe estado de processo expirado. O risco conhecido é que pedidos abandonados continuam ativos até cancelamento/recusa. O plano não deve sugerir que sete dias já sejam aplicados como regra de negócio.

## Contratos de API

### Criar pedido pendente

`POST /appointments/pending`

- `EMAIL` com produto: exige `appointment_datetime` válido e futuro; consultoria sem produto preserva o campo opcional;
- `CALENDLY`: exige que o especialista possua capacidade Calendly ativa;
- `EMAIL` com produto é aceito somente quando a capacidade Calendly estiver inativa; `CALENDLY` é aceito somente quando ela estiver ativa;
- `CALENDLY` rejeita `appointment_datetime` enviado pelo cliente; apenas callback/webhook sincronizado pode preenchê-lo;
- a criação do agendamento e do processo é atômica;
- a resposta retorna o appointment e seu `process_id`, ambos pertencentes ao cliente autenticado, sem dados de terceiros.

O caminho direto `POST /appointments`, hoje usado para criar `SCHEDULED/PLATFORM`, deixa de aceitar esse cenário para cliente e produto. Um cliente HTTP sem Calendly deve usar o pedido pendente `EMAIL`; ele não pode contornar a confirmação do especialista criando um compromisso direto.

### Confirmar pelo processo

`POST /processes/:processId/confirm-appointment`

- permitido somente ao especialista atribuído; administradores podem inspecionar conforme as permissões existentes, mas não confirmam em nome dele;
- aceita o horário sugerido ou um novo horário futuro;
- confirma o appointment sob lock e mantém o processo em `SCHEDULING`;
- não registra a primeira alteração como remarcação.

O endpoint alternativo de confirmação direta de appointment não será usado pelo frontend desse fluxo, evitando semânticas diferentes para o avanço do processo.

### Consultar pedido existente

`GET /appointments/check` é uma consulta de pedido existente, não de disponibilidade de horário, aceita somente `CUSTOMER` e deixa de receber `client_id`. O cliente vem exclusivamente do JWT e a consulta aceita apenas especialista e produto. A resposta discriminada é:

- `{ exists: false }`; ou
- `{ exists: true, appointment_id, process_id, appointment_status, scheduling_method, appointment_datetime }` para um appointment pertencente ao próprio cliente.

Ela não contém nomes, e-mails, telefones nem IDs de outros clientes. Esses dados são suficientes para a página escolher entre o CTA, o aviso de processo existente e a recuperação do painel de e-mail.

### Projeção pública do especialista

A página de produto usa `GET /specialists/:id/public-profile`, uma projeção dedicada com apenas os campos necessários para exibição e contato comercial. Antes de endurecer o endpoint genérico, seus consumidores de exibição de especialista, incluindo o modal de abertura de processo, migram para essa projeção. As listagens públicas `GET /specialists` e `GET /specialists/grouped-by-category` reutilizam o mesmo serializer seguro e deixam de selecionar CPF/CNPJ e RG. `GET /users/:id`, que hoje pode devolver CPF, RG, telefone e estado civil, passa a aceitar somente o próprio usuário ou `ADMIN`; os demais recebem `403`.

Como a remoção da URL do Calendly passa por `PATCH /users/:id`, esse endpoint também deve validar o alvo: somente o próprio usuário ou um `ADMIN` pode alterá-lo. Além disso, somente usuários `SPECIALIST` podem definir `calendly_url`; `null` continua permitido para remover o valor. Conhecer o UUID de outra conta não autoriza a edição. A correção e o teste de IDOR fazem parte desta entrega porque, sem ela, qualquer usuário autenticado poderia modificar a configuração de Calendly e outros dados do perfil de terceiros.

## Fonte de verdade do Calendly

A aplicação terá um único campo derivado no backend, `calendly_scheduling_available`. Para este fluxo ele é `true` somente quando existe uma URL HTTPS cujo hostname pertence ao Calendly **e** uma `CalendlyConnection` com `is_active=true`. Token de acesso expirado não desativa a capacidade enquanto o refresh continua válido; uma falha definitiva como `invalid_grant` marca a conexão como inativa.

O backend devolve essa capacidade na projeção usada pela página do produto, e o frontend escolhe o fluxo com base nela. O backend repete a validação ao criar o pedido para impedir bypass pelo cliente HTTP.

O callback OAuth persiste também a `scheduling_url` devolvida pelo Calendly como `calendly_url`, para que uma conexão válida tenha o link necessário ao popup. Ao desconectar, a conexão é desativada e URL/URIs derivados são limpos na mesma transação. A edição de perfil envia `null` ao apagar a URL, em vez de omitir o campo e preservar o valor antigo.

O backend aplica a exigência de data ao `EMAIL` relacionado a produto (`product_id` presente). A consultoria sem produto mantém o contrato atual de `PENDING/EMAIL` sem data, evitando ampliar esta correção para um segundo fluxo de produto. Ela continua exigindo definição do horário pelo especialista ao confirmar.

## Privacidade e autorização dos contatos

Enquanto o pedido `PENDING/EMAIL` estiver no estágio `SCHEDULING`, somente o especialista atribuído pode ver e-mail e telefone do cliente. Essa projeção é aplicada tanto na listagem `GET /processes/specialist/:specialistId` quanto no detalhe `GET /processes/:id`, sempre validando que o usuário autenticado é o especialista da rota/processo. Ela continua disponível ao especialista atribuído durante `SCHEDULED`, `COMPLETED` e no histórico do processo. As listagens de cliente, `OFFICE`, `CONSULTANT`, outros especialistas e respostas públicas não recebem esses contatos por causa desse estado; `ADMIN` só os recebe nos endpoints administrativos que já exigem esse papel, nunca por herança de uma projeção pública.

O cliente não passa a ver o telefone privado do especialista antes da confirmação. O e-mail comercial necessário para compor a mensagem vem da projeção segura do produto/especialista. Esse e-mail comercial é intencionalmente público e, portanto, sujeito a coleta automatizada; a projeção pública fica limitada a ID, nome comercial, especialidade, e-mail comercial, URL de agendamento e o booleano de capacidade, nunca documentos, telefone pessoal, estado civil, tokens, URIs OAuth ou detalhes da conexão.

## Componentes de frontend

- `ProductPage`: escolhe Calendly ou solicitação por e-mail usando a capacidade devolvida pelo backend; remove a bifurcação atual entre `EMAIL` sem data e `PLATFORM` já confirmado.
- `AppointmentDateTimeModal`: coleta a proposta futura e aceita `initialValue`. Na ação **Alterar e confirmar**, converte o ISO existente para `datetime-local` no fuso do navegador. Se o campo não for editado, envia o ISO original e preserva exatamente o instante; se o usuário editar uma hora local ambígua em transição de horário de verão, vale o offset escolhido pelo navegador.
- componente dedicado de sucesso do pedido: concentra `mailto:`, Gmail, cópia do endereço e navegação ao processo, mantendo a página de produto focada na orquestração.
- `ProcessCard`: separa explicitamente **Confirmar horário** de **Alterar e confirmar** e exibe os contatos autorizados.
- serviço de appointments: representa o contrato `PENDING/EMAIL` com data obrigatória e não chama a criação `PLATFORM` nesse cenário.
- perfil: permite remover de fato a URL do Calendly.

## Tratamento de erros

- data ausente, inválida ou passada: `400` com mensagem específica;
- `CALENDLY` solicitado sem capacidade ativa: `409/CALENDLY_UNAVAILABLE` e orientação para usar o fluxo por e-mail;
- `EMAIL` com produto solicitado quando há capacidade Calendly ativa: `409/EMAIL_FLOW_UNAVAILABLE`;
- pedido ativo duplicado: `409/ACTIVE_PROCESS_EXISTS`, devolvendo `process_id` e o snapshot mínimo somente depois de comprovar que o cliente autenticado é o dono;
- conflito descoberto na confirmação: `409` sem PII e com orientação para escolher outro horário;
- falha ao criar pedido/processo: transação revertida e nenhuma tentativa de abrir e-mail;
- falha ao abrir aplicativo externo: pedido permanece criado e fallbacks continuam disponíveis;
- telefone ausente: o atalho de telefone/WhatsApp não é exibido; telefone preenchido mas não normalizável: o valor original é exibido como texto, sem gerar link `wa.me` incorreto.

Ao receber `409` em **Confirmar horário**, o frontend abre e mantém o modal **Alterar e confirmar**, pré-preenchido com a proposta e com erro inline associado ao campo. Os botões ficam desabilitados e com estado busy durante a requisição para impedir dupla submissão.

O backend recebe e armazena um instante UTC (`toISOString()`). A interface mostra o fuso IANA do navegador, e o corpo do e-mail formata o instante nesse fuso, por exemplo `20/10/2026 14:30 (America/Sao_Paulo)`. O fuso não é persistido separadamente.

Para WhatsApp, o helper remove caracteres não numéricos; números brasileiros com 10 ou 11 dígitos recebem prefixo `55`, e números com 12 ou 13 dígitos iniciados por `55` são aceitos. Os demais não geram link. O link usa `https://wa.me/<digits>` em nova aba com `noopener noreferrer`, mantendo o número original visível para o especialista.

O painel recebe foco no título após a criação, anuncia sucesso com `role=status`/`aria-live=polite` e erros com `role=alert`. O modal preserva foco, rótulos, `aria-describedby` para erros e devolve o foco ao acionador. Falha ou indisponibilidade do clipboard mantém o endereço selecionável e anuncia que a cópia não ocorreu.

## Estratégia de testes

### Backend

- TDD para exigir horário futuro no `PENDING/EMAIL` com produto, preservar consultoria sem produto e aceitar registros legados na leitura;
- teste da transação de criação `Appointment + Process`;
- teste da matriz de capacidade Calendly, incluindo URL/domínio, OAuth ativo/inativo, disconnect, data proibida no `CALENDLY` e rejeição recíproca de método;
- teste de bypass comprovando que o cliente não cria `SCHEDULED/PLATFORM` por `POST /appointments`;
- teste de confirmação no mesmo horário e em horário alterado;
- testes concorrentes PostgreSQL: duas propostas diferentes para o mesmo especialista/horário são aceitas, confirmações simultâneas deixam exatamente uma `SCHEDULED`, duplo clique não duplica histórico e especialistas diferentes podem usar o mesmo horário;
- teste de que o predicado central ignora propostas `PENDING/EMAIL` em todos os chamadores;
- testes de autorização e projeção de contatos em lista e detalhe;
- teste de IDOR em `PATCH /users/:id`, permitindo somente o próprio usuário ou `ADMIN`;
- teste de que não especialista não altera `calendly_url`;
- testes de não exposição de PII na consulta de pedido, conflitos e perfil público/privado.

### Frontend

- TDD do único CTA e do envio de `appointment_datetime` no fluxo sem Calendly;
- teste de que o e-mail só é aberto após resposta de sucesso e no máximo uma vez por appointment;
- teste das alternativas de e-mail e recuperação após reload/duplicidade;
- teste do helper de composição com acentos, `&`, `?`, `#`, CR/LF e valores longos;
- teste do tratamento específico de duplicidade sem confundir outros `409`;
- teste das ações distintas de confirmar e alterar/confirmar, incluindo valor inicial, preservação do ISO quando inalterado, escolha do navegador em horário DST editado e conflito inline;
- teste de telefone ausente ou inválido e da remoção da URL do Calendly.

### E2E local

Com a stack local, dois produtos/processos e três identidades — cliente com telefone, especialista atribuído e outro usuário/especialista — em contextos de navegador independentes:

1. publicar ou selecionar produto de especialista sem Calendly;
2. como cliente, escolher uma data futura e criar o pedido;
3. verificar a URL `mailto:`/Gmail gerada, sem afirmar que um e-mail externo foi enviado;
4. verificar processo pendente e persistência da proposta;
5. como especialista atribuído, verificar e-mail, telefone e WhatsApp do cliente;
6. alterar e confirmar o horário;
7. verificar o agendamento `SCHEDULED`, o processo ainda em `SCHEDULING`, os controles da reunião e a ausência de consumo de remarcação;
8. repetir o caminho confirmando a sugestão sem alteração;
9. validar que usuário não atribuído não recebe os contatos.

O E2E inspeciona o `href` de `mailto:` sem navegar para um aplicativo externo. O caminho Gmail só é aberto em aba controlável quando houver sessão apropriada. O cenário crítico é repetido em viewport móvel e com navegação por teclado.

## Critérios de aceite

- sem Calendly, o cliente sempre informa data e hora antes de criar o pedido;
- a criação resulta em `PENDING/EMAIL`, não em `SCHEDULED/PLATFORM`;
- o cliente consegue iniciar um e-mail com destinatário, assunto e corpo pré-preenchidos e possui fallbacks persistentes;
- o especialista atribuído vê a proposta, o e-mail e o WhatsApp/telefone válido do cliente;
- o especialista pode confirmar ou alterar e confirmar;
- somente a confirmação reserva o horário; o processo permanece em `SCHEDULING` para permitir a reunião;
- o backend impede bypass do tipo de integração e confirma sob lock;
- erros não disparam composição de e-mail indevidamente;
- endpoints tocados pelo fluxo não expõem dados pessoais a usuários não autorizados;
- a edição de perfil rejeita tentativas de alterar outro usuário sem papel `ADMIN`;
- recarregar ou revisitar a página recupera os fallbacks do próprio pedido sem repetir a abertura automática do e-mail;
- a consultoria sem produto continua podendo criar pedido `PENDING/EMAIL` sem data;
- testes automatizados e o E2E local cobrem os dois lados do fluxo.
