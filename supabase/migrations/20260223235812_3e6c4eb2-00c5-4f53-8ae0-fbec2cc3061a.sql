CREATE UNIQUE INDEX IF NOT EXISTS products_unique_barcode_active
ON products (codigo_barras)
WHERE ativo = true AND codigo_barras IS NOT NULL;