# Telefones da contraparte no card de negociação

## Contexto

Os cards de processo já renderizam o telefone da contraparte quando o campo
`phone` está presente. Porém, as páginas de cliente e especialista carregam os
cards por rotas de listagem que omitem esse campo. A regra de visibilidade foi
implementada apenas na rota de detalhe, portanto o frontend não recebe o dado
necessário mesmo depois da confirmação do agendamento.

## Regra de negócio

- Com o agendamento em `PENDING`, nenhum participante recebe o telefone da
  contraparte.
- Com o agendamento em `SCHEDULED` ou `COMPLETED`, o cliente recebe o telefone
  do especialista e o especialista recebe o telefone do cliente.
- Telefone ausente no cadastro continua sendo representado por `null` e não
  gera uma linha vazia no card.
- E-mails e demais informações do card não mudam.

## Abordagem

A regra será aplicada no backend, nas respostas que alimentam os cards. Isso
evita uma requisição de detalhe para cada item da lista e impede que o frontend
receba telefones antes do momento permitido.

Uma função privada e pura no `ProcessesService` identificará os estados que
liberam contato. Os mapeamentos das listagens de cliente e especialista usarão
essa função para preencher somente o telefone da contraparte. A rota de detalhe
usará a mesma condição, incluindo `COMPLETED`, para que os contratos da API não
divirjam entre si.

O frontend continuará apenas apresentando o dado recebido. A tipagem local da
página de processos do cliente será alinhada ao contrato que já existe no
serviço compartilhado.

## Fluxo de dados

1. A página solicita a lista de processos do participante autenticado.
2. O backend consulta o processo, o agendamento e os usuários relacionados.
3. O backend verifica o status do agendamento.
4. Em `SCHEDULED` ou `COMPLETED`, inclui o telefone da contraparte; nos demais
   estados, devolve `null`.
5. O `ProcessCard` renderiza e mascara o telefone somente quando houver valor.

## Segurança e casos de borda

- A autorização atual das rotas permanece inalterada.
- A decisão de exposição fica no backend; não depende de esconder elementos
  apenas na interface.
- `PENDING`, `CANCELLED`, agendamento ausente e status desconhecido permanecem
  sem telefone.
- A resposta não usa o telefone de um participante como fallback para o outro.

## Testes

Testes unitários do `ProcessesService` comprovarão, para cliente e especialista:

- `PENDING` devolve `phone: null` para a contraparte;
- `SCHEDULED` devolve o telefone cadastrado da contraparte;
- `COMPLETED` mantém o telefone disponível;
- telefone não cadastrado continua `null` mesmo após a liberação.

Após a implementação, serão executados o teste focado do serviço, a checagem
de tipos/build dos módulos afetados e a verificação do diff final.

## Fora de escopo

- Alterar cadastro ou validação de telefone.
- Mudar a apresentação visual ou o comportamento de cópia do card.
- Expor contatos para consultor, escritório ou administrador por novas regras.
- Modificar o ciclo de vida do agendamento.
