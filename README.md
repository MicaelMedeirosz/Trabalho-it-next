# Trabalho IT Next — Sistema de Upload, Validação, Catalogação e Análise de Estruturas de Banco de Dados

Plataforma para gestão do ciclo de vida de arquivos contendo estruturas de bancos de dados e metadados técnicos (.csv, .txt, .sql), com pipeline automatizado de 20 etapas (ETP-001 a ETP-020), motor de validação de 16 regras (RV001 a RV016), catalogação de objetos (schemas, tabelas, colunas, views, procedures, sequences, constraints, relacionamentos), fila de homologação, trilha de auditoria e relatórios consolidados.

## Stack

- **Backend:** Node.js + Express + TypeScript + Prisma
- **Frontend:** React + Vite + TypeScript + TailwindCSS
- **Banco de dados:** PostgreSQL (Supabase)
- **Storage de arquivos:** Supabase Storage
- **Autenticação:** JWT

## Estrutura

```
/apps
  /web    -> frontend React
  /api    -> backend Express
/packages
  /shared-types -> enums/DTOs compartilhados (ETP-001..020, RV001..016)
/prisma
  schema.prisma -> modelo de dados completo
```

## Setup local

### 1. Pré-requisitos
- Node.js 20+
- Conta gratuita no [Supabase](https://supabase.com)

### 2. Criar projeto no Supabase
1. Criar novo projeto em supabase.com
2. Em **Project Settings > Database**, copiar a **Connection String** (modo "URI")
3. Em **Project Settings > API**, copiar `URL` e `service_role key`
4. Em **Storage**, criar um bucket chamado `uploads` (público ou privado, tanto faz — acesso é feito via service key)

### 3. Variáveis de ambiente

```
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
```

Preencher `apps/api/.env` com os dados do Supabase:
```
DATABASE_URL="postgresql://postgres:[SENHA]@[HOST]:5432/postgres"
SUPABASE_URL="https://[PROJECT_REF].supabase.co"
SUPABASE_SERVICE_ROLE_KEY="..."
```

### 4. Instalar dependências e preparar banco

```bash
npm install
npm run prisma:generate
npm run prisma:migrate -- --name init
```

### 5. Rodar em desenvolvimento

```bash
npm run dev:api    # porta 4000
npm run dev:web    # porta 5173
```

Acessar `http://localhost:5173`, criar conta (primeiro usuário pode ser promovido a `ADMIN` manualmente no banco para acessar a tela de Homologação).

## Deploy (free tier)

- **Frontend:** Vercel (aponta para `apps/web`, variável `VITE_API_URL` = URL do backend no Render)
- **Backend:** Render (Web Service apontando para `apps/api`, build `npm install && npm run build`, start `npm start`, variáveis de ambiente iguais ao `.env`)
- **Banco/Storage:** Supabase (já usado em dev)

## Pipeline de Processamento (ETP-001 a ETP-020)

Executado de forma síncrona a cada upload, com cada etapa registrada em `processing_steps`:

| Etapas | Descrição |
|---|---|
| ETP-001 a 003 | Recebimento, validação de extensão e tamanho |
| ETP-004 a 006 | Integridade, codificação, hash SHA-256 |
| ETP-007 a 009 | Metadados iniciais, sessão de processamento, análise estrutural |
| ETP-010 a 012 | Identificação de objetos, estatísticas, SGBD de origem |
| ETP-013 a 016 | Logs, dashboard, regras de validação, fila de homologação |
| ETP-017 a 020 | Aprovação/rejeição, auditoria, liberação |

## Regras de Validação (RV001 a RV016)

Implementadas em `apps/api/src/modules/validation/validation.engine.ts`.

## Scripts úteis

```bash
npm run prisma:studio   # interface visual do banco
npm run build:api       # build de produção backend
npm run build:web       # build de produção frontend
```
