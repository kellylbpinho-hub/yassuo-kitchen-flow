/**
 * Helper de imagens para pratos / cardápio.
 *
 * Estratégia: usa o serviço público loremflickr.com (sem API key, gratuito)
 * com tag "food" + nome normalizado do prato e um lock determinístico baseado
 * no id, garantindo que o mesmo prato sempre receba a mesma foto.
 *
 * Em caso de falha (offline / bloqueio), o consumidor deve aplicar um
 * fallback CSS via `dishGradient(id)` no background do elemento.
 */

const FOOD_FALLBACK_TAG = "food,gourmet,restaurant";

function normalizeTag(name: string | null | undefined): string {
  if (!name) return FOOD_FALLBACK_TAG;
  const normalized = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]+/g, " ")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .join(",");
  return normalized ? `${normalized},food` : FOOD_FALLBACK_TAG;
}

function hashSeed(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = (h << 5) - h + input.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h) % 9999;
}

/** Monta URL de imagem para o prato. */
export function dishImageUrl(
  name: string | null | undefined,
  id?: string | null,
  size: { w: number; h: number } = { w: 400, h: 200 }
): string {
  const tag = normalizeTag(name);
  const lock = id ? hashSeed(id) : hashSeed(name || "dish");
  return `https://loremflickr.com/${size.w}/${size.h}/${tag}?lock=${lock}`;
}

/** Gradiente CSS de fallback no estilo dourado/âmbar premium. */
export function dishGradient(id?: string | null): string {
  const seed = id ? hashSeed(id) : 0;
  const hue = 28 + (seed % 24); // 28-52 (laranja → âmbar → dourado)
  return `linear-gradient(135deg, hsl(${hue} 80% 32%) 0%, hsl(${hue + 6} 60% 14%) 100%)`;
}
