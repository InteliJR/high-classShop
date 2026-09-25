# Comissão do especialista no convite e na edição administrativa

## Contexto

Na `develop` analisada, o administrador convida um especialista informando
somente e-mail e especialidade. Esses dados são gravados em um token JWT e o
especialista conclui o próprio cadastro. Como a taxa de comissão não participa
do convite nem do cadastro, `User.commission_rate` é criada como `null`.

O cálculo de contratos já interpreta uma comissão nula como `0%`, mas a
interface administrativa também apresenta esse valor como zero e não distingue
um cadastro incompleto de uma comissão explicitamente configurada como `0%`.

A plataforma já permite editar a comissão de um especialista cadastrado pela
tela de especialistas e pela página de comissões. Esta especificação completa o
fluxo de entrada e torna visível o estado legado sem duplicar um novo sistema de
convites.

## Objetivos

- Exigir que o administrador defina a comissão ao convidar um especialista.
- Garantir que o especialista não consiga alterar a comissão durante o próprio
  cadastro.
- Persistir a comissão junto com a criação da conta.
- Exigir comissão ao transformar um usuário existente em especialista.
- Preservar os caminhos administrativos de edição após o cadastro.
- Distinguir visualmente comissão nula de comissão explicitamente configurada
  como `0%`.
- Manter especialistas legados com comissão nula funcionando com valor efetivo
  de `0%`.

## Fora do escopo

- Editar, revogar ou auditar convites pendentes.
- Criar uma tabela persistente de convites.
- Alterar a divisão matemática das comissões.
- Alterar comissões já congeladas em contratos existentes.
- Preencher automaticamente a comissão dos especialistas legados.
- Permitir que o especialista edite a própria comissão.

## Decisões aprovadas

1. A comissão será obrigatória no envio de um novo convite.
2. O valor aceitará de `0%` a `100%`, inclusive, com no máximo duas casas
   decimais.
3. A comissão será incluída no token JWT assinado do convite.
4. O cadastro público não aceitará comissão informada livremente pelo cliente;
   o backend usará exclusivamente o valor validado do token.
5. Comissão nula continuará valendo `0%` nos cálculos para compatibilidade.
6. Comissão nula exibirá a sinalização `Comissão não configurada` nas telas
   administrativas.
7. Salvar explicitamente qualquer valor, inclusive `0%`, removerá a
   sinalização.
8. Não haverá migration nem backfill: a nulabilidade existente é necessária
   para distinguir o estado legado de um zero intencional.
9. Mudanças de comissão afetarão somente contratos criados posteriormente;
   snapshots existentes permanecerão inalterados.

## Fluxo do convite

O modal `Novo Especialista` receberá o campo obrigatório
`Comissão do especialista (% da comissão total)`. O campo começará vazio, para
evitar que ausência de decisão seja confundida com uma decisão explícita por
`0%`.

A ajuda textual deve explicar que o percentual representa a fatia do
especialista sobre a comissão total da venda, não uma porcentagem direta do
valor do produto.

O frontend enviará:

```json
{
  "email": "especialista@exemplo.com",
  "speciality": "CAR",
  "commission_rate": 25
}
```

O backend substituirá o objeto inline do controller por um DTO próprio para o
convite. O DTO validará e-mail, especialidade, presença do valor, intervalo e
precisão decimal. `0` deve ser tratado como valor presente e válido; validações
baseadas em truthiness não podem rejeitá-lo.

Depois da validação, o token assinado conterá:

```json
{
  "type": "SPECIALIST_INVITE",
  "email": "especialista@exemplo.com",
  "speciality": "CAR",
  "commission_rate": 25
}
```

O token continuará expirando em sete dias. Como convites pendentes não serão
editáveis, não será criada persistência adicional.

## Cadastro do especialista

A validação do token retornará e-mail, especialidade e comissão. A tela de
cadastro mostrará a comissão como informação somente leitura, deixando claro
que foi definida pelo administrador.

`RegisterSpecialistDto` continuará sem um campo de comissão. Durante
`registerSpecialist`, o backend obterá `commission_rate` do token verificado e
gravará o valor na mesma criação de `User` que persiste o papel e a
especialidade.

Esse limite de confiança impede que uma chamada manual ao endpoint público
substitua a comissão escolhida pelo administrador.

## Conversão de usuário para especialista

O painel também permite transformar um usuário existente em especialista. Esse
caminho precisa seguir a mesma regra do convite para não continuar produzindo
especialistas com comissão nula.

Quando o cargo de destino for `SPECIALIST`:

- a interface exibirá especialidade e comissão;
- ambos serão obrigatórios;
- `ChangeRoleDto` aceitará e validará `commission_rate` nesse contexto;
- papel, especialidade e comissão serão persistidos na mesma transação.

Para os demais cargos, `commission_rate` não será aplicado. Ao sair do papel de
especialista, esta entrega não apagará o valor histórico; uma política de
limpeza de atributos por mudança de cargo fica fora do escopo.

## Edição após o cadastro

Os acessos já existentes serão preservados:

- ação de edição na gestão de especialistas, para especialidade e comissão;
- página de comissões, para edição rápida da comissão.

