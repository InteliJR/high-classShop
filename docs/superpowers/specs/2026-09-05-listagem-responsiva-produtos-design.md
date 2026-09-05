# Listagem responsiva e identificação monetária dos produtos

## Contexto

A gestão de produtos hoje usa uma tabela com sete colunas e depende de rolagem
horizontal em telas estreitas. Os dados locais de validação também identificam
os cenários monetários nos nomes dos clientes (`Cliente BRL` e `Cliente USD`),
o que confunde pessoa e produto.

Esta entrega torna a listagem confortável em celular e notebook e move a
identificação BRL/USD para junto do nome do produto. A lógica monetária já
aprovada não será alterada.

## Decisões aprovadas

- A pessoa deixa de carregar `Cliente BRL` ou `Cliente USD` no nome dos
  fixtures locais. Os nomes exibidos passam a ser somente `Bruna` e `Uri`;
  seus e-mails e papéis permanecem iguais.
- Cada item mostra, depois do nome completo do produto, um selo textual
  `Produto BRL` ou `Produto USD`, derivado de `product.currency`.
- O valor continua formatado com a unidade monetária correspondente:
  `R$ 120.000,00` ou `US$ 120.000,00`.
- O selo é apresentação; `marca`, `modelo` e identificadores persistidos não
  recebem a moeda como parte estrutural do nome.
- O fixture BRL local remove `BRL` do modelo já existente para evitar
  duplicação entre nome e selo.

## Layout responsivo

### Celular, tablet e notebook estreito

Abaixo de 1280 px, os produtos serão exibidos como cartões:

- uma coluna em celular;
- duas colunas a partir de 640 px;
- imagem, nome completo, selo de moeda, ano, valor e estado sem rolagem
  horizontal;
- ações `Editar` e `Excluir` com ícone e texto, ocupando toda a largura útil.

### Notebook amplo e desktop

A partir de 1280 px, a tabela permanece, mas será reduzida para cinco colunas:

1. Produto — imagem, marca, modelo e selo BRL/USD;
2. Ano;
3. Valor;
4. Estado;
5. Ações.

A identidade do produto fica em uma única célula flexível. Valor e ações não
quebram linha, e textos longos do produto podem truncar sem deformar a tabela.

## Estrutura de componentes

A renderização responsiva ficará em um componente apresentacional separado da
página que busca os dados. Ele receberá a lista filtrada e callbacks de edição
e exclusão. Assim, a página mantém autenticação, busca, filtro e navegação,
enquanto o componente pode ser testado sem simular todo o aplicativo.

Um pequeno selo reutilizado nas duas apresentações gera o texto a partir da
moeda, evitando divergência entre cartão e tabela.

## Estados e erros

Os estados existentes de carregamento, lista vazia e falha de carregamento são
preservados. A exclusão mantém confirmação e mensagens atuais. Imagens
indisponíveis continuam usando o fallback `sem foto`.

## Testes e aceite

- Teste de componente comprova as duas superfícies responsivas (`xl:hidden` e
  `hidden xl:block`).
- Testes confirmam nome, selo `Produto BRL/USD`, valor formatado e ações
  acessíveis.
- A suíte completa e o build do frontend devem terminar com código zero.
- A aplicação local será reiniciada e deixada disponível para validação.

## Fora do escopo

- Conversão cambial.
- Mudança na negociação, no valor mínimo ou no contrato.
- Alteração de APIs ou do schema do banco.
- Redesenho das demais tabelas do sistema.
