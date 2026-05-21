import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/useAuth";

// Page Imports
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import UserDashboard from "./pages/UserDashboard";
import SendPackage from "./pages/SendPackage";
import OrderTracking from "./pages/OrderTracking";
import DriverDashboard from "./pages/DriverDashboard";
import AdminDashboard from "./pages/AdminDashboard";
import Payment from "./pages/Payment"; 
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

/**
 * AppRoutes handles the conditional rendering based on 
 * the user's authentication state and role (Admin/Driver/User)
 */
function AppRoutes() {
  const { user, loading, isDriver, isAdmin } = useAuth();

  // Show a premium loader while checking Supabase session/metadata
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin h-10 w-10 border-4 border-primary border-t-transparent rounded-full shadow-sm" />
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground animate-pulse">
            Securing Session...
          </p>
        </div>
      </div>
    );
  }

  // 1. PUBLIC ROUTES: If not logged in, they only see Landing or Auth
  if (!user) {
    return (
      <Routes>
        <Route path="/" element={<Index />} />
        <Route path="/auth" element={<Auth />} />
        {/* Any other link sends them to landing to login */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    );
  }

  // 2. ROLE-BASED REDIRECTION: Logic for the "Home" path after login
  const getDefaultDashboard = () => {
    if (isAdmin) return "/admin";
    if (isDriver) return "/driver";
    return "/dashboard";
  };

  return (
    <Routes>
      {/* Auto-redirect to the correct dashboard based on SQL Role */}
      <Route path="/" element={<Navigate to={getDefaultDashboard()} replace />} />
      <Route path="/auth" element={<Navigate to={getDefaultDashboard()} replace />} />
      
      {/* CUSTOMER ROUTES */}
      <Route path="/dashboard" element={<UserDashboard />} />
      <Route path="/send-package" element={<SendPackage />} />
      <Route path="/payment" element={<Payment />} />
      <Route path="/order/:id" element={<OrderTracking />} />
      
      {/* DRIVER ROUTES (Protected) */}
      <Route 
        path="/driver" 
        element={isDriver ? <DriverDashboard /> : <Navigate to="/dashboard" replace />} 
      />
      
      {/* ADMIN ROUTES (Protected - for gagan.walia5678@gmail.com) */}
      <Route 
        path="/admin" 
        element={isAdmin ? <AdminDashboard /> : <Navigate to="/dashboard" replace />} 
      />
      
      {/* Catch-all 404 */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      {/* Global Toast notifications for "Order Confirmed", etc. */}
      <Toaster />
      <Sonner position="top-center" richColors />
      
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;