As duas entradas devem aplicar as mesmas regras numéricas: valor obrigatório,
intervalo de `0` a `100` e no máximo duas casas decimais. A autorização
permanece restrita a administradores.

Uma alteração passa a valer nos cálculos de novos contratos. Contratos já
criados continuam usando os valores registrados no próprio snapshot e não são
recalculados retroativamente.

## Estado legado e sinalização no frontend

O contrato da API deve preservar `commission_rate: null`; o backend não deve
converter o campo persistido para zero na listagem. O valor efetivo pode ser
derivado no ponto de cálculo com:

```text
effectiveCommissionRate = commission_rate ?? 0
```

Nas telas administrativas que exibem especialistas:

- `commission_rate === null`: mostrar `0%` e uma flag amarela
  `Comissão não configurada`;
- `commission_rate === 0`: mostrar somente `0%`, sem flag;
- `commission_rate > 0`: mostrar o percentual configurado, sem flag.

A tela de gestão de especialistas receberá uma coluna ou informação explícita
de comissão, pois hoje a listagem principal não mostra esse dado. A página de
comissões manterá `0` como valor inicial editável para registros nulos, mas
receberá separadamente o estado `configured` para não perder a flag.

Após uma gravação bem-sucedida, a resposta atualizada da API deve substituir o
registro no estado local. Se o administrador salvar `0%`, o backend persistirá
zero, a resposta deixará de ser nula e a flag desaparecerá imediatamente.

## Regras de erro

- Convite sem comissão: `Informe a comissão do especialista.`
- Valor não numérico: `A comissão deve ser um número.`
- Valor fora do intervalo: `A comissão deve estar entre 0% e 100%.`
- Mais de duas casas decimais: `A comissão deve ter no máximo duas casas decimais.`
- Token antigo sem comissão: deve continuar válido para compatibilidade e
  criar o especialista com `commission_rate: null`, que será sinalizado como
  não configurado.
- Token inválido ou expirado: mantém o tratamento atual.

O suporte a tokens antigos é temporário e natural: depois do prazo atual de
sete dias, todos os novos tokens já terão comissão.

## Segurança e integridade

- A comissão é definida por um administrador autenticado.
- O JWT protege o valor contra alteração durante o autocadastro.
- O endpoint público não confia em comissão enviada no corpo.
- A edição posterior continua protegida por papel administrativo.
- `null` e `0` não podem ser normalizados para o mesmo valor nas respostas de
  listagem ou no estado do frontend.
- O cálculo continua aceitando `null` como `0%`, conforme decisão de
  compatibilidade.

A validação já existente de que as fatias do especialista e do escritório não
podem ultrapassar `100%` da comissão total continuará ocorrendo no fluxo do
contrato. Regras globais entre um especialista e todos os escritórios possíveis
não serão adicionadas nesta entrega.

## Testes

### Backend

- DTO de convite aceita `0`, `100` e valor com duas casas decimais;
- DTO rejeita ausência, número negativo, valor acima de `100` e precisão maior
  que duas casas;
- serviço de convite inclui a comissão no token assinado;
- validação de convite retorna a comissão assinada;
- cadastro persiste a comissão recebida do token;
- corpo público não consegue sobrescrever a comissão do token;
- token legado sem comissão cria registro nulo;
- conversão para especialista exige e persiste especialidade e comissão na
  mesma transação;
- edição aceita `0%` e preserva zero como valor não nulo;
- listagem preserva `null` para cadastros legados;
- cálculo de contrato mantém fallback de `null` para `0%`.

### Frontend

- formulário de convite exige a comissão e aceita `0`;
- mensagens de intervalo e precisão são apresentadas antes do envio;
- valor é enviado junto com e-mail e especialidade;
- cadastro mostra a comissão do convite como somente leitura;
- conversão de cargo para especialista exige comissão;
- especialista com comissão nula mostra `0%` e a flag;
- especialista com zero explícito mostra `0%` sem a flag;
- salvar `0%` em um registro nulo remove a flag sem recarregar a página;
- edição de valor positivo atualiza a apresentação.

### Verificação integrada

- convidar especialista com comissão positiva e concluir o cadastro;
- convidar especialista com comissão explícita de `0%` e concluir o cadastro;
- validar que a conta criada possui o valor esperado;
- editar a comissão pelas duas entradas administrativas;
- validar a sinalização de um registro legado nulo;
- confirmar que contrato anterior à edição não foi recalculado;
- executar builds de backend e frontend;
- limitar Jest e Vitest a no máximo dois workers.

## Critérios de aceite

1. Não é possível gerar um novo convite sem definir uma comissão válida.
2. O especialista criado pelo convite recebe exatamente a comissão assinada no
   token.
3. O especialista não consegue escolher ou sobrescrever a própria comissão.
4. Transformar um usuário em especialista exige comissão e especialidade.
5. Administradores conseguem editar a comissão posteriormente, inclusive para
   `0%`.
6. Comissão nula continua produzindo valor efetivo de `0%` nos cálculos.
7. Comissão nula exibe `Comissão não configurada`; zero persistido não exibe.
8. Salvar `0%` em um registro legado remove a flag imediatamente.
9. Contratos existentes não são alterados retroativamente.
10. Nenhuma migration ou backfill de comissão é executado.
