import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { BarcodeScanner } from "@/components/BarcodeScanner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScanBarcode, Keyboard, Package } from "lucide-react";
import { parseGS1Barcode, type GS1Data } from "@/lib/gs1Parser";
import { ProductSearch } from "@/components/recebimento/ProductSearch";
import { RegisterProductForm } from "@/components/recebimento/RegisterProductForm";
import { ReceiptForm } from "@/components/recebimento/ReceiptForm";
import { ReceiptSuccess } from "@/components/recebimento/ReceiptSuccess";
import { RecentReceipts } from "@/components/recebimento/RecentReceipts";
import type { Product, Unit, PurchaseUnit, Step } from "@/components/recebimento/types";

export default function RecebimentoDigital() {
  const { profile } = useAuth();
  const [step, setStep] = useState<Step>("idle");
  const [barcode, setBarcode] = useState("");
  const [product, setProduct] = useState<Product | null>(null);
  const [units, setUnits] = useState<Unit[]>([]);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [purchaseUnits, setPurchaseUnits] = useState<PurchaseUnit[]>([]);
  const [gs1Data, setGs1Data] = useState<GS1Data | null>(null);
  const [defaultCdId, setDefaultCdId] = useState("");

  // Success state for continuous mode
  const [lastQuantidade, setLastQuantidade] = useState("");
  const [lastSaldo, setLastSaldo] = useState(0);

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
    if (cdUnit) setDefaultCdId(cdUnit.id);
    else if (allUnits.length > 0) setDefaultCdId(allUnits[0].id);
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

  const handleScanDetected = (code: string) => {
    const gs1 = parseGS1Barcode(code);
    const gs1Result = gs1.isGS1 ? gs1 : null;
    const normalizeBarcode = (raw: string) => raw.replace(/[^0-9]/g, "").trim() || "";
    const lookupCode = gs1.isGS1 && gs1.gtin ? normalizeBarcode(gs1.gtin) : normalizeBarcode(code);

    setGs1Data(gs1Result);
    setBarcode(lookupCode);

    supabase
      .from("products")
      .select("id, nome, marca, unidade_medida, codigo_barras, estoque_atual, unidade_id, company_id, category_id, categoria")
      .eq("codigo_barras", lookupCode)
      .eq("ativo", true)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setProduct(data as Product);
          setStep("receipt");
        } else {
          setStep("not_found");
        }
      });
  };

  const handleProductFound = (p: Product, gs1: GS1Data | null, bc: string) => {
    setProduct(p);
    setBarcode(bc);
    setGs1Data(gs1);
    setStep("receipt");
  };

  const handleReceiptSuccess = (updatedProduct: Product, quantidade: string, novoSaldo: number) => {
    setProduct(updatedProduct);
    setLastQuantidade(quantidade);
    setLastSaldo(novoSaldo);
    setStep("success");
  };

  const handleSameProduct = () => {
    // Keep product, reset receipt fields by going back to receipt step
    setGs1Data(null);
    setStep("receipt");
  };

  const reset = () => {
    setStep("idle");
    setBarcode("");
    setProduct(null);
    setGs1Data(null);
    setLastQuantidade("");
    setLastSaldo(0);
  };

  if (step === "scanning") {
    return (
      <BarcodeScanner
        onDetected={(code) => {
          setStep("idle");
          handleScanDetected(code);
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
        <>
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
          <RecentReceipts />
        </>
      )}

      {/* Manual search */}
      {step === "manual" && (
        <ProductSearch
          allProducts={allProducts}
          onProductFound={handleProductFound}
          onNotFound={(bc) => {
            setBarcode(bc);
            setStep("not_found");
          }}
          onCancel={reset}
        />
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
        <RegisterProductForm
          barcode={barcode}
          units={units}
          defaultUnitId={defaultCdId}
          onProductRegistered={(p) => {
            setProduct(p);
            setStep("receipt");
          }}
          onBack={() => setStep("not_found")}
        />
      )}

      {/* Receipt form */}
      {step === "receipt" && product && (
        <ReceiptForm
          key={`${product.id}-${Date.now()}`}
          product={product}
          barcode={barcode}
          gs1Data={gs1Data}
          units={units}
          purchaseUnits={purchaseUnits}
          defaultUnitId={defaultCdId}
          onSuccess={handleReceiptSuccess}
          onCancel={reset}
        />
      )}

      {/* Success */}
      {step === "success" && product && (
        <ReceiptSuccess
          product={product}
          quantidade={lastQuantidade}
          novoSaldo={lastSaldo}
          onNewReceipt={reset}
          onSameProduct={handleSameProduct}
        />
      )}
    </div>
  );
}
