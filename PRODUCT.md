# Product

## Register

product

## Platform

web

## Users

Clientes finais (compradores de carros/barcos/aeronaves de alto padrão), Consultores (trazem e acompanham clientes, ganham comissão), Especialistas (conduzem negociação, propostas e contratos) e Administradores (operação da plataforma: escritórios, consultores, especialistas). Quatro papéis, quatro dashboards (`/admin`, `/consultant`, `/specialist`, `/catalog` + `/customer`), um sistema visual só.

## Product Purpose

A High Class Shop é uma plataforma de intermediação para venda de carros, barcos e aeronaves de alto padrão: conecta clientes a especialistas através de um fluxo completo — catálogo, agendamento, negociação, proposta, contrato (assinatura digital via DocuSign) e conclusão. Consultores trazem e acompanham clientes; especialistas conduzem a negociação e fecham o contrato. Sucesso é o processo (`SCHEDULING → NEGOTIATION → PROCESSING_CONTRACT → DOCUMENTATION → COMPLETED | REJECTED`) ficar claro o bastante pra que nenhum papel fique sem saber o que fazer a seguir — e pra nenhuma tela virar um beco sem saída.

## Positioning

Uma central única para o ciclo de venda de bens de alto valor — do primeiro contato à assinatura do contrato — sem depender de planilha, e-mail solto ou processo improvisado por escritório.

## Brand Personality

Discreta e confiável — não "luxuosa" no sentido óbvio (sem dourado, sem grafite-premium, sem gradiente). A confiança vem da consistência e da ausência de ruído visual: poucas cores, hierarquia clara, cada tela sabendo pra onde o usuário deve ir a seguir. É a mesma lógica de quem está fechando um contrato de alto valor: sobriedade em vez de exibição.

## Anti-references

Paleta grafite + dourado foi cogitada e descartada explicitamente — não deve reaparecer em nenhuma tela. Badges de status saturados (verde/vermelho/laranja/roxo/azul cheios, estilo dashboard SaaS genérico) também foram descartados a favor de um indicador discreto (pílula neutra + ponto de cor — ver `DESIGN.md`). Evitar qualquer cor de destaque separada do preto/cinza de ação — a plataforma é deliberadamente monocromática nas ações (botão primário, links, foco).

## Design Principles

- **Sempre existe um caminho de volta** — nenhuma tela é um beco sem saída; todo fluxo (contrato, agendamento, convite em lote) tem uma saída explícita, nunca só o botão de voltar do navegador.
- **Ação é monocromática** — botão primário, links e foco usam preto/grafite; cor é reservada só pra status (indicador discreto) e pro whitelabel do escritório.
- **Um sistema, quatro papéis** — Cliente, Consultor, Especialista e Admin compartilham o mesmo vocabulário visual (`DESIGN.md`); diferenças são de conteúdo/permissão, não de estilo.
- **Whitelabel só onde faz sentido** — telas do cliente final herdam a cor da concessionária/escritório (`ThemeProvider` + `--brand-*`); Admin e Especialista permanecem neutros na marca padrão da plataforma.
- **Consistência de componente acima de implementação pontual** — um `Button`, um `Modal`, um `StatusBadge`, reaproveitados; não uma versão nova por tela.

## Accessibility & Inclusion

Sem exigência formal de WCAG. Padrão razoável: contraste legível nos tokens definidos em `DESIGN.md`, foco sempre visível (anel único), respeito a `prefers-reduced-motion` nas transições. Sem modo escuro nesta fase — ver `DESIGN.md` para os tokens já preparados pra isso no futuro.
