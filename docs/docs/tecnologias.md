# ⚙️ **TECNOLOGIAS E ARQUITETURA**

### 🗓 Informações Gerais

* **Nome do Projeto:** Plataforma Web com Frontend Estático e API em Lightsail
* **Tech Lead:** Jonathan Alves
* **Data de Entrada na Área:** 25/08/2025
* **Data Estimada de Conclusão:** 30/09/2025

### Checklist de Entrada e Saída

#### ✅ Checklist de Entrada
* [x] Documento de Visão de Produto validado

#### 📤 Checklist de Saída
* [ ] Stack definida e aprovada
* [ ] Diagrama de arquitetura completo
* [ ] Plano de implantação claro
* [ ] Documento validado com o time de Desenvolvimento

### Stack Tecnológica

#### Frontend
* **Framework:** React + Vite
* **Linguagem:** TypeScript
* **UI/Estilo:** Tailwind CSS
* **Ferramentas:** ESLint, Prettier
* **Hospedagem:** Amazon S3 (static website) + CloudFront (CDN)
* **Domínio:** Route 53 + ACM (certificado SSL)

**Justificativa:** Build estático rápido e econômico via S3; distribuição global com baixa latência via CloudFront; domínio e SSL gerenciados pela AWS.

#### Backend
* **Linguagem:** TypeScript
* **Framework:** Nest.js
* **Execução:** Amazon Lightsail (instância ou Lightsail Containers)
* **ORM:** Prisma
* **Autenticação:** JWT (Access + Refresh token)
* **Upload de Arquivos:** Amazon S3

**Justificativa:** NestJS oferece arquitetura modular, validação e DI. Lightsail simplifica custo/gestão mantendo acesso ao ecossistema AWS.

#### Banco de Dados
* **Tipo:** Relacional
* **Tecnologia:** PostgreSQL gerenciado no Amazon Lightsail

**Justificativa:** Instância gerenciada com snapshots automáticos, menor custo/complexidade que RDS para este porte.

#### Outras Tecnologias
* **Cache:** N/A (futuro: ElastiCache/Redis)
* **Monitoramento:** CloudWatch Logs + Sentry
* **Testes:** N/A (futuro)

### Arquitetura da Solução

#### Visão Geral
Aplicação SPA hospedada no S3 e servida globalmente pelo CloudFront. Usuário acessa **app.seu-dominio.com** (CloudFront), que chama a API **api.seu-dominio.com** hospedada em Lightsail. A API acessa PostgreSQL gerenciado do Lightsail em sub-rede privada.

#### Componentes Principais
* **Frontend (S3 + CloudFront):** Entrega de assets estáticos/SPA
* **API (Lightsail):** NestJS; autenticação JWT; integração com S3 e banco
* **Banco de Dados (Lightsail PostgreSQL):** Dados transacionais; snapshots automáticos
* **DNS (Route 53):** Zonas hospedadas e registros
* **Certificados (ACM):** TLS para CloudFront

#### Ambiente de Desenvolvimento
```bash
# Banco local
docker compose up -d db

# Backend
npm run start:dev

# Frontend  
npm run dev
```

### Considerações de Segurança

#### Políticas de CORS
* Permitir apenas `https://app.seu-dominio.com`
* Métodos: GET/POST/PUT/PATCH/DELETE
* Credenciais desabilitadas por padrão

#### Proteção de Dados
* **Em trânsito:** HTTPS via CloudFront/ACM; TLS 1.2+
* **Em repouso:** Criptografia S3 e banco habilitada

#### Autenticação e Autorização
* JWT com expiração curta (access token)
* Refresh token opcional
* Senhas com bcrypt
* Roles/guards no NestJS

#### Rede e Acesso
* Banco não exposto à Internet
* Security groups com portas mínimas
* 443/80 para CloudFront; 443/22 restrito para API

---

## 🗂️ **MODELAGEM DE DADOS**

### **USUÁRIOS**

