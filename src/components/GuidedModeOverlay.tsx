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

  const overlapArea = (
    a: { left: number; right: number; top: number; bottom: number },
    b: { left: number; right: number; top: number; bottom: number }
  ) => {
    const x = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
    const y = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
    return x * y;
  };

  const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(value, max));

  const collectInteractiveRects = useCallback(() => {
    const selectors = [
      "[role='listbox']",
      "[role='menu']",
      "[role='dialog'][data-state='open']",
      "[data-radix-popper-content-wrapper]",
      "[data-state='open'][role='dialog']",
    ];

    const nodes = selectors.flatMap((selector) => Array.from(document.querySelectorAll(selector)));

    return nodes
      .filter((node) => {
        if (!(node instanceof HTMLElement)) return false;
        if (tooltipRef.current && (node === tooltipRef.current || tooltipRef.current.contains(node))) return false;
        if (node.closest("[data-guided-overlay='true']")) return false;

        const style = window.getComputedStyle(node);
        if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) return false;

        const r = node.getBoundingClientRect();
        return r.width > 24 && r.height > 24;
      })
      .map((node) => node.getBoundingClientRect());
  }, []);

  const positionTooltip = useCallback(() => {
    if (!rect || !currentStep) return;

    const margin = 8;
    const gap = 14;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    const interactiveRects = collectInteractiveRects();
    const shouldCompact = interactiveRects.length > 0;
    setCompactMode((prev) => (prev === shouldCompact ? prev : shouldCompact));

    const tooltipWidth = tooltipRef.current?.offsetWidth ?? (shouldCompact ? 280 : 340);
    const tooltipHeight = tooltipRef.current?.offsetHeight ?? (shouldCompact ? 92 : 188);

    const targetRect = {
      left: rect.left - 10,
      right: rect.right + 10,
      top: rect.top - 10,
      bottom: rect.bottom + 10,
    };

    if (isMobile) {
      const dockTop = rect.top > viewportHeight * 0.55;
      const width = Math.min(viewportWidth - margin * 2, shouldCompact ? 300 : 360);
      const left = clamp((viewportWidth - width) / 2, margin, viewportWidth - width - margin);
      const baseTop = dockTop ? margin : viewportHeight - tooltipHeight - margin;
      const top = clamp(baseTop, margin, viewportHeight - tooltipHeight - margin);
      const pointerLeft = clamp(rect.left + rect.width / 2 - left, 24, width - 24);

      setTooltipStyle({ top, left, width });
      setArrowStyle({
        position: "absolute",
        left: pointerLeft,
        ...(dockTop
          ? {
              bottom: -8,
              transform: "translateX(-50%) rotate(180deg)",
            }
          : {
              top: -8,
              transform: "translateX(-50%)",
            }),
      });
      return;
    }

    const preferred = currentStep.position || "bottom";
    const fallbackOrder: Array<"top" | "bottom" | "left" | "right"> = ["right", "bottom", "top", "left"];
    const order = [preferred, ...fallbackOrder.filter((side) => side !== preferred)] as Array<
      "top" | "bottom" | "left" | "right"
    >;

    const avoidRects = [targetRect, ...interactiveRects];

    const candidates = order.map((side) => {
      let top = 0;
      let left = 0;

      if (side === "bottom") {
        top = rect.bottom + gap;
        left = rect.left + rect.width / 2 - tooltipWidth / 2;
      } else if (side === "top") {
        top = rect.top - tooltipHeight - gap;
        left = rect.left + rect.width / 2 - tooltipWidth / 2;
      } else if (side === "left") {
        top = rect.top + rect.height / 2 - tooltipHeight / 2;
        left = rect.left - tooltipWidth - gap;
      } else {
        top = rect.top + rect.height / 2 - tooltipHeight / 2;
        left = rect.right + gap;
      }

      const clampedLeft = clamp(left, margin, viewportWidth - tooltipWidth - margin);
      const clampedTop = clamp(top, margin, viewportHeight - tooltipHeight - margin);

      const candidateRect = {
        left: clampedLeft,
        right: clampedLeft + tooltipWidth,
        top: clampedTop,
        bottom: clampedTop + tooltipHeight,
      };

      const overlap = avoidRects.reduce((acc, item) => acc + overlapArea(candidateRect, item), 0);

      return { side, top: clampedTop, left: clampedLeft, overlap };
    });

    const best = candidates.sort((a, b) => a.overlap - b.overlap)[0];

    setTooltipStyle({
      top: best.top,
      left: best.left,
      width: tooltipWidth,
      maxWidth: viewportWidth - margin * 2,
    });

    const arrowS: React.CSSProperties = { position: "absolute" };
    if (best.side === "bottom") {
      arrowS.top = -8;
      arrowS.left = clamp(rect.left + rect.width / 2 - best.left, 18, tooltipWidth - 18);
      arrowS.transform = "translateX(-50%)";
    } else if (best.side === "top") {
      arrowS.bottom = -8;
      arrowS.left = clamp(rect.left + rect.width / 2 - best.left, 18, tooltipWidth - 18);
      arrowS.transform = "translateX(-50%) rotate(180deg)";
    } else if (best.side === "left") {
      arrowS.right = -8;
      arrowS.top = clamp(rect.top + rect.height / 2 - best.top, 18, tooltipHeight - 18);
      arrowS.transform = "translateY(-50%) rotate(90deg)";
    } else {
      arrowS.left = -8;
      arrowS.top = clamp(rect.top + rect.height / 2 - best.top, 18, tooltipHeight - 18);
      arrowS.transform = "translateY(-50%) rotate(-90deg)";
    }

    setArrowStyle(arrowS);
  }, [collectInteractiveRects, currentStep, isMobile, rect]);

  // Position tooltip and keep it reactive when dropdowns/modals open
  useEffect(() => {
    if (!rect || !currentStep || !enabled) return;

    let frame = 0;
    const schedulePosition = () => {
      if (frame) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(positionTooltip);
    };

    schedulePosition();

    const onWindowChange = () => schedulePosition();
    window.addEventListener("resize", onWindowChange);
    window.addEventListener("scroll", onWindowChange, true);

    const observer = new MutationObserver(() => schedulePosition());
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["data-state", "aria-expanded", "class", "style"],
    });

    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("resize", onWindowChange);
      window.removeEventListener("scroll", onWindowChange, true);
      observer.disconnect();
    };
  }, [rect, currentStep, enabled, positionTooltip, currentStepIndex, stepCompleted, waitingSubmitSuccess, compactMode]);

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
