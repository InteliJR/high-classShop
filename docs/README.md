# 📚 Documentação — High-class Shop

Este diretório contém a documentação do projeto usando Docusaurus.

---

## ✅ Configuração atual do projeto

Os campos principais já estão configurados em `docusaurus.config.ts` para este repositório:

- `organizationName: "InteliJR"`
- `projectName: "high-classShop"`
- `baseUrl: "/high-classShop/"`
- `url: "https://InteliJR.github.io"`

URL final de docs:

**https://intelijr.github.io/high-classShop/**

---

## 🛠️ Desenvolvimento local

```bash
cd docs
npm install
npm start
```

---

## 🚀 Build e deploy

```bash
# Build local
npm run build

# Servir build local
npm run serve

# Deploy manual no GitHub Pages
npm run deploy
```

---

## 🗂️ Estrutura do diretório

```bash
docs/
├── docs/                # Conteúdo em Markdown
├── src/                 # Componentes/páginas do Docusaurus
├── static/              # Arquivos estáticos
├── docusaurus.config.ts # Configuração principal
├── sidebars.ts          # Sidebar da documentação
└── package.json         # Scripts e dependências
```

---

## 🧩 Troubleshooting

### 1) Página sem CSS ou quebrada

Confirme que `baseUrl` e `projectName` correspondem exatamente ao repositório:

- `projectName: "high-classShop"`
- `baseUrl: "/high-classShop/"`

### 2) 404 após deploy

- Verifique se o GitHub Pages está apontando para `gh-pages`.
- Aguarde alguns minutos para propagação.
- Reexecute `npm run deploy` em caso de falha no pipeline.