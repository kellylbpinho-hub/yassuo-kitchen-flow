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