#### Empresa Parceira
```sql
CREATE TABLE companies (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  cnpj VARCHAR(14) UNIQUE NOT NULL,
  logo VARCHAR(500),
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### Consultor de Investimento
```sql
CREATE TABLE consultants (
  id SERIAL PRIMARY KEY,
  company_id INTEGER REFERENCES companies(id),
  name VARCHAR(255) NOT NULL,
  identification_number VARCHAR(50) NOT NULL,
  rg VARCHAR(20) NOT NULL,
  cpf VARCHAR(11) UNIQUE NOT NULL,
  cargo VARCHAR(100),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### Cliente Final
```sql
CREATE TABLE clients (
  id SERIAL PRIMARY KEY,
  consultant_id INTEGER REFERENCES consultants(id),
  name VARCHAR(255) NOT NULL,
  rg VARCHAR(20) NOT NULL,
  cpf VARCHAR(11) UNIQUE NOT NULL,
  estado_civil VARCHAR(50),
  cep VARCHAR(8),
  endereco TEXT,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### Especialista
```sql
CREATE TABLE specialists (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  rg VARCHAR(20) NOT NULL,
  cpf VARCHAR(11) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  especialidade ENUM('carros', 'barcos', 'aeronaves') NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### Admin
```sql
CREATE TABLE admins (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### **PRODUTOS**

#### Carros
```sql
CREATE TABLE cars (
  id SERIAL PRIMARY KEY,
  specialist_id INTEGER REFERENCES specialists(id),
  marca VARCHAR(100) NOT NULL,
  modelo VARCHAR(100) NOT NULL,
  valor DECIMAL(15,2) NOT NULL,
  estado ENUM('novo', 'seminovo', 'colecao') NOT NULL,
  ano INTEGER NOT NULL,
  descricao TEXT,
  cor VARCHAR(50),
  km INTEGER,
  cambio VARCHAR(50),
  combustivel VARCHAR(50),
  tipo_categoria ENUM('SUV', 'sedan', 'coupe', 'conversivel', 'esportivo', 'supercarro'),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### Barcos
```sql
CREATE TABLE boats (
  id SERIAL PRIMARY KEY,
  specialist_id INTEGER REFERENCES specialists(id),
  marca VARCHAR(100) NOT NULL,
  modelo VARCHAR(100) NOT NULL,
  valor DECIMAL(15,2) NOT NULL,
  ano INTEGER NOT NULL,
  fabricante VARCHAR(100),
  tamanho VARCHAR(50),
  estilo VARCHAR(100),
  combustivel VARCHAR(50),
  motor VARCHAR(100),
  ano_motor INTEGER,
  descricao_completa TEXT,
  acessorios TEXT,
  estado ENUM('novo', 'seminovo', 'colecao') NOT NULL,
  tipo_embarcacao ENUM('iate', 'lancha', 'catamara', 'veleiro', 'jet_boat', 'outro'),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### Aeronaves
```sql
CREATE TABLE aircraft (
  id SERIAL PRIMARY KEY,
  specialist_id INTEGER REFERENCES specialists(id),
  categoria VARCHAR(100),
  ano INTEGER NOT NULL,
  marca VARCHAR(100) NOT NULL,
  modelo VARCHAR(100) NOT NULL,
  assentos INTEGER,
  estado ENUM('novo', 'seminovo', 'colecao') NOT NULL,
  descricao TEXT,
  valor DECIMAL(15,2) NOT NULL,
  tipo_aeronave ENUM('VLJ', 'executivo_medio', 'intercontinental', 'turbohelice', 'helicoptero'),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### Imagens dos Produtos
```sql
CREATE TABLE product_images (
  id SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL,
  product_type ENUM('car', 'boat', 'aircraft') NOT NULL,
  image_url VARCHAR(500) NOT NULL,
  is_primary BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### **PROCESSOS**

#### Processos de Negociação
```sql
CREATE TABLE processes (
  id SERIAL PRIMARY KEY,
  client_id INTEGER REFERENCES clients(id),
  specialist_id INTEGER REFERENCES specialists(id),
  product_id INTEGER NOT NULL,
  product_type ENUM('car', 'boat', 'aircraft') NOT NULL,
  status ENUM('agendamento', 'negociacao', 'documentacao', 'concluido') DEFAULT 'agendamento',
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### Documentos
```sql
CREATE TABLE documents (
  id SERIAL PRIMARY KEY,
  process_id INTEGER REFERENCES processes(id),
  file_name VARCHAR(255) NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  file_type VARCHAR(50),
  uploaded_by INTEGER NOT NULL,
  uploaded_by_type ENUM('client', 'specialist') NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
```

#### Agendamentos
```sql
CREATE TABLE appointments (
  id SERIAL PRIMARY KEY,
  client_id INTEGER REFERENCES clients(id),
  specialist_id INTEGER REFERENCES specialists(id),
  product_id INTEGER NOT NULL,
  product_type ENUM('car', 'boat', 'aircraft') NOT NULL,
  date DATE NOT NULL,
  time TIME NOT NULL,
  status ENUM('scheduled', 'completed', 'cancelled') DEFAULT 'scheduled',
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### **GUIAS DE INTERESSE**

#### Carros
```sql
CREATE TABLE car_interests (
  id SERIAL PRIMARY KEY,
  client_id INTEGER REFERENCES clients(id),
  uso_principal VARCHAR(100),
  preferencia_foco VARCHAR(100),
  faixa_valor VARCHAR(50),
  status VARCHAR(50),
  marca_preferida VARCHAR(100),
  modelo_preferido VARCHAR(100),
  perfil_veiculo VARCHAR(100),
  blindagem BOOLEAN,
  carroceria VARCHAR(100),
  fator_importante TEXT,
  recursos_indispensaveis TEXT,
  estilo_viagem VARCHAR(100),
  mensagem_imagem TEXT,
  prazo_aquisicao VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### Barcos
```sql
CREATE TABLE boat_interests (
  id SERIAL PRIMARY KEY,
  client_id INTEGER REFERENCES clients(id),
  uso_principal ENUM('lazer', 'cruzeiros', 'pesca', 'eventos', 'colecao_investimento'),
  preferencia_foco ENUM('conforto', 'performance', 'equilibrio'),
  faixa_valor ENUM('ate_500k', '500k_1M', 'acima_1M'),
  status ENUM('nova', 'seminova', 'colecao_raridade'),
  marca_preferida VARCHAR(100),
  modelo_preferido VARCHAR(100),
  tipo_embarcacao ENUM('iate', 'lancha', 'catamara', 'veleiro', 'jet_boat', 'outro'),
  tamanho_embarcacao ENUM('ate_30_pes', '30_50_pes', 'acima_50_pes'),
  motor ENUM('diesel', 'gasolina', 'eletrico_hibrido'),
  capacidade_pessoas ENUM('1_4', '5_8', 'mais_8'),
  cabine_pernoite ENUM('day_boat', '1_2_cabines', 'mais_2_cabines'),
  experiencia_navegacao ENUM('nenhuma', 'basica', 'medio_porte', 'iates_grandes'),
  operacao_embarcacao ENUM('pessoal', 'com_auxilio', 'apenas_crew_capitao'),
  marina_preferencia ENUM('possui', 'precisa_indicacao', 'nao_prioridade'),
  recursos_indispensaveis TEXT,
  prazo_aquisicao ENUM('imediato', 'curto', 'medio', 'longo'),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### Aeronaves
```sql
CREATE TABLE aircraft_interests (
  id SERIAL PRIMARY KEY,
  client_id INTEGER REFERENCES clients(id),
  uso_principal ENUM('corporativo', 'lazer', 'turismo', 'transporte_familia', 'colecao_investimento'),
  preferencia_foco ENUM('conforto_luxo', 'performance', 'equilibrio'),
  faixa_valor ENUM('ate_5M', '5_20M', 'acima_20M'),
  status ENUM('nova', 'seminova', 'colecao_raridade'),
  marca_preferida VARCHAR(100),
  modelo_preferido VARCHAR(100),
  tipo_aeronave ENUM('VLJ', 'executivo', 'intercontinental', 'turbohelice', 'helicoptero', 'outro'),
  alcance_autonomia ENUM('curta', 'media', 'longa'),
  capacidade_passageiros ENUM('ate_4', '5_8', 'mais_8'),
  experiencia_voo ENUM('nenhuma', 'aeronaves_leves', 'executivos_turbohelices', 'grandes_intercontinentais'),
  operacao_aeronave ENUM('pilotar_pessoalmente', 'com_auxilio', 'apenas_crew_piloto'),
  hangar_preferencia ENUM('possui', 'precisa_indicacao', 'nao_prioridade'),
  configuracao_cabine ENUM('executiva', 'passageiros_familia', 'outra'),
  recursos_indispensaveis TEXT,
  prazo_aquisicao ENUM('imediato', 'curto', 'medio', 'longo'),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

---

## 🔌 **API - ROTAS E ENDPOINTS**

### **PADRÕES GERAIS DA API**

#### Formato Base das Respostas
Todas as respostas da API seguem o padrão:

**Sucesso:**
```json
{
  "success": true,
  "message": "Descrição da operação",
  "data": { /* dados retornados */ },
  "meta": { /* metadados quando aplicável */ }
}
```

**Erro:**
```json
{
  "success": false,
  "error": {
    "code": 400,
    "message": "Descrição do erro",
    "details": { /* detalhes específicos do erro */ },
    "timestamp": "2024-10-08T14:30:00Z"
  }
}
```

#### Paginação
Todas as rotas que retornam listas suportam paginação:

**Query Params:**
- `page` (integer, default: 1) - Página atual
- `limit` (integer, default: 20, max: 100) - Itens por página
- `sort` (string) - Campo para ordenação
- `order` (string: 'asc'|'desc', default: 'desc') - Direção da ordenação

**Resposta Paginada:**
```json
{
  "success": true,
  "message": "Lista recuperada com sucesso",
  "data": [...],
  "meta": {
    "pagination": {
      "current_page": 1,
      "per_page": 20,
      "total": 150,
      "total_pages": 8,
      "has_next": true,
      "has_prev": false
    }
  }
}
```

### **AUTENTICAÇÃO**

#### `POST /api/auth/login`
**Descrição:** Autentica usuário no sistema  
**Acesso:** Público

**Request:**
```json
{
  "email": "user@email.com",
  "password": "senha123"
}
```

**Responses:**
- **200 - Login realizado com sucesso:**
```json
{
  "success": true,
  "message": "Login realizado com sucesso",
  "data": {
    "token": "jwt_token_here",
    "refresh_token": "refresh_token_here",
    "expires_in": 3600,
    "user": {
      "id": 1,
      "name": "Nome do Usuário",
      "email": "user@email.com",
      "user_type": "client",
      "company_id": 1,
      "created_at": "2024-10-08T14:30:00Z"
    }
  }
}
```

- **400 - Dados inválidos:**
```json
{
  "success": false,
  "error": {
    "code": 400,
    "message": "Dados inválidos",
    "details": {
      "email": ["O campo email é obrigatório"],
      "password": ["O campo senha é obrigatório"]
    }
  }
}
```

- **401 - Credenciais inválidas:**
```json
{
  "success": false,
  "error": {
    "code": 401,
    "message": "Email ou senha incorretos"
  }
}
```

- **429 - Rate limit excedido:**
```json
{
  "success": false,
  "error": {
    "code": 429,
    "message": "Muitas tentativas de login. Tente novamente em 15 minutos"
  }
}
```

#### `POST /api/auth/register/client`
**Descrição:** Registra novo cliente no sistema  
**Acesso:** Público

**Request:**
```json
{
  "name": "Nome do Cliente",
  "email": "cliente@email.com",
  "password": "senha123",
  "rg": "12.345.678-9",
  "cpf": "12345678901",
  "estado_civil": "solteiro",
  "cep": "01234567",
  "endereco": "Rua das Flores, 123",
  "consultant_id": 1
}
```

**Responses:**
- **201 - Conta criada com sucesso:**
```json
{
  "success": true,
  "message": "Conta criada com sucesso",
  "data": {
    "user": {
      "id": 1,
      "name": "Nome do Cliente",
      "email": "cliente@email.com",
      "user_type": "client",
      "created_at": "2024-10-08T14:30:00Z"
    }
  }
}
```

- **409 - Email ou CPF já cadastrados:**
```json
{
  "success": false,
  "error": {
    "code": 409,
    "message": "Email ou CPF já cadastrados no sistema"
  }
}
```

- **422 - Erro de validação:**
```json
{
  "success": false,
  "error": {
    "code": 422,
    "message": "Dados inválidos",
    "details": {
      "cpf": ["CPF inválido"],
      "password": ["Senha deve ter pelo menos 6 caracteres"]
    }
  }
}
```

#### `POST /api/auth/logout`
**Descrição:** Invalida token do usuário  
**Acesso:** Usuário autenticado

**Responses:**
- **200 - Logout realizado:**
```json
{
  "success": true,
  "message": "Logout realizado com sucesso"
}
```

- **401 - Token inválido:**
```json
{
  "success": false,
  "error": {
    "code": 401,
    "message": "Token inválido ou expirado"
  }
}
```

#### `POST /api/auth/refresh`
**Descrição:** Renova token de acesso  
**Acesso:** Usuário autenticado

**Request:**
```json
{
  "refresh_token": "refresh_token_here"
}
```

**Responses:**
- **200 - Token renovado:**
```json
{
  "success": true,
  "message": "Token renovado com sucesso",
  "data": {
    "token": "new_jwt_token",
    "expires_in": 3600
  }
}
```

- **401 - Token expirado:**
```json
{
  "success": false,
  "error": {
    "code": 401,
    "message": "Refresh token inválido ou expirado"
  }
}
```

### **PRODUTOS - CARROS**

#### `GET /api/cars`
**Descrição:** Lista todos os carros com filtros e paginação  
**Acesso:** Todos usuários logados

**Query Parameters:**
```
Filtros de Busca:
- search (string) - Busca textual em marca, modelo e descrição
- marca (string) - Nome da marca
- modelo (string) - Nome do modelo
- ano_min (integer) - Ano mínimo
- ano_max (integer) - Ano máximo
- preco_min (decimal) - Preço mínimo
- preco_max (decimal) - Preço máximo
- estado (enum: 'novo'|'seminovo'|'colecao')
- tipo_categoria (enum: 'SUV'|'sedan'|'coupe'|'conversivel'|'esportivo'|'supercarro')
- cor (string) - Cor do veículo
- km_max (integer) - Quilometragem máxima
- cambio (enum: 'manual'|'automatico'|'cvt')
- combustivel (enum: 'gasolina'|'alcool'|'flex'|'diesel'|'eletrico'|'hibrido')

Paginação e Ordenação:
- page (integer, default: 1)
- limit (integer, default: 20, max: 100)
- sort (enum: 'valor'|'ano'|'km'|'created_at', default: 'created_at')
- order (enum: 'asc'|'desc', default: 'desc')
```

**Responses:**
- **200 - Lista recuperada com sucesso:**
```json
{
  "success": true,
  "message": "Carros listados com sucesso",
  "data": [
    {
      "id": 1,
      "marca": "Ferrari",
      "modelo": "F8 Tributo",
      "valor": 2850000.00,
      "estado": "novo",
      "ano": 2024,
      "cor": "Rosso Corsa",
      "km": 0,
      "cambio": "automatico",
      "combustivel": "gasolina",
      "tipo_categoria": "esportivo",
      "descricao": "Supercarro italiano com motor V8 biturbo",
      "specialist": {
        "id": 1,
        "name": "João Silva",
        "email": "joao@specialist.com"
      },
      "images": [
        {
          "id": 1,
          "image_url": "https://bucket.s3.com/car-1-front.jpg",
          "is_primary": true
        }
      ],
      "created_at": "2024-10-08T14:30:00Z",
      "updated_at": "2024-10-08T14:30:00Z"
    }
  ],
  "meta": {
    "pagination": {
      "current_page": 1,
      "per_page": 20,
      "total": 45,
      "total_pages": 3,
      "has_next": true,
      "has_prev": false
    },
    "filters": {
      "total_without_filters": 120,
      "applied_filters": ["marca", "preco_min"]
    }
  }
}
```

- **400 - Parâmetros inválidos:**
```json
{
  "success": false,
  "error": {
    "code": 400,
    "message": "Parâmetros de consulta inválidos",
    "details": {
      "ano_min": ["Deve ser um número inteiro"],
      "preco_max": ["Deve ser maior que preco_min"]
    }
  }
}
```

#### `GET /api/cars/:id`
**Descrição:** Obtém detalhes de um carro específico  
**Acesso:** Todos usuários logados

**Responses:**
- **200 - Carro encontrado:**
```json
{
  "success": true,
  "message": "Carro encontrado",
  "data": {
    "id": 1,
    "marca": "Ferrari",
    "modelo": "F8 Tributo",
    "valor": 2850000.00,
    "estado": "novo",
    "ano": 2024,
    "descricao": "Supercarro italiano com motor V8 biturbo de 720cv",
    "cor": "Rosso Corsa",
    "km": 0,
    "cambio": "automatico",
    "combustivel": "gasolina",
    "tipo_categoria": "esportivo",
    "specialist": {
      "id": 1,
      "name": "João Silva",
      "email": "joao@specialist.com",
      "especialidade": "carros"
    },
    "images": [
      {
        "id": 1,
        "image_url": "https://bucket.s3.com/car-1-front.jpg",
        "is_primary": true
      },
      {
        "id": 2,
        "image_url": "https://bucket.s3.com/car-1-interior.jpg",
        "is_primary": false
      }
    ],
    "created_at": "2024-10-08T14:30:00Z",
    "updated_at": "2024-10-08T14:30:00Z"
  }
}
```

- **404 - Carro não encontrado:**
```json
{
  "success": false,
  "error": {
    "code": 404,
    "message": "Carro não encontrado"
  }
}
```

#### `POST /api/cars`
**Descrição:** Cria novo carro no catálogo  
**Acesso:** Especialista (carros), Admin

**Request:**
```json
{
  "marca": "Ferrari",
  "modelo": "F8 Tributo",
  "valor": 2850000.00,
  "estado": "novo",
  "ano": 2024,
  "descricao": "Supercarro italiano com motor V8 biturbo",
  "cor": "Rosso Corsa",
  "km": 0,
  "cambio": "automatico",
  "combustivel": "gasolina",
  "tipo_categoria": "esportivo"
}
```

**Responses:**
- **201 - Carro criado com sucesso:**
```json
{
  "success": true,
  "message": "Carro cadastrado com sucesso",
  "data": {
    "id": 1,
    "marca": "Ferrari",
    "modelo": "F8 Tributo",
    /* ... outros campos ... */
    "created_at": "2024-10-08T14:30:00Z"
  }
}
```

- **403 - Sem permissão:**
```json
{
  "success": false,
  "error": {
    "code": 403,
    "message": "Acesso negado. Apenas especialistas em carros podem criar carros"
  }
}
```

#### `PUT /api/cars/:id`
**Descrição:** Atualiza dados de um carro  
**Acesso:** Especialista owner, Admin

**Responses:**
- **200 - Carro atualizado:**
```json
{
  "success": true,
  "message": "Carro atualizado com sucesso",
  "data": {
    "id": 1,
    /* ... dados atualizados ... */
    "updated_at": "2024-10-08T15:00:00Z"
  }
}
```

#### `DELETE /api/cars/:id`
**Descrição:** Remove carro do catálogo  
**Acesso:** Especialista owner, Admin

**Responses:**
- **204 - Carro removido:**
```json
{
  "success": true,
  "message": "Carro removido com sucesso"
}
```

- **409 - Conflito:**
```json
{
  "success": false,
  "error": {
    "code": 409,
    "message": "Não é possível remover carro com processos ativos"
  }
}
```

### **PRODUTOS - BARCOS**

#### `GET /api/boats`
**Descrição:** Lista todos os barcos com filtros e paginação  
**Acesso:** Todos usuários logados

**Query Parameters:**
```
Filtros Específicos de Barcos:
- tipo_embarcacao (enum: 'iate'|'lancha'|'catamara'|'veleiro'|'jet_boat'|'outro')
- tamanho (enum: 'ate_30_pes'|'30_50_pes'|'acima_50_pes')
- fabricante (string)
- combustivel (enum: 'diesel'|'gasolina'|'eletrico'|'hibrido')
- motor (string)

Filtros Comuns:
- search, marca, modelo, ano_min, ano_max, preco_min, preco_max, estado
- page, limit, sort, order
```

**Responses:**
- **200 - Lista de barcos:**
```json
{
  "success": true,
  "message": "Barcos listados com sucesso",
  "data": [
    {
      "id": 1,
      "marca": "Azimut",
      "modelo": "Grande 32M",
      "valor": 8500000.00,
      "estado": "novo",
      "ano": 2024,
      "fabricante": "Azimut Yachts",
      "tamanho": "acima_50_pes",
      "estilo": "Motor Yacht",
      "combustivel": "diesel",
      "motor": "Caterpillar C32 ACERT",
      "ano_motor": 2024,
      "tipo_embarcacao": "iate",
      "descricao_completa": "Iate de luxo com acabamento em madeira italiana",
      "acessorios": "Ar condicionado, sistema de navegação GPS, som premium",
      "specialist": {
        "id": 2,
        "name": "Marina Santos",
        "especialidade": "barcos"
      },
      "images": [
        {
          "id": 3,
          "image_url": "https://bucket.s3.com/boat-1-exterior.jpg",
          "is_primary": true
        }
      ],
      "created_at": "2024-10-08T14:30:00Z"
    }
  ],
  "meta": {
    "pagination": {
      "current_page": 1,
      "per_page": 20,
      "total": 28,
      "total_pages": 2,
      "has_next": true,
      "has_prev": false
    }
  }
}
```

### **PRODUTOS - AERONAVES**

#### `GET /api/aircraft`
**Descrição:** Lista todas as aeronaves com filtros e paginação  
**Acesso:** Todos usuários logados

**Query Parameters:**
```
Filtros Específicos de Aeronaves:
- categoria (string)
- tipo_aeronave (enum: 'VLJ'|'executivo_medio'|'intercontinental'|'turbohelice'|'helicoptero')
- assentos_min (integer)
- assentos_max (integer)

Filtros Comuns:
- search, marca, modelo, ano_min, ano_max, preco_min, preco_max, estado
- page, limit, sort, order
```

**Responses:**
- **200 - Lista de aeronaves:**
```json
{
  "success": true,
  "message": "Aeronaves listadas com sucesso",
  "data": [
    {
      "id": 1,
      "categoria": "Jato Executivo",
      "ano": 2023,
      "marca": "Embraer",
      "modelo": "Phenom 300E",
      "assentos": 8,
      "estado": "seminovo",
      "descricao": "Jato executivo médio com alcance intercontinental",
      "valor": 15000000.00,
      "tipo_aeronave": "executivo_medio",
      "specialist": {
        "id": 3,
        "name": "Carlos Aviation",
        "especialidade": "aeronaves"
      },
      "images": [
        {
          "id": 5,
          "image_url": "https://bucket.s3.com/aircraft-1-exterior.jpg",
          "is_primary": true
        }
      ],
      "created_at": "2024-10-08T14:30:00Z"
    }
  ],
  "meta": {
    "pagination": {
      "current_page": 1,
      "per_page": 20,
      "total": 15,
      "total_pages": 1,
      "has_next": false,
      "has_prev": false
    }
  }
}
```

### **PROCESSOS DE NEGOCIAÇÃO**

#### `GET /api/processes`
**Descrição:** Lista processos de negociação conforme permissões do usuário  
**Acesso:** Conforme hierarquia de permissões

**Regras de Acesso:**
- **Admin:** Todos os processos
- **Especialista:** Apenas seus processos
- **Consultor:** Processos dos seus clientes
- **Cliente:** Apenas seus processos

**Query Parameters:**
```
Filtros:
- status (enum: 'agendamento'|'negociacao'|'documentacao'|'concluido')
- product_type (enum: 'car'|'boat'|'aircraft')
- client_id (integer) - apenas Admin/Consultor
- specialist_id (integer) - apenas Admin
- date_from (date: YYYY-MM-DD)
- date_to (date: YYYY-MM-DD)
- search (string) - nome do cliente ou produto

Paginação:
- page, limit, sort ('created_at'|'updated_at'|'status'), order
```

**Responses:**
- **200 - Lista de processos:**
```json
{
  "success": true,
  "message": "Processos listados com sucesso",
  "data": [
    {
      "id": 1,
      "status": "negociacao",
      "product_type": "car",
      "client": {
        "id": 1,
        "name": "João Cliente",
        "email": "joao@email.com"
      },
      "specialist": {
        "id": 1,
        "name": "Maria Especialista",
        "especialidade": "carros"
      },
      "product": {
        "id": 1,
        "marca": "Ferrari",
        "modelo": "F8 Tributo",
        "valor": 2850000.00
      },
      "notes": "Cliente demonstrou interesse em test drive",
      "documents_count": 3,
      "last_activity": "2024-10-08T10:30:00Z",
      "created_at": "2024-10-05T14:30:00Z",
      "updated_at": "2024-10-08T10:30:00Z"
    }
  ],
  "meta": {
    "pagination": {
      "current_page": 1,
      "per_page": 20,
      "total": 12,
      "total_pages": 1,
      "has_next": false,
      "has_prev": false
    },
    "summary": {
      "by_status": {
        "agendamento": 2,
        "negociacao": 5,
        "documentacao": 3,
        "concluido": 2
      }
    }
  }
}
```

- **403 - Sem permissão:**
```json
{
  "success": false,
  "error": {
    "code": 403,
    "message": "Acesso negado. Você não tem permissão para visualizar estes processos"
  }
}
```

#### `POST /api/processes`
**Descrição:** Cria novo processo de negociação  
**Acesso:** Consultor (seus clientes), Admin

**Request:**
```json
{
  "client_id": 1,
  "product_id": 1,
  "product_type": "car",
  "specialist_id": 1,
  "notes": "Cliente interessado em test drive"
}
```

**Responses:**
- **201 - Processo criado:**
```json
{
  "success": true,
  "message": "Processo criado com sucesso",
  "data": {
    "id": 1,
    "status": "agendamento",
    "product_type": "car",
    "client": {
      "id": 1,
      "name": "João Cliente"
    },
    "specialist": {
      "id": 1,
      "name": "Maria Especialista"
    },
    "product": {
      "id": 1,
      "marca": "Ferrari",
      "modelo": "F8 Tributo"
    },
    "notes": "Cliente interessado em test drive",
    "created_at": "2024-10-08T14:30:00Z"
  }
}
```

- **404 - Recurso não encontrado:**
```json
{
  "success": false,
  "error": {
    "code": 404,
    "message": "Cliente, produto ou especialista não encontrado"
  }
}
```

- **409 - Processo já existe:**
```json
{
  "success": false,
  "error": {
    "code": 409,
    "message": "Já existe um processo ativo para este cliente e produto"
  }
}
```

#### `PUT /api/processes/:id/status`
**Descrição:** Atualiza status do processo  
**Acesso:** Especialista owner, Admin

**Request:**
```json
{
  "status": "documentacao",
  "notes": "Documentos enviados para análise"
}
```

**Responses:**
- **200 - Status atualizado:**
```json
{
  "success": true,
  "message": "Status do processo atualizado com sucesso",
  "data": {
    "id": 1,
    "status": "documentacao",
    "notes": "Documentos enviados para análise",
    "updated_at": "2024-10-08T15:00:00Z",
    "status_history": [
      {
        "status": "agendamento",
        "changed_at": "2024-10-05T14:30:00Z"
      },
      {
        "status": "negociacao", 
        "changed_at": "2024-10-07T10:00:00Z"
      },
      {
        "status": "documentacao",
        "changed_at": "2024-10-08T15:00:00Z"
      }
    ]
  }
}
```

### **AGENDAMENTOS**

#### `GET /api/appointments`
**Descrição:** Lista agendamentos conforme permissões do usuário  
**Acesso:** Conforme hierarquia de permissões

**Query Parameters:**
```
Filtros:
- status (enum: 'scheduled'|'completed'|'cancelled')
- date_from (date: YYYY-MM-DD)
- date_to (date: YYYY-MM-DD)
- client_id (integer) - conforme permissão
- specialist_id (integer) - conforme permissão
- product_type (enum: 'car'|'boat'|'aircraft')

Paginação:
- page, limit, sort ('date'|'time'|'created_at'), order
```

**Responses:**
- **200 - Lista de agendamentos:**
```json
{
  "success": true,
  "message": "Agendamentos listados com sucesso",
  "data": [
    {
      "id": 1,
      "date": "2024-10-10",
      "time": "14:00:00",
      "status": "scheduled",
      "notes": "Test drive do Ferrari F8",
      "client": {
        "id": 1,
        "name": "João Cliente",
        "email": "joao@email.com"
      },
      "specialist": {
        "id": 1,
        "name": "Maria Especialista",
        "especialidade": "carros"
      },
      "product": {
        "id": 1,
        "product_type": "car",
        "marca": "Ferrari",
        "modelo": "F8 Tributo",
        "valor": 2850000.00
      },
      "created_at": "2024-10-08T14:30:00Z",
      "updated_at": "2024-10-08T14:30:00Z"
    }
  ],
  "meta": {
    "pagination": {
      "current_page": 1,
      "per_page": 20,
      "total": 8,
      "total_pages": 1,
      "has_next": false,
      "has_prev": false
    },
    "summary": {
      "upcoming": 5,
      "completed": 2,
      "cancelled": 1
    }
  }
}
```

#### `POST /api/appointments`
**Descrição:** Cria novo agendamento  
**Acesso:** Cliente, Consultor, Especialista

**Request:**
```json
{
  "client_id": 1,
  "specialist_id": 1,
  "product_id": 1,
  "product_type": "car",
  "date": "2024-10-10",
  "time": "14:00",
  "notes": "Test drive do Ferrari F8"
}
```

**Responses:**
- **201 - Agendamento criado:**
```json
{
  "success": true,
  "message": "Agendamento criado com sucesso",
  "data": {
    "id": 1,
    "date": "2024-10-10",
    "time": "14:00:00",
    "status": "scheduled",
    "notes": "Test drive do Ferrari F8",
    "client": {
      "id": 1,
      "name": "João Cliente"
    },
    "specialist": {
      "id": 1,
      "name": "Maria Especialista"
    },
    "product": {
      "id": 1,
      "marca": "Ferrari",
      "modelo": "F8 Tributo"
    },
    "created_at": "2024-10-08T14:30:00Z"
  }
}
```

- **409 - Conflito de horário:**
```json
{
  "success": false,
  "error": {
    "code": 409,
    "message": "Especialista já possui agendamento neste horário",
    "details": {
      "conflicting_appointment": {
        "id": 2,
        "date": "2024-10-10",
        "time": "14:00:00",
        "client": "Outro Cliente"
      },
      "suggested_times": [
        "15:00:00",
        "16:00:00",
        "17:00:00"
      ]
    }
  }
}
```

- **422 - Erro de validação:**
```json
{
  "success": false,
  "error": {
    "code": 422,
    "message": "Dados inválidos",
    "details": {
      "date": ["Data deve ser futura"],
      "time": ["Horário deve estar entre 08:00 e 18:00"]
    }
  }
}
```

#### `PUT /api/appointments/:id/status`
**Descrição:** Atualiza status do agendamento  
**Acesso:** Participantes do agendamento, Admin

**Request:**
```json
{
  "status": "completed",
  "notes": "Test drive realizado com sucesso"
}
```

**Responses:**
- **200 - Status atualizado:**
```json
{
  "success": true,
  "message": "Agendamento atualizado com sucesso",
  "data": {
    "id": 1,
    "status": "completed",
    "notes": "Test drive realizado com sucesso",
    "completed_at": "2024-10-10T15:30:00Z",
    "updated_at": "2024-10-10T15:30:00Z"
  }
}
```

### **GUIAS DE INTERESSE**

#### `GET /api/interests/car`
**Descrição:** Lista guias de interesse em carros  
**Acesso:** Cliente (próprio), Consultor (seus clientes), Admin

**Query Parameters:**
```
Filtros:
- client_id (integer) - obrigatório para Consultor/Admin
- faixa_valor (string)
- marca_preferida (string)
- prazo_aquisicao (string)
- uso_principal (string)

Paginação: page, limit, sort, order
```

**Responses:**
- **200 - Lista de interesses:**
```json
{
  "success": true,
  "message": "Guias de interesse listados com sucesso",
  "data": [
    {
      "id": 1,
      "client": {
        "id": 1,
        "name": "João Cliente"
      },
      "uso_principal": "lazer",
      "preferencia_foco": "conforto",
      "faixa_valor": "1M_5M",
      "status": "novo",
      "marca_preferida": "Ferrari",
      "modelo_preferido": "F8 Tributo",
      "perfil_veiculo": "esportivo",
      "blindagem": false,
      "carroceria": "coupe",
      "fator_importante": "Performance e design",
      "recursos_indispensaveis": "Ar condicionado, som premium",
      "estilo_viagem": "urbano",
      "mensagem_imagem": "Procuro um supercarro para uso no fim de semana",
      "prazo_aquisicao": "curto",
      "created_at": "2024-10-08T14:30:00Z",
      "updated_at": "2024-10-08T14:30:00Z"
    }
  ],
  "meta": {
    "pagination": {
      "current_page": 1,
      "per_page": 20,
      "total": 5,
      "total_pages": 1,
      "has_next": false,
      "has_prev": false
    }
  }
}
```

#### `POST /api/interests/car`
**Descrição:** Cria novo guia de interesse em carros  
**Acesso:** Cliente (próprio), Consultor (seus clientes)

**Request:**
```json
{
  "client_id": 1,
  "uso_principal": "lazer",
  "preferencia_foco": "conforto",
  "faixa_valor": "1M_5M",
  "status": "novo",
  "marca_preferida": "Ferrari",
  "modelo_preferido": "F8 Tributo",
  "perfil_veiculo": "esportivo",
  "blindagem": false,
  "carroceria": "coupe",
  "fator_importante": "Performance e design",
  "recursos_indispensaveis": "Ar condicionado, som premium",
  "estilo_viagem": "urbano",
  "mensagem_imagem": "Procuro um supercarro para uso no fim de semana",
  "prazo_aquisicao": "curto"
}
```

**Responses:**
- **201 - Interesse criado:**
```json
{
  "success": true,
  "message": "Guia de interesse criado com sucesso",
  "data": {
    "id": 1,
    /* ... dados do interesse ... */
    "created_at": "2024-10-08T14:30:00Z"
  }
}
```

- **409 - Interesse já existe:**
```json
{
  "success": false,
  "error": {
    "code": 409,
    "message": "Cliente já possui um guia de interesse ativo para carros"
  }
}
```

#### `GET /api/interests/boat`
**Descrição:** Lista guias de interesse em barcos  
**Estrutura similar ao endpoint de carros, com campos específicos de barcos**

#### `POST /api/interests/boat`
**Request com campos específicos de barcos:**
```json
{
  "client_id": 1,
  "uso_principal": "lazer",
  "preferencia_foco": "conforto",
  "faixa_valor": "500k_1M",
  "status": "nova",
  "marca_preferida": "Azimut",
  "tipo_embarcacao": "iate",
  "tamanho_embarcacao": "30_50_pes",
  "motor": "diesel",
  "capacidade_pessoas": "5_8",
  "cabine_pernoite": "1_2_cabines",
  "experiencia_navegacao": "medio_porte",
  "operacao_embarcacao": "com_auxilio",
  "marina_preferencia": "precisa_indicacao",
  "recursos_indispensaveis": "GPS, ar condicionado",
  "prazo_aquisicao": "medio"
}
```

#### `GET /api/interests/aircraft`
**Descrição:** Lista guias de interesse em aeronaves  
**Estrutura similar aos demais endpoints**

#### `POST /api/interests/aircraft`
**Request com campos específicos de aeronaves:**
```json
{
  "client_id": 1,
  "uso_principal": "corporativo",
  "preferencia_foco": "performance",
  "faixa_valor": "5_20M",
  "status": "seminova",
  "marca_preferida": "Embraer",
  "tipo_aeronave": "executivo",
  "alcance_autonomia": "media",
  "capacidade_passageiros": "5_8",
  "experiencia_voo": "executivos_turbohelices",
  "operacao_aeronave": "apenas_crew_piloto",
  "hangar_preferencia": "precisa_indicacao",
  "configuracao_cabine": "executiva",
  "recursos_indispensaveis": "Internet, entretenimento",
  "prazo_aquisicao": "medio"
}
```

### **DOCUMENTOS**

#### `GET /api/processes/:id/documents`
**Descrição:** Lista documentos de um processo específico  
**Acesso:** Participantes do processo, Admin

**Query Parameters:**
```
Filtros:
- file_type (string) - Tipo do arquivo (pdf, jpg, png, etc.)
- uploaded_by_type (enum: 'client'|'specialist')

Paginação: page, limit, sort ('created_at'|'file_name'), order
```

**Responses:**
- **200 - Lista de documentos:**
```json
{
  "success": true,
  "message": "Documentos listados com sucesso",
  "data": [
    {
      "id": 1,
      "file_name": "contrato_compra_venda.pdf",
      "file_type": "pdf",
      "file_size": 1024000,
      "uploaded_by": {
        "id": 1,
        "name": "João Cliente",
        "type": "client"
      },
      "process": {
        "id": 1,
        "status": "documentacao"
      },
      "created_at": "2024-10-08T14:30:00Z"
    }
  ],
  "meta": {
    "pagination": {
      "current_page": 1,
      "per_page": 20,
      "total": 3,
      "total_pages": 1,
      "has_next": false,
      "has_prev": false
    },
    "summary": {
      "total_size": 3072000,
      "by_type": {
        "pdf": 2,
        "jpg": 1
      }
    }
  }
}
```

#### `POST /api/documents`
**Descrição:** Faz upload de documento para um processo  
**Acesso:** Cliente (próprios processos), Especialista (seus processos)  
**Content-Type:** multipart/form-data

**Request:**
```
FormData:
- file: [arquivo]
- process_id: 1
- description: "Contrato assinado"
```

**Responses:**
- **201 - Documento enviado:**
```json
{
  "success": true,
  "message": "Documento enviado com sucesso",
  "data": {
    "id": 1,
    "file_name": "contrato_compra_venda.pdf",
    "file_path": "documents/process_1/contrato_compra_venda.pdf",
    "file_type": "pdf",
    "file_size": 1024000,
    "description": "Contrato assinado",
    "process_id": 1,
    "uploaded_by": {
      "id": 1,
      "name": "João Cliente",
      "type": "client"
    },
    "created_at": "2024-10-08T14:30:00Z"
  }
}
```

- **413 - Arquivo muito grande:**
```json
{
  "success": false,
  "error": {
    "code": 413,
    "message": "Arquivo muito grande. Tamanho máximo: 10MB"
  }
}
```

- **415 - Tipo não suportado:**
```json
{
  "success": false,
  "error": {
    "code": 415,
    "message": "Tipo de arquivo não suportado",
    "details": {
      "supported_types": ["pdf", "doc", "docx", "jpg", "png", "gif"]
    }
  }
}
```

#### `GET /api/documents/:id/download`
**Descrição:** Baixa arquivo do documento  
**Acesso:** Participantes do processo, Admin

**Responses:**
- **200 - Arquivo baixado:**
```
Content-Type: application/octet-stream
Content-Disposition: attachment; filename="contrato_compra_venda.pdf"
[binary content]
```

- **404 - Documento não encontrado:**
```json
{
  "success": false,
  "error": {
    "code": 404,
    "message": "Documento não encontrado"
  }
}
```

#### `DELETE /api/documents/:id`
**Descrição:** Remove documento do sistema  
**Acesso:** Usuário que fez upload, Admin

**Responses:**
- **204 - Documento removido:**
```json
{
  "success": true,
  "message": "Documento removido com sucesso"
}
```

- **403 - Sem permissão:**
```json
{
  "success": false,
  "error": {
    "code": 403,
    "message": "Apenas o autor do documento pode removê-lo"
  }
}
```

### **DASHBOARD E ESTATÍSTICAS**

#### `GET /api/dashboard/stats`
**Descrição:** Obtém estatísticas do dashboard conforme tipo de usuário  
**Acesso:** Usuário logado

**Responses por tipo de usuário:**

**Cliente:**
```json
{
  "success": true,
  "message": "Estatísticas do dashboard",
  "data": {
    "active_processes": 2,
    "completed_processes": 1,
    "upcoming_appointments": 1,
    "interests_created": 3,
    "favorite_products": 5,
    "recent_activities": [
      {
        "type": "process_update",
        "message": "Processo #123 atualizado para 'documentacao'",
        "date": "2024-10-08T10:30:00Z"
      },
      {
        "type": "appointment_scheduled",
        "message": "Agendamento marcado para 10/10/2024",
        "date": "2024-10-07T15:00:00Z"
      }
    ],
    "process_timeline": [
      {
        "month": "2024-08",
        "started": 1,
        "completed": 0
      },
      {
        "month": "2024-09", 
        "started": 1,
        "completed": 1
      }
    ]
  }
}
```

**Consultor:**
```json
{
  "success": true,
  "message": "Estatísticas do dashboard",
  "data": {
    "total_clients": 15,
    "active_processes": 8,
    "completed_processes": 12,
    "conversion_rate": 69,
    "monthly_revenue": 1250000.00,
    "upcoming_appointments": 4,
    "client_satisfaction": 4.8,
    "monthly_processes": [
      { "month": "2024-07", "started": 3, "completed": 5 },
      { "month": "2024-08", "started": 5, "completed": 2 },
      { "month": "2024-09", "started": 2, "completed": 8 },
      { "month": "2024-10", "started": 8, "completed": 1 }
    ],
    "top_products": [
      {
        "product_type": "car",
        "marca": "Ferrari",
        "interest_count": 12
      },
      {
        "product_type": "boat", 
        "marca": "Azimut",
        "interest_count": 8
      }
    ]
  }
}
```

**Especialista:**
```json
{
  "success": true,
  "message": "Estatísticas do dashboard", 
  "data": {
    "active_processes": 12,
    "products_listed": 45,
    "completed_sales": 8,
    "pending_documentation": 3,
    "upcoming_appointments": 6,
    "average_sale_time": 45,
    "total_revenue": 28500000.00,
    "monthly_sales": [
      { "month": "2024-07", "count": 2, "value": 5700000.00 },
      { "month": "2024-08", "count": 4, "value": 11400000.00 },
      { "month": "2024-09", "count": 1, "value": 2850000.00 },
      { "month": "2024-10", "count": 5, "value": 14250000.00 }
    ],
    "product_performance": [
      {
        "product_id": 1,
        "marca": "Ferrari",
        "modelo": "F8 Tributo",
        "views": 156,
        "interests": 12,
        "appointments": 5
      }
    ]
  }
}
```

**Admin:**
```json
{
  "success": true,
  "message": "Estatísticas do dashboard",
  "data": {
    "total_users": 150,
    "total_products": 89,
    "active_processes": 45,
    "total_revenue": 89500000.00,
    "monthly_revenue": [
      { "month": "2024-07", "value": 15000000.00 },
      { "month": "2024-08", "value": 28000000.00 },
      { "month": "2024-09", "value": 19000000.00 },
      { "month": "2024-10", "value": 35000000.00 }
    ],
    "conversion_rates": {
      "carros": 68,
      "barcos": 72,
      "aeronaves": 59
    },
    "user_activity": {
      "daily_active": 45,
      "weekly_active": 89,
      "monthly_active": 134
    },
    "popular_categories": [
      { "category": "carros", "count": 45, "percentage": 50.6 },
      { "category": "barcos", "count": 28, "percentage": 31.5 },
      { "category": "aeronaves", "count": 16, "percentage": 17.9 }
    ],
    "system_health": {
      "uptime": 99.9,
      "response_time": 245,
      "error_rate": 0.1
    }
  }
}
```

### **ESTOQUE E INVENTÁRIO**

#### `GET /api/inventory`
**Descrição:** Lista produtos do inventário com status de disponibilidade  
**Acesso:** Especialista (seus produtos), Admin

**Query Parameters:**
```
Filtros:
- status (enum: 'disponivel'|'reservado'|'vendido')
- product_type (enum: 'car'|'boat'|'aircraft')
- specialist_id (integer) - apenas Admin
- date_from (date) - Data de cadastro
- date_to (date) - Data de cadastro

Paginação: page, limit, sort ('created_at'|'valor'|'status'), order
```

**Responses:**
- **200 - Lista do inventário:**
```json
{
  "success": true,
  "message": "Inventário listado com sucesso",
  "data": [
    {
      "id": 1,
      "product_type": "car",
      "marca": "Ferrari",
      "modelo": "F8 Tributo",
      "valor": 2850000.00,
      "status": "disponivel",
      "days_in_inventory": 45,
      "interest_count": 12,
      "appointment_count": 5,
      "process_count": 2,
      "specialist": {
        "id": 1,
        "name": "Maria Especialista"
      },
      "last_activity": "2024-10-07T16:30:00Z",
      "created_at": "2024-08-24T14:30:00Z"
    }
  ],
  "meta": {
    "pagination": {
      "current_page": 1,
      "per_page": 20,
      "total": 45,
      "total_pages": 3,
      "has_next": true,
      "has_prev": false
    },
    "summary": {
      "by_status": {
        "disponivel": 35,
        "reservado": 7,
        "vendido": 3
      },
      "total_value": 128750000.00,
      "average_days_in_inventory": 67
    }
  }
}
```

#### `PUT /api/products/:id/status`
**Descrição:** Atualiza status de disponibilidade do produto  
**Acesso:** Especialista owner, Admin

**Request:**
```json
{
  "status": "reservado",
  "notes": "Produto reservado para cliente João"
}
```

**Responses:**
- **200 - Status atualizado:**
```json
{
  "success": true,
  "message": "Status do produto atualizado com sucesso",
  "data": {
    "id": 1,
    "status": "reservado",
    "notes": "Produto reservado para cliente João",
    "updated_at": "2024-10-08T15:30:00Z",
    "status_history": [
      {
        "status": "disponivel",
        "changed_at": "2024-08-24T14:30:00Z"
      },
      {
        "status": "reservado",
        "changed_at": "2024-10-08T15:30:00Z",
        "notes": "Produto reservado para cliente João"
      }
    ]
  }
}
```

---

## 🔐 **REGRAS DE ACESSO**

### Hierarquia de Permissões
1. **Admin:** Acesso total ao sistema
2. **Especialista:** Apenas produtos/processos da sua especialidade
3. **Consultor:** Apenas seus clientes e processos relacionados
4. **Cliente:** Apenas seus próprios dados e processos
5. **Empresa:** Apenas dados dos seus consultores

### Controle de Acesso por Recurso

#### Produtos
- **Visualizar:** Todos usuários logados
- **Criar/Editar:** Especialista da área + Admin
- **Excluir:** Especialista owner + Admin

#### Processos
- **Visualizar:** Participantes do processo + Admin
- **Criar:** Consultor (seus clientes) + Admin
- **Atualizar status:** Especialista owner + Admin

#### Documentos
- **Upload:** Cliente/Especialista do processo
- **Download:** Participantes do processo + Admin
- **Excluir:** Usuário que fez upload + Admin

#### Agendamentos
- **Criar:** Cliente, Consultor, Especialista
- **Visualizar:** Participantes do agendamento + Admin
- **Cancelar:** Participantes + Admin

---

## 📊 **CÓDIGOS DE STATUS HTTP**

### **Autenticação e Autorização**
- `401` - Token não fornecido ou inválido
- `403` - Token válido mas sem permissão para o recurso
- `429` - Rate limit excedido

### **Validação e Dados**
- `400` - Requisição malformada ou parâmetros inválidos
- `404` - Recurso não encontrado
- `409` - Conflito (duplicação, regra de negócio violada)
- `422` - Erro de validação dos dados

### **Sucesso**
- `200` - Requisição bem-sucedida
- `201` - Recurso criado com sucesso
- `204` - Recurso removido (sem conteúdo)

### **Servidor**
- `500` - Erro interno do servidor
- `503` - Serviço temporariamente indisponível

### **Upload de Arquivos**
- `413` - Arquivo muito grande
- `415` - Tipo de arquivo não suportado

### **Formato de Resposta de Erro**
```json
{
  "error": {
    "code": 422,
    "message": "Dados de validação inválidos",
    "details": {
      "email": ["O campo email é obrigatório"],
      "cpf": ["CPF já cadastrado no sistema"]
    }
  }
}
```

