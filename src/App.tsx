import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppLayout } from "@/components/AppLayout";
import Index from "./pages/Index";
import Login from "./pages/Login";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Dashboard from "./pages/Dashboard";
import Estoque from "./pages/Estoque";
import Compras from "./pages/Compras";
import ComprasDetalhe from "./pages/ComprasDetalhe";
import Desperdicio from "./pages/Desperdicio";
import DesperdicioContrato from "./pages/DesperdicioContrato";
import DashboardFinanceiro from "./pages/DashboardFinanceiro";
import Usuarios from "./pages/Usuarios";
import Unidades from "./pages/Unidades";
import Categorias from "./pages/Categorias";
import RecebimentoDigital from "./pages/RecebimentoDigital";
import Alertas from "./pages/Alertas";
import QA from "./pages/QA";
import PedidoInterno from "./pages/PedidoInterno";
import AprovacoesCd from "./pages/AprovacoesCd";
import MeusPedidos from "./pages/MeusPedidos";
import ConfiguracoesAcesso from "./pages/ConfiguracoesAcesso";
import CardapioSemanal from "./pages/CardapioSemanal";
import PainelNutri from "./pages/PainelNutri";
import Pratos from "./pages/Pratos";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/login" element={<Login />} />
            <Route path="/esqueci-senha" element={<ForgotPassword />} />
            <Route path="/redefinir-senha" element={<ResetPassword />} />
            <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/estoque" element={<Estoque />} />
              <Route path="/compras" element={<Compras />} />
              <Route path="/compras/:id" element={<ComprasDetalhe />} />
              <Route path="/desperdicio" element={<Desperdicio />} />
              <Route path="/desperdicio-contrato" element={<DesperdicioContrato />} />
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
              <Route path="/pratos" element={<Pratos />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
