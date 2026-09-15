---
sidebar_position: 6
title: Agendamento sem Calendly
---

# Agendamento sem Calendly — especificação de design

**Data:** 14 de setembro de 2026  
**Status:** aprovado para planejamento  
**Escopo:** cadastro de produtos e início de negociação quando o especialista não possui Calendly conectado

## 1. Objetivo

Permitir que especialistas operem normalmente sem uma conta Calendly e oferecer ao cliente duas formas simples de iniciar uma negociação:

1. entrar em contato livremente por e-mail e combinar o horário fora da plataforma; ou
2. escolher uma data e hora diretamente na plataforma.

O Calendly continua disponível como conveniência, mas deixa de ser requisito para cadastrar produtos ou receber solicitações.

## 2. Estado atual e problemas encontrados

O sistema já possui boa parte da infraestrutura necessária:

- `Appointment` registra data, participantes e estado do agendamento;
- `Process` representa o processo comercial e nasce em `SCHEDULING`;
- o backend já valida conflitos de horário e consegue criar `Appointment` e `Process` atomicamente;
- a página de produto já possui um fallback que cria uma solicitação pendente e abre um `mailto:`;
- a área de processos já possui a sala de reunião interna e ações para iniciar e entrar em uma reunião;
- existe um modal global dispensável que incentiva o especialista a conectar o Calendly.

Entretanto, o comportamento atual não atende integralmente ao objetivo:

- `ProductFormPage` substitui o formulário por um bloqueio quando o especialista não tem Calendly;
- o modal global afirma que a negociação fica bloqueada sem Calendly;
- o cliente sem Calendly só recebe a opção de e-mail;
- não existe interface ativa para o cliente escolher uma data e hora na plataforma;
- no fluxo de e-mail, a confirmação do especialista não exige o horário combinado;
- não existe controle explícito da única alteração de horário permitida ao especialista;
- o endpoint direto de agendamento precisa garantir que o usuário autenticado seja o próprio cliente informado.

## 3. Decisões de produto

- Conectar o Calendly é opcional.
- A ausência ou indisponibilidade do Calendly nunca bloqueia criação, edição ou publicação de produtos.
- Um especialista com Calendly mantém o fluxo atual de agendamento.
- Um cliente que escolhe um produto de especialista sem Calendly pode optar por e-mail ou agendamento interno.
- Um horário escolhido pelo cliente na plataforma é confirmado imediatamente.
- No fluxo por e-mail, somente o especialista registra o horário acordado.
- Registrar o primeiro horário após a conversa por e-mail não conta como alteração.
- Depois que um horário está confirmado, o especialista pode alterá-lo uma única vez.
- A alteração feita pelo especialista é definitiva e não depende de aprovação do cliente.
- O MVP não restringe tecnicamente o início da sala a uma janela exata ao redor do horário; o horário é exibido e o especialista inicia a sala quando chega o momento.

## 4. Abordagem escolhida

A implementação evoluirá o fluxo atual, reutilizando `Appointment`, `Process`, as validações de agenda e a sala interna.

Não será criado um calendário completo de disponibilidade. Essa alternativa exigiria regras de jornada, recorrência, bloqueios e fuso horário que não são necessárias para o primeiro lançamento.

Também não haverá uma etapa de aprovação da sugestão do cliente: no agendamento interno, a seleção já cria um horário confirmado.

## 5. Modelo de dados

### 5.1 Origem do agendamento

Adicionar ao Prisma:

```prisma
enum AppointmentSchedulingMethod {
  CALENDLY
  EMAIL
  PLATFORM
}
```

Adicionar a `Appointment`:

```prisma
scheduling_method             AppointmentSchedulingMethod?
specialist_rescheduled_at     DateTime?
specialist_rescheduled_from   DateTime?
```

`scheduling_method` será opcional para permitir uma migração aditiva sem classificar incorretamente registros históricos. Todos os novos agendamentos devem preenchê-lo explicitamente.

`specialist_rescheduled_at` funciona como a trava da única alteração. `specialist_rescheduled_from` preserva o horário anterior para auditoria.

Não é necessário um contador: campo vazio significa que a alteração ainda está disponível; campo preenchido significa que ela já foi consumida.

