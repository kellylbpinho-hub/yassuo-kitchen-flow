/**
 * GS1-128 / GS1 DataBar parser
 * Extracts Application Identifiers from GS1 barcodes
 */

export interface GS1Data {
  gtin?: string;         // AI 01 - GTIN (14 digits)
  lotNumber?: string;    // AI 10 - Batch/Lot number (variable, up to 20)
  expiryDate?: string;   // AI 15 - Best before date (YYMMDD)
  productionDate?: string; // AI 11 - Production date (YYMMDD)
  netWeightKg?: number;  // AI 310x - Net weight in kg (6 digits, x decimal places)
  serialNumber?: string; // AI 21 - Serial number
  quantity?: number;     // AI 30 - Variable count
  rawBarcode: string;
  isGS1: boolean;
}

// GS1 Group Separator character (ASCII 29) or ]C1 symbology identifier
const GS = String.fromCharCode(29);

// AI definitions: [prefix, fixedLength (null = variable, terminated by GS)]
const AI_DEFS: Array<{ prefix: string; key: keyof GS1Data; length: number | null; transform?: (v: string) => any }> = [
  { prefix: "01", key: "gtin", length: 14 },
  { prefix: "10", key: "lotNumber", length: null },
  { prefix: "11", key: "productionDate", length: 6 },
  { prefix: "15", key: "expiryDate", length: 6 },
  { prefix: "17", key: "expiryDate", length: 6 }, // AI 17 = expiry (also common)
  { prefix: "21", key: "serialNumber", length: null },
  { prefix: "30", key: "quantity", length: null, transform: (v) => parseInt(v, 10) },
  // AI 310x = net weight kg with x decimal places
  { prefix: "3100", key: "netWeightKg", length: 6, transform: (v) => parseInt(v, 10) },
  { prefix: "3101", key: "netWeightKg", length: 6, transform: (v) => parseInt(v, 10) / 10 },
  { prefix: "3102", key: "netWeightKg", length: 6, transform: (v) => parseInt(v, 10) / 100 },
  { prefix: "3103", key: "netWeightKg", length: 6, transform: (v) => parseInt(v, 10) / 1000 },
  { prefix: "3104", key: "netWeightKg", length: 6, transform: (v) => parseInt(v, 10) / 10000 },
  { prefix: "3105", key: "netWeightKg", length: 6, transform: (v) => parseInt(v, 10) / 100000 },
];

/**
 * Parse a YYMMDD date string into YYYY-MM-DD format
 */
function parseGS1Date(yymmdd: string): string | null {
  if (!yymmdd || yymmdd.length !== 6) return null;
  const yy = parseInt(yymmdd.substring(0, 2), 10);
  const mm = yymmdd.substring(2, 4);
  const dd = yymmdd.substring(4, 6);
  // GS1 convention: years 00-49 → 2000-2049, 50-99 → 1950-1999
  const year = yy <= 49 ? 2000 + yy : 1900 + yy;
  // DD=00 means last day of month
  const day = dd === "00" ? "28" : dd;
  return `${year}-${mm}-${day}`;
}

/**
 * Parse a GS1-128 barcode string and extract structured data
 */
export function parseGS1Barcode(raw: string): GS1Data {
  const result: GS1Data = { rawBarcode: raw, isGS1: false };

  // Clean symbology identifiers
  let code = raw.replace(/^\]C1/, "").replace(/^\]d2/, "").replace(/^\]e0/, "");
  
  // Quick heuristic: GS1-128 codes are typically 20+ chars with AI patterns
  // Regular EAN-13/UPC are 8-14 digits
  const digitsOnly = code.replace(/[^0-9]/g, "");
  if (digitsOnly.length <= 14 && !code.includes(GS)) {
    // Likely a regular EAN/UPC barcode
    result.isGS1 = false;
    return result;
  }

  // Try to parse AIs
  let pos = 0;
  let parsed = false;

  while (pos < code.length) {
    let matched = false;

    // Sort AI_DEFS by prefix length descending to match longer prefixes first
    const sortedDefs = [...AI_DEFS].sort((a, b) => b.prefix.length - a.prefix.length);

    for (const ai of sortedDefs) {
      if (code.substring(pos).startsWith(ai.prefix)) {
        const dataStart = pos + ai.prefix.length;

        let value: string;
        if (ai.length !== null) {
          // Fixed length
          value = code.substring(dataStart, dataStart + ai.length);
          pos = dataStart + ai.length;
          // Skip GS if present after fixed-length field
          if (pos < code.length && code[pos] === GS) pos++;
        } else {
          // Variable length - terminated by GS or end of string
          const gsPos = code.indexOf(GS, dataStart);
          if (gsPos !== -1) {
            value = code.substring(dataStart, gsPos);
            pos = gsPos + 1;
          } else {
            value = code.substring(dataStart);
            pos = code.length;
          }
        }

        if (value) {
          const transformed = ai.transform ? ai.transform(value) : value;
          (result as any)[ai.key] = transformed;
          parsed = true;
        }
        matched = true;
        break;
      }
    }

    if (!matched) {
      // Skip unknown character
      pos++;
    }
  }

  result.isGS1 = parsed;

  // Convert date strings to YYYY-MM-DD
  if (result.expiryDate && typeof result.expiryDate === "string" && result.expiryDate.length === 6) {
    result.expiryDate = parseGS1Date(result.expiryDate) || result.expiryDate;
  }
  if (result.productionDate && typeof result.productionDate === "string" && result.productionDate.length === 6) {
    result.productionDate = parseGS1Date(result.productionDate) || result.productionDate;
  }

  return result;
}

/**
 * Get suggested validity days based on product category
 */
export function getSuggestedValidityDays(categoria: string | null | undefined): number {
  if (!categoria) return 30;
  const cat = categoria.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (cat.includes("proteina") || cat.includes("carne") || cat.includes("frango") || cat.includes("peixe")) return 30;
  if (cat.includes("hortifruti") || cat.includes("frutas") || cat.includes("verdura") || cat.includes("legume")) return 7;
  if (cat.includes("laticinio") || cat.includes("leite") || cat.includes("queijo")) return 15;
  return 30;
}

/**
 * Format a date offset from today as YYYY-MM-DD
 */
export function getDateOffsetISO(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}
