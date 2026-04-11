import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, CheckCircle, AlertTriangle, Plus, Trash2, Send } from "lucide-react";
import { toast } from "sonner";

interface QuotationItem {
  id: string;
  nome_produto: string;
  unidade_medida: string;
  quantidade: number;
  preco_unitario: number | null;
  observacao_fornecedor: string;
}

interface NewItem {
  nome_produto: string;
  unidade_medida: string;
  quantidade: string;
  preco_unitario: string;
}

const EMPTY_NEW_ITEM: NewItem = { nome_produto: "", unidade_medida: "kg", quantidade: "", preco_unitario: "" };

export default function CotacaoPublica() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fornecedorNome, setFornecedorNome] = useState("");
  const [observacao, setObservacao] = useState("");
  const [items, setItems] = useState<QuotationItem[]>([]);
  const [newItems, setNewItems] = useState<NewItem[]>([]);
  const [quotationId, setQuotationId] = useState("");

  const baseUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/quotation-public`;

  useEffect(() => {
    if (!token) return;
    fetch(`${baseUrl}?token=${token}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
        } else {
          setQuotationId(data.quotation_id);
          setFornecedorNome(data.fornecedor_nome);
          setObservacao(data.observacao || "");
          setItems(
            (data.items || []).map((i: any) => ({
              ...i,
              preco_unitario: null,
              observacao_fornecedor: "",
            }))
          );
        }
        setLoading(false);
      })
      .catch(() => {
        setError("Erro ao carregar cotação");
        setLoading(false);
      });
  }, [token]);

  const updateItemPrice = (idx: number, value: string) => {
    setItems((prev) =>
      prev.map((item, i) =>
        i === idx ? { ...item, preco_unitario: value ? Number(value) : null } : item
      )
    );
  };

  const updateItemObs = (idx: number, value: string) => {
    setItems((prev) =>
      prev.map((item, i) =>
        i === idx ? { ...item, observacao_fornecedor: value } : item
      )
    );
  };

  const addNewItem = () => setNewItems((prev) => [...prev, { ...EMPTY_NEW_ITEM }]);

  const updateNewItem = (idx: number, field: keyof NewItem, value: string) => {
    setNewItems((prev) => prev.map((ni, i) => (i === idx ? { ...ni, [field]: value } : ni)));
  };

  const removeNewItem = (idx: number) => {
    setNewItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async () => {
    const missingPrices = items.some((i) => i.preco_unitario === null || i.preco_unitario <= 0);
    if (missingPrices) {
      toast.error("Preencha o preço unitário de todos os itens");
      return;
    }

    for (const ni of newItems) {
      if (!ni.nome_produto || !ni.quantidade || !ni.preco_unitario) {
        toast.error("Preencha todos os campos dos itens adicionais");
        return;
      }
    }

    setSubmitting(true);
    try {
      const res = await fetch(`${baseUrl}?token=${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quotation_id: quotationId,
          items: items.map((i) => ({
            id: i.id,
            preco_unitario: i.preco_unitario,
            observacao_fornecedor: i.observacao_fornecedor || null,
          })),
          new_items: newItems
            .filter((ni) => ni.nome_produto && ni.quantidade && ni.preco_unitario)
            .map((ni) => ({
              nome_produto: ni.nome_produto,
              unidade_medida: ni.unidade_medida,
              quantidade: Number(ni.quantidade),
              preco_unitario: Number(ni.preco_unitario),
            })),
        }),
      });
      const data = await res.json();
      if (data.error) {
        toast.error(data.error);
      } else {
        setSubmitted(true);
      }
    } catch {
      toast.error("Erro ao enviar cotação");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center space-y-4 max-w-md">
          <AlertTriangle className="h-16 w-16 text-destructive mx-auto" />
          <h1 className="text-xl font-bold text-foreground">{error}</h1>
          <p className="text-muted-foreground">
            Este link pode ter expirado ou já foi respondido.
          </p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center space-y-4 max-w-md">
          <CheckCircle className="h-16 w-16 text-success mx-auto" />
          <h1 className="text-xl font-bold text-foreground">Cotação Enviada!</h1>
          <p className="text-muted-foreground">
            Seus preços foram registrados. O comprador irá analisar sua proposta.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto p-4 sm:p-6 space-y-6">
        {/* Header */}
        <div className="text-center space-y-2 pt-6">
          <h1 className="text-2xl font-bold text-foreground">Cotação de Preços</h1>
          <p className="text-muted-foreground">
            Olá, <span className="font-medium text-foreground">{fornecedorNome}</span>
          </p>
          {observacao && (
            <p className="text-sm text-muted-foreground bg-card p-3 rounded-lg border border-border">
              {observacao}
            </p>
          )}
        </div>

        {/* Items */}
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">Itens para Cotação</h2>
          {items.map((item, idx) => (
            <div key={item.id} className="bg-card border border-border rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-foreground">{item.nome_produto}</p>
                  <p className="text-sm text-muted-foreground">
                    {item.quantidade} {item.unidade_medida}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Preço Unitário (R$) *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0,00"
                    value={item.preco_unitario ?? ""}
                    onChange={(e) => updateItemPrice(idx, e.target.value)}
                    className="bg-input border-border"
                  />
                </div>
                <div>
                  <Label className="text-xs">Observação</Label>
                  <Input
                    placeholder="Opcional"
                    value={item.observacao_fornecedor}
                    onChange={(e) => updateItemObs(idx, e.target.value)}
                    className="bg-input border-border"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* New items from supplier */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">Itens Adicionais</h2>
            <Button variant="outline" size="sm" onClick={addNewItem}>
              <Plus className="h-4 w-4 mr-1" /> Adicionar Item
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            Deseja sugerir produtos que não estão na lista?
          </p>
          {newItems.map((ni, idx) => (
            <div key={idx} className="bg-card border border-border rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-muted-foreground">Item adicional #{idx + 1}</p>
                <Button variant="ghost" size="icon" onClick={() => removeNewItem(idx)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <Label className="text-xs">Nome do Produto *</Label>
                  <Input
                    value={ni.nome_produto}
                    onChange={(e) => updateNewItem(idx, "nome_produto", e.target.value)}
                    className="bg-input border-border"
                    placeholder="Ex: Arroz Branco Tipo 1"
                  />
                </div>
                <div>
                  <Label className="text-xs">Unidade</Label>
                  <Input
                    value={ni.unidade_medida}
                    onChange={(e) => updateNewItem(idx, "unidade_medida", e.target.value)}
                    className="bg-input border-border"
                    placeholder="kg"
                  />
                </div>
                <div>
                  <Label className="text-xs">Quantidade *</Label>
                  <Input
                    type="number"
                    min="0"
                    value={ni.quantidade}
                    onChange={(e) => updateNewItem(idx, "quantidade", e.target.value)}
                    className="bg-input border-border"
                  />
                </div>
                <div className="col-span-2">
                  <Label className="text-xs">Preço Unitário (R$) *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={ni.preco_unitario}
                    onChange={(e) => updateNewItem(idx, "preco_unitario", e.target.value)}
                    className="bg-input border-border"
                    placeholder="0,00"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Submit */}
        <Button
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full h-12 text-base"
          size="lg"
        >
          {submitting ? (
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
          ) : (
            <Send className="h-5 w-5 mr-2" />
          )}
          Enviar Cotação
        </Button>

        <p className="text-center text-xs text-muted-foreground pb-6">
          Powered by Yassuo Kitchen Flow
        </p>
      </div>
    </div>
  );
}