### 5.2 Estados

| Método | Criação | Quando passa a `SCHEDULED` | Processo |
|---|---|---|---|
| `CALENDLY` | `PENDING` | após sincronização/confirmação atual | permanece com o comportamento existente |
| `EMAIL` | `PENDING`, sem horário | quando o especialista registra o horário acordado | permanece em `SCHEDULING` até a reunião |
| `PLATFORM` | `SCHEDULED`, com horário | na própria criação | nasce em `SCHEDULING` |

Confirmar um horário não significa concluir a reunião nem iniciar a negociação financeira. O processo continua em `SCHEDULING` enquanto a conversa ainda não aconteceu.

## 6. Fluxos

### 6.1 Especialista sem Calendly

1. O especialista entra na área autenticada.
2. A plataforma consulta o estado da conexão Calendly.
3. Se não houver conexão ativa, exibe um modal informativo.
4. O especialista pode escolher `Conectar agora` ou `Continuar sem Calendly`.
5. Ao dispensar o modal, continua usando todas as funcionalidades, inclusive cadastro de produtos.
6. O modal não volta durante a mesma sessão do navegador.

Falha na consulta do Calendly não bloqueia nenhuma tela. O formulário de produto deve ser renderizado independentemente do resultado dessa consulta.

### 6.2 Cliente escolhe contato por e-mail

1. Na página do produto, o cliente seleciona `Enviar e-mail`.
2. A plataforma cria `Appointment(PENDING, EMAIL)` e o `Process(SCHEDULING)` associado na mesma transação.
3. A plataforma abre um `mailto:` com destinatário, assunto e texto sugeridos, todos editáveis no cliente de e-mail.
4. A página redireciona para `Meus Processos` e informa que o horário será definido após o contato.
5. O especialista combina o horário com o cliente fora da plataforma.
6. No card do processo, o especialista escolhe `Definir data e hora`.
7. O backend valida e grava o horário, muda o agendamento para `SCHEDULED` e mantém o processo em `SCHEDULING`.
8. O cliente recebe uma notificação e passa a ver o horário no processo.

Se o navegador não conseguir abrir o cliente de e-mail, a solicitação continua criada. A interface deve exibir o endereço do especialista com uma ação de copiar.

### 6.3 Cliente escolhe data e hora na plataforma

1. Na página do produto, o cliente seleciona `Escolher data e hora`.
2. Um modal simples exibe um campo `datetime-local`, o fuso local do navegador e o botão `Confirmar agendamento`.
3. O frontend converte o valor local para ISO 8601 UTC.
4. O backend valida o usuário, o produto, o horário futuro, conflito de agenda e processo ativo duplicado.
5. A transação cria `Appointment(SCHEDULED, PLATFORM)` e `Process(SCHEDULING)`.
6. O cliente é redirecionado para `Meus Processos` com o horário confirmado.
7. O especialista é notificado sobre o novo agendamento.

O cliente não escolhe a duração no MVP. Será usada a mesma janela de conflito de uma hora já adotada pelo backend.

### 6.4 Alteração única pelo especialista

1. Um agendamento `SCHEDULED` com horário e `specialist_rescheduled_at` vazio exibe `Alterar horário` somente ao especialista responsável.
2. O especialista escolhe um novo horário futuro.
3. A interface avisa que essa será a única alteração e pede confirmação explícita.
4. O backend trava a agenda do especialista, revalida conflito excluindo o próprio agendamento e atualiza atomicamente:
   - `specialist_rescheduled_from` com o horário vigente;
   - `appointment_datetime` com o novo horário;
   - `specialist_rescheduled_at` com o instante da operação.
5. O novo horário passa a valer imediatamente.
6. O cliente é notificado e a ação desaparece para o especialista.

Uma segunda tentativa retorna `409 Conflict` com mensagem de que a alteração definitiva já foi utilizada.

### 6.5 Reunião interna

1. Enquanto o processo está em `SCHEDULING` e o agendamento está `SCHEDULED`, ambos veem o horário confirmado.
2. Ao chegar o momento, o especialista usa `Iniciar reunião`.
3. O cliente passa a ver `Entrar na reunião` assim que a sessão existir.
4. O encerramento da conversa segue o fluxo atual de avanço para negociação.

