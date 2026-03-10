-- RPC: return price history for a symbol within date range
CREATE OR REPLACE FUNCTION get_price_history(
  p_symbol TEXT,
  p_from TIMESTAMPTZ DEFAULT now() - INTERVAL '7 days',
  p_to TIMESTAMPTZ DEFAULT now()
)
RETURNS SETOF prices AS $$
  SELECT * FROM prices
  WHERE symbol = p_symbol
    AND fetched_at BETWEEN p_from AND p_to
  ORDER BY fetched_at DESC;
$$ LANGUAGE sql STABLE;

-- Grant anon execute on RPC functions
GRANT EXECUTE ON FUNCTION get_latest_prices() TO anon;
GRANT EXECUTE ON FUNCTION get_price_history(TEXT, TIMESTAMPTZ, TIMESTAMPTZ) TO anon;
