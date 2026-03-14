import { useGuidedMode } from "@/contexts/GuidedModeContext";
import { Switch } from "@/components/ui/switch";
import { HelpCircle } from "lucide-react";

export function GuidedModeToggle() {
  const { enabled, toggleEnabled, setShowPanel } = useGuidedMode();

  return (
    <button
      onClick={() => {
        if (enabled) {
          setShowPanel(true);
        }
        toggleEnabled();
      }}
      className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border bg-card hover:bg-accent transition-colors"
    >
      <HelpCircle className="h-4 w-4 text-primary" />
      <span className="text-xs font-medium text-muted-foreground">Modo Guiado</span>
      <Switch
        checked={enabled}
        onCheckedChange={() => toggleEnabled()}
        className="scale-75"
        onClick={(e) => e.stopPropagation()}
      />
    </button>
  );
}
