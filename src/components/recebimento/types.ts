export interface Product {
  id: string;
  nome: string;
  marca: string | null;
  unidade_medida: string;
  codigo_barras: string | null;
  estoque_atual: number;
  unidade_id: string;
  company_id: string;
  category_id: string | null;
  categoria: string | null;
}

export interface Unit {
  id: string;
  name: string;
  type: string;
}

export interface PurchaseUnit {
  id: string;
  nome: string;
  fator_conversao: number;
  product_id: string;
}

export interface RecentReceipt {
  id: string;
  product_name: string;
  quantidade: number;
  unidade_medida: string;
  lote: string;
  created_at: string;
}

export type Step = "idle" | "scanning" | "manual" | "found" | "not_found" | "register" | "receipt" | "success";
