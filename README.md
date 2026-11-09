# Trabalho IT Next — Sistema de Upload, Validação, Catalogação e Análise de Estruturas de Banco de Dados

Plataforma para gestão do ciclo de vida de arquivos contendo estruturas de bancos de dados e metadados técnicos (.csv, .txt, .sql), com pipeline automatizado de 20 etapas (ETP-001 a ETP-020), motor de validação de 16 regras (RV001 a RV016), catalogação de objetos (schemas, tabelas, colunas, views, procedures, sequences, constraints, relacionamentos), fila de homologação, trilha de auditoria e relatórios consolidados.

## Stack

- **Backend:** Node.js + Express + TypeScript + Prisma
- **Frontend:** React + Vite + TypeScript + TailwindCSS
- **Banco de dados:** PostgreSQL (container Docker local)
- **Storage de arquivos:** disco local (volume Docker)
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

## Setup local (Docker)

MVP 100% local. Só precisa de [Docker](https://www.docker.com/products/docker-desktop/) e Docker Compose instalados — nada de conta em serviço externo.

Gere uma chave JWT exclusiva na primeira execução (o arquivo `.env` não entra no Git):

```bash
docker run --rm -v "${PWD}:/repo" -w /repo node:24-alpine node scripts/setup-local.cjs
docker compose up --build
```

Se já tiver Node instalado, use `npm run setup:local` no lugar do primeiro comando. O script preserva um segredo local já gerado; não compartilhe o `.env`. As portas 5173, 4000 e 5432 ficam restritas a `127.0.0.1`.

Isso sobe 3 containers:
- `db` — PostgreSQL 16, dados persistidos em volume (`db_data`)
- `api` — backend Express, roda `prisma migrate deploy` automaticamente no start, arquivos de upload gravados em volume (`uploads_data`)
- `web` — frontend React servido via nginx

Acessar `http://localhost:5173`, criar conta (primeiro usuário pode ser promovido a `ADMIN` manualmente no banco para acessar a tela de Homologação).

Pra derrubar os containers: `docker compose down` (dados continuam no volume). Pra limpar tudo, incluindo dados: `docker compose down -v`.

### Rodar em outra máquina

Clonar o repositório, gerar o `.env` pelo comando de setup acima e rodar `docker compose up --build`. Não precisa instalar Node, Postgres nem nada além do Docker — tudo sobe dentro dos containers.

### Desenvolvimento sem rebuild a cada mudança

Pra editar código com hot-reload, ao invés de usar o container `api`/`web`, pode subir só o banco via Docker e rodar o resto local:

```bash
docker compose up db
npm install
npm run prisma:generate
npm run prisma:deploy
npm run dev:api    # porta 4000
npm run dev:web    # porta 5173
```

Nesse caso, copiar `apps/api/.env.example` para `apps/api/.env`, configurar um `JWT_SECRET` aleatório de pelo menos 32 bytes e usar `DATABASE_URL="postgresql://postgres:postgres@localhost:5432/trabalho_it_next"` no `.env` (fora do Docker, o host é `localhost`, não `db`).

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


## Verificações de segurança

### Perfil

Acesse **Meu perfil** no menu ou clique no seu nome no canto superior direito.
A tela mostra nome, e-mail, data de cadastro e se a conta tem acesso de administrador.
É possível selecionar, salvar, trocar ou remover uma foto JPG/PNG/WebP de até 2 MB.
As permissões são apenas consultadas; não podem ser alteradas pelo próprio usuário.
A coluna de foto é criada automaticamente pela migração ao iniciar a API com Docker.

### Testes

```bash
npm audit
docker build --target security-test -f apps/api/Dockerfile -t trabalho-it-next-security-test .
```

Os testes usam um servidor HTTP isolado e persistência simulada; não alteram usuários nem arquivos do banco local. Veja `SECURITY_REVIEW.md` para escopo, correções e limitações antes de expor o sistema na internet.
