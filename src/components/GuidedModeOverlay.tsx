import { useEffect, useState, useRef } from "react";
import { useGuidedMode } from "@/contexts/GuidedModeContext";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

export function GuidedModeOverlay() {
  const { activeTask, currentStep, currentStepIndex, totalSteps, nextStep, prevStep, exitTask, skipTutorial, enabled } =
    useGuidedMode();
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [tooltipStyle, setTooltipStyle] = useState<React.CSSProperties>({});
  const [arrowStyle, setArrowStyle] = useState<React.CSSProperties>({});
  const [arrowDir, setArrowDir] = useState<"top" | "bottom" | "left" | "right">("bottom");
  const tooltipRef = useRef<HTMLDivElement>(null);
  const retryRef = useRef<number>(0);

  useEffect(() => {
    if (!currentStep || !enabled) {
      setRect(null);
      return;
    }

    const find = () => {
      const el = document.querySelector(currentStep.selector);
      if (el) {
        const r = el.getBoundingClientRect();
        setRect(r);
        retryRef.current = 0;

        // Scroll into view if needed
        if (r.top < 0 || r.bottom > window.innerHeight) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
          // Re-measure after scroll
          setTimeout(() => setRect(el.getBoundingClientRect()), 400);
        }
      } else if (retryRef.current < 10) {
        retryRef.current++;
        setTimeout(find, 500);
      } else {
        setRect(null);
      }
    };

    // Small delay for DOM to render after navigation
    const timer = setTimeout(find, 300);
    return () => clearTimeout(timer);
  }, [currentStep, enabled]);

  // Position tooltip
  useEffect(() => {
    if (!rect || !currentStep) return;

    const pos = currentStep.position || "bottom";
    const pad = 16;
    const tooltipW = 320;
    const tooltipH = 120;
    setArrowDir(pos);

    let top = 0;
    let left = 0;

    switch (pos) {
      case "bottom":
        top = rect.bottom + pad;
        left = rect.left + rect.width / 2 - tooltipW / 2;
        break;
      case "top":
        top = rect.top - tooltipH - pad;
        left = rect.left + rect.width / 2 - tooltipW / 2;
        break;
      case "left":
        top = rect.top + rect.height / 2 - tooltipH / 2;
        left = rect.left - tooltipW - pad;
        break;
      case "right":
        top = rect.top + rect.height / 2 - tooltipH / 2;
        left = rect.right + pad;
        break;
    }

    // Clamp to viewport
    left = Math.max(8, Math.min(left, window.innerWidth - tooltipW - 8));
    top = Math.max(8, Math.min(top, window.innerHeight - tooltipH - 8));

    setTooltipStyle({ top, left, width: tooltipW });

    // Arrow
    const arrowS: React.CSSProperties = { position: "absolute" };
    switch (pos) {
      case "bottom":
        arrowS.top = -8;
        arrowS.left = "50%";
        arrowS.transform = "translateX(-50%)";
        break;
      case "top":
        arrowS.bottom = -8;
        arrowS.left = "50%";
        arrowS.transform = "translateX(-50%) rotate(180deg)";
        break;
      case "left":
        arrowS.right = -8;
        arrowS.top = "50%";
        arrowS.transform = "translateY(-50%) rotate(90deg)";
        break;
      case "right":
        arrowS.left = -8;
        arrowS.top = "50%";
        arrowS.transform = "translateY(-50%) rotate(-90deg)";
        break;
    }
    setArrowStyle(arrowS);
  }, [rect, currentStep]);

  if (!enabled || !activeTask || !currentStep) return null;

  return (
    <>
      {/* Backdrop with cutout */}
      <div className="fixed inset-0 z-[70] pointer-events-none">
        <svg className="absolute inset-0 w-full h-full">
          <defs>
            <mask id="guided-mask">
              <rect x="0" y="0" width="100%" height="100%" fill="white" />
              {rect && (
                <rect
                  x={rect.left - 6}
                  y={rect.top - 6}
                  width={rect.width + 12}
                  height={rect.height + 12}
                  rx="8"
                  fill="black"
                />
              )}
            </mask>
          </defs>
          <rect
            x="0"
            y="0"
            width="100%"
            height="100%"
            fill="hsl(240 3% 5% / 0.7)"
            mask="url(#guided-mask)"
          />
        </svg>

        {/* Highlight ring */}
        {rect && (
          <div
            className="absolute border-2 border-primary rounded-lg shadow-[0_0_0_4px_hsl(350_95%_43%/0.2)] pointer-events-none animate-pulse"
            style={{
              top: rect.top - 6,
              left: rect.left - 6,
              width: rect.width + 12,
              height: rect.height + 12,
            }}
          />
        )}
      </div>

      {/* Allow clicks on the highlighted element */}
      {rect && (
        <div
          className="fixed z-[71]"
          style={{
            top: rect.top,
            left: rect.left,
            width: rect.width,
            height: rect.height,
            pointerEvents: "auto",
          }}
        />
      )}

      {/* Tooltip */}
      <div
        ref={tooltipRef}
        className="fixed z-[72] bg-card border border-border rounded-xl shadow-2xl p-4 animate-in fade-in zoom-in-95 duration-200"
        style={tooltipStyle}
      >
        {/* Arrow */}
        <div style={arrowStyle}>
          <svg width="16" height="8" viewBox="0 0 16 8">
            <polygon points="8,0 16,8 0,8" fill="hsl(var(--card))" stroke="hsl(var(--border))" strokeWidth="1" />
          </svg>
        </div>

        <div className="flex items-start justify-between gap-2 mb-3">
          <div>
            <p className="text-xs font-semibold text-primary">
              {activeTask.emoji} {activeTask.label}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Passo {currentStepIndex + 1} de {totalSteps}
            </p>
          </div>
          <button onClick={exitTask} className="text-muted-foreground hover:text-foreground flex-shrink-0">
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="text-sm text-foreground leading-relaxed mb-3">{currentStep.instruction}</p>

        {/* Progress bar */}
        <div className="w-full h-1 bg-muted rounded-full mb-3 overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-300"
            style={{ width: `${((currentStepIndex + 1) / totalSteps) * 100}%` }}
          />
        </div>

        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={prevStep}
            disabled={currentStepIndex === 0}
            className="h-7 text-xs gap-1"
          >
            <ChevronLeft className="h-3 w-3" />
            Anterior
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={skipTutorial}
            className="h-7 text-xs text-muted-foreground hover:text-foreground"
          >
            Pular tutorial
          </Button>
          <Button size="sm" onClick={nextStep} className="h-7 text-xs gap-1">
            {currentStepIndex === totalSteps - 1 ? "Concluir" : "Próximo"}
            {currentStepIndex < totalSteps - 1 && <ChevronRight className="h-3 w-3" />}
          </Button>
        </div>
      </div>
    </>
  );
}
