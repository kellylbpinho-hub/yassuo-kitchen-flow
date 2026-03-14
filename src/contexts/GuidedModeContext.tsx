import { createContext, useContext, useState, useCallback, ReactNode, useEffect, useRef } from "react";
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
  skipTutorial: () => void;
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
  const restoredRef = useRef(false);

  // Load preference and restore progress from profile
  useEffect(() => {
    if (!profile || restoredRef.current) return;
    const p = profile as any;
    if (p.guided_mode) {
      setEnabled(true);
      // Restore saved task progress
      if (p.guided_task_id && typeof p.guided_step === "number") {
        const task = guidedTasks.find((t) => t.id === p.guided_task_id);
        if (task && p.guided_step < task.steps.length) {
          setActiveTask(task);
          setCurrentStepIndex(p.guided_step);
          // Navigate to the task's route if not already there
          if (location.pathname !== task.route) {
            navigate(task.route);
          }
        } else {
          // Task finished or invalid, show panel
          setShowPanel(true);
        }
      } else {
        setShowPanel(true);
      }
    }
    restoredRef.current = true;
  }, [profile]);

  // Persist progress whenever step or task changes
  const persistProgress = useCallback(
    async (taskId: string | null, step: number) => {
      if (!profile) return;
      await supabase
        .from("profiles")
        .update({ guided_task_id: taskId, guided_step: step } as any)
        .eq("user_id", profile.user_id);
    },
    [profile]
  );

  const toggleEnabled = useCallback(async () => {
    const next = !enabled;
    setEnabled(next);
    if (!next) {
      setShowPanel(false);
      setActiveTask(null);
      setCurrentStepIndex(0);
      if (profile) {
        await supabase
          .from("profiles")
          .update({ guided_mode: next, guided_task_id: null, guided_step: 0 } as any)
          .eq("user_id", profile.user_id);
      }
    } else {
      setShowPanel(true);
      if (profile) {
        await supabase
          .from("profiles")
          .update({ guided_mode: next } as any)
          .eq("user_id", profile.user_id);
      }
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
      persistProgress(taskId, 0);
      if (location.pathname !== task.route) {
        navigate(task.route);
      }
    },
    [navigate, location.pathname, persistProgress]
  );

  const nextStep = useCallback(() => {
    if (!activeTask) return;
    if (currentStepIndex < activeTask.steps.length - 1) {
      const next = currentStepIndex + 1;
      setCurrentStepIndex(next);
      persistProgress(activeTask.id, next);
    } else {
      // Finished
      setActiveTask(null);
      setCurrentStepIndex(0);
      setShowPanel(true);
      persistProgress(null, 0);
    }
  }, [activeTask, currentStepIndex, persistProgress]);

  const prevStep = useCallback(() => {
    if (currentStepIndex > 0) {
      const prev = currentStepIndex - 1;
      setCurrentStepIndex(prev);
      if (activeTask) persistProgress(activeTask.id, prev);
    }
  }, [currentStepIndex, activeTask, persistProgress]);

  const exitTask = useCallback(() => {
    // Save progress so user can resume later
    if (activeTask) persistProgress(activeTask.id, currentStepIndex);
    setActiveTask(null);
    setCurrentStepIndex(0);
    setShowPanel(true);
  }, [activeTask, currentStepIndex, persistProgress]);

  const skipTutorial = useCallback(async () => {
    setActiveTask(null);
    setCurrentStepIndex(0);
    setShowPanel(false);
    setEnabled(false);
    if (profile) {
      await supabase
        .from("profiles")
        .update({ guided_mode: false, guided_task_id: null, guided_step: 0 } as any)
        .eq("user_id", profile.user_id);
    }
  }, [profile]);

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
        skipTutorial,
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
