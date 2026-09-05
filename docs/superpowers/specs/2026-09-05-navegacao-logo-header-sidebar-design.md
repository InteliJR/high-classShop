# Navegação pela logo no header e na sidebar

## Contexto

A marca exibida no header já aceita clique, mas o destino público ainda é a
landing page. A mesma marca exibida na sidebar não é interativa. Isso torna o
comportamento inconsistente entre as duas superfícies e impede que a logo seja
usada como atalho previsível para o início da área atual.

Esta entrega padroniza a navegação da logo da plataforma e da logo
white-label de um escritório parceiro. Não haverá alteração nas rotas nem na
resolução da identidade visual já existente.

## Comportamento aprovado

Ao selecionar a logo no header ou na sidebar, o usuário será enviado para:

- visitante não autenticado: `/catalog/cars`;
- cliente (`CUSTOMER`): `/customer/home`;
- consultor (`CONSULTANT`): `/consultant/dashboard`;
- especialista (`SPECIALIST`): `/specialist/dashboard`;
- administrador (`ADMIN`): `/admin/dashboard`;
- escritório (`OFFICE`): `/office/dashboard`.

A regra vale tanto para a logo padrão da plataforma quanto para uma logo de
escritório parceiro. O contexto white-label mantido em memória continuará
ativo durante a navegação interna para o catálogo.

## Estrutura da solução

A resolução do destino ficará centralizada em uma função de navegação, para
que Header e Sidebar não mantenham condições duplicadas. A função aceitará o
papel do usuário ou a ausência de usuário e devolverá uma rota válida para
todos os casos conhecidos.

As imagens visíveis no Header e na Sidebar serão envolvidas por links de
navegação interna do React Router. O link terá um nome acessível que comunique
o destino de início sem depender do texto alternativo da imagem.

Na sidebar mobile, selecionar a logo também fechará o drawer, seguindo o
comportamento dos demais links do menu. Na sidebar desktop recolhida, onde a
logo não é renderizada atualmente, nenhuma nova marca ou controle será
introduzido.

## Fluxo e estados

Não haverá chamada adicional à API, carregamento assíncrono nem novo estado.
O destino será calculado a partir do usuário já disponível no store de
autenticação.

Para visitantes oriundos de `/i/:slug`, a navegação SPA para
`/catalog/cars` preservará o escritório no store white-label, mantendo logo e
cores no catálogo enquanto a página não for recarregada. A limitação já
existente de perder esse contexto após um recarregamento fora de `/i/:slug`
permanece fora do escopo.

## Testes e critérios de aceite

- O helper de navegação retorna o destino esperado para visitante e para cada
  papel autenticado.
- A logo do Header possui destino `/catalog/cars` para visitante.
- A logo do Header leva um usuário autenticado ao início correspondente ao
  seu papel.
- A logo da Sidebar possui o mesmo destino do Header para visitante e usuário
  autenticado.
- O clique na logo da Sidebar fecha o drawer no mobile.
- A logo white-label continua sendo exibida e recebe o mesmo comportamento da
  logo padrão.
- Os testes focados de navegação e o build do frontend terminam com código
  zero.

## Fora do escopo

- Alterar ou criar páginas de dashboard e catálogo.
- Tornar clicável a marca presente nos painéis das páginas de autenticação.
- Persistir o white-label em `sessionStorage` ou mudar o formato das URLs
  públicas.
- Exibir uma logo nova quando a sidebar desktop estiver recolhida.
- Alterar os demais links do Header ou da Sidebar.