## 7. Backend e contratos HTTP

### 7.1 Criação direta

Manter `POST /appointments` como operação de agendamento interno e endurecer suas regras:

- aceitar somente usuário autenticado com papel `CUSTOMER`;
- exigir `req.user.id === client_id`;
- exigir `appointment_datetime` para esse fluxo;
- definir `scheduling_method = PLATFORM` no servidor;
- criar agendamento e processo na mesma transação;
- manter o processo em `SCHEDULING`.

O cliente não poderá enviar outro `scheduling_method` nesse endpoint.

### 7.2 Solicitação por e-mail

`POST /appointments/pending` passa a aceitar `scheduling_method` apenas com os valores `EMAIL` ou `CALENDLY`. As chamadas da página de produto devem enviar o valor de forma explícita.

Para reduzir risco de compatibilidade, chamadas antigas sem o campo continuam sendo tratadas como `CALENDLY` no serviço, mas o banco não aplica um default retroativo.

### 7.3 Definição inicial pelo especialista

Evoluir `POST /processes/:id/confirm-appointment` para aceitar:

```json
{
  "appointment_datetime": "2026-09-20T17:00:00.000Z"
}
```

Para `EMAIL`, a data é obrigatória. A operação:

- exige que o solicitante seja o especialista do processo;
- exige processo em `SCHEDULING` e agendamento em `PENDING`;
- valida data futura e conflito sob a trava já existente;
- muda o agendamento para `SCHEDULED`;
- não preenche os campos de reagendamento;
- não avança o processo para `NEGOTIATION`.

### 7.4 Reagendamento definitivo

Adicionar `PATCH /appointments/:id/reschedule`:

```json
{
  "appointment_datetime": "2026-09-21T19:00:00.000Z"
}
```

Regras:

- somente o especialista responsável;
- agendamento em `SCHEDULED`;
- horário atual existente;
- `specialist_rescheduled_at` ainda vazio;
- novo horário futuro e diferente do atual;
- ausência de conflito com outro agendamento do especialista;
- atualização atômica e protegida contra duas alterações concorrentes.

## 8. Frontend

### 8.1 `RequireCalendlyModal`

- Trocar o texto que afirma haver bloqueio.
- Usar `Continuar sem Calendly` no lugar de `Lembrar mais tarde`.
- Manter o comportamento dispensável por sessão.

### 8.2 `ProductFormPage`

- Remover o gate de Calendly.
- Não esperar a consulta da conexão para renderizar o formulário.
- O modal global continua responsável por recomendar a conexão.

### 8.3 `ProductPage`

- Manter o popup atual quando existe URL Calendly.
- Sem URL, apresentar duas ações claras:
  - `Enviar e-mail`;
  - `Escolher data e hora`.
- Reutilizar um modal de agendamento enxuto para o segundo caminho.
- Manter o tratamento de duplicidade e o redirecionamento para processos.

### 8.4 `ProcessCard`

- Para `EMAIL + PENDING`, substituir a confirmação sem horário por `Definir data e hora`.
- Para `SCHEDULED`, exibir o horário aos dois participantes.
- Exibir `Alterar horário` ao especialista apenas quando a alteração ainda estiver disponível.
- Após o reagendamento, exibir `Horário alterado definitivamente`.
- Manter o início da sala exclusivamente com o especialista; o cliente entra depois que a sessão é criada.

## 9. Erros e mensagens

| Situação | Resposta | Comportamento da interface |
|---|---|---|
| Horário passado | `400` | manter modal aberto e explicar que deve ser futuro |
| Conflito de agenda | `409` | manter modal aberto e pedir outro horário |
| Processo ativo duplicado | `409` | direcionar para o processo existente |
| Cliente agendando por outro usuário | `403` | negar sem criar registros |
| Usuário que não é o especialista tentando definir/alterar | `403` | negar sem alterar registros |
| Segunda alteração do especialista | `409` | informar que a alteração definitiva já foi usada |
| Falha no envio da notificação | operação continua | registrar erro; não reverter agendamento |
| Falha ao consultar Calendly | nenhuma restrição | manter produtos e alternativas disponíveis |
| Falha ao abrir `mailto:` | solicitação continua | mostrar e-mail copiável e link para processos |

