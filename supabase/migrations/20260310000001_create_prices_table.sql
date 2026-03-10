-- Create prices table for commodity price time-series data
CREATE TABLE prices (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  symbol TEXT NOT NULL CHECK (symbol IN (
    'SJC_9999', 'SJC_RING', 'PNJ_GOLD', 'DOJI_GOLD',
    'PNJ_SILVER',
    'RON95', 'RON98', 'DIESEL',
    'XAU_USD', 'XAG_USD',
    'WTI_USD', 'BRENT_USD',
    'RBOB_USD'
  )),
  price NUMERIC(18,4) NOT NULL,
  bid NUMERIC(18,4),
  ask NUMERIC(18,4),
  unit TEXT NOT NULL CHECK (unit IN ('VND', 'USD')),
  source TEXT NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(symbol, fetched_at)
);

-- Indexes for fast queries by symbol + date range
CREATE INDEX idx_prices_symbol_fetched ON prices(symbol, fetched_at DESC);
CREATE INDEX idx_prices_fetched ON prices(fetched_at DESC);

-- RLS: anon can only read, service_role can insert
ALTER TABLE prices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_read" ON prices FOR SELECT TO anon USING (true);
CREATE POLICY "service_write" ON prices FOR ALL TO service_role USING (true) WITH CHECK (true);

-- RPC: return latest price per symbol
CREATE OR REPLACE FUNCTION get_latest_prices()
RETURNS SETOF prices AS $$
  SELECT DISTINCT ON (symbol) *
  FROM prices
  ORDER BY symbol, fetched_at DESC;
$$ LANGUAGE sql STABLE;
