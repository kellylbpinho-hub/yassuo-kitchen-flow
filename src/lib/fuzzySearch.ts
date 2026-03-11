/**
 * Normalize a string for fuzzy matching:
 * - lowercase
 * - remove accents/diacritics (ã→a, ç→c, é→e, etc.)
 */
export function normalize(str: string): string {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/**
 * Fuzzy match: returns true if the normalized query is found within the normalized text.
 */
export function fuzzyMatch(text: string, query: string): boolean {
  if (!query) return true;
  return normalize(text).includes(normalize(query));
}

/**
 * Fuzzy match for products: searches across nome, marca, and categoria.
 */
export function fuzzyMatchProduct(
  product: { nome: string; marca?: string | null; categoria?: string | null; category_name?: string | null },
  query: string
): boolean {
  if (!query) return true;
  const q = normalize(query);
  return (
    normalize(product.nome).includes(q) ||
    (!!product.marca && normalize(product.marca).includes(q)) ||
    (!!product.categoria && normalize(product.categoria).includes(q)) ||
    (!!product.category_name && normalize(product.category_name).includes(q))
  );
}

/**
 * Format product display label: "Nome — Marca" or just "Nome" if no marca.
 */
export function formatProductLabel(nome: string, marca?: string | null): string {
  return marca ? `${nome} — ${marca}` : nome;
}
