-- =============================================================================
-- Rosi Coiffeur — Setup consolidado do Supabase (projeto nqaegttmdxuoblqixkfq)
-- Cole TODO este arquivo no SQL Editor do Dashboard e execute uma única vez.
-- Idempotente: pode ser reexecutado sem erro.
-- Consolida schema.sql + migration_supplier_products.sql + itens que o código
-- usa e que faltavam (settings, working_hours, promotions, client_passkeys,
-- colunas extras de clients, bucket de avatar).
-- =============================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- ENUMS
-- (client_status NÃO é mais usado: o front usa 'Ativo' | 'Inativo' | 'Novo')
-- ---------------------------------------------------------------------------
do $$ begin
  create type appointment_status as enum ('Confirmado', 'VIP', 'Aguardando', 'Cancelado');
exception when duplicate_object then null; end $$;

do $$ begin
  create type transaction_type as enum ('income', 'expense');
exception when duplicate_object then null; end $$;

do $$ begin
  create type supplier_category as enum ('Coloração', 'Cuidados', 'Equipamentos', 'Outros');
exception when duplicate_object then null; end $$;

do $$ begin
  create type svc_category_status as enum ('active', 'inactive');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- TABELAS
-- ---------------------------------------------------------------------------

-- Clientes (status em text: código grava 'Ativo', 'Inativo' e 'Novo')
create table if not exists clients (
  id                 uuid        primary key default gen_random_uuid(),
  user_id            uuid        references auth.users(id) on delete set null,
  name               text        not null,
  email              text,
  phone              text,
  status             text        not null default 'Ativo',
  avatar_url         text,
  member_since       date        not null default current_date,
  notes              text,
  address            text,
  contact_preference text,
  birth_date         date,
  created_at         timestamptz not null default now()
);

create table if not exists service_categories (
  id           uuid                primary key default gen_random_uuid(),
  name         text                not null,
  description  text,
  duration_min integer             check (duration_min > 0),
  price        numeric(10,2)       check (price >= 0),
  status       svc_category_status not null default 'active',
  created_at   timestamptz         not null default now()
);

create table if not exists appointments (
  id           uuid               primary key default gen_random_uuid(),
  client_id    uuid               not null references clients(id) on delete cascade,
  service      text               not null,
  date         date               not null,
  time_start   time               not null,
  time_end     time               not null,
  status       appointment_status not null default 'Aguardando',
  professional text,
  price        numeric,
  created_at   timestamptz        not null default now(),
  constraint chk_time check (time_end > time_start)
);

create table if not exists transactions (
  id          uuid             primary key default gen_random_uuid(),
  type        transaction_type not null,
  title       text             not null,
  subtitle    text,
  amount      numeric(10,2)    not null check (amount > 0),
  category    text,
  occurred_at timestamptz      not null default now(),
  created_at  timestamptz      not null default now()
);

create table if not exists suppliers (
  id           uuid              primary key default gen_random_uuid(),
  company_name text              not null,
  cnpj         text,
  category     supplier_category not null default 'Outros',
  email        text,
  phone        text,
  created_at   timestamptz       not null default now()
);

create table if not exists supplier_products (
  id            uuid          primary key default gen_random_uuid(),
  supplier_id   uuid          not null references suppliers(id) on delete cascade,
  name          text          not null,
  price         numeric(10,2),
  purchase_date date,
  category      text,
  created_at    timestamptz   not null default now()
);

create table if not exists service_history (
  id           uuid          primary key default gen_random_uuid(),
  client_id    uuid          not null references clients(id) on delete cascade,
  title        text          not null,
  professional text,
  amount       numeric(10,2) not null check (amount >= 0),
  date         date          not null default current_date,
  status       text          not null default 'Concluído',
  created_at   timestamptz   not null default now()
);

-- Configurações do salão (uma linha)
create table if not exists settings (
  id            uuid        primary key default gen_random_uuid(),
  salon_name    text        not null default 'Meu Salão',
  tagline       text,
  phone         text,
  email         text,
  address       text,
  instagram     text,
  whatsapp      text,
  logo_url      text,
  primary_color text,
  closed_dates  text[]      not null default '{}',
  created_at    timestamptz not null default now()
);

-- Horário de funcionamento (0 = domingo)
create table if not exists working_hours (
  id          uuid        primary key default gen_random_uuid(),
  day_of_week smallint    not null unique check (day_of_week between 0 and 6),
  open_time   time        not null,
  close_time  time        not null,
  active      boolean     not null default true,
  created_at  timestamptz not null default now()
);

