import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { BarcodeScanner } from "@/components/BarcodeScanner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScanBarcode, Keyboard, Package, Loader2, CheckCircle2, Search, Info } from "lucide-react";
import { toast } from "sonner";
import { fuzzyMatchProduct, formatProductLabel } from "@/lib/fuzzySearch";
import { parseGS1Barcode, getSuggestedValidityDays, type GS1Data } from "@/lib/gs1Parser";

interface Product {
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

interface Unit {
  id: string;
  name: string;
  type: string;
}

interface PurchaseUnit {
  id: string;
  nome: string;
  fator_conversao: number;
  product_id: string;
}

type Step = "idle" | "scanning" | "manual" | "found" | "not_found" | "register" | "receipt" | "success";

export default function RecebimentoDigital() {
  const { user, profile } = useAuth();
  const [step, setStep] = useState<Step>("idle");
  const [barcode, setBarcode] = useState("");
  const [product, setProduct] = useState<Product | null>(null);
  const [units, setUnits] = useState<Unit[]>([]);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [purchaseUnits, setPurchaseUnits] = useState<PurchaseUnit[]>([]);
  const [loading, setLoading] = useState(false);

  // GS1 parsed data
  const [gs1Data, setGs1Data] = useState<GS1Data | null>(null);

  // Autocomplete state
  const [searchQuery, setSearchQuery] = useState("");
  const [popoverOpen, setPopoverOpen] = useState(false);

  // Receipt form
  const [validade, setValidade] = useState("");
  const [lote, setLote] = useState("");
  const [quantidade, setQuantidade] = useState("");
  const [selectedUnit, setSelectedUnit] = useState("");

  // Register product form
  const [newName, setNewName] = useState("");
  const [newMarca, setNewMarca] = useState("");
  const [newUnidadeMedida, setNewUnidadeMedida] = useState("kg");
  const [newUnit, setNewUnit] = useState("");
  const [newCategoria, setNewCategoria] = useState("");


  const CATEGORIAS_FIXAS = ["Grãos", "Proteínas", "Laticínios", "Hortifruti", "Bebidas", "Descartáveis", "Limpeza", "Temperos", "Outros"];

  useEffect(() => {
    loadUnits();
    loadAllProducts();
    loadPurchaseUnits();
  }, []);

  const loadUnits = async () => {
    const { data } = await supabase.from("units").select("id, name, type");
    const allUnits = (data || []) as Unit[];
    setUnits(allUnits);
    const cdUnit = allUnits.find((u) => u.type === "cd");
    if (cdUnit) {
      setSelectedUnit(cdUnit.id);
      setNewUnit(cdUnit.id);
    } else if (allUnits.length > 0) {
      setSelectedUnit(allUnits[0].id);
      setNewUnit(allUnits[0].id);
    }
  };

  const loadAllProducts = async () => {
    const { data } = await supabase
      .from("products")
      .select("id, nome, marca, unidade_medida, codigo_barras, estoque_atual, unidade_id, company_id, category_id, categoria")
      .eq("ativo", true)
      .order("nome");
    setAllProducts((data || []) as Product[]);
  };

  const loadPurchaseUnits = async () => {
    const { data } = await supabase
      .from("product_purchase_units")
      .select("id, nome, fator_conversao, product_id");
    setPurchaseUnits((data || []) as PurchaseUnit[]);
  };

  const normalizeBarcode = (raw: string) => raw.replace(/[^0-9]/g, "").trim() || "";

  const lookupBarcode = async (code: string) => {
    const gs1 = parseGS1Barcode(code);
    setGs1Data(gs1.isGS1 ? gs1 : null);

    const lookupCode = gs1.isGS1 && gs1.gtin ? normalizeBarcode(gs1.gtin) : normalizeBarcode(code);
    setBarcode(lookupCode);
    setLoading(true);

    const { data } = await supabase
      .from("products")
      .select("id, nome, marca, unidade_medida, codigo_barras, estoque_atual, unidade_id, company_id, category_id, categoria")
      .eq("codigo_barras", lookupCode)
      .eq("ativo", true)
      .maybeSingle();

    setLoading(false);
    if (data) {
      const p = data as Product;
      setProduct(p);
      prefillFromGS1(gs1, p);
      setStep("receipt");
    } else {
      setStep("not_found");
    }
  };

  const prefillFromGS1 = (gs1: GS1Data, _p: Product) => {
    if (gs1.isGS1) {
      if (gs1.expiryDate) setValidade(gs1.expiryDate);
      if (gs1.lotNumber) setLote(gs1.lotNumber);
      if (gs1.netWeightKg !== undefined) setQuantidade(String(gs1.netWeightKg));
    }
    // Soberania da etiqueta: validade manual obrigatória se não GS1
    // Não auto-preencher validade sem dados reais
  };

  const handleProductSelected = (p: Product) => {
    setProduct(p);
    setBarcode(p.codigo_barras || "");
    setPopoverOpen(false);
    setGs1Data(null);
    // Soberania da etiqueta: não auto-sugerir validade
    setStep("receipt");
  };

  const handleManualSubmit = () => {
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
        setBarcode("");
        setStep("not_found");
      }
    }
  };

  const filteredProducts = searchQuery.length >= 2
    ? allProducts.filter((p) => fuzzyMatchProduct(p, searchQuery) || (p.codigo_barras && p.codigo_barras.includes(searchQuery)))
    : [];

  // Check weight deviation against last 5 entries — silent logging
  const checkAndLogWeightDeviation = async (productId: string, currentQty: number) => {
    const { data: lastEntries } = await supabase
      .from("movements")
      .select("quantidade")
      .eq("product_id", productId)
      .eq("tipo", "entrada")
      .order("created_at", { ascending: false })
      .limit(5);

    if (!lastEntries || lastEntries.length < 2) return; // Not enough history

    const avg = lastEntries.reduce((s, e) => s + Number(e.quantidade), 0) / lastEntries.length;
    const deviation = Math.abs(currentQty - avg) / avg;

    if (deviation > 0.3 && profile?.company_id) {
      // Silent log — no blocking dialog
      await supabase.from("weight_divergence_logs").insert({
        company_id: profile.company_id,
        product_id: productId,
        product_name: product?.nome || "Produto",
        peso_informado: currentQty,
        media_historica: Math.round(avg * 1000) / 1000,
        percentual_desvio: Math.round(deviation * 10000) / 100,
        user_id: user!.id,
        user_name: profile.full_name,
        unidade_id: selectedUnit,
      });
    }
  };

  const handleRegisterProduct = async () => {
    if (!newName.trim()) {
      toast.error("Informe o nome do produto.");
      return;
    }
    if (!newUnit) {
      toast.error("Selecione a unidade.");
      return;
    }
    if (!newCategoria) {
      toast.error("Selecione a categoria.");
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.rpc("rpc_create_product", {
      p_unidade_id: newUnit,
      p_nome: newName.trim(),
      p_unidade_medida: newUnidadeMedida,
      p_codigo_barras: barcode || null,
    });

    if (error) {
      toast.error("Erro ao cadastrar: " + error.message);
      setLoading(false);
      return;
    }
    const result = data as any;
    if (result?.id && !result?.already_existed) {
      const updateData: any = { categoria: newCategoria };
      if (newMarca.trim()) updateData.marca = newMarca.trim();
      await supabase.from("products").update(updateData).eq("id", result.id);
    }
    const newProduct: Product = {
      ...(result as Product),
      categoria: newCategoria,
      marca: newMarca.trim() || null,
    };
    setProduct(newProduct);
    setStep("receipt");
    setLoading(false);
    if (result.already_existed) {
      toast.info("Produto já existente encontrado. Prossiga com o recebimento.");
    } else {
      toast.success("Produto cadastrado!");
    }
  };

  const executeReceipt = async () => {
    const qty = parseFloat(quantidade);
    setLoading(true);

    const { data, error } = await supabase.rpc("rpc_receive_digital", {
      p_product_id: product!.id,
      p_unidade_id: selectedUnit,
      p_validade: validade,
      p_lote_codigo: lote.trim(),
      p_quantidade: qty,
    });

    setLoading(false);

    if (error) {
      toast.error(error.message || "Erro desconhecido");
      return;
    }

    if (data && product) {
      setProduct({ ...product, estoque_atual: (data as any).novo_estoque_atual });
    }

    setStep("success");
    toast.success("Recebimento registrado com sucesso!");
    window.dispatchEvent(new CustomEvent("guided:receipt:success"));
  };

  const handleReceipt = async () => {
    if (!validade || !lote.trim() || !quantidade || !selectedUnit) {
      toast.error("Preencha todos os campos obrigatórios.");
      return;
    }

    const qty = parseFloat(quantidade);
    if (isNaN(qty) || qty <= 0) {
      toast.error("Quantidade inválida.");
      return;
    }

    // Log weight deviation silently (non-blocking)
    await checkAndLogWeightDeviation(product!.id, qty);
    await executeReceipt();
  };

  const reset = () => {
    setStep("idle");
    setBarcode("");
    setSearchQuery("");
    setProduct(null);
    setGs1Data(null);
    setValidade("");
    setLote("");
    setQuantidade("");
    setNewName("");
    setNewMarca("");
    setNewUnidadeMedida("kg");
    setNewCategoria("");
  };

  const getProductPurchaseUnit = (): PurchaseUnit | null => {
    if (!product) return null;
    return purchaseUnits.find((pu) => pu.product_id === product.id) || null;
  };

  const isWeightUnit = product?.unidade_medida && ["kg", "g"].includes(product.unidade_medida);
  const quantityLabel = isWeightUnit ? "Peso da Caixa (kg)" : "Quantidade na Caixa";
  const purchaseUnit = getProductPurchaseUnit();

  if (step === "scanning") {
    return (
      <BarcodeScanner
        onDetected={(code) => {
          setStep("idle");
          lookupBarcode(code);
        }}
        onClose={() => setStep("idle")}
      />
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <h1 className="text-2xl font-display font-bold text-foreground">
        Recebimento Digital
      </h1>

      {/* Idle */}
      {step === "idle" && (
        <div className="grid gap-4 sm:grid-cols-2 max-w-lg" data-guide="btn-scan">
          <Button className="h-24 text-lg gap-3" onClick={() => setStep("scanning")}>
            <ScanBarcode className="h-7 w-7" />
            Escanear código de barras
          </Button>
          <Button variant="outline" className="h-24 text-lg gap-3" onClick={() => setStep("manual")}>
            <Keyboard className="h-7 w-7" />
            Buscar produto
          </Button>
        </div>
      )}

      {/* Manual entry with autocomplete */}
      {step === "manual" && (
        <div className="glass-card p-6 max-w-sm space-y-4">
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
            <Button onClick={handleManualSubmit} disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Buscar
            </Button>
            <Button variant="ghost" onClick={reset}>
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && step === "idle" && (
        <div className="flex items-center justify-center h-32">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}

      {/* Product not found */}
      {step === "not_found" && (
        <div className="glass-card p-6 max-w-md space-y-4">
          <div className="flex items-center gap-2">
            <Package className="h-5 w-5 text-warning" />
            <h2 className="font-display font-bold text-foreground">
              Produto não cadastrado
            </h2>
          </div>
          {barcode && (
            <p className="text-sm text-muted-foreground">
              Código: <Badge variant="secondary">{barcode}</Badge>
            </p>
          )}
          <div className="flex gap-2">
            <Button onClick={() => setStep("register")}>Cadastrar produto</Button>
            <Button variant="ghost" onClick={reset}>Voltar</Button>
          </div>
        </div>
      )}

      {/* Register new product */}
      {step === "register" && (
        <div className="glass-card p-6 max-w-md space-y-4">
          <h2 className="font-display font-bold text-foreground">Cadastrar Produto</h2>
          {barcode && (
            <p className="text-xs text-muted-foreground">
              Código: <Badge variant="secondary">{barcode}</Badge>
            </p>
          )}
          <div className="space-y-3">
            {barcode && (
              <div>
                <Label>Código de barras</Label>
                <Input value={barcode} readOnly className="bg-muted" />
              </div>
            )}
            <div>
              <Label>Nome do produto *</Label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} autoFocus />
            </div>
            <div>
              <Label>Marca</Label>
              <Input value={newMarca} onChange={(e) => setNewMarca(e.target.value)} placeholder="Ex: Friboi, Sadia..." />
            </div>
            <div>
              <Label>Unidade de medida</Label>
              <Select value={newUnidadeMedida} onValueChange={setNewUnidadeMedida}>
                <SelectTrigger className="bg-input border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="kg">kg</SelectItem>
                  <SelectItem value="g">g</SelectItem>
                  <SelectItem value="L">L</SelectItem>
                  <SelectItem value="ml">ml</SelectItem>
                  <SelectItem value="un">un</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Categoria *</Label>
              <Select value={newCategoria} onValueChange={setNewCategoria}>
                <SelectTrigger className="bg-input border-border">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIAS_FIXAS.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Unidade (local) *</Label>
              <Select value={newUnit} onValueChange={setNewUnit}>
                <SelectTrigger className="bg-input border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {units.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name} ({u.type.toUpperCase()})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleRegisterProduct} disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Cadastrar e continuar
            </Button>
            <Button variant="ghost" onClick={() => setStep("not_found")}>Voltar</Button>
          </div>
        </div>
      )}

      {/* Receipt form */}
      {step === "receipt" && product && (
        <div className="glass-card p-6 max-w-md space-y-4">
          <h2 className="font-display font-bold text-foreground">Recebimento</h2>
          <div className="bg-accent/50 rounded-lg p-3 space-y-1">
            <p className="text-sm font-medium text-foreground">{product.nome}</p>
            {product.marca && (
              <p className="text-xs text-muted-foreground">Marca: {product.marca}</p>
            )}
            <p className="text-xs text-muted-foreground">
              {barcode ? `Código: ${barcode} · ` : ""}Medida: {product.unidade_medida}
            </p>
            {purchaseUnit && (
              <div className="flex items-center gap-1 mt-1">
                <Info className="h-3 w-3 text-primary" />
                <span className="text-xs text-primary font-medium">
                  Peso/Qtd Esperada: {purchaseUnit.fator_conversao} {product.unidade_medida} ({purchaseUnit.nome})
                </span>
              </div>
            )}
          </div>

          {/* GS1 badge */}
          {gs1Data?.isGS1 && (
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="secondary" className="text-xs bg-primary/10 text-primary border-primary/20">
                GS1-128 detectado
              </Badge>
              {gs1Data.netWeightKg !== undefined && (
                <Badge variant="outline" className="text-xs">
                  Peso: {gs1Data.netWeightKg} kg
                </Badge>
              )}
              {gs1Data.lotNumber && (
                <Badge variant="outline" className="text-xs">
                  Lote: {gs1Data.lotNumber}
                </Badge>
              )}
            </div>
          )}

          <div className="space-y-3">
            <div>
              <Label>Validade * (data da etiqueta)</Label>
              <Input type="date" value={validade} onChange={(e) => setValidade(e.target.value)} data-guide="input-validade" />
              {product.categoria && !gs1Data?.isGS1 && (
                <p className="text-xs text-muted-foreground mt-1">
                  Referência: ~{getSuggestedValidityDays(product.categoria)} dias para {product.categoria}
                </p>
              )}
            </div>
            <div>
              <Label>Lote *</Label>
              <Input value={lote} onChange={(e) => setLote(e.target.value)} placeholder="Ex: L2025-001" data-guide="input-lote" />
            </div>
            <div data-guide="input-qty-receb">
              <Label>{quantityLabel} *</Label>
              <Input
                type="number"
                min="0.001"
                step="0.001"
                value={quantidade}
                onChange={(e) => setQuantidade(e.target.value)}
                placeholder={isWeightUnit ? "Ex: 12.450" : `Em ${product.unidade_medida}`}
              />
              {isWeightUnit && (
                <p className="text-xs text-muted-foreground mt-1">
                  Aceita decimais para peso real (ex: 12.450 kg)
                </p>
              )}
            </div>
            <div>
              <Label>Local de recebimento (CD) *</Label>
              <Select value={selectedUnit} onValueChange={setSelectedUnit}>
                <SelectTrigger className="bg-input border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {units
                    .filter((u) => u.type === "cd")
                    .map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.name} (CD)
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={handleReceipt} disabled={loading} data-guide="btn-confirm-receb">
              {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Confirmar Recebimento
            </Button>
            <Button variant="ghost" onClick={reset}>Cancelar</Button>
          </div>
        </div>
      )}

      {/* Success */}
      {step === "success" && (
        <div className="glass-card p-6 max-w-sm text-center space-y-4">
          <CheckCircle2 className="h-16 w-16 text-success mx-auto" />
          <h2 className="font-display font-bold text-lg text-foreground">
            Recebimento Registrado!
          </h2>
          <p className="text-sm text-muted-foreground">
            Produto: {product?.nome} · Qtd: {quantidade} {product?.unidade_medida}
          </p>
          <Button onClick={reset}>Novo Recebimento</Button>
        </div>
      )}
    </div>
  );
}
