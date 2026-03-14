import { useGuidedMode } from "@/contexts/GuidedModeContext";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

export function GuidedModePanel() {
  const { showPanel, setShowPanel, availableTasks, startTask, enabled } = useGuidedMode();

  if (!enabled || !showPanel) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-background/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-md mx-4 rounded-2xl border border-border bg-card p-6 shadow-2xl animate-in zoom-in-95 duration-200">
        <button
          onClick={() => setShowPanel(false)}
          className="absolute top-3 right-3 text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="text-center mb-5">
          <h2 className="text-lg font-bold text-foreground">O que você quer fazer?</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Escolha uma ação e eu guio você passo a passo.
          </p>
        </div>

        <div className="grid gap-2">
          {availableTasks.map((task) => (
            <Button
              key={task.id}
              variant="outline"
              className="w-full justify-start gap-3 h-12 text-sm font-medium hover:border-primary/50 hover:bg-primary/5 transition-all"
              onClick={() => startTask(task.id)}
            >
              <span className="text-lg">{task.emoji}</span>
              <span>{task.label}</span>
            </Button>
          ))}
        </div>

        {availableTasks.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">
            Nenhuma ação disponível para seu perfil.
          </p>
        )}
      </div>
    </div>
  );
}
