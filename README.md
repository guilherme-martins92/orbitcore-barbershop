# Barbearia App

Sistema de agendamento de horários para barbearias. O cliente escolhe serviço, profissional, dia e horário disponível; o dono gerencia serviços, profissionais e a agenda do dia por um backoffice protegido por login.

Projeto construído com **Next.js (App Router) + TypeScript + Prisma + PostgreSQL**, pensado como uma base multi-tenant (uma instância pode atender várias barbearias, cada uma identificada por um `slug` na URL).

## Stack

- **Next.js 16** (App Router, Server Components, Server Actions, Route Handlers)
- **TypeScript**
- **Tailwind CSS v4**
- **Prisma 7** + **PostgreSQL**
- **Auth.js (NextAuth v5)** — autenticação por e-mail/senha
- **Zod** — validação de dados de entrada nas rotas de API
- **bcryptjs** — hash de senha

## Funcionalidades

### Público (cliente)

- Página de agendamento por barbearia (`/[slug]`)
- Fluxo de 4 etapas: serviço → profissional → data/horário → dados do cliente
- Cálculo de disponibilidade considerando expediente, folgas e agendamentos já existentes
- Proteção contra agendamento duplicado em condição de corrida (transação `SERIALIZABLE` + retry automático)

### Backoffice (dono, autenticado)

- Login por e-mail/senha
- **Serviços**: criar, editar, ativar/desativar
- **Profissionais**: criar, editar, ativar/desativar, com vínculo de serviços realizados e dias/horário de trabalho
- **Agenda**: visualizar agendamentos por dia, marcar como concluído, cancelar ou registrar não comparecimento
- Todas as rotas de admin (páginas e API) são protegidas — só o dono da barbearia específica pode acessar seus próprios dados

## Estrutura do projeto

```
src/
├── app/
│   ├── (public)/[slug]/            → página pública de agendamento
│   ├── (admin)/
│   │   ├── login/                  → tela de login
│   │   ├── dashboard/              → redireciona o dono pra sua barbearia
│   │   └── [slug]/
│   │       ├── services/           → CRUD de serviços
│   │       ├── professionals/      → CRUD de profissionais
│   │       └── agenda/             → agenda do dia
│   └── api/
│       ├── auth/[...nextauth]/     → rotas internas do Auth.js
│       └── barbershops/[slug]/
│           ├── availability/       → GET: consulta horários livres
│           ├── appointments/       → GET (admin) / POST (público)
│           │   └── [appointmentId] → PATCH: atualizar status
│           ├── services/           → GET/POST
│           │   └── [serviceId]     → PATCH/DELETE (soft delete)
│           └── professionals/      → GET/POST
│               └── [professionalId] → PATCH/DELETE (soft delete)
├── components/
│   ├── booking-flow.tsx            → fluxo de agendamento do cliente
│   └── admin/                      → componentes do backoffice
├── lib/
│   ├── prisma.ts                   → instância do Prisma Client
│   ├── availability.ts             → cálculo de horários livres
│   ├── appointments.ts             → criação de agendamento com proteção contra corrida
│   └── require-owner.ts            → helpers de autorização (dono da barbearia)
├── scripts/                        → scripts de teste manual (ver abaixo)
└── types/
    └── next-auth.d.ts              → augmentação de tipos da sessão

prisma/
└── schema.prisma                   → modelagem completa do banco
```

## Modelo de dados

Multi-tenant: praticamente todo modelo carrega uma referência a `barbershopId`. Principais entidades:

- **Barbershop** — a barbearia (tenant)
- **User** — usuários da plataforma (`OWNER`, `PROFESSIONAL`, `CLIENT`, `PLATFORM_ADMIN`)
- **Professional** — profissional que atende, com login opcional
- **ProfessionalSchedule** — horário de trabalho recorrente por dia da semana
- **ProfessionalTimeOff** — folgas/bloqueios pontuais
- **Service** — serviços oferecidos (duração, preço)
- **ProfessionalService** — quais profissionais realizam quais serviços
- **Client** — clientes da barbearia
- **Appointment** — agendamentos (`PENDING`, `CONFIRMED`, `COMPLETED`, `CANCELLED`, `NO_SHOW`)

