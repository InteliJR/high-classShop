# Task #252 — Motivo da consultoria e confirmação de recebimento

[Ver comparação visual antes e depois](antes-e-depois.md).

Branch: `feat/consultancy-reason-252`.

Fluxo executado separadamente, na worktree desta task. Prints reais da aplicação local, com API e dados simulados. Não foi usado PostgreSQL real nem alterado qualquer dado de produção.

## 1. Cliente escolhe a especialista para a consultoria.

![Cliente escolhe a especialista para a consultoria.](01-escolher-especialista.png)

## 2. Motivo vazio é bloqueado antes de registrar o pedido.

![Motivo vazio é bloqueado antes de registrar o pedido.](02-motivo-obrigatorio.png)

## 3. Cliente informa o motivo, sem repetir nome ou e-mail.

![Cliente informa o motivo, sem repetir nome ou e-mail.](03-cliente-informa-motivo.png)

## 4. Solicitação recebida; o horário continua aguardando confirmação.

![Solicitação recebida; o horário continua aguardando confirmação.](04-cliente-recebe-confirmacao.png)

## 5. A especialista encontra o motivo no processo, inclusive após recarregar.

![A especialista encontra o motivo no processo, inclusive após recarregar.](05-especialista-le-motivo.png)

## Verificações

Também foram conferidos o bloqueio de motivo vazio, o limite de 500 caracteres, o envio único e a leitura do motivo pelo especialista após recarregar.

Nenhum erro de JavaScript foi registrado durante este fluxo.