create table if not exists promotions (
  id           uuid        primary key default gen_random_uuid(),
  title        text        not null,
  description  text,
  discount_pct numeric,
  valid_until  date,
  active       boolean     not null default true,
  created_at   timestamptz not null default now()
);

-- Passkeys (WebAuthn) dos clientes
create table if not exists client_passkeys (
  id            uuid        primary key default gen_random_uuid(),
  client_id     uuid        not null references clients(id) on delete cascade,
  credential_id text        not null unique,
  public_key    text        not null,
  created_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- ÍNDICES
-- ---------------------------------------------------------------------------
create index if not exists idx_appointments_date      on appointments(date);
create index if not exists idx_appointments_client_id on appointments(client_id);
create index if not exists idx_transactions_occurred  on transactions(occurred_at);
create index if not exists idx_service_history_client on service_history(client_id);
create index if not exists idx_clients_name           on clients(name);
create index if not exists idx_clients_user_id        on clients(user_id);
create index if not exists idx_clients_email          on clients(email);
create index if not exists idx_supplier_products_sup  on supplier_products(supplier_id);
create index if not exists idx_client_passkeys_client  on client_passkeys(client_id);

-- ---------------------------------------------------------------------------
-- ROW LEVEL SECURITY — acesso total para usuários autenticados
-- (o app de cliente também usa auth.signUp, então clientes logados têm o
--  mesmo acesso; veja o resumo sobre endurecer isso depois)
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'clients','service_categories','appointments','transactions','suppliers',
    'supplier_products','service_history','settings','working_hours',
    'promotions','client_passkeys'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists %I on %I', 'authenticated full access', t);
    execute format(
      'create policy %I on %I for all to authenticated using (true) with check (true)',
      'authenticated full access', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- STORAGE — bucket público de avatares (o app tenta 'avatars' primeiro)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do update set public = true;

drop policy if exists "avatars public read"        on storage.objects;
drop policy if exists "avatars authenticated write" on storage.objects;
drop policy if exists "avatars authenticated update" on storage.objects;
drop policy if exists "avatars authenticated delete" on storage.objects;

create policy "avatars public read" on storage.objects
  for select using (bucket_id = 'avatars');
create policy "avatars authenticated write" on storage.objects
  for insert to authenticated with check (bucket_id = 'avatars');
create policy "avatars authenticated update" on storage.objects
  for update to authenticated using (bucket_id = 'avatars') with check (bucket_id = 'avatars');
create policy "avatars authenticated delete" on storage.objects
  for delete to authenticated using (bucket_id = 'avatars');

-- ---------------------------------------------------------------------------
-- DADOS INICIAIS (apenas se as tabelas estiverem vazias)
-- ---------------------------------------------------------------------------
insert into settings (salon_name)
select 'Rosi Coiffeur' where not exists (select 1 from settings);

insert into working_hours (day_of_week, open_time, close_time, active) values
  (0, '09:00', '18:00', false),
  (1, '09:00', '18:00', true),
  (2, '09:00', '18:00', true),
  (3, '09:00', '18:00', true),
  (4, '09:00', '18:00', true),
  (5, '09:00', '18:00', true),
  (6, '09:00', '14:00', true)
on conflict (day_of_week) do nothing;

insert into service_categories (name, description, duration_min, price, status)
select * from (values
  ('Corte Feminino',     'Corte com acabamento e secagem',             60, 120.00, 'active'::svc_category_status),
  ('Corte Masculino',    'Corte masculino com finalização',            30,  60.00, 'active'::svc_category_status),
  ('Coloração',          'Coloração completa com tinta profissional', 120, 250.00, 'active'::svc_category_status),
  ('Balayage / Mechas',  'Técnica de iluminação manual',              150, 380.00, 'active'::svc_category_status),
  ('Escova Progressiva', 'Alisamento com escova progressiva',         180, 320.00, 'active'::svc_category_status),
  ('Hidratação',         'Tratamento intensivo de hidratação',         60,  90.00, 'active'::svc_category_status),
  ('Escova Simples',     'Escova modeladora',                          45,  70.00, 'active'::svc_category_status),
  ('Manicure',           'Esmaltação e cuidado das unhas',             40,  40.00, 'active'::svc_category_status),
  ('Pedicure',           'Esmaltação e cuidado dos pés',               50,  50.00, 'active'::svc_category_status),
  ('Sobrancelha Design', 'Design e modelagem de sobrancelhas',         20,  35.00, 'active'::svc_category_status)
) v(name, description, duration_min, price, status)
where not exists (select 1 from service_categories);
