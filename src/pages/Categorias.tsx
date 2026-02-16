import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Loader2, Pencil, Trash2, Tag } from "lucide-react";
import { toast } from "sonner";

interface Category {
  id: string;
  name: string;
  company_id: string;
  created_at: string;
}

export default function Categorias() {
  const { profile, canManage } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [editCat, setEditCat] = useState<Category | null>(null);
  const [name, setName] = useState("");

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    const { data } = await supabase.from("product_categories").select("*").order("name");
    setCategories((data || []) as Category[]);
    setLoading(false);
  };

  const createCategory = async () => {
    if (!name.trim()) { toast.error("Informe o nome da categoria."); return; }
    const { error } = await supabase.from("product_categories").insert({
      name: name.trim(),
      company_id: profile!.company_id,
    });
    if (error) {
      if (error.message.includes("duplicate")) toast.error("Categoria já existe.");
      else toast.error("Erro: " + error.message);
    } else {
      toast.success("Categoria criada!");
      setCreateOpen(false);
      setName("");
      loadData();
    }
  };

  const updateCategory = async () => {
    if (!editCat || !name.trim()) return;
    const { error } = await supabase.from("product_categories").update({ name: name.trim() }).eq("id", editCat.id);
    if (error) {
      if (error.message.includes("duplicate")) toast.error("Categoria já existe.");
      else toast.error("Erro: " + error.message);
    } else {
      toast.success("Categoria atualizada!");
      setEditCat(null);
      setName("");
      loadData();
    }
  };

  const deleteCategory = async (cat: Category) => {
    if (!confirm(`Excluir categoria "${cat.name}"?`)) return;
    const { error } = await supabase.from("product_categories").delete().eq("id", cat.id);
    if (error) toast.error("Erro ao excluir: " + error.message);
    else { toast.success("Categoria excluída!"); loadData(); }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-display font-bold text-foreground">Categorias de Produtos</h1>
        {canManage && (
          <Dialog open={createOpen} onOpenChange={(open) => { setCreateOpen(open); if (!open) setName(""); }}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" />Nova Categoria</Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-border max-w-sm">
              <DialogHeader>
                <DialogTitle className="font-display">Nova Categoria</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>Nome *</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} className="bg-input border-border" placeholder="Ex: Padaria" />
                </div>
                <Button onClick={createCategory} className="w-full">Criar Categoria</Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Edit dialog */}
      <Dialog open={!!editCat} onOpenChange={(open) => { if (!open) { setEditCat(null); setName(""); } }}>
        <DialogContent className="bg-card border-border max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display">Editar Categoria</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nome *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} className="bg-input border-border" />
            </div>
            <Button onClick={updateCategory} className="w-full">Salvar</Button>
          </div>
        </DialogContent>
      </Dialog>

      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead>Categoria</TableHead>
                {canManage && <TableHead className="w-28">Ações</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {categories.length === 0 ? (
                <TableRow><TableCell colSpan={2} className="text-center text-muted-foreground py-8">Nenhuma categoria cadastrada.</TableCell></TableRow>
              ) : (
                categories.map((cat) => (
                  <TableRow key={cat.id} className="border-border">
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <Tag className="h-4 w-4 text-muted-foreground" />
                        {cat.name}
                      </div>
                    </TableCell>
                    {canManage && (
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="sm" onClick={() => { setEditCat(cat); setName(cat.name); }}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => deleteCategory(cat)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
