-- =============================================================================
-- Rosi Coiffeur — Supabase Schema
-- Execute este arquivo no SQL Editor do seu projeto Supabase.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- EXTENSÕES
-- ---------------------------------------------------------------------------
create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- ENUMS
-- ---------------------------------------------------------------------------
do $$ begin
  create type client_status       as enum ('VIP', 'Confirmado', 'Novo', 'Aguardando');
exception when duplicate_object then null; end $$;

do $$ begin
  create type appointment_status  as enum ('Confirmado', 'VIP', 'Aguardando', 'Cancelado');
exception when duplicate_object then null; end $$;

do $$ begin
  create type transaction_type    as enum ('income', 'expense');
exception when duplicate_object then null; end $$;

do $$ begin
  create type supplier_category   as enum ('Coloração', 'Cuidados', 'Equipamentos', 'Outros');
exception when duplicate_object then null; end $$;

do $$ begin
  create type svc_category_status as enum ('active', 'inactive');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- TABELAS
-- ---------------------------------------------------------------------------

-- ── Clientes ────────────────────────────────────────────────────────────────
create table if not exists clients (
  id           uuid              primary key default gen_random_uuid(),
  name         text              not null,
  email        text,
  phone        text,
  status       client_status     not null default 'Novo',
  avatar_url   text,
  member_since date              not null default current_date,
  notes        text,
  created_at   timestamptz       not null default now()
);

-- ── Categorias de serviço ────────────────────────────────────────────────────
create table if not exists service_categories (
  id           uuid              primary key default gen_random_uuid(),
  name         text              not null,
  description  text,
  duration_min integer           check (duration_min > 0),
  price        numeric(10,2)     check (price >= 0),
  status       svc_category_status not null default 'active',
  created_at   timestamptz       not null default now()
);

-- ── Agendamentos ─────────────────────────────────────────────────────────────
create table if not exists appointments (
  id           uuid              primary key default gen_random_uuid(),
  client_id    uuid              not null references clients(id) on delete cascade,
  service      text              not null,
  date         date              not null,
  time_start   time              not null,
  time_end     time              not null,
  status       appointment_status not null default 'Aguardando',
  professional text,
  price        numeric,
  created_at   timestamptz       not null default now(),
  constraint chk_time check (time_end > time_start)
);

-- ── Transações financeiras ────────────────────────────────────────────────────
create table if not exists transactions (
  id           uuid              primary key default gen_random_uuid(),
  type         transaction_type  not null,
  title        text              not null,
  subtitle     text,
  amount       numeric(10,2)     not null check (amount > 0),
  category     text,
  occurred_at  timestamptz       not null default now(),
  created_at   timestamptz       not null default now()
);

-- ── Fornecedores ──────────────────────────────────────────────────────────────
create table if not exists suppliers (
  id           uuid              primary key default gen_random_uuid(),
  company_name text              not null,
  cnpj         text,
  category     supplier_category not null default 'Outros',
  email        text,
  phone        text,
  created_at   timestamptz       not null default now()
);

-- ── Histórico de serviços por cliente ─────────────────────────────────────────
create table if not exists service_history (
  id           uuid              primary key default gen_random_uuid(),
  client_id    uuid              not null references clients(id) on delete cascade,
  title        text              not null,
  professional text,
  amount       numeric(10,2)     not null check (amount >= 0),
  date         date              not null default current_date,
  status       text              not null default 'Concluído',
  created_at   timestamptz       not null default now()
);

-- ---------------------------------------------------------------------------
-- ÍNDICES
-- ---------------------------------------------------------------------------
create index if not exists idx_appointments_date       on appointments(date);
create index if not exists idx_appointments_client_id  on appointments(client_id);
create index if not exists idx_transactions_occurred   on transactions(occurred_at);
create index if not exists idx_service_history_client  on service_history(client_id);
create index if not exists idx_clients_name            on clients(name);

-- ---------------------------------------------------------------------------
-- ROW LEVEL SECURITY
-- Política aberta para usuários autenticados (ajuste conforme sua auth strategy)
-- ---------------------------------------------------------------------------
alter table clients            enable row level security;
alter table service_categories enable row level security;
alter table appointments       enable row level security;
alter table transactions       enable row level security;
alter table suppliers          enable row level security;
alter table service_history    enable row level security;

-- Permite tudo para usuários autenticados
create policy "auth: all on clients"            on clients            for all using (auth.role() = 'authenticated');
create policy "auth: all on service_categories" on service_categories for all using (auth.role() = 'authenticated');
create policy "auth: all on appointments"       on appointments       for all using (auth.role() = 'authenticated');
create policy "auth: all on transactions"       on transactions       for all using (auth.role() = 'authenticated');
create policy "auth: all on suppliers"          on suppliers          for all using (auth.role() = 'authenticated');
create policy "auth: all on service_history"    on service_history    for all using (auth.role() = 'authenticated');

-- ---------------------------------------------------------------------------
-- DADOS INICIAIS (seed)
-- ---------------------------------------------------------------------------

-- Categorias de serviço
insert into service_categories (name, description, duration_min, price, status) values
  ('Corte Feminino',        'Corte com acabamento e secagem',               60,  120.00, 'active'),
  ('Corte Masculino',       'Corte masculino com finalização',              30,   60.00, 'active'),
  ('Coloração',             'Coloração completa com tinta profissional',   120,  250.00, 'active'),
  ('Balayage / Mechas',     'Técnica de iluminação manual',                150,  380.00, 'active'),
  ('Escova Progressiva',    'Alisamento com escova progressiva',           180,  320.00, 'active'),
  ('Hidratação',            'Tratamento intensivo de hidratação',           60,   90.00, 'active'),
  ('Escova Simples',        'Escova modeladora',                            45,   70.00, 'active'),
  ('Manicure',              'Esmaltação e cuidado das unhas',               40,   40.00, 'active'),
  ('Pedicure',              'Esmaltação e cuidado dos pés',                 50,   50.00, 'active'),
  ('Sobrancelha Design',    'Design e modelagem de sobrancelhas',           20,   35.00, 'active')
on conflict do nothing;

-- Clientes de exemplo
insert into clients (name, email, phone, status, member_since, notes) values
  ('Ana Clara Souza',   'ana.clara@email.com',  '(11) 99876-5432', 'VIP',        '2022-03-15', 'Prefere atendimento às terças'),
  ('Marina Silva',      'marina@email.com',     '(11) 98765-4321', 'Confirmado', '2023-01-10', null),
  ('Julia Ferreira',    'julia.f@email.com',    '(11) 97654-3210', 'Confirmado', '2023-06-20', 'Alergia a amônia'),
  ('Camila Rodrigues',  'camila.r@email.com',   '(11) 96543-2109', 'Novo',       '2024-11-05', null),
  ('Beatriz Lima',      'bia.lima@email.com',   '(11) 95432-1098', 'VIP',        '2021-08-22', 'Cliente fiel, desconto de 10%')
on conflict do nothing;

-- Fornecedor de exemplo
insert into suppliers (company_name, cnpj, category, email, phone) values
  ('L''Oréal Professionnel', '00.000.000/0001-00', 'Coloração', 'vendas@loreal.com.br', '(11) 3000-0000'),
  ('Wella Professional',     null,                 'Cuidados',  null,                   null)
on conflict do nothing;
