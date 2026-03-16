import { useGuidedMode } from "@/contexts/GuidedModeContext";
import { HelpCircle } from "lucide-react";

export function GuidedModeToggleMobile() {
  const { enabled, toggleEnabled, setShowPanel } = useGuidedMode();

  return (
    <button
      onClick={() => {
        if (enabled) {
          setShowPanel(true);
        } else {
          toggleEnabled();
        }
      }}
      className="relative text-muted-foreground hover:text-foreground transition-colors p-1"
      title="Modo Guiado"
    >
      <HelpCircle className="h-5 w-5" />
      {enabled && (
        <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-primary" />
      )}
    </button>
  );
}
