import { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search, ShieldCheck, ShieldX, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { fuzzyMatch } from "@/lib/fuzzySearch";

interface Product {
  id: string;
  nome: string;
  category_name?: string;
}

interface Unit {
  id: string;
  name: string;
  type: string;
}

interface Rule {
  id: string;
  unit_id: string;
  product_id: string;
  status: string;
}

export default function Categorias() {
  const { profile, isCeo, isGerenteOperacional } = useAuth();
  const canEdit = isCeo || isGerenteOperacional;

  const [products, setProducts] = useState<Product[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUnitId, setSelectedUnitId] = useState("");
  const [search, setSearch] = useState("");
  const [toggling, setToggling] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const [productsRes, unitsRes, rulesRes] = await Promise.all([
      supabase
        .from("products")
        .select("id, nome, product_categories(name)")
        .eq("ativo", true)
        .order("nome"),
      supabase.from("units").select("id, name, type").order("name"),
      supabase.from("unit_product_rules").select("id, unit_id, product_id, status"),
    ]);

    const prods = (productsRes.data || []).map((p: any) => ({
      id: p.id,
      nome: p.nome,
      category_name: p.product_categories?.name || undefined,
    }));
    setProducts(prods);

    const allUnits = (unitsRes.data || []) as Unit[];
    setUnits(allUnits);

    // Default to first kitchen
    const kitchens = allUnits.filter((u) => u.type === "kitchen");
    if (kitchens.length > 0 && !selectedUnitId) {
      setSelectedUnitId(kitchens[0].id);
    }

    setRules((rulesRes.data || []) as Rule[]);
    setLoading(false);
  };

  const kitchenUnits = useMemo(() => units.filter((u) => u.type === "kitchen"), [units]);

  const rulesForUnit = useMemo(
    () => rules.filter((r) => r.unit_id === selectedUnitId),
    [rules, selectedUnitId]
  );

  const filteredProducts = useMemo(() => {
    let list = products;
    if (search.trim()) {
      list = list.filter(
        (p) => fuzzyMatch(p.nome, search) || (p.category_name && fuzzyMatch(p.category_name, search))
      );
    }
    return list;
  }, [products, search]);

  const getStatus = (productId: string): "permitido" | "bloqueado" => {
    const rule = rulesForUnit.find((r) => r.product_id === productId);
    return rule?.status === "bloqueado" ? "bloqueado" : "permitido";
  };

  const blockedCount = useMemo(
    () => rulesForUnit.filter((r) => r.status === "bloqueado").length,
    [rulesForUnit]
  );

  const toggleRule = async (productId: string) => {
    if (!selectedUnitId || !profile) return;
    setToggling(productId);

    const existing = rulesForUnit.find((r) => r.product_id === productId);

    if (existing) {
      // If blocked → remove rule (= permitido)
      if (existing.status === "bloqueado") {
        const { error } = await supabase
          .from("unit_product_rules")
          .delete()
          .eq("id", existing.id);
        if (error) {
          toast.error("Erro ao desbloquear: " + error.message);
        } else {
          toast.success("Produto desbloqueado para esta unidade.");
          setRules((prev) => prev.filter((r) => r.id !== existing.id));
        }
      }
    } else {
      // No rule → create as bloqueado
      const { data, error } = await supabase
        .from("unit_product_rules")
        .insert({
          unit_id: selectedUnitId,
          product_id: productId,
          status: "bloqueado",
          company_id: profile.company_id,
          created_by: profile.user_id,
        })
        .select("id, unit_id, product_id, status")
        .single();
      if (error) {
        toast.error("Erro ao bloquear: " + error.message);
      } else {
        toast.success("Produto bloqueado para esta unidade.");
        setRules((prev) => [...prev, data as Rule]);
      }
    }
    setToggling(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Controle de Contrato</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gerencie quais produtos são permitidos ou bloqueados por unidade.
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="w-full sm:w-64">
          <Select value={selectedUnitId} onValueChange={setSelectedUnitId}>
            <SelectTrigger className="bg-input border-border">
              <SelectValue placeholder="Selecionar Unidade" />
            </SelectTrigger>
            <SelectContent>
              {kitchenUnits.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar produto ou categoria..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Summary */}
      {selectedUnitId && (
        <div className="flex items-center gap-3 text-sm">
          <Badge variant="outline" className="gap-1.5">
            <ShieldAlert className="h-3.5 w-3.5" />
            {blockedCount} bloqueado{blockedCount !== 1 ? "s" : ""}
          </Badge>
          <span className="text-muted-foreground">
            {filteredProducts.length} produto{filteredProducts.length !== 1 ? "s" : ""}
          </span>
        </div>
      )}

      {!selectedUnitId ? (
        <div className="glass-card p-8 text-center text-muted-foreground">
          Selecione uma unidade para visualizar o controle de contrato.
        </div>
      ) : (
        <div className="glass-card overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead>Produto</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead className="w-32">Status</TableHead>
                  {canEdit && <TableHead className="w-32">Ação</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProducts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={canEdit ? 4 : 3} className="text-center text-muted-foreground py-8">
                      Nenhum produto encontrado.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredProducts.map((p) => {
                    const status = getStatus(p.id);
                    const isBlocked = status === "bloqueado";
                    return (
                      <TableRow key={p.id} className="border-border">
                        <TableCell className="font-medium">{p.nome}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {p.category_name || "—"}
                        </TableCell>
                        <TableCell>
                          {isBlocked ? (
                            <Badge variant="destructive" className="gap-1">
                              <ShieldX className="h-3 w-3" />
                              Bloqueado
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="gap-1 text-success border-success/30">
                              <ShieldCheck className="h-3 w-3" />
                              Permitido
                            </Badge>
                          )}
                        </TableCell>
                        {canEdit && (
                          <TableCell>
                            <Button
                              variant={isBlocked ? "outline" : "destructive"}
                              size="sm"
                              disabled={toggling === p.id}
                              onClick={() => toggleRule(p.id)}
                            >
                              {toggling === p.id ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : isBlocked ? (
                                "Desbloquear"
                              ) : (
                                "Bloquear"
                              )}
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
}
