import { Loader2, CalendarDays } from "lucide-react";

export default function CardapioSemanal() {
  return (
    <div className="space-y-6 animate-fade-in">
      <h1 className="text-2xl font-display font-bold text-foreground">Cardápio Semanal</h1>
      <div className="glass-card p-8 text-center text-muted-foreground">
        <CalendarDays className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p>Em breve: monte o cardápio semanal item a item com ficha nutricional e custos.</p>
      </div>
    </div>
  );
}
