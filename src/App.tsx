import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import Header from "./components/layout/Header";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Education from "./pages/Education";
import NotFound from "./pages/NotFound";
import { AdminDashboard } from "./components/admin/AdminDashboard";
import { WelcomeMessage } from "./components/welcome/WelcomeMessage";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <div className="min-h-screen bg-background">
            <Header />
            <Routes>
              <Route path="/" element={<WelcomeMessage />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/dashboard" element={<Index />} />
              <Route path="/education" element={<Education />} />
              <Route path="/admin" element={<AdminDashboard />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </div>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
