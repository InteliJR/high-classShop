# Rollout do Design System — Fatias 2-7 (checklist, não exaustivo)

> Plano leve, de propósito — não transcreve código linha a linha como o da Fatia 1. Cada item é "arquivo → o que muda", usando a **tabela canônica de tokenização** e os componentes já existentes (`Button`, `Card`, `Alert`, `Dialog`/`DialogContent`, `PageHeader`, `StatusBadge`, `EmptyState`) documentados em `docs/superpowers/specs/2026-07-21-rollout-completo-design-system.md`. Quem for implementar: abrir o arquivo, aplicar a tabela de tokenização + trocar botão/modal cru pelo componente certo, verificar com `tsc -b` + `build` + `lint` + screenshot real (Playwright mockando API, nunca o backend local nesta máquina).

## Fatia 2 — Especialista

- [ ] `ProcessesPage.tsx` — `PageHeader`; os 10 botões crus viram `Button`/ícone tokenizado conforme a tabela canônica; não tocar em `ProcessCard.tsx` (fora de escopo).
- [ ] `ProductsPage.tsx` — ícones editar/excluir (SVG à mão) → `Pencil`/`Trash2`; resolver a mistura `text-text-primary` + cinza cru, tudo pros tokens novos.
- [ ] `CreateContractPage.tsx` — **não dividir o arquivo** nesta fatia; só tokenizar (o padrão de campo repetido ~35x é uma troca de string só); 4 botões crus → `Button`.
- [ ] `ContractPreviewCallback.tsx` — só falta tokenizar ~11 classes `slate-*` ao redor dos 3 usos de `Button` já corretos (não mexer neles).
- [ ] `RequireCalendlyModal.tsx` / `RequireGoogleMeetModal.tsx` — migrar pro `Dialog`/`DialogContent`; **gradiente sai** (vira ícone + título normal, ver spec); comportamento do "Lembrar mais tarde" não muda.

## Fatia 3 — Admin

- [ ] `DashboardPage.tsx` — `PageHeader`; 6 stat cards → `Card`; gráficos recharts mantidos, só moldura vira `Card`; **adicionar** 3 atalhos rápidos (`ActionCard` tokenizado, mesmo padrão do `OfficeDashboardPage.tsx`) pra Escritórios/Especialistas/Configurações.
- [ ] `CompaniesPage.tsx` + `SpecialistsPage.tsx` — migrar as `Modal` (`ui/Modal.tsx`) existentes pro `Dialog`; `EditIcon`/`TrashIcon` → `Pencil`/`Trash2`; `alert()` de erro de exclusão fica como está.
- [ ] `CommissionsPage.tsx` — tokenizar `TabButton`; **não mexer** em `SplitBar`'s cores (paleta categórica própria, não é status); `RateRow` usa `text-status-ok`/`text-status-bad`; botões CSV/PDF → `Button variant="light"`.
- [ ] `DatabasePage.tsx` — reskin (tabs, botões, tabela); **sem cross-link** de linha pro CRUD nesta fatia (fica pra depois).
- [ ] `SettingsPage.tsx` + `MyCompanyPage.tsx` — remover o shell de página próprio do `SettingsPage` (normalizar pro padrão das outras); banners de erro/sucesso → `Alert`; toggle switch só tokeniza (não vira componente novo, só 1 consumidor).
- [ ] `Sidebar.tsx` — adicionar `{ to: "/office/consultants", label: "Consultores", icon: <Users size={20} /> }` no `case "ADMIN":` (rota já permite, sem rota nova).

## Fatia 4 — Escritório

- [ ] `OfficeConsultantsPage.tsx` — avaliar reaproveitar o `Dialog`+fluxo de convite em lote do Consultor em vez de manter a implementação duplicada; se não der por dependências diferentes, ao menos tokenizar + usar `Dialog` em vez do `window.confirm()` nativo (achado da auditoria original).
- [ ] `OfficeDashboardPage.tsx` — já usa o padrão `ActionCard`; só tokenizar cores (`bg-gray-900`→`Button`, `border-gray-100`→`border-border-soft`, etc).
- [ ] `OfficeClientsPage.tsx`, `OfficeCompanySettingsPage.tsx` — tabela canônica de tokenização; checar responsividade (grids fixos sem breakpoint apontados na auditoria original).

## Fatia 5 — Cliente

- [ ] `CatalogPage.tsx` — **implementar filtro real** (decisão confirmada — não só remover o botão); definir campos de filtro com base no que já existe no produto (marca/modelo/ano/preço); tokenizar o resto da página.
- [ ] `ProductPage.tsx` + `ConsultoriaPage.tsx` — **unificar a lógica de agendamento num hook compartilhado** (decisão confirmada) antes/junto do reskin, corrigindo o bug de agendamento órfão (popup fechado sem limpeza) no processo; `PageHeader` no lugar do botão de voltar solto.
- [ ] `CustomerProcessesPage.tsx`, `CustomerHomePage.tsx` — tabela canônica de tokenização + `StatusBadge` onde houver status de processo cru.

## Fatia 6 — Auth

- [ ] `RegisterConsultantPage.tsx`, `RegisterOfficePage.tsx`, `RegisterSpecialistPage.tsx` — tela de "convite expirado/inválido" ganha o mesmo botão que `RegisterPage.tsx` já tem (achado de beco sem saída da auditoria original — replicar a correção 3x).
- [ ] `LoginPage.tsx`, `ForgotPasswordPage.tsx`, `ResetPasswordPage.tsx` — tabela canônica de tokenização; já usam bastante classe responsiva (auditoria original não achou problema de responsividade aqui, só cor crua).

## Fatia 7 — Consolidação transversal (só depois de 2-6 completas)

- [ ] Grep por consumidores restantes de `components/ui/Modal.tsx` e `components/shared/Modal.tsx` — se zero, apagar os 2 arquivos.
- [ ] Grep por `STATUS_LABELS`/`STATUS_COLORS` locais restantes — trocar por `StatusBadge`/`PROCESS_STATUS_META`.
- [ ] Migrar `NegotiationPage.tsx` pro `ProposalStatusBadge` (criado na Fatia 1).
- [ ] Só agora avaliar se algum consumidor real justifica criar `Tabs`/`Dropdown menu` — senão, deixar pra próxima vez que surgir.

## Fora de escopo (não implementar sem alinhar antes)

- Comissão de consultor (não existe, ver `CLAUDE.md`).
- Dashboards enriquecidos (Admin/Especialista/Escritório) além do reskin simples — brainstorm próprio depois.
- Cross-link de `DatabasePage`, divisão de `CreateContractPage` em componentes menores — mencionados nas fatias acima como "fica pra depois", não implementar junto.
