-- ─────────────────────────────────────────────────────────────────────────────
-- Criação da tabela supplier_products
-- Execute este script no Supabase SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE supplier_products (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id   uuid        NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  name          text        NOT NULL,
  price         numeric(10, 2),
  purchase_date date,
  category      text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE supplier_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated users full access"
  ON supplier_products
  FOR ALL
  USING  (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');
