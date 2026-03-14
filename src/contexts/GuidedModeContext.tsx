import { createContext, useContext, useState, useCallback, ReactNode, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { guidedTasks, GuidedTask, GuidedStep } from "@/lib/guidedSteps";

interface GuidedModeContextType {
  enabled: boolean;
  toggleEnabled: () => void;
  showPanel: boolean;
  setShowPanel: (v: boolean) => void;
  activeTask: GuidedTask | null;
  currentStepIndex: number;
  currentStep: GuidedStep | null;
  totalSteps: number;
  startTask: (taskId: string) => void;
  nextStep: () => void;
  prevStep: () => void;
  exitTask: () => void;
  availableTasks: GuidedTask[];
}

const GuidedModeContext = createContext<GuidedModeContextType | undefined>(undefined);

export function GuidedModeProvider({ children }: { children: ReactNode }) {
  const { profile, role } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [enabled, setEnabled] = useState(false);
  const [showPanel, setShowPanel] = useState(false);
  const [activeTask, setActiveTask] = useState<GuidedTask | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  // Load preference from profile
  useEffect(() => {
    if (profile && (profile as any).guided_mode) {
      setEnabled(true);
    }
  }, [profile]);

  const toggleEnabled = useCallback(async () => {
    const next = !enabled;
    setEnabled(next);
    if (!next) {
      setShowPanel(false);
      setActiveTask(null);
      setCurrentStepIndex(0);
    } else {
      setShowPanel(true);
    }
    // Persist
    if (profile) {
      await supabase
        .from("profiles")
        .update({ guided_mode: next } as any)
        .eq("user_id", profile.user_id);
    }
  }, [enabled, profile]);

  const availableTasks = guidedTasks.filter((t) => {
    if (!role) return false;
    if (t.allowedRoles && t.allowedRoles.length > 0 && !t.allowedRoles.includes(role)) return false;
    if (t.blockedRoles && t.blockedRoles.includes(role)) return false;
    return true;
  });

  const startTask = useCallback(
    (taskId: string) => {
      const task = guidedTasks.find((t) => t.id === taskId);
      if (!task) return;
      setActiveTask(task);
      setCurrentStepIndex(0);
      setShowPanel(false);
      if (location.pathname !== task.route) {
        navigate(task.route);
      }
    },
    [navigate, location.pathname]
  );

  const nextStep = useCallback(() => {
    if (!activeTask) return;
    if (currentStepIndex < activeTask.steps.length - 1) {
      setCurrentStepIndex((i) => i + 1);
    } else {
      // Finished
      setActiveTask(null);
      setCurrentStepIndex(0);
      setShowPanel(true);
    }
  }, [activeTask, currentStepIndex]);

  const prevStep = useCallback(() => {
    if (currentStepIndex > 0) setCurrentStepIndex((i) => i - 1);
  }, [currentStepIndex]);

  const exitTask = useCallback(() => {
    setActiveTask(null);
    setCurrentStepIndex(0);
    setShowPanel(true);
  }, []);

  const currentStep = activeTask ? activeTask.steps[currentStepIndex] ?? null : null;
  const totalSteps = activeTask ? activeTask.steps.length : 0;

  return (
    <GuidedModeContext.Provider
      value={{
        enabled,
        toggleEnabled,
        showPanel,
        setShowPanel,
        activeTask,
        currentStepIndex,
        currentStep,
        totalSteps,
        startTask,
        nextStep,
        prevStep,
        exitTask,
        availableTasks,
      }}
    >
      {children}
    </GuidedModeContext.Provider>
  );
}

export function useGuidedMode() {
  const ctx = useContext(GuidedModeContext);
  if (!ctx) throw new Error("useGuidedMode must be used within GuidedModeProvider");
  return ctx;
}
