---
sidebar_position: 3
---

# 🎨 Design

## 🗓 Informações Gerais

- **Nome do Projeto:** Plataforma de Vendas com Agendamento Integrado
- **Responsável de Design:** Davi Nascimento de Jesus
- **Data de Entrada no Design:** 06/08/2025
- **Data de Entrega Estimada para Desenvolvimento:** 11/09/2025 *(4 semanas: wireframe + identidade visual + protótipo de alta fidelidade)*
- **Link para Documento de Visão de Produto:** [Visão de Produto](./visao-produto.md)
- **Link para Figma do Projeto:** [Figma do Projeto](https://www.figma.com/design/cXBj43ekyFwcl7HWfPuuz5/High-Class-Shop?node-id=163-1013&t=ET2wlqJuut5lVjkT-1)

---

## ✅ Checklist de Entrada (antes de iniciar o design)

- [x] Documento de Visão de Produto recebido e validado  
- [x] Escopo e funcionalidades compreendidos  
- [x] Personas identificadas  
- [x] Alinhamento com PO realizado  
- [x] Capacidade da equipe verificada  
- [x] Deadline estabelecido  

---

## 📤 Checklist de Saída (antes de repassar para Desenvolvimento)

- [x] Wireframes  
- [x] Protótipo final validado pelo cliente  
- [x] Layouts organizados no Figma  
- [x] Especificações visuais claras (cores, tamanhos, espaçamentos)  
- [x] Responsividade definida  
- [x] Assets entregues (logos, imagens, ícones)  

---

## 🎯 Objetivo do Design

Criar uma experiência **sofisticada, discreta e minimalista** (preto e branco) para clientes de alto poder aquisitivo vinculados a escritórios de investimento, com **navegação lateral** clara e **agendamento integrado**. A interface deve priorizar **clareza, exclusividade e segurança**, mantendo uma **estrutura funcional comum** com **personalização visual por escritório parceiro** (com logo do escritório).

---

## 🖼 Wireframes

Fluxos a cobrir (versão cliente, especialista e admin):

1. Catálogo por categoria (Carros, Lanchas, Helicópteros) → Filtro → Detalhe do item → CTA “Agendar com especialista”  
2. Agendamento: Formulário de interesse → Calendário (slots disponíveis) → Confirmação  
3. Especialista: Dashboard de agendamentos por categoria → Detalhe do cliente → Anotações/Andamento/Documentos → Atualização de status  
4. Admin: Visão consolidada → Métricas/Conversão → Parceiros (logos/cores) → Usuários/Permissões  

**Link para protótipo:** [Figma do Projeto](https://www.figma.com/design/cXBj43ekyFwcl7HWfPuuz5/High-Class-Shop?node-id=163-1013&t=ET2wlqJuut5lVjkT-1)

---

## 🖌 Identidade Visual

### 🅰️ Tipografia

- **Fonte Primária:** Inter
- **Tamanhos padrão:**  
  - H1 / Títulos de página: 32–40px / 700  
  - H2 / Seções: 24–28px / 600  
  - H3 / Subtítulos e cards: 18–20px / 600  
  - Corpo: 16px / 400  
  - Secundário/Metadados: 12–14px / 400  

*(Observação: espaçamento arejado, altura de linha 1.4–1.6; uso de caps e tracking leve em navegação lateral.)*

---

### 🎨 Paleta de Cores

Foco em preto e branco, com cinzas de alto contraste

- **Cor Primária (UI/Texto forte):** `#0B0B0B`  
- **Cor Secundária (Superfícies):** `#F5F5F5`  
- **Cor de Fundo (Base):** `#FFFFFF`  
- **Texto Principal:** `#1A1A1A`  
- **Bordas/Divisores:** `#E6E6E6`  
- **Feedback positivo:** `#2A9D8F`  
- **Feedback negativo:** `#E76F51`  

*Acento por parceiro:* aplicar **uma** cor de acento sutil (ex.: dourado `#C8A96A` ou azul profundo `#1E3A8A`) **apenas** em logo/indicadores discretos.

---

### 🧩 Estilo de Ícones

- [ ] Filled  
- [x] Outlined  
- [ ] Duotone  
- [ ] Outro  

**Fonte dos ícones:** Plugin Iconify do Figma


---

## 🧼 Limitações e Restrições Visuais

- Evitar imagens de pessoas/“lifestyle”; priorizar **produto** (carros, lanchas, helicópteros) em **alta resolução** e fundos neutros.  
- Sem gradientes chamativos ou cores saturadas; manter **contraste** e **legibilidade**.  
- Animações sutis (fade/slide 150–250ms) — sem motion excessivo.  
- A personalização por escritório limita-se ao **logo** ; **estrutura e componentes são comuns**.  

---

## 📱 Responsividade

**O design contempla os seguintes formatos?**

- [x] Mobile *(funcional, foco em consulta/alertas)*  
- [x] Tablet *(prioritário)*  
- [x] Desktop *(prioritário, alta resolução)*  
- [ ] Outros: ____________  

**Observações:**  
- **Prioridade**: desktop e tablets de alta resolução (público e contexto de uso).  
- Mobile mantém fluxos essenciais (consulta de itens, agendar/reagendar, notificações).  

---

## 📤 Especificações para Handoff (quando finalizar)

- Grade: 12 col / 80–96rem max width (desktop); 8 col (tablet); 4 col (mobile)  
- Espaçamentos: 4/8/12/16/24/32/48/64  
- Componentes: AppShell com **Navbar lateral**, Header secundário, Cards de item, Drawer de filtros, Modal de agendamento, Tabela (admin/especialista)  
- Estados: hover, focus, disabled, loading skeleton  
- Acessibilidade: contraste AA, foco visível, áreas clicáveis ≥ 40px, textos alternativos em imagens  
- Tokens (exemplo):  
  - `--radius: 12px;` `--shadow: 0 8px 24px rgba(0,0,0,.08);`  
  - `--border: 1px solid #E6E6E6;`  

---

## 🔀 Traços de Navegação (por perfil)

**Cliente**  
Navbar: *Carros* • *Lanchas* • *Helicópteros* • *Agendar* • *Minhas interações* • *Suporte*  
Ponto-chave: CTA “Agendar com especialista” destacado no detalhe do item.  

**Especialista (por categoria)**  
Navbar: *Agenda* • *Leads / Formulários* • *Negociações* • *Documentos* • *Relatórios*  
Ponto-chave: filtro travado na categoria do especialista; histórico por cliente.  

**Administrador**  
Navbar: *Visão Geral* • *Parceiros* • *Especialistas* • *Métricas & Conversão* • *Relatórios* • *Configurações*  
Ponto-chave: visão consolidada das três categorias; personalização por parceiro.  

---


## 📌 Observações Finais

- **Experiência premium, discreta e consistente**: preto & branco, foco no produto, navegação lateral.  
- **Personalização por parceiro** sem alterar arquitetura de informação.  
- **Segurança & privacidade**: diretrizes visuais e de UX devem reforçar confiança (cópias claras, feedbacks discretos, estados de carregamento).  
- **Escalabilidade**: componentes e tokens preparados para inclusão de novos parceiros/categorias sem refazer telas.  
- **Critérios de aceite do design** alinhados aos **RF/RNF** do documento de visão, com protótipo navegável e casos de teste de fluxo de agendamento, filtros e dashboards.  

---
