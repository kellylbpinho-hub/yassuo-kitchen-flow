import * as pdfjsLib from "pdfjs-dist";
// @ts-ignore - vite worker import
import workerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;

export interface NFePdfItem {
  descricao: string;
  quantidade: number;
  unidade: string;
  valorUnitario: number;
  ean?: string;
}

export interface NFePdfData {
  numero: string;
  cnpjEmitente: string;
  emitente: string;
  dataEmissao: string;
  valorTotal: number;
  items: NFePdfItem[];
  rawText: string;
  ocrConfidence: "alta" | "media" | "baixa";
}

const onlyDigits = (s: string) => s.replace(/\D/g, "");

const parseDateBR = (s: string): string => {
  const m = s.match(/(\d{2})[\/\-](\d{2})[\/\-](\d{4})/);
  if (!m) return "";
  return `${m[3]}-${m[2]}-${m[1]}`;
};

const parseNumberBR = (s: string): number => {
  if (!s) return 0;
  const cleaned = s.replace(/\./g, "").replace(",", ".");
  const n = Number(cleaned);
  return isNaN(n) ? 0 : n;
};

/**
 * Extrai dados básicos de uma DANFE em PDF (texto nativo).
 * Funciona apenas em PDFs com texto embutido — PDFs escaneados retornam dados vazios
 * e o usuário deve preencher manualmente.
 */
export async function parseNFePdf(file: File): Promise<NFePdfData> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  let fullText = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((it: any) => ("str" in it ? it.str : ""))
      .join(" ");
    fullText += "\n" + pageText;
  }

  const text = fullText.replace(/\s+/g, " ").trim();

  // Heurísticas DANFE
  const numeroMatch = text.match(/N[º°ºo]?\.?\s*(\d{3}\.?\d{3}\.?\d{3})/i)
    || text.match(/N[º°ºo]?\.?\s*(\d{6,9})/i);
  const numero = numeroMatch ? onlyDigits(numeroMatch[1]) : "";

  const cnpjMatch = text.match(/(\d{2}\.\d{3}\.\d{3}\/\d{4}\-\d{2})/);
  const cnpjEmitente = cnpjMatch ? cnpjMatch[1] : "";

  const dataMatch = text.match(/EMISS[ÃA]O[^\d]*(\d{2}\/\d{2}\/\d{4})/i)
    || text.match(/(\d{2}\/\d{2}\/\d{4})/);
  const dataEmissao = dataMatch ? parseDateBR(dataMatch[1]) : "";

  const totalMatch = text.match(/VALOR\s+TOTAL\s+DA\s+NOTA[^\d]*([\d\.,]+)/i)
    || text.match(/V\.?\s*TOTAL\s+DA\s+NOTA[^\d]*([\d\.,]+)/i);
  const valorTotal = totalMatch ? parseNumberBR(totalMatch[1]) : 0;

  // Emitente: tentar capturar nome após "RAZÃO SOCIAL" ou antes do CNPJ
  let emitente = "";
  const razaoMatch = text.match(/RAZ[ÃA]O\s+SOCIAL[^A-Z]*([A-ZÁÉÍÓÚÇÃÕ][A-ZÁÉÍÓÚÇÃÕ\s\.&\-]{4,80})/i);
  if (razaoMatch) emitente = razaoMatch[1].trim();

  // Avaliar confiança
  const hits = [numero, cnpjEmitente, dataEmissao].filter(Boolean).length;
  const ocrConfidence: NFePdfData["ocrConfidence"] =
    hits === 3 ? "alta" : hits === 2 ? "media" : "baixa";

  return {
    numero,
    cnpjEmitente,
    emitente,
    dataEmissao,
    valorTotal,
    items: [], // Itens são complexos de extrair de DANFE — preenchidos manualmente
    rawText: fullText,
    ocrConfidence,
  };
}
