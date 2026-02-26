# Decentralized Club (SaaS MVP)

Plataforma SaaS com:
- Area do Usuario (membro pagante)
- Area Administrativa (admin)
- Integracao por webhook com Kirvano para ativacao/bloqueio automatico de assinatura

## Stack
- Next.js 15 (App Router)
- TypeScript
- Tailwind CSS (tema escuro estilo fintech)
- Prisma (SQLite local + PostgreSQL prod)
- NextAuth (credentials)

## Funcionalidades implementadas

### 1) Integracao Kirvano
- Endpoint: `POST /api/webhooks/kirvano`
- Valida assinatura do webhook via HMAC SHA-256 (`x-kirvano-signature`)
- Processa eventos:
  - `pagamento_aprovado`
  - `assinatura_ativa`
  - `cancelamento`
  - `reembolso`
  - `falha_pagamento`
- Regras automaticas:
  - Cria usuario no pagamento aprovado
  - Ativa/atualiza plano e status
  - Bloqueia acesso em cancelamento/falha
- Idempotencia por `event_id`
- Salva no banco:
  - id de transacao
  - status da assinatura
  - data de renovacao
  - plano contratado

### 2) Area do Usuario
- Login com email/senha
- Reset de senha (MVP simplificado)
- Bloqueio de acesso por status da assinatura
- Dashboard com:
  - Precos BTC/ETH/SOL/BNB (CoinGecko)
  - Ultima atualizacao diaria
  - Ultima analise exclusiva
  - Conteudos recentes
  - Status e proxima cobranca da assinatura
- Atualizacoes diarias:
  - Lista por data
  - Busca
  - Filtro por mes
  - Artigo detalhado
- Analises exclusivas por categoria:
  - Macro, Tecnica, Narrativas, Institucional, EUA
- Videos:
  - Player embutido (YouTube/Vimeo)
  - Organizacao por modulo
  - Restricao por plano

### 3) Area Admin
- Gestao de conteudo:
  - Criar e excluir atualizacoes, analises e videos
  - Campos para agendamento de publicacao
  - Link de PDF opcional nas analises
- Gestao de usuarios:
  - Listagem de membros
  - Ver plano/status
  - Alterar plano manualmente
  - Bloquear/desbloquear acesso
  - Exportar CSV (`/api/export/members.csv`)
- Gestao de planos:
  - Criar plano
  - Ativar/desativar plano
  - Associar `kirvanoProductId`
  - Definir permissoes JSON
- Metricas:
  - Membros ativos
  - Receita mensal estimada
  - Taxa de cancelamento
  - Conteudos mais acessados

## Estrutura de banco (Prisma)
Principais modelos:
- `User`
- `Plan`
- `Subscription`
- `WebhookEvent`
- `DailyUpdate`
- `Analysis`
- `Video`
- `ContentView`

Arquivo: `prisma/schema.prisma`

## Como rodar

1. Copie as variaveis de ambiente:
```bash
cp .env.example .env
```

2. Local: use SQLite (ja vem no `.env.example`).

3. Instale dependencias:
```bash
npm install
```

4. Gere cliente Prisma + sincronize banco local:
```bash
npm run prisma:generate
npm run prisma:db:push
```

5. Rode seed:
```bash
npm run prisma:seed
```

6. Suba o projeto:
```bash
npm run dev
```

## Produção (Railway/PostgreSQL)
1. Use schema PostgreSQL:
```bash
npm run prisma:generate:prod
npm run prisma:db:push:prod
```
2. Defina `DATABASE_URL` de PostgreSQL no ambiente da Railway.

## Credenciais seed
- Admin: `admin@decentralized.club`
- Senha: `Admin@12345`

## Rotas principais
- Login: `/login`
- Reset senha: `/reset-password`
- Membro: `/app/dashboard`
- Admin: `/admin`

## Observacoes
- Conteudo foi estruturado com foco educacional (sem promessa de rentabilidade).
- Reset de senha esta simplificado para MVP; em producao use fluxo com token por email.
- Upload de arquivo esta modelado via URL; para upload fisico, integrar storage (S3/Supabase Storage).
