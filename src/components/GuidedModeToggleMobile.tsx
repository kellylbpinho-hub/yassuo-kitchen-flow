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
      className="relative text-primary hover:text-primary/80 transition-colors p-1"
      title="Modo Guiado"
      aria-label="Modo Guiado"
    >
      <HelpCircle className="h-5 w-5" />
      {enabled && (
        <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-primary animate-pulse ring-2 ring-card" />
      )}
    </button>
  );
}
