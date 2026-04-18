import { useEffect, useMemo, useRef, useState } from "react";
import { Search, Plus, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { fuzzyMatchProduct } from "@/lib/fuzzySearch";

interface ProductOption {
  id: string;
  nome: string;
  marca?: string | null;
  unidade_medida: string;
  category_name?: string;
}

interface ProductQuickAddProps {
  products: ProductOption[];
  excludedIds: Set<string>;
  onAdd: (productId: string, quantidade: number, observacao: string) => boolean;
  blockedProductIds?: Set<string>;
}

export function ProductQuickAdd({ products, excludedIds, onAdd, blockedProductIds }: ProductQuickAddProps) {
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [quantidade, setQuantidade] = useState("");
  const [obs, setObs] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = useMemo(() => {
    const trimmed = search.trim();
    const base = trimmed
      ? products.filter((p) => fuzzyMatchProduct(p, trimmed))
      : products;
    return base.filter((p) => !excludedIds.has(p.id)).slice(0, 8);
  }, [products, search, excludedIds]);

  const selected = useMemo(
    () => products.find((p) => p.id === selectedId) || null,
    [products, selectedId],
  );

  const isBlocked = selected ? blockedProductIds?.has(selected.id) : false;

  const handleSelect = (id: string) => {
    const p = products.find((x) => x.id === id);
    if (!p) return;
    setSelectedId(id);
    setSearch(p.nome);
    setShowSuggestions(false);
    setActiveIndex(0);
    setTimeout(() => {
      const qtyInput = containerRef.current?.querySelector<HTMLInputElement>('input[name="qty"]');
      qtyInput?.focus();
    }, 50);
  };

  const handleSubmit = () => {
    if (!selected) return;
    const qty = parseFloat(quantidade.replace(",", "."));
    if (isNaN(qty) || qty <= 0) return;
    const ok = onAdd(selected.id, qty, obs.trim());
    if (ok) {
      setSelectedId(null);
      setSearch("");
      setQuantidade("");
      setObs("");
    }
  };

  const onKeyDownSearch = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions || filtered.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      handleSelect(filtered[activeIndex].id);
    }
  };

  return (
    <div
      ref={containerRef}
      className="rounded-2xl border border-border/60 bg-card/40 p-4 space-y-3"
      data-guide="add-item-card"
    >
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-foreground">Adicionar item ao pedido</h3>
        <span className="text-[11px] text-muted-foreground/70">
          {products.length - excludedIds.size} disponíveis
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[1fr_140px_auto] gap-2">
        <div className="relative" data-guide="search-product">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Buscar produto por nome ou marca…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setSelectedId(null);
              setShowSuggestions(true);
              setActiveIndex(0);
            }}
            onFocus={() => setShowSuggestions(true)}
            onKeyDown={onKeyDownSearch}
            className="pl-9 bg-background/50 border-border/60 focus-visible:border-primary/50"
          />
          {showSuggestions && filtered.length > 0 && (
            <div className="absolute z-20 left-0 right-0 mt-1.5 max-h-72 overflow-auto rounded-xl border border-border bg-popover shadow-2xl py-1">
              {filtered.map((p, idx) => (
                <button
                  key={p.id}
                  type="button"
                  onMouseEnter={() => setActiveIndex(idx)}
                  onClick={() => handleSelect(p.id)}
                  className={`w-full text-left px-3 py-2 text-sm transition-colors flex items-center justify-between gap-3 ${
                    idx === activeIndex
                      ? "bg-primary/10 text-foreground"
                      : "hover:bg-accent/50 text-foreground/90"
                  }`}
                >
                  <div className="min-w-0">
                    <div className="font-medium truncate">{p.nome}</div>
                    <div className="text-[11px] text-muted-foreground truncate">
                      {p.marca ? `${p.marca} · ` : ""}
                      {p.category_name || "Sem categoria"}
                    </div>
                  </div>
                  <span className="text-[10px] uppercase font-semibold text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded shrink-0">
                    {p.unidade_medida}
                  </span>
                </button>
              ))}
            </div>
          )}
          {showSuggestions && search.trim() && filtered.length === 0 && (
            <div className="absolute z-20 left-0 right-0 mt-1.5 rounded-xl border border-border bg-popover shadow-xl px-3 py-3 text-sm text-muted-foreground">
              Nenhum produto encontrado.
            </div>
          )}
        </div>

        <Input
          name="qty"
          type="number"
          min="0.01"
          step="0.01"
          value={quantidade}
          onChange={(e) => setQuantidade(e.target.value)}
          placeholder={selected ? `Qtd em ${selected.unidade_medida}` : "Quantidade"}
          className="bg-background/50 border-border/60 focus-visible:border-primary/50"
          data-guide="input-qty"
        />

        <Button
          type="button"
          onClick={handleSubmit}
          disabled={!selected || !quantidade || isBlocked}
          className="gap-1.5 bg-primary/90 hover:bg-primary text-primary-foreground"
          data-guide="btn-add-item"
        >
          <Plus className="h-4 w-4" />
          Adicionar
        </Button>
      </div>

      {selected && (
        <div className="grid grid-cols-1 gap-2">
          <Input
            value={obs}
            onChange={(e) => setObs(e.target.value)}
            placeholder="Observação deste item (opcional)"
            className="h-9 text-sm bg-background/50 border-border/60"
          />
        </div>
      )}

      {isBlocked && (
        <p className="text-xs font-medium text-destructive">
          Este produto está bloqueado por contrato para a unidade de destino.
        </p>
      )}
    </div>
  );
}
