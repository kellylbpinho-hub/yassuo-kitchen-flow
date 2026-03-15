import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { GuidedModeProvider } from "@/contexts/GuidedModeContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppLayout } from "@/components/AppLayout";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { PageLoader } from "@/components/PageLoader";

// Lazy-loaded pages
const Index = lazy(() => import("./pages/Index"));
const Login = lazy(() => import("./pages/Login"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Estoque = lazy(() => import("./pages/Estoque"));
const Compras = lazy(() => import("./pages/Compras"));
const ComprasDetalhe = lazy(() => import("./pages/ComprasDetalhe"));
const Desperdicio = lazy(() => import("./pages/Desperdicio"));
const DesperdicioContrato = lazy(() => import("./pages/DesperdicioContrato"));
const DashboardFinanceiro = lazy(() => import("./pages/DashboardFinanceiro"));
const Usuarios = lazy(() => import("./pages/Usuarios"));
const Unidades = lazy(() => import("./pages/Unidades"));
const Categorias = lazy(() => import("./pages/Categorias"));
const RecebimentoDigital = lazy(() => import("./pages/RecebimentoDigital"));
const Alertas = lazy(() => import("./pages/Alertas"));
const QA = lazy(() => import("./pages/QA"));
const PedidoInterno = lazy(() => import("./pages/PedidoInterno"));
const AprovacoesCd = lazy(() => import("./pages/AprovacoesCd"));
const MeusPedidos = lazy(() => import("./pages/MeusPedidos"));
const ConfiguracoesAcesso = lazy(() => import("./pages/ConfiguracoesAcesso"));
const CardapioSemanal = lazy(() => import("./pages/CardapioSemanal"));
const PainelNutri = lazy(() => import("./pages/PainelNutri"));
const Pratos = lazy(() => import("./pages/Pratos"));
const RelatorioExecutivo = lazy(() => import("./pages/RelatorioExecutivo"));
const PlanejamentoInsumos = lazy(() => import("./pages/PlanejamentoInsumos"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 2 * 60 * 1000, // 2 min — avoid refetches on tab focus
      gcTime: 10 * 60 * 1000, // 10 min garbage collection
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <ErrorBoundary>
            <Suspense fallback={<PageLoader />}>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/login" element={<Login />} />
                <Route path="/esqueci-senha" element={<ForgotPassword />} />
                <Route path="/redefinir-senha" element={<ResetPassword />} />
                <Route element={<ProtectedRoute><GuidedModeProvider><AppLayout /></GuidedModeProvider></ProtectedRoute>}>
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/estoque" element={<Estoque />} />
                  <Route path="/compras" element={<Compras />} />
                  <Route path="/compras/:id" element={<ComprasDetalhe />} />
                  <Route path="/desperdicio" element={<Desperdicio />} />
                  <Route path="/desperdicio-contrato" element={<DesperdicioContrato />} />
                  <Route path="/dashboard-financeiro" element={<DashboardFinanceiro />} />
                  <Route path="/usuarios" element={<Usuarios />} />
                  <Route path="/unidades" element={<Unidades />} />
                  <Route path="/categorias" element={<Categorias />} />
                  <Route path="/alertas" element={<Alertas />} />
                  <Route path="/qa" element={<QA />} />
                  <Route path="/recebimento-digital" element={<RecebimentoDigital />} />
                  <Route path="/pedido-interno" element={<PedidoInterno />} />
                  <Route path="/aprovacoes-cd" element={<AprovacoesCd />} />
                  <Route path="/meus-pedidos" element={<MeusPedidos />} />
                  <Route path="/configuracoes-acesso" element={<ConfiguracoesAcesso />} />
                  <Route path="/cardapio-semanal" element={<CardapioSemanal />} />
                  <Route path="/painel-nutri" element={<PainelNutri />} />
                  <Route path="/pratos" element={<Pratos />} />
                  <Route path="/relatorio-executivo" element={<RelatorioExecutivo />} />
                  <Route path="/planejamento-insumos" element={<PlanejamentoInsumos />} />
                </Route>
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </ErrorBoundary>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
