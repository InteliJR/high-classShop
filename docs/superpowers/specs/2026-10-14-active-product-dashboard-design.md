# Produtos ativos nos dashboards

## Objetivo

Corrigir a divergência entre produtos ativos e produtos cadastrados nos dashboards que exibem essa informação. A quantidade em destaque deve representar somente produtos ativos, enquanto o texto auxiliar deve informar a quantidade total de produtos, incluindo ativos e inativos.

## Escopo

A alteração abrange os dois dashboards que hoje exibem quantidade de produtos:

- dashboard administrativo;
- dashboard do especialista.

O dashboard de escritório não exibe quantidade de produtos e, portanto, não será alterado.

## Regra de negócio

- Produto ativo é aquele cujo campo `is_active` é `true`.
- Total de produtos inclui registros ativos e inativos.
- No dashboard administrativo, as quantidades agregam carros, embarcações e aeronaves de todos os especialistas.
- No dashboard do especialista, as quantidades consideram apenas os produtos vinculados ao especialista e à especialidade dele.

## Contrato da API

Para preservar compatibilidade, os campos existentes continuarão representando o total cadastrado:

- `totalProducts` no dashboard administrativo;
- `productsListed` no dashboard do especialista;
- `productsByType` continuará disponível no dashboard administrativo com as contagens totais por categoria.

As duas respostas receberão o campo `activeProducts`, que contém a contagem filtrada por `is_active: true`.

## Interface

Nos dois dashboards, o card passará a exibir:

- título: `Produtos ativos`;
- valor principal: `activeProducts`;
- texto auxiliar: `<total> produtos no total`.

O dashboard administrativo deixará de exibir no card a divisão por categoria, mas a informação continuará disponível na API para consumidores existentes.

Durante o carregamento, os skeletons existentes serão preservados. Na ausência de dados, as quantidades exibidas serão zero.

## Testes e validação

- Testes unitários do backend verificarão que produtos ativos e totais usam filtros distintos nos dois endpoints.
- Testes de componentes do frontend verificarão o título, o valor em destaque e o texto auxiliar nos dashboards administrativo e do especialista.
- Build de backend e frontend confirmará a consistência de tipos.
- Um percurso E2E no navegador validará visualmente os dois dashboards em larguras desktop e móvel, registrando screenshots no diretório de evidências do projeto.

## Fora de escopo

- Alterar a listagem ou o processo de ativação/inativação de produtos.
- Remover os campos antigos da API.
- Adicionar o indicador a dashboards que atualmente não mostram produtos.
