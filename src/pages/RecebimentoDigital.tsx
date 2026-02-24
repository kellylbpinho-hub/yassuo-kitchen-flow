import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { BarcodeScanner } from "@/components/BarcodeScanner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScanBarcode, Keyboard, Package, Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

interface Product {
  id: string;
  nome: string;
  unidade_medida: string;
  codigo_barras: string | null;
  estoque_atual: number;
  unidade_id: string;
  company_id: string;
  category_id: string | null;
}

interface Unit {
  id: string;
  name: string;
  type: string;
}

type Step = "idle" | "scanning" | "manual" | "found" | "not_found" | "register" | "receipt" | "success";

export default function RecebimentoDigital() {
  const { user, profile } = useAuth();
  const [step, setStep] = useState<Step>("idle");
  const [barcode, setBarcode] = useState("");
  const [manualCode, setManualCode] = useState("");
  const [product, setProduct] = useState<Product | null>(null);
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(false);

  // Receipt form
  const [validade, setValidade] = useState("");
  const [lote, setLote] = useState("");
  const [quantidade, setQuantidade] = useState("");
  const [selectedUnit, setSelectedUnit] = useState("");

  // Register product form
  const [newName, setNewName] = useState("");
  const [newUnidadeMedida, setNewUnidadeMedida] = useState("kg");
  const [newUnit, setNewUnit] = useState("");
  const [newCategoria, setNewCategoria] = useState("");

  const CATEGORIAS_FIXAS = ["Grãos", "Proteínas", "Laticínios", "Hortifruti", "Bebidas", "Descartáveis", "Limpeza", "Temperos", "Outros"];

  useEffect(() => {
    loadUnits();
  }, []);

  const loadUnits = async () => {
    const { data } = await supabase.from("units").select("id, name, type");
    const allUnits = (data || []) as Unit[];
    setUnits(allUnits);
    // Default to CD units for receiving
    const cdUnit = allUnits.find((u) => u.type === "cd");
    if (cdUnit) {
      setSelectedUnit(cdUnit.id);
      setNewUnit(cdUnit.id);
    } else if (allUnits.length > 0) {
      setSelectedUnit(allUnits[0].id);
      setNewUnit(allUnits[0].id);
    }
  };

  // Normalize barcode: strip non-digits + trim
  const normalizeBarcode = (raw: string) => raw.replace(/[^0-9]/g, "").trim() || "";

  const lookupBarcode = async (code: string) => {
    const normalized = normalizeBarcode(code);
    setBarcode(normalized);
    setLoading(true);

    // Search by normalized barcode within user's company (RLS handles company filtering)
    const { data } = await supabase
      .from("products")
      .select("*")
      .eq("codigo_barras", normalized)
      .eq("ativo", true)
      .maybeSingle();

    setLoading(false);
    if (data) {
      setProduct(data as Product);
      setStep("receipt");
    } else {
      setStep("not_found");
    }
  };

  const handleManualSubmit = () => {
    const code = manualCode.trim();
    if (!code) {
      toast.error("Digite um código de barras.");
      return;
    }
    lookupBarcode(code);
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
      p_codigo_barras: barcode,
    });

    if (error) {
      toast.error("Erro ao cadastrar: " + error.message);
      setLoading(false);
      return;
    }
    const result = data as any;
    // Update categoria text field
    if (result?.id && !result?.already_existed) {
      await supabase.from("products").update({ categoria: newCategoria }).eq("id", result.id);
    }
    setProduct(result as Product);
    setStep("receipt");
    setLoading(false);
    if (result.already_existed) {
      toast.info("Produto já existente encontrado. Prossiga com o recebimento.");
    } else {
      toast.success("Produto cadastrado!");
    }
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
      // Parse Postgres exception messages for user-friendly display
      const msg = error.message || "Erro desconhecido";
      toast.error(msg);
      return;
    }

    // Update local product state with new stock from RPC response
    if (data && product) {
      setProduct({ ...product, estoque_atual: (data as any).novo_estoque_atual });
    }

    setStep("success");
    toast.success("Recebimento registrado com sucesso!");
  };

  const reset = () => {
    setStep("idle");
    setBarcode("");
    setManualCode("");
    setProduct(null);
    setValidade("");
    setLote("");
    setQuantidade("");
    setNewName("");
    setNewUnidadeMedida("kg");
    setNewCategoria("");
  };

  // Scanning modal
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

      {/* Idle: action buttons */}
      {step === "idle" && (
        <div className="grid gap-4 sm:grid-cols-2 max-w-lg">
          <Button
            className="h-24 text-lg gap-3"
            onClick={() => setStep("scanning")}
          >
            <ScanBarcode className="h-7 w-7" />
            Escanear código de barras
          </Button>
          <Button
            variant="outline"
            className="h-24 text-lg gap-3"
            onClick={() => setStep("manual")}
          >
            <Keyboard className="h-7 w-7" />
            Digitar código manualmente
          </Button>
        </div>
      )}

      {/* Manual entry */}
      {step === "manual" && (
        <div className="glass-card p-6 max-w-sm space-y-4">
          <Label>Código de barras</Label>
          <Input
            placeholder="Ex: 7891234567890"
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value)}
            inputMode="numeric"
            autoFocus
          />
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
          <p className="text-sm text-muted-foreground">
            Código: <Badge variant="secondary">{barcode}</Badge>
          </p>
          <div className="flex gap-2">
            <Button onClick={() => setStep("register")}>
              Cadastrar produto
            </Button>
            <Button variant="ghost" onClick={reset}>
              Voltar
            </Button>
          </div>
        </div>
      )}

      {/* Register new product */}
      {step === "register" && (
        <div className="glass-card p-6 max-w-md space-y-4">
          <h2 className="font-display font-bold text-foreground">
            Cadastrar Produto
          </h2>
          <p className="text-xs text-muted-foreground">
            Código: <Badge variant="secondary">{barcode}</Badge>
          </p>
          <div className="space-y-3">
            <div>
              <Label>Código de barras</Label>
              <Input value={barcode} readOnly className="bg-muted" />
            </div>
            <div>
              <Label>Nome do produto *</Label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} autoFocus />
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
            <Button variant="ghost" onClick={() => setStep("not_found")}>
              Voltar
            </Button>
          </div>
        </div>
      )}

      {/* Receipt form */}
      {step === "receipt" && product && (
        <div className="glass-card p-6 max-w-md space-y-4">
          <h2 className="font-display font-bold text-foreground">
            Recebimento
          </h2>
          <div className="bg-accent/50 rounded-lg p-3 space-y-1">
            <p className="text-sm font-medium text-foreground">{product.nome}</p>
            <p className="text-xs text-muted-foreground">
              Código: {barcode} · Medida: {product.unidade_medida}
            </p>
          </div>

          <div className="space-y-3">
            <div>
              <Label>Validade *</Label>
              <Input type="date" value={validade} onChange={(e) => setValidade(e.target.value)} />
            </div>
            <div>
              <Label>Lote *</Label>
              <Input value={lote} onChange={(e) => setLote(e.target.value)} placeholder="Ex: L2025-001" />
            </div>
            <div>
              <Label>Quantidade recebida *</Label>
              <Input
                type="number"
                min="0.01"
                step="0.01"
                value={quantidade}
                onChange={(e) => setQuantidade(e.target.value)}
                placeholder={`Em ${product.unidade_medida}`}
              />
            </div>
            <div>
              <Label>Local de recebimento (CD/Unidade) *</Label>
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
            <Button onClick={handleReceipt} disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Confirmar Recebimento
            </Button>
            <Button variant="ghost" onClick={reset}>
              Cancelar
            </Button>
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
