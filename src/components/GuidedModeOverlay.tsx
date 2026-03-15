import { useEffect, useState, useRef, useCallback } from "react";
import { useGuidedMode } from "@/contexts/GuidedModeContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, X, Check } from "lucide-react";
import type { GuidedStep } from "@/lib/guidedSteps";

export function GuidedModeOverlay() {
  const { activeTask, currentStep, currentStepIndex, totalSteps, nextStep, prevStep, exitTask, skipTutorial, enabled } =
    useGuidedMode();

  const isMobile = useIsMobile();

  const [rect, setRect] = useState<DOMRect | null>(null);
  const [tooltipStyle, setTooltipStyle] = useState<React.CSSProperties>({});
  const [arrowStyle, setArrowStyle] = useState<React.CSSProperties>({});
  const [stepCompleted, setStepCompleted] = useState(false);
  const [waitingSubmitSuccess, setWaitingSubmitSuccess] = useState(false);
  const [elementMissing, setElementMissing] = useState(false);
  const [compactMode, setCompactMode] = useState(false);

  const retryRef = useRef<number>(0);
  const advanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const viewedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const baselineValueRef = useRef<string>("");
  const selectArmedRef = useRef<boolean>(false);
  const submitClickedRef = useRef<boolean>(false);
  const tooltipRef = useRef<HTMLDivElement | null>(null);

  const clearTimers = () => {
    if (advanceTimerRef.current) {
      clearTimeout(advanceTimerRef.current);
      advanceTimerRef.current = null;
    }
    if (viewedTimerRef.current) {
      clearTimeout(viewedTimerRef.current);
      viewedTimerRef.current = null;
    }
  };

  const getStepRootElement = useCallback((step: GuidedStep | null) => {
    if (!step) return null;
    return document.querySelector(step.selector);
  }, []);

  const getCompletionSourceElement = useCallback((step: GuidedStep, root: Element | null) => {
    if (step.completionSelector) {
      return document.querySelector(step.completionSelector);
    }
    return root;
  }, []);

  const readFieldValue = useCallback(
    (step: GuidedStep, root: Element | null): string => {
      const source = getCompletionSourceElement(step, root);
      if (!source) return "";

      const datasetValue = source.getAttribute("data-guide-value");
      if (datasetValue !== null) return datasetValue;

      if (source instanceof HTMLInputElement || source instanceof HTMLTextAreaElement || source instanceof HTMLSelectElement) {
        return source.value ?? "";
      }

      const innerWithData = source.querySelector("[data-guide-value]");
      if (innerWithData) {
        return innerWithData.getAttribute("data-guide-value") ?? "";
      }

      const innerInput = source.querySelector("input, textarea, select") as
        | HTMLInputElement
        | HTMLTextAreaElement
        | HTMLSelectElement
        | null;
      if (innerInput) {
        return innerInput.value ?? "";
      }

      return (source.textContent || "").trim();
    },
    [getCompletionSourceElement]
  );

  const checkNumericGtZero = useCallback(
    (step: GuidedStep, root: Element | null) => {
      const source = getCompletionSourceElement(step, root);
      if (!source) return false;

      const numericInputs = source.querySelectorAll<HTMLInputElement>("input[type='number'], input");
      if (numericInputs.length > 0) {
        const hasPositive = Array.from(numericInputs).some((input) => {
          const n = parseFloat((input.value || "").replace(",", "."));
          return Number.isFinite(n) && n > 0;
        });
        if (hasPositive) return true;
      }

      const raw = readFieldValue(step, root);
      const n = parseFloat(raw.replace(",", "."));
      return Number.isFinite(n) && n > 0;
    },
    [getCompletionSourceElement, readFieldValue]
  );

  const completeStep = useCallback(() => {
    if (stepCompleted || !currentStep) return;
    setStepCompleted(true);
    const delay = currentStep.advanceDelay ?? 550;
    advanceTimerRef.current = setTimeout(() => {
      nextStep();
    }, delay);
  }, [stepCompleted, currentStep, nextStep]);

  // Reset per-step state
  useEffect(() => {
    clearTimers();
    setStepCompleted(false);
    setWaitingSubmitSuccess(false);
    setElementMissing(false);
    setCompactMode(false);
    selectArmedRef.current = false;
    submitClickedRef.current = false;

    const root = getStepRootElement(currentStep);
    baselineValueRef.current = currentStep && root ? readFieldValue(currentStep, root) : "";
  }, [currentStepIndex, activeTask?.id, currentStep, getStepRootElement, readFieldValue]);

  // Find and track target element (scroll + highlight)
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
        setElementMissing(false);
        retryRef.current = 0;

        if (r.top < 0 || r.bottom > window.innerHeight) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
          setTimeout(() => {
            const newRect = el.getBoundingClientRect();
            setRect(newRect);
          }, 400);
        }
      } else if (retryRef.current < 12) {
        retryRef.current++;
        setTimeout(find, 400);
      } else {
        setRect(null);
        setElementMissing(true);
      }
    };

    const timer = setTimeout(find, 250);
    return () => clearTimeout(timer);
  }, [currentStep, enabled]);

  // Auto-skip optional step when element does not exist
  useEffect(() => {
    if (!currentStep || !elementMissing || !currentStep.optional || stepCompleted) return;
    completeStep();
  }, [currentStep, elementMissing, stepCompleted, completeStep]);

  // Value-based completion checker (field/select/numeric)
  useEffect(() => {
    if (!currentStep || !enabled || stepCompleted) return;

    const type = currentStep.completionType;
    if (!["field_filled", "select_chosen", "numeric_gt_zero"].includes(type)) return;

    const evaluate = () => {
      const root = getStepRootElement(currentStep);
      if (!root) return;

      if (type === "field_filled") {
        if (readFieldValue(currentStep, root).trim().length > 0) {
          completeStep();
        }
        return;
      }

      if (type === "numeric_gt_zero") {
        if (checkNumericGtZero(currentStep, root)) {
          completeStep();
        }
        return;
      }

      if (type === "select_chosen") {
        const currentValue = readFieldValue(currentStep, root).trim();
        const changedFromBaseline = currentValue.length > 0 && currentValue !== baselineValueRef.current;
        if (changedFromBaseline) {
          completeStep();
        }
      }
    };

    evaluate();
    const interval = setInterval(evaluate, 250);
    return () => clearInterval(interval);
  }, [currentStep, enabled, stepCompleted, getStepRootElement, readFieldValue, checkNumericGtZero, completeStep]);

  // Click-based completion and select option tracking
  useEffect(() => {
    if (!currentStep || !enabled || stepCompleted) return;

    const handleClick = (event: Event) => {
      const root = getStepRootElement(currentStep);
      const target = event.target as Element | null;
      if (!root || !target) return;

      const isInsideStep = root.contains(target);
      const optionNode = target.closest('[role="option"]');

      if (currentStep.completionType === "button_clicked" && isInsideStep) {
        completeStep();
        return;
      }

      if (currentStep.completionType === "select_chosen") {
        if (isInsideStep) {
          selectArmedRef.current = true;
        }
        if (selectArmedRef.current && optionNode) {
          completeStep();
        }
        return;
      }

      if (currentStep.completionType === "submit_success" && isInsideStep) {
        submitClickedRef.current = true;
        setWaitingSubmitSuccess(true);
      }
    };

    document.addEventListener("click", handleClick, { capture: true });
    return () => document.removeEventListener("click", handleClick, { capture: true });
  }, [currentStep, enabled, stepCompleted, getStepRootElement, completeStep]);

  // Submit success completion (requires click + success event)
  useEffect(() => {
    if (!currentStep || !enabled || stepCompleted || currentStep.completionType !== "submit_success") return;
    if (!currentStep.successEvent) return;

    const onSuccess = () => {
      if (!submitClickedRef.current) return;
      completeStep();
    };

    window.addEventListener(currentStep.successEvent, onSuccess as EventListener);
    return () => window.removeEventListener(currentStep.successEvent!, onSuccess as EventListener);
  }, [currentStep, enabled, stepCompleted, completeStep]);

  // View-only completion after being highlighted
  useEffect(() => {
    if (!currentStep || !enabled || stepCompleted || currentStep.completionType !== "viewed" || !rect) return;

    const wait = currentStep.advanceDelay ?? 1200;
    viewedTimerRef.current = setTimeout(() => {
      completeStep();
    }, wait);

    return () => {
      if (viewedTimerRef.current) {
        clearTimeout(viewedTimerRef.current);
        viewedTimerRef.current = null;
      }
    };
  }, [currentStep, enabled, stepCompleted, rect, completeStep]);

  // Position tooltip
  useEffect(() => {
    if (!rect || !currentStep) return;

    const pos = currentStep.position || "bottom";
    const pad = 16;
    const tooltipW = 340;
    const tooltipH = 128;

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

    left = Math.max(8, Math.min(left, window.innerWidth - tooltipW - 8));
    top = Math.max(8, Math.min(top, window.innerHeight - tooltipH - 8));

    setTooltipStyle({ top, left, width: tooltipW });

    const arrowS: React.CSSProperties = { position: "absolute" };
    if (pos === "bottom") {
      arrowS.top = -8;
      arrowS.left = "50%";
      arrowS.transform = "translateX(-50%)";
    } else if (pos === "top") {
      arrowS.bottom = -8;
      arrowS.left = "50%";
      arrowS.transform = "translateX(-50%) rotate(180deg)";
    } else if (pos === "left") {
      arrowS.right = -8;
      arrowS.top = "50%";
      arrowS.transform = "translateY(-50%) rotate(90deg)";
    } else {
      arrowS.left = -8;
      arrowS.top = "50%";
      arrowS.transform = "translateY(-50%) rotate(-90deg)";
    }

    setArrowStyle(arrowS);
  }, [rect, currentStep]);

  if (!enabled || !activeTask || !currentStep) return null;

  const completionLabel: Record<GuidedStep["completionType"], string> = {
    field_filled: "Preencha o campo para continuar",
    select_chosen: "Escolha uma opção para continuar",
    numeric_gt_zero: "Informe um valor maior que zero",
    button_clicked: "Clique no elemento destacado para continuar",
    submit_success: waitingSubmitSuccess ? "Aguardando confirmação de sucesso..." : "Execute a ação e aguarde a confirmação",
    viewed: "Visualizando...",
  };

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
          <rect x="0" y="0" width="100%" height="100%" fill="hsl(240 3% 5% / 0.7)" mask="url(#guided-mask)" />
        </svg>

        {rect && (
          <div
            className={`absolute border-2 rounded-lg pointer-events-none ${
              stepCompleted
                ? "border-[hsl(var(--success))] shadow-[0_0_0_4px_hsl(142_71%_45%/0.3)]"
                : "border-primary shadow-[0_0_0_4px_hsl(350_95%_43%/0.2)] animate-pulse"
            }`}
            style={{
              top: rect.top - 6,
              left: rect.left - 6,
              width: rect.width + 12,
              height: rect.height + 12,
            }}
          />
        )}
      </div>

      {/* Tooltip */}
      <div
        className="fixed z-[72] bg-card border border-border rounded-xl shadow-2xl p-4 animate-in fade-in zoom-in-95 duration-200"
        style={tooltipStyle}
      >
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

        <p className="text-sm text-foreground leading-relaxed mb-1">{currentStep.instruction}</p>

        {stepCompleted ? (
          <p className="text-xs text-[hsl(var(--success))] font-medium flex items-center gap-1 mb-2">
            <Check className="h-3 w-3" /> Passo concluído. Avançando...
          </p>
        ) : (
          <p className="text-xs text-muted-foreground mb-2 italic">{completionLabel[currentStep.completionType]}</p>
        )}

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
            Voltar
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={skipTutorial}
            className="h-7 text-xs text-muted-foreground hover:text-foreground"
          >
            Pular tutorial
          </Button>
          <Button size="sm" onClick={nextStep} disabled={!stepCompleted} className="h-7 text-xs gap-1">
            {currentStepIndex === totalSteps - 1 ? "Concluir" : "Próximo"}
            {currentStepIndex < totalSteps - 1 && <ChevronRight className="h-3 w-3" />}
          </Button>
        </div>
      </div>
    </>
  );
}
