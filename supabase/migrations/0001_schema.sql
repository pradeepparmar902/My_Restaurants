-- Tadka Restaurant Growth Platform: Production PostgreSQL Schema (Supabase)
-- Money is stored in paise (integer). Phone numbers are stored in E.164 international format.

CREATE TABLE IF NOT EXISTS restaurants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  counter_mode TEXT NOT NULL DEFAULT 'auto' CHECK (counter_mode IN ('auto', 'manual')),
  send_final_bill BOOLEAN NOT NULL DEFAULT TRUE,
  gstin TEXT,
  time_zone TEXT NOT NULL DEFAULT 'Asia/Kolkata',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  user_id UUID,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('Admin', 'Manager', 'Chef', 'Waiter', 'Reception')),
  can_manage_access BOOLEAN NOT NULL DEFAULT FALSE,
  extra_permissions TEXT[] NOT NULL DEFAULT '{}',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (restaurant_id, phone)
);

CREATE TABLE IF NOT EXISTS dining_tables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  qr_token TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS menu_items (
  id SERIAL PRIMARY KEY,
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL DEFAULT '🍲',
  name_en TEXT NOT NULL,
  name_hi TEXT NOT NULL,
  name_gu TEXT NOT NULL,
  price_paise INTEGER NOT NULL CHECK (price_paise >= 0),
  is_veg BOOLEAN NOT NULL DEFAULT TRUE,
  is_jain BOOLEAN NOT NULL DEFAULT FALSE,
  photo_url TEXT,
  available BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  phone TEXT UNIQUE NOT NULL,
  name TEXT,
  whatsapp_consent BOOLEAN NOT NULL DEFAULT FALSE,
  whatsapp_consent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS counters (
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  business_date DATE NOT NULL,
  last_number INTEGER NOT NULL DEFAULT 26,
  PRIMARY KEY (restaurant_id, business_date)
);

CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  table_id UUID REFERENCES dining_tables(id),
  customer_id UUID REFERENCES customers(id),
  phone TEXT,
  counter_number TEXT,
  created_by TEXT NOT NULL CHECK (created_by IN ('customer', 'staff')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'billed', 'paid', 'closed')),
  business_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (restaurant_id, business_date, counter_number)
);

CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  sequence INTEGER NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('app', 'waiter')),
  status TEXT NOT NULL DEFAULT 'Received' CHECK (status IN ('Received', 'Cooking', 'Ready', 'Delivered', 'Cancelled')),
  rush BOOLEAN NOT NULL DEFAULT FALSE,
  vip BOOLEAN NOT NULL DEFAULT FALSE,
  placed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ready_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  delivered_by UUID REFERENCES staff(id)
);

CREATE TABLE IF NOT EXISTS order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  dish_id INTEGER NOT NULL REFERENCES menu_items(id),
  dish_name_snapshot TEXT NOT NULL,
  price_paise_snapshot INTEGER NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity BETWEEN 1 AND 20),
  note TEXT
);

CREATE TABLE IF NOT EXISTS bills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID UNIQUE NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  subtotal_paise INTEGER NOT NULL DEFAULT 0,
  discount_paise INTEGER NOT NULL DEFAULT 0,
  gst_paise INTEGER NOT NULL DEFAULT 0,
  total_paise INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft', 'Pushed', 'Paid', 'Void')),
  pushed_by UUID REFERENCES staff(id),
  pushed_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  whatsapp_sent_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id UUID NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
  method TEXT NOT NULL,
  amount_paise INTEGER NOT NULL CHECK (amount_paise > 0),
  status TEXT NOT NULL DEFAULT 'Created' CHECK (status IN ('Created', 'Succeeded', 'Failed', 'Refunded')),
  gateway_reference TEXT UNIQUE,
  tagged_by UUID REFERENCES staff(id),
  split_group INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS loyalty_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  stars INTEGER NOT NULL DEFAULT 0 CHECK (stars BETWEEN 0 AND 5),
  points INTEGER NOT NULL DEFAULT 0 CHECK (points >= 0),
  tier TEXT NOT NULL DEFAULT 'Silver',
  UNIQUE (restaurant_id, customer_id)
);

CREATE TABLE IF NOT EXISTS loyalty_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES loyalty_accounts(id) ON DELETE CASCADE,
  bill_id UUID REFERENCES bills(id),
  entry_type TEXT NOT NULL CHECK (entry_type IN ('star', 'points', 'reward', 'redeem')),
  delta INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS social_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  handle TEXT NOT NULL,
  encrypted_token TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (customer_id, platform)
);

CREATE TABLE IF NOT EXISTS social_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('reel', 'snap', 'google_review')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  discount_paise INTEGER NOT NULL DEFAULT 0,
  decided_by UUID REFERENCES staff(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS whatsapp_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  to_number TEXT NOT NULL,
  template_name TEXT NOT NULL DEFAULT 'final_bill',
  bill_id UUID REFERENCES bills(id),
  provider_id TEXT,
  status TEXT NOT NULL CHECK (status IN ('queued', 'sent', 'failed')),
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  who TEXT NOT NULL,
  action TEXT NOT NULL,
  what TEXT NOT NULL,
  details TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
