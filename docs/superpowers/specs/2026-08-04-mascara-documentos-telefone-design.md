# Design: máscara de CPF/CNPJ/RG/telefone em toda a plataforma

## Contexto

No fluxo de cadastro (customer, consultor, especialista, escritório) e nas telas
de perfil/admin, os campos de documento (CPF/RG/CNPJ) e telefone são
inconsistentes: alguns aplicam pontuação ao digitar, outros pedem "apenas
números" no placeholder, outros exibem o valor salvo cru (sem pontuação). O
valor **sempre** deve ser salvo no banco sem pontuação, mas exibido ao usuário
sempre pontuado — nunca com dígitos ocultos (não é mascaramento de segurança,
é só formatação).

Além disso, com a unificação RG/CPF, o campo RG deve aceitar um CPF completo
(11 dígitos) como valor válido.

Referência de padrão usada: `locpay_full/app/frontend/lib/validation.ts`
(`maskCPF`, `maskCNPJ`, `maskPhone`/`maskPhoneLocal`, aplicados via
`onChange={(e) => onChange({ field: formatX(e.target.value) })}`, com
`stripFormatting` antes do submit).

## Estado atual (auditoria)

- `frontend/src/services/contracts.service.ts` já tem `stripFormatting`,
  `applyCpfMask`, `applyCnpjMask`, `applyCepMask` — local errado (deveria ser
  um util), sem máscara de telefone, e um `formatRg` morto (nunca importado).
- `backend/src/shared/utils/format.utils.ts` já tem o espelho pro backend
  (`formatCpf/formatCnpj/formatRg/formatCep/stripFormatting`), usado só para
  montar o envelope do DocuSign.
- Telas sem máscara nenhuma ao digitar: `RegisterOfficePage.tsx`,
  `RegisterSpecialistPage.tsx`, `RegisterConsultantPage.tsx`,
  `ProfilePage.tsx` (placeholder "Apenas números"),
  `OfficeCompanySettingsPage.tsx`, `NewCompanyForm.tsx`, `MyCompanyPage.tsx`.
- Telas com lógica duplicada (funciona, mas não usa o util compartilhado):
  `RegisterPage.tsx` (formatCPF/formatRG/formatPhone locais),
  `ConsultantClientsPage.tsx` (formatCPF local, só para exibição).
- Exibição crua (sem formatar) de valor salvo: `CompaniesPage.tsx` (cnpj na
  tabela), `ProfilePage.tsx` (prefill de cpf/rg), `CreateContractPage.tsx`
  (prefill de seller_rg/buyer_rg).
- **Bug real**: `CreateContractPage.tsx` monta o payload de
  `seller_cpf/buyer_cpf/*_cnpj` com o valor **pontuado** (sem
  `stripFormatting`) e envia para `generate-contract.dto.ts`/
  `preview-contract.dto.ts`, que não validam formato. O backend
  (`contracts.service.ts`) grava esse valor pontuado como veio, direto em
  colunas de `PlatformCompany`. A coluna `specialist_document` é
  `VARCHAR(14)` — um CNPJ pontuado tem 18 caracteres e não cabe.
- Backend limita RG a 7-10 dígitos (ou exatamente 9, em
  `create-specialist.dto.ts`) em 6 DTOs: `auth.ts` (4 classes),
  `create-consultant.dto.ts`, `create-specialist.dto.ts`,
  `update-specialist.dto.ts`, `update-user.dto.ts`. Isso rejeita um CPF de 11
  dígitos no campo RG — precisa relaxar para aceitar a unificação.
- Fora de escopo: `DatabasePage.tsx` — visualizador genérico de registros
  brutos do banco para debug administrativo, não é um fluxo de cadastro de
  usuário final. Fica como está.

## Design

### 1. Util compartilhado: `frontend/src/utils/mask.ts`

Novo módulo, único local das funções de máscara de documento/telefone:

- `stripFormatting(value)` — remove tudo que não é dígito.
- `applyCpfMask(value)` — `###.###.###-##`, como já existe hoje.
- `applyCnpjMask(value)` — `##.###.###/####-##`, como já existe hoje.
- `applyCepMask(value)` — `#####-###`, como já existe hoje.
- `applyRgMask(value)` — agrupa RG de 7-9 dígitos (`#.###.###`,
  `##.###.###`, `##.###.###-#`, mesma lógica de
  `backend/src/shared/utils/format.utils.ts#formatRg`); a partir de 10
  dígitos delega para `applyCpfMask` (cobre a unificação RG/CPF).
- `applyPhoneMask(value)` — `(##) ####-####` ou `(##) #####-####`
  dependendo do tamanho do número local (8 ou 9 dígitos), mesma lógica de
  `maskPhoneLocal` do locpay.

`contracts.service.ts` (frontend) passa a importar dessas funções em vez de
declará-las; `formatBRL` permanece onde está (fora do escopo, não é
documento). As duplicatas locais em `RegisterPage.tsx` e
`ConsultantClientsPage.tsx` são removidas em favor do import compartilhado.

### 2. Aplicar máscara ao digitar

Em todos os inputs de cpf/cnpj/rg/telefone das telas listadas acima:
`onChange` passa a aplicar a função de máscara correspondente antes de
atualizar o state/form, igual ao padrão já usado em `CreateContractPage.tsx`
para `seller_cpf`. Remove o placeholder "Apenas números" do `ProfilePage`
(deixa de fazer sentido).

`CreateContractPage.tsx`: adiciona a máscara que falta em `buyer_cpf`
(hoje só `seller_cpf` tem) e em `seller_rg`/`buyer_rg` (nunca foram
mascarados).

### 3. Aplicar formatação na exibição

Mesma função de máscara, aplicada sobre o valor já salvo (são funções puras
do dígito, servem tanto para "enquanto digita" quanto para "exibir valor
existente"): `CompaniesPage.tsx` (cnpj na tabela), prefill de
`ProfilePage.tsx` e `CreateContractPage.tsx`.

### 4. Corrigir o bug de dados pontuados indo pro banco

- `CreateContractPage.tsx`: `stripFormatting()` em todos os campos de
  documento (cpf/cnpj) antes de montar o payload de submit — mesmo padrão já
  usado no restante do arquivo para `seller_cpf`/`buyer_cpf`/`*_cep` em
  outras chamadas.
- Backend `contracts.service.ts` (`features/contracts/`): aplica
  `stripFormatting()` (de `shared/utils/format.utils.ts`) nos campos de
  documento antes de persistir em `PlatformCompany` — defesa em
  profundidade, evita o overflow de `specialist_document` independente do
  que o frontend mandar.

### 5. Backend: RG aceita CPF (unificação)

Relaxar `@Length`/`@Matches` do campo `rg` de `7,10` (ou `9,9`, no caso de
`create-specialist.dto.ts`) para `7,11` dígitos em:
`backend/src/auth/dto/auth.ts` (`UserRegisterDto`, `RegisterConsultantDto`,
`RegisterOfficeDto`, `RegisterSpecialistDto`),
`backend/src/features/consultants/dto/create-consultant.dto.ts`,
`backend/src/features/specialists/dto/create-specialist.dto.ts`,
`backend/src/features/specialists/dto/update-specialist.dto.ts`,
`backend/src/features/users/dto/update-user.dto.ts`.

`backend/src/shared/utils/format.utils.ts#formatRg`: estende para
reconhecer 11 dígitos e formatar como CPF (hoje só formata 7-9 dígitos e
devolve o valor cru para qualquer outro tamanho).

## Testes

- `frontend/src/utils/mask.ts`: teste unitário cobrindo os 5 casos de RG
  (7/8/9 dígitos, e 10-11 delegando para CPF), CPF, CNPJ, CEP, telefone
  (8 e 9 dígitos locais).
- Backend: ajustar/adicionar teste dos DTOs relaxados aceitando RG de 11
  dígitos; teste de `contracts.service.ts` confirmando que documentos
  pontuados chegando do DTO são salvos sem pontuação.

## Fora de escopo

- `DatabasePage.tsx` (viewer genérico de debug).
- Checksum de CPF quando usado como valor do campo RG (a validação de RG
  hoje não tem checksum nenhum; não adicionamos um para o caso unificado).
- `formatBRL` e demais formatadores não relacionados a documento/telefone.