Detalhes completos em [`prisma/schema.prisma`](./prisma/schema.prisma).

## Como rodar localmente

### Pré-requisitos

- Node.js
- Docker (pra rodar o Postgres localmente)

### 1. Instalar dependências

```bash
npm install
```

### 2. Subir o banco de dados

```bash
docker compose up -d
```

### 3. Configurar variáveis de ambiente

Crie um `.env.local` na raiz com:

```
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/barbearia?schema=public"
AUTH_SECRET="gere com: npx auth secret"
```

### 4. Rodar as migrations

```bash
npx prisma migrate dev
```

### 5. Popular o banco com dados de teste

```bash
npx prisma db seed
npx tsx src/scripts/set-owner-password.ts
```

Isso cria uma barbearia de teste (`barbearia-do-ze`) e define a senha `senha123` para o e-mail `dono@barbearia.com`.

### 6. Rodar o projeto

```bash
npm run dev
```

- Agendamento (cliente): `http://localhost:3000/barbearia-do-ze`
- Login (dono): `http://localhost:3000/login`

## Scripts de teste manual

Além do seed, o projeto tem scripts pra validar a lógica central sem precisar de interface:

```bash
# Testa o cálculo de disponibilidade com um agendamento já existente
npx tsx src/scripts/test-availability.ts

# Dispara duas tentativas simultâneas de agendar o mesmo horário,
# validando a proteção contra condição de corrida
npx tsx src/scripts/test-concurrent-booking.ts
```

## Testando a API

Uma collection do Postman com os principais endpoints está disponível em
[`barbearia-api.postman_collection.json`](./barbearia-api.postman_collection.json).

## Decisões técnicas relevantes

- **Disponibilidade flexível, não em grade fixa**: o motor de disponibilidade retorna intervalos livres (não horários pré-definidos de 15 em 15 min); a UI sugere horários dentro desses intervalos, mas o backend aceita qualquer horário exato que caiba.
- **Proteção contra overbooking em duas camadas**: a UI sempre reconsulta a disponibilidade antes de confirmar, e o backend roda a criação do agendamento numa transação `SERIALIZABLE` com retry automático — mesmo sob concorrência real, no máximo um agendamento vence.
- **Soft delete**: serviços e profissionais nunca são apagados de verdade (só desativados), pra preservar a integridade de agendamentos históricos que os referenciam.
- **Autenticação sem middleware**: a checagem de sessão acontece diretamente em cada página/rota de admin (via helpers em `lib/require-owner.ts`), evitando depender da convenção de `middleware.ts`/`proxy.ts`, que mudou entre versões recentes do Next.js.

## Testes automatizados

Os testes rodam contra um banco de dados **separado** do banco de desenvolvimento, pra poder apagar/recriar dados livremente.

### 1. Criar o banco de teste

Com o Docker do Postgres já rodando:
\`\`\`bash
docker compose exec postgres psql -U postgres -c "CREATE DATABASE barbearia_test;"
\`\`\`

### 2. Configurar o ambiente de teste

\`\`\`bash
cp .env.test.example .env.test
\`\`\`

### 3. Aplicar as migrations no banco de teste (PowerShell)

\`\`\`powershell
$env:DATABASE_URL="postgresql://postgres:postgres@localhost:5432/barbearia_test?schema=public"
npx prisma migrate deploy
Remove-Item Env:DATABASE_URL
\`\`\`

### 4. Rodar os testes

\`\`\`bash
npm test
\`\`\`

## Roadmap / próximos passos

- [ ] Deploy em produção (Vercel + banco gerenciado)
- [ ] Notificações de lembrete (e-mail/WhatsApp)
- [ ] Cobrança por assinatura (Stripe), para o modelo SaaS multi-tenant
- [ ] Constraint de exclusão no Postgres (`EXCLUDE USING gist`) como reforço adicional contra overbooking, além da proteção via transação
- [ ] Horários de trabalho diferentes por dia da semana na UI do backoffice (o banco já suporta; a interface hoje aplica o mesmo horário a todos os dias marcados)
