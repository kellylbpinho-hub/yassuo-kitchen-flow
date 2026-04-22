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
  size: { w: number; h: number } = { w: 400, h: 200 },
  category?: string | null
): string {
  const map: Record<string, string> = {
    frango: "1598103442097-8b74394b95c3",
    peito: "1567620905732-2d1ec7ab7445",
    assado: "1598103442097-8b74394b95c3",
    grelhado: "1604908177522-aab63e0c1f8f",
    carne: "1546833999-b9f581a1996d",
    bife: "1546833999-b9f581a1996d",
    picanha: "1546833999-b9f581a1996d",
    peixe: "1519708227418-a2f9c7aba00a",
    salmao: "1519708227418-a2f9c7aba00a",
    camarao: "1559847844-5315695dadae",
    arroz: "1536304993831-df8347cbf720",
    risoto: "1536304993831-df8347cbf720",
    macarrao: "1555949258-eb67b1ef0ceb",
    massa: "1555949258-eb67b1ef0ceb",
    espaguete: "1555949258-eb67b1ef0ceb",
    lasanha: "1560506840-ec148e82a604",
    batata: "1574484284002-952d92456975",
    pure: "1574484284002-952d92456975",
    farofa: "1547592166-23ac45744acd",
    feijao: "1547592166-23ac45744acd",
    feijoada: "1547592166-23ac45744acd",
    salada: "1512621776951-a57141f2eefd",
    legume: "1540420773420-3366772f4999",
    sopa: "1547592116-3b93a4c0f2af",
    bolo: "1464349095431-e9a21285b5f3",
    sobremesa: "1486427944299-d1955d23e34d",
    sorvete: "1488900128323-21503983d706",
    ovo: "1482049016688-2d3e1b311543",
    acebolado: "1546833999-b9f581a1996d",
    refogado: "1540420773420-3366772f4999",
  };

  const n = (name || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .trim();

  let photoId = "1476224203421-74b968e8f22a";
  for (const [k, v] of Object.entries(map)) {
    if (n.includes(k)) {
      photoId = v;
      break;
    }
  }

  return `https://images.unsplash.com/photo-${photoId}?w=${size.w}&h=${size.h}&fit=crop&q=80&auto=format`;
}

/** Gradiente CSS de fallback no estilo dourado/âmbar premium. */
export function dishGradient(id?: string | null): string {
  const seed = id ? hashSeed(id) : 0;
  const hue = 28 + (seed % 24); // 28-52 (laranja → âmbar → dourado)
  return `linear-gradient(135deg, hsl(${hue} 80% 32%) 0%, hsl(${hue + 6} 60% 14%) 100%)`;
}
