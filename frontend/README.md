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

### Variáveis de ambiente

- `VITE_API_BASE_URL` (ex.: `http://localhost:3000/api`)

> Importante: use URL absoluta com protocolo (`http://` ou `https://`) para evitar montagem incorreta de rota no navegador.

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

---

## 📚 Documentação complementar

- Arquitetura do backend (módulos, endpoints, payloads e integrações): `../architecture.md`
- Guia de integração frontend com endpoints consumidos: `../frontend-integration-guide.md`
