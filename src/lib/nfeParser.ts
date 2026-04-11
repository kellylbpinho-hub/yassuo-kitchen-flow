export interface NFeItem {
  codigo: string; // cProd or cEAN
  ean: string;
  descricao: string;
  unidade: string;
  quantidade: number;
  valorUnitario: number;
  lote: string;
  validade: string; // YYYY-MM-DD
}

export interface NFeData {
  numero: string;
  serie: string;
  chave: string;
  emitente: string;
  cnpjEmitente: string;
  dataEmissao: string;
  items: NFeItem[];
}

/**
 * Parse NF-e XML (modelo 55) and extract product items with lot/expiry info.
 * Supports both nfeProc and NFe root elements.
 */
export function parseNFeXml(xmlString: string): NFeData {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlString, "text/xml");

  const parseError = doc.querySelector("parsererror");
  if (parseError) {
    throw new Error("XML inválido. Verifique se o arquivo é uma NF-e válida.");
  }

  // Find the NFe/infNFe node (handles both nfeProc and standalone NFe)
  const ns = "http://www.portalfiscal.inf.br/nfe";

  const getEl = (parent: Element | Document, tag: string): Element | null => {
    return parent.getElementsByTagNameNS(ns, tag)[0] || parent.getElementsByTagName(tag)[0] || null;
  };

  const getAllEl = (parent: Element | Document, tag: string): Element[] => {
    const nsList = parent.getElementsByTagNameNS(ns, tag);
    if (nsList.length > 0) return Array.from(nsList);
    return Array.from(parent.getElementsByTagName(tag));
  };

  const getText = (parent: Element | Document, tag: string): string => {
    const el = getEl(parent, tag);
    return el?.textContent?.trim() || "";
  };

  const infNFe = getEl(doc, "infNFe");
  if (!infNFe) {
    throw new Error("Elemento infNFe não encontrado. O arquivo não parece ser uma NF-e válida.");
  }

  // Header info
  const ide = getEl(infNFe, "ide");
  const emit = getEl(infNFe, "emit");

  const numero = ide ? getText(ide, "nNF") : "";
  const serie = ide ? getText(ide, "serie") : "";
  const dataEmissao = ide ? getText(ide, "dhEmi").substring(0, 10) : "";
  const chave = infNFe.getAttribute("Id")?.replace("NFe", "") || "";
  const emitente = emit ? getText(emit, "xNome") : "";
  const cnpjEmitente = emit ? getText(emit, "CNPJ") : "";

  // Parse items (det elements)
  const detElements = getAllEl(infNFe, "det");
  const items: NFeItem[] = [];

  for (const det of detElements) {
    const prod = getEl(det, "prod");
    if (!prod) continue;

    const ean = getText(prod, "cEAN") || getText(prod, "cEANTrib") || "";
    const codigo = getText(prod, "cProd") || "";
    const descricao = getText(prod, "xProd") || "";
    const unidade = getText(prod, "uCom") || getText(prod, "uTrib") || "";
    const quantidade = parseFloat(getText(prod, "qCom") || getText(prod, "qTrib") || "0");
    const valorUnitario = parseFloat(getText(prod, "vUnCom") || getText(prod, "vUnTrib") || "0");

    // Try to find lot and expiry from rastro elements (rastreabilidade)
    let lote = "";
    let validade = "";

    const rastros = getAllEl(prod, "rastro");
    if (rastros.length > 0) {
      const rastro = rastros[0]; // Use first rastro
      lote = getText(rastro, "nLote");
      const dVal = getText(rastro, "dVal");
      if (dVal) {
        // dVal can be YYYY-MM-DD or DD/MM/YYYY
        validade = dVal.includes("/")
          ? dVal.split("/").reverse().join("-")
          : dVal;
      }
    }

    // Also check infAdProd for lot info as fallback
    if (!lote) {
      const infAdProd = getText(det, "infAdProd");
      const loteMatch = infAdProd.match(/[Ll]ote[:\s]*([^\s,;]+)/);
      if (loteMatch) lote = loteMatch[1];

      const valMatch = infAdProd.match(/[Vv]al(?:idade)?[:\s]*(\d{2}\/\d{2}\/\d{4})/);
      if (valMatch && !validade) {
        validade = valMatch[1].split("/").reverse().join("-");
      }
    }

    items.push({
      codigo,
      ean: ean === "SEM GTIN" ? "" : ean,
      descricao,
      unidade: normalizeUnit(unidade),
      quantidade,
      valorUnitario,
      lote,
      validade,
    });
  }

  if (items.length === 0) {
    throw new Error("Nenhum item encontrado na NF-e.");
  }

  return {
    numero,
    serie,
    chave,
    emitente,
    cnpjEmitente,
    dataEmissao,
    items,
  };
}

function normalizeUnit(unit: string): string {
  const map: Record<string, string> = {
    KG: "kg",
    GR: "g",
    G: "g",
    UN: "un",
    UND: "un",
    LT: "L",
    L: "L",
    ML: "ml",
    CX: "un",
    PC: "un",
    PCT: "un",
  };
  return map[unit.toUpperCase()] || unit.toLowerCase();
}
