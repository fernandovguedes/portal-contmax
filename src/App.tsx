import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import Portal from "./pages/Portal";
import Index from "./pages/Index";
import Clientes from "./pages/Clientes";
import Admin from "./pages/Admin";
import Auth from "./pages/Auth";
import Honorarios from "./pages/Honorarios";
import ComparativoTributario from "./pages/ComparativoTributario";
import DashboardExecutivo from "./pages/DashboardExecutivo";
import QualidadeAtendimento from "./pages/QualidadeAtendimento";
import OnecodeContacts from "./pages/OnecodeContacts";
import Integracoes from "./pages/Integracoes";
import IntegracaoDetalhe from "./pages/IntegracaoDetalhe";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();
  if (loading) return <div className="flex min-h-screen items-center justify-center">Carregando...</div>;
  if (!session) return <Navigate to="/auth" replace />;
  return <>{children}</>;
}

function AuthRoute() {
  const { session, loading } = useAuth();
  if (loading) return <div className="flex min-h-screen items-center justify-center">Carregando...</div>;
  if (session) return <Navigate to="/" replace />;
  return <Auth />;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/auth" element={<AuthRoute />} />
            <Route path="/" element={<ProtectedRoute><Portal /></ProtectedRoute>} />
            <Route path="/controle-fiscal" element={<ProtectedRoute><Index /></ProtectedRoute>} />
            <Route path="/clientes/:orgSlug" element={<ProtectedRoute><Clientes /></ProtectedRoute>} />
            <Route path="/honorarios-contmax" element={<ProtectedRoute><Honorarios /></ProtectedRoute>} />
            <Route path="/comparativo-tributario" element={<ProtectedRoute><ComparativoTributario /></ProtectedRoute>} />
            <Route path="/dashboard-executivo" element={<ProtectedRoute><DashboardExecutivo /></ProtectedRoute>} />
            <Route path="/qualidade-atendimento" element={<ProtectedRoute><QualidadeAtendimento /></ProtectedRoute>} />
            <Route path="/integracoes" element={<ProtectedRoute><Integracoes /></ProtectedRoute>} />
            <Route path="/integracoes/:slug" element={<ProtectedRoute><IntegracaoDetalhe /></ProtectedRoute>} />
            <Route path="/admin" element={<ProtectedRoute><Admin /></ProtectedRoute>} />
            <Route path="/admin/onecode-contacts" element={<ProtectedRoute><OnecodeContacts /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
