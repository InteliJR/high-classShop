# Jitsi — Estudo de Custos e Viabilidade

**Data:** 2026-05-25
**Autor:** @Messias-Olivindo
**Para:** TASK 1.12 / apresentação ao cliente
**Status:** Finalizado

## Pergunta / Objetivo

Quanto custaria usar o Jitsi na plataforma para chamadas de reunião de aproximadamente 1 hora? Qual é a forma mais adequada de contratação para um negócio como o High-Class Shop?

## Resumo executivo

A plataforma já tem suporte ao Jitsi no código — basta trocar uma variável de ambiente. O servidor público gratuito (`meet.jit.si`) funciona para testes, mas não é adequado para uso em produção com clientes. Para produção, existem duas opções: **servidor próprio** (custo fixo mensal, ~R$ 100–300/mês) ou **JaaS** — serviço pago da empresa que mantém o Jitsi (custo por minuto de uso). Para o volume esperado da plataforma, **servidor próprio** tende a ser mais barato e mais simples de controlar.

---

## Detalhes

### Situação atual

O sistema já tem o Jitsi implementado. Quando a variável `MEETING_PROVIDER=JITSI` está ativa, o sistema gera um link de sala Jitsi e embute ele como vídeo dentro da plataforma. Hoje está apontando para o servidor público gratuito (`meet.jit.si`), que:

- Não tem garantia de qualidade ou estabilidade.
- Pode ter travamentos ou quedas.
- Não é recomendado para reuniões de negócios com clientes.

Para chamadas de 1 hora com clientes comprando veículos de alto valor, isso é um risco de imagem.

---

### Opção 1 — Servidor próprio (self-hosted)

Instalar o Jitsi em um servidor na nuvem da plataforma. O Jitsi em si é gratuito (código aberto).

**O que se paga:** somente o servidor.

| Carga esperada | Servidor sugerido | Custo estimado/mês |
|---|---|---|
| Até 5 chamadas simultâneas (2–4 pessoas cada) | VPS 2 vCPU / 4 GB RAM | R$ 100–180 |
| Até 15 chamadas simultâneas | VPS 4 vCPU / 8 GB RAM | R$ 250–400 |

> Valores de referência: Digital Ocean, AWS, Hetzner. Podem variar.

**Prós:**
- Custo fixo e previsível, independente de quantas chamadas forem feitas.
- Controle total: dados das reuniões ficam no servidor da plataforma, não em terceiros.
- Sem limite de tempo de chamada.

**Contras:**
- Alguém precisa configurar e manter o servidor (atualizações, segurança). Custo de tempo.
- Se o servidor cair, as reuniões caem junto.

**Esforço de implementação:** médio. Servidor para cima em ~2–4 horas com o instalador oficial. Depois basta trocar a variável `JITSI_BASE_URL` para apontar para o servidor próprio. Sem mudanças no código da plataforma.

---

### Opção 2 — JaaS (Jitsi as a Service) — serviço pago da 8x8

A empresa 8x8 (que mantém o Jitsi) oferece o Jitsi como serviço gerenciado. Cobrança por minuto de uso.

**Como funciona o custo:**
- Free tier: 10.000 minutos/mês gratuitos por conta.
- Após isso: cobrança por minuto de cada participante na chamada.
- Preço aproximado (verificar site atual): US$ 0,004 por participante/minuto.

**Exemplo para 1 hora de chamada com 2 pessoas:**
- 2 pessoas × 60 minutos = 120 minutos cobráveis
- Custo por chamada: ~US$ 0,48 (~R$ 2,50 na cotação atual)

**Exemplo mensal:**
| Chamadas/mês | Custo estimado (USD) | Custo estimado (BRL) |
|---|---|---|
| 83 chamadas de 1h (2 pessoas) | ~US$ 0 (dentro do free) | R$ 0 |
| 200 chamadas de 1h (2 pessoas) | ~US$ 82 | ~R$ 430 |
| 500 chamadas de 1h (2 pessoas) | ~US$ 244 | ~R$ 1.280 |

> Dólar de referência: R$ 5,25. Verificar preços atuais em [jaas.8x8.vc](https://jaas.8x8.vc).

**Prós:**
- Sem servidor para gerenciar. A 8x8 cuida de tudo.
- Escala automaticamente.
- Se o volume for baixo (até ~160 chamadas de 1h por mês), pode ficar dentro do free.

**Contras:**
- Custo variável: se o volume de reuniões crescer muito, o custo sobe.
- Requer pequena mudança no código (geração de token JWT para autenticar no serviço). Cerca de 1 dia de trabalho de desenvolvimento.
- Dados ficam na infraestrutura da 8x8 (empresa americana).

---

### Comparativo rápido

| | Servidor próprio | JaaS |
|---|---|---|
| Custo mensal (volume baixo) | R$ 100–180 (fixo) | R$ 0 (dentro do free) |
| Custo mensal (volume alto) | R$ 100–180 (fixo) | Cresce com o uso |
| Manutenção técnica | Sim | Não |
| Mudança no código | Quase nenhuma | ~1 dia |
| Controle dos dados | Total | Parcial (8x8) |
| Limite de duração de chamada | Nenhum | Nenhum |

---

## Recomendação

**Curto prazo (próximas semanas):** testar com **JaaS free** para validar a experiência dos usuários sem custo. Tem 10.000 minutos/mês grátis, suficiente para testes e para os primeiros clientes.

**Médio prazo (quando o volume de reuniões crescer):** migrar para **servidor próprio** na nuvem (Digital Ocean ou AWS). Custo fixo, mais controle, sem dependência de terceiros.

A mudança entre os dois é sempre só a variável de ambiente `JITSI_BASE_URL` — não é preciso refazer nada no sistema.

---

## Referências

- Jitsi Meet (código aberto): https://jitsi.org
- JaaS (serviço pago): https://jaas.8x8.vc
- Instalador oficial self-hosted: https://jitsi.github.io/handbook/docs/devops-guide/devops-guide-quickstart
- Código na plataforma: `backend/src/features/meetings/meetings.service.ts` (suporte Jitsi já implementado)
- Env vars relevantes: `MEETING_PROVIDER`, `JITSI_BASE_URL` (ver `CLAUDE.md`)
