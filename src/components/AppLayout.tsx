import { useState } from "react";
import { NavLink, Outlet, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { LayoutDashboard, LogOut, Menu, X, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ROLE_LABELS } from "@/lib/constants";
import { useSidebarNavigation, type NavGroup } from "@/hooks/useSidebarNavigation";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { MobileBottomNav } from "@/components/MobileBottomNav";
import { GuidedModeToggle } from "@/components/GuidedModeToggle";
import { GuidedModeToggleMobile } from "@/components/GuidedModeToggleMobile";
import { AlertCenter } from "@/components/AlertCenter";
import { GuidedModePanel } from "@/components/GuidedModePanel";
import { GuidedModeOverlay } from "@/components/GuidedModeOverlay";

export function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { profile, role, signOut, isNutricionista } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const groups = useSidebarNavigation();

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  const isGroupActive = (group: NavGroup) =>
    group.items.some((item) => location.pathname.startsWith(item.to));

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-60 bg-sidebar border-r border-sidebar-border flex flex-col transition-transform duration-300 lg:relative lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-sidebar-border shrink-0">
          <div className="flex items-center gap-2.5">
            <h1 className="text-lg font-sans font-bold tracking-tight">
              <span className="text-white">Yassuo</span> <span className="text-destructive">App</span>
            </h1>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        {!isNutricionista && (
          <div className="px-3 pt-3 shrink-0">
            <NavLink
              to="/dashboard"
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                isActive ? "sidebar-item-active" : "sidebar-item"
              }
            >
              <LayoutDashboard className="h-4 w-4" />
              <span className="text-sm font-medium">Dashboard</span>
            </NavLink>
          </div>
        )}

        <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
          {groups.map((group) => (
            <Collapsible key={group.label} defaultOpen={isGroupActive(group)}>
              <CollapsibleTrigger className="flex items-center justify-between w-full px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors rounded-md">
                <span>{group.label}</span>
                <ChevronDown className="h-3.5 w-3.5 transition-transform duration-200 group-data-[state=open]:rotate-180" />
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-0.5 mt-0.5">
                {group.items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={() => setSidebarOpen(false)}
                    className={({ isActive }) =>
                      isActive ? "sidebar-item-active" : "sidebar-item"
                    }
                  >
                    <item.icon className="h-4 w-4" />
                    <span className="text-sm font-medium">{item.label}</span>
                  </NavLink>
                ))}
              </CollapsibleContent>
            </Collapsible>
          ))}
        </nav>

        <div className="shrink-0 px-4 py-3 border-t border-sidebar-border">
          <div className="flex items-center gap-3 mb-2">
            <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-semibold text-xs">
              {profile?.full_name?.charAt(0)?.toUpperCase() || "?"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate leading-tight">
                {profile?.full_name || "Usuário"}
              </p>
              <p className="text-[11px] text-muted-foreground truncate">
                {role ? ROLE_LABELS[role] || role : ""}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-muted-foreground hover:text-foreground hover:bg-accent h-8 text-xs"
            onClick={handleSignOut}
          >
            <LogOut className="h-3.5 w-3.5 mr-2" />
            Sair
          </Button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="flex items-center justify-between px-4 py-2 border-b border-border bg-card lg:px-5 shrink-0">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden text-muted-foreground hover:text-foreground"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex-1 flex justify-center lg:hidden">
            <span className="text-lg font-sans font-bold tracking-tight"><span className="text-white">Yassuo</span> <span className="text-destructive">App</span></span>
          </div>
          <div className="flex items-center gap-1 lg:hidden">
            <AlertCenter />
            <GuidedModeToggleMobile />
            <button
              onClick={handleSignOut}
              className="text-muted-foreground hover:text-foreground"
              title="Sair"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>
          <div className="hidden lg:flex lg:flex-1 lg:justify-end lg:items-center lg:gap-2">
            <AlertCenter />
            <GuidedModeToggle />
          </div>
        </header>

        <div className="flex-1 overflow-auto p-3 pb-16 lg:p-5 lg:pb-5">
          <Outlet />
        </div>
      </main>

      <MobileBottomNav />
      <GuidedModePanel />
      <GuidedModeOverlay />
    </div>
  );
}