## 10. Notificações

As notificações continuam assíncronas e não críticas, seguindo o padrão existente do `NotificationService`.

- Agendamento interno criado: avisar o especialista com cliente, produto e horário.
- Horário do fluxo por e-mail definido: avisar o cliente.
- Horário alterado definitivamente: avisar o cliente, mostrando horário anterior e novo.

Não será implementada resposta por e-mail, convite de calendário ou confirmação adicional no MVP.

## 11. Segurança e concorrência

- Toda decisão de autorização ocorre no backend; o frontend apenas oculta ações indisponíveis.
- O agendamento direto verifica a identidade do cliente autenticado.
- Definição e alteração do horário verificam o especialista vinculado ao processo/agendamento.
- A validação de produto continua exigindo produto ativo, do tipo correto e pertencente ao especialista.
- A trava de agenda do especialista é adquirida antes de verificar conflitos e escrever.
- A alteração única usa atualização condicional com `specialist_rescheduled_at: null`; duas requisições concorrentes não podem consumir a alteração duas vezes.
- Criação de `Appointment`, `Process` e histórico permanece atômica.

## 12. Estratégia de testes

### Frontend

- `ProductFormPage` renderiza e envia o formulário mesmo sem Calendly.
- O modal Calendly é dispensável e comunica que a integração é opcional.
- `ProductPage` mantém Calendly quando conectado e mostra as duas alternativas quando desconectado.
- O modal interno converte corretamente a data local para UTC.
- O fluxo de e-mail cria solicitação antes de abrir `mailto:` e oferece fallback copiável.
- `ProcessCard` exige data na confirmação por e-mail.
- A ação de alterar horário aparece uma vez e desaparece após sucesso.

### Backend

- Cliente só agenda para si mesmo.
- Agendamento interno exige horário futuro e nasce `SCHEDULED/PLATFORM`.
- Solicitação por e-mail nasce `PENDING/EMAIL` sem horário.
- Apenas o especialista registra o primeiro horário do fluxo por e-mail.
- Definição inicial mantém o processo em `SCHEDULING` e não consome reagendamento.
- Primeira alteração grava horário anterior e instante da alteração.
- Segunda alteração retorna conflito.
- Requisições concorrentes permitem apenas uma alteração.
- Conflito de agenda, produto incorreto e processo duplicado continuam bloqueados.
- Falha ao criar o processo reverte o agendamento.
- Falha de notificação não reverte alterações confirmadas.
- Testes existentes do Calendly continuam passando.

### Verificação integrada

Validar manualmente com dois usuários, cliente e especialista sem Calendly:

1. cadastrar um produto;
2. iniciar uma solicitação por e-mail e registrar o horário pelo especialista;
3. criar outro agendamento escolhendo o horário na plataforma;
4. alterar uma vez e confirmar que a segunda alteração é bloqueada;
5. iniciar e acessar a sala pelos dois participantes.

## 13. Critérios de aceite

- Especialista sem Calendly cadastra, edita e publica produtos sem bloqueio.
- O lembrete de Calendly pode ser fechado e não contém mensagem de bloqueio.
- Cliente de produto sem Calendly escolhe entre e-mail e data/hora interna.
- Os dois caminhos criam processo rastreável em `SCHEDULING`.
- O fluxo de e-mail só ganha horário quando o especialista o registra.
- O agendamento interno nasce confirmado.
- Ambos visualizam o horário vigente.
- O especialista consegue alterá-lo uma vez, com efeito imediato.
- A segunda alteração é recusada também sob concorrência.
- O cliente é notificado quando o especialista define ou altera o horário.
- A sala interna continua acessível pelo processo no momento combinado.
- O fluxo Calendly existente não sofre regressão.

## 14. Fora de escopo

- agenda de disponibilidade recorrente do especialista;
- bloqueio de feriados, horário comercial ou intervalos personalizados;
- aprovação do cliente após alteração;
- múltiplas propostas de reagendamento;
- integração com Google Calendar, Outlook ou convites `.ics`;
- abertura automática da sala exatamente no horário;
- escolha de duração pelo cliente;
- chat interno para substituir o e-mail.
