// ─────────────────────────────────────────────────────────────────────────────
// Database types — mirrors the Supabase schema defined in schema.sql
// ─────────────────────────────────────────────────────────────────────────────

export type ClientStatus = 'Ativo' | 'Inativo';
export type AppointmentStatus = 'Confirmado' | 'Aguardando' | 'Cancelado';
export type TransactionType = 'income' | 'expense';
export type SupplierCategory = 'Coloração' | 'Cuidados' | 'Equipamentos' | 'Outros';
export type ServiceCategoryStatus = 'active' | 'inactive';

// ── Row types (what the DB returns) ─────────────────────────────────────────

export interface Client {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  status: ClientStatus;
  avatar_url: string | null;
  member_since: string;         // ISO date string
  notes: string | null;
  address: string | null;
  contact_preference: string | null;
  birth_date: string | null;
  created_at: string;
}

export interface Appointment {
  id: string;
  client_id: string;
  service: string;
  date: string;                 // ISO date string (YYYY-MM-DD)
  time_start: string;           // HH:MM
  time_end: string;             // HH:MM
  status: AppointmentStatus;
  price: number | null;
  professional: string | null;
  created_at: string;
  // joined from clients:
  client?: Pick<Client, 'id' | 'name' | 'avatar_url' | 'status' | 'phone'>;
}

export interface Transaction {
  id: string;
  type: TransactionType;
  title: string;
  subtitle: string | null;
  amount: number;               // always positive; sign derived from `type`
  category: string | null;
  occurred_at: string;          // ISO timestamp
  created_at: string;
}

export interface Supplier {
  id: string;
  company_name: string;
  cnpj: string | null;
  category: SupplierCategory;
  email: string | null;
  phone: string | null;
  created_at: string;
}

export interface ServiceHistory {
  id: string;
  client_id: string;
  title: string;
  professional: string | null;
  amount: number;
  date: string;                 // ISO date string
  status: string;
  created_at: string;
}

export interface ServiceCategory {
  id: string;
  name: string;
  description: string | null;
  duration_min: number | null;  // default duration in minutes
  price: number | null;         // default price in BRL
  status: ServiceCategoryStatus;
  created_at: string;
}

export type SupplierProductCategory = 'Coloração' | 'Cuidados' | 'Equipamentos' | 'Higiene' | 'Outros';

export interface SupplierProduct {
  id: string;
  supplier_id: string;
  name: string;
  price: number | null;
  purchase_date: string | null;   // ISO date YYYY-MM-DD
  category: SupplierProductCategory | null;
  created_at: string;
}

// ── Database shape consumed by the Supabase client ───────────────────────────

export interface Database {
  public: {
    Tables: {
      clients:         { Row: Client;         Insert: Omit<Client, 'id' | 'created_at'>;         Update: Partial<Omit<Client, 'id' | 'created_at'>>         };
      appointments:    { Row: Appointment;    Insert: Omit<Appointment, 'id' | 'created_at' | 'client'>; Update: Partial<Omit<Appointment, 'id' | 'created_at' | 'client'>> };
      transactions:    { Row: Transaction;    Insert: Omit<Transaction, 'id' | 'created_at'>;    Update: Partial<Omit<Transaction, 'id' | 'created_at'>>    };
      suppliers:       { Row: Supplier;       Insert: Omit<Supplier, 'id' | 'created_at'>;       Update: Partial<Omit<Supplier, 'id' | 'created_at'>>       };
      service_history:    { Row: ServiceHistory;    Insert: Omit<ServiceHistory, 'id' | 'created_at'>;    Update: Partial<Omit<ServiceHistory, 'id' | 'created_at'>>    };
      service_categories: { Row: ServiceCategory; Insert: Omit<ServiceCategory, 'id' | 'created_at'>; Update: Partial<Omit<ServiceCategory, 'id' | 'created_at'>> };
    };
  };
}
