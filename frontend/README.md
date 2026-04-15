# 🎨 Frontend — High-class Shop

Aplicação web em React responsável pela experiência de clientes, especialistas e administradores no fluxo de produtos, processos, agendamentos e reuniões.

---

## 🚀 Stack

- React 19
- TypeScript
- Vite
- Tailwind CSS
- React Router
- Axios
- Zustand

---

## 🛠️ Setup local

```bash
cd frontend
npm install
npm run dev
```

Aplicação local: `http://localhost:5173`

> Garanta que o backend esteja rodando em `http://localhost:3000` com prefixo `/api`.

---

## 📦 Scripts

```bash
# Desenvolvimento
npm run dev

# Build de produção
npm run build

# Preview do build
npm run preview

# Lint
npm run lint
```

---

## 🗂️ Estrutura resumida

```bash
frontend/src/
├── components/   # Componentes reutilizáveis
├── pages/        # Páginas da aplicação
├── routes/       # Definição de rotas
├── services/     # Cliente HTTP e integrações
├── store/        # Estado global (Zustand)
├── hooks/        # Hooks customizados
└── types/        # Tipagens compartilhadas
```

---

## 🔐 Observações de integração

- O frontend consome endpoints autenticados com cookies/tokens conforme fluxo do backend.
- Fluxos críticos (agendamento/reunião) dependem de sincronização com a API para refletir estados corretos do processo.
