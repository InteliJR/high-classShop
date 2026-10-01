# Calendly opcional no cadastro de produtos

## Objetivo

Permitir que especialistas cadastrem e importem produtos sem conectar uma conta do Calendly. A integração com o Calendly permanece opcional e limitada aos fluxos de agendamento.

## Comportamento esperado

- Especialistas podem cadastrar manualmente carros, embarcações e aeronaves sem conexão ativa com o Calendly.
- Especialistas podem importar por CSV carros, embarcações e aeronaves sem conexão ativa com o Calendly.
- As permissões atuais permanecem: o especialista só pode criar produtos da própria especialidade e o administrador continua autorizado.
- As validações de arquivo, campos do produto e propriedade do produto permanecem inalteradas.
- A conexão com o Calendly continua disponível no perfil e nos fluxos de agendamento, mas não interfere no catálogo.

## Causa raiz

O commit que tornou o Calendly opcional removeu o bloqueio da página de cadastro no frontend, mas preservou no backend chamadas a `assertSpecialistHasCalendly` nos endpoints de criação e importação de carros, embarcações e aeronaves. Assim, o formulário é exibido, porém a API rejeita a operação.

## Arquitetura e fluxo

Os controllers de carros, embarcações e aeronaves deixarão de consultar o estado da conexão com o Calendly ao criar ou importar produtos. Cada endpoint continuará executando `assertSpecialistCanCreate`, atribuindo o especialista responsável e delegando a persistência ou a criação do job de importação ao serviço correspondente.

Como nenhum fluxo de produto continuará usando `assertSpecialistHasCalendly`, o helper, seus testes isolados e a injeção de `PrismaService` adicionada exclusivamente para essa consulta serão removidos. Isso mantém a fronteira entre catálogo e agendamento explícita e evita código morto.

O frontend já renderiza o formulário sem consultar o Calendly e não requer mudança.

## Tratamento de erros

Não haverá novo tipo de erro. Erros de papel, especialidade, arquivo CSV e dados do produto permanecem como estão. A resposta de proibição relacionada exclusivamente à ausência de Calendly deixa de existir nos fluxos de produto.

## Testes

Os testes dos três controllers deverão provar, antes da mudança de produção, que um especialista sem conexão com o Calendly consegue:

1. cadastrar manualmente um produto da própria especialidade;
2. iniciar uma importação CSV válida da própria especialidade.

Os testes também verificarão que o backend não consulta a conexão com o Calendly nesses fluxos. As suítes existentes de autorização continuam protegendo as restrições de papel e especialidade.

## Fora do escopo

- Alterar a integração OAuth ou os agendamentos do Calendly.
- Remover a opção de conectar o Calendly no perfil.
- Alterar permissões de criação, edição ou exclusão de produtos.
- Modificar o processamento interno dos jobs de importação.
