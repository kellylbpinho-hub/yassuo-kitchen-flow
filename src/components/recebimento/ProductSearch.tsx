import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Loader2, Search } from "lucide-react";
import { fuzzyMatchProduct, formatProductLabel } from "@/lib/fuzzySearch";
import { parseGS1Barcode, type GS1Data } from "@/lib/gs1Parser";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import type { Product } from "./types";

interface ProductSearchProps {
  allProducts: Product[];
  onProductFound: (product: Product, gs1Data: GS1Data | null, barcode: string) => void;
  onNotFound: (barcode: string) => void;
  onCancel: () => void;
}

export function ProductSearch({ allProducts, onProductFound, onNotFound, onCancel }: ProductSearchProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const normalizeBarcode = (raw: string) => raw.replace(/[^0-9]/g, "").trim() || "";

  const filteredProducts = searchQuery.length >= 2
    ? allProducts.filter((p) => fuzzyMatchProduct(p, searchQuery) || (p.codigo_barras && p.codigo_barras.includes(searchQuery)))
    : [];

  const lookupBarcode = async (code: string) => {
    const gs1 = parseGS1Barcode(code);
    const gs1Result = gs1.isGS1 ? gs1 : null;
    const lookupCode = gs1.isGS1 && gs1.gtin ? normalizeBarcode(gs1.gtin) : normalizeBarcode(code);
    setLoading(true);

    const { data } = await supabase
      .from("products")
      .select("id, nome, marca, unidade_medida, codigo_barras, estoque_atual, unidade_id, company_id, category_id, categoria")
      .eq("codigo_barras", lookupCode)
      .eq("ativo", true)
      .maybeSingle();

    setLoading(false);
    if (data) {
      onProductFound(data as Product, gs1Result, lookupCode);
    } else {
      onNotFound(lookupCode);
    }
  };

  const handleProductSelected = (p: Product) => {
    setPopoverOpen(false);
    onProductFound(p, null, p.codigo_barras || "");
  };

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    const code = searchQuery.trim();
    if (!code) {
      toast.error("Digite um código de barras ou nome do produto.");
      return;
    }
    if (/^\d{8,}$/.test(code.replace(/[^0-9]/g, ""))) {
      lookupBarcode(code);
    } else {
      const match = allProducts.find((p) => fuzzyMatchProduct(p, code));
      if (match) {
        handleProductSelected(match);
      } else {
        onNotFound("");
      }
    }
  };

  return (
    <form onSubmit={handleSubmit} className="glass-card p-6 max-w-sm space-y-4">
      <Label>Buscar por nome ou código de barras</Label>
      <Popover open={popoverOpen && filteredProducts.length > 0} onOpenChange={setPopoverOpen}>
        <PopoverTrigger asChild>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Ex: Alcatra, 7891234..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPopoverOpen(true);
              }}
              onFocus={() => filteredProducts.length > 0 && setPopoverOpen(true)}
              className="pl-9"
              autoFocus
            />
          </div>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start" onOpenAutoFocus={(e) => e.preventDefault()}>
          <Command>
            <CommandList>
              <CommandEmpty>Nenhum produto encontrado</CommandEmpty>
              <CommandGroup heading="Sugestões">
                {filteredProducts.slice(0, 8).map((p) => (
                  <CommandItem
                    key={p.id}
                    value={p.nome}
                    onSelect={() => handleProductSelected(p)}
                    className="cursor-pointer"
                  >
                    <div className="flex flex-col">
                      <span className="font-medium">
                        {formatProductLabel(p.nome, p.marca)}
                      </span>
                      {p.codigo_barras && (
                        <span className="text-xs text-muted-foreground">EAN: {p.codigo_barras}</span>
                      )}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      <div className="flex gap-2">
        <Button type="submit" disabled={loading}>
          {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
          Buscar
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
