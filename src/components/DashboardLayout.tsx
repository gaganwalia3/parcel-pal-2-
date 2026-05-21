import { ReactNode, useEffect, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { 
  LayoutDashboard, Package, Send, 
  LogOut, User, Bell, Search, ClipboardList 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { API_URL } from "@/config";

interface Props { children: ReactNode; title: string; }

export const DashboardLayout = ({ children, title }: Props) => {
  const { signOut, isDriver } = useAuth();
  const location = useLocation();
  const queryClient = useQueryClient();

  const isActive = (path: string) => location.pathname === path;

  // Cache to track the last notified state for each order to prevent notification storms
  const lastStatesRef = useRef<Record<string, { status: string; arrived_at_pickup: boolean; arrived_at_dropoff: boolean }>>({});

  useEffect(() => {
    const token = localStorage.getItem("pp_token");
    if (!token) return;

    const sseUrl = `${API_URL}/api/orders/notifications/sse?token=${token}`;
    const eventSource = new EventSource(sseUrl);

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'order_updated') {
          const order = data.order;
          
          const lastState = lastStatesRef.current[order.id];
          const currentStateKey = `${order.status}_${!!order.arrived_at_pickup}_${!!order.arrived_at_dropoff}`;
          const lastStateKey = lastState ? `${lastState.status}_${lastState.arrived_at_pickup}_${lastState.arrived_at_dropoff}` : null;

          if (lastStateKey !== currentStateKey) {
            // Update cache
            lastStatesRef.current[order.id] = {
              status: order.status,
              arrived_at_pickup: !!order.arrived_at_pickup,
              arrived_at_dropoff: !!order.arrived_at_dropoff
            };

            // Determine if a toast notification should be displayed, and what message
            let toastMsg = "";
            if (order.status === "assigned" && !order.arrived_at_pickup) {
              if (!lastState || lastState.status !== "assigned") {
                toastMsg = "assigned to a driver.";
              }
            } else if (order.status === "assigned" && order.arrived_at_pickup) {
              if (!lastState || !lastState.arrived_at_pickup) {
                toastMsg = "at pickup spot.";
              }
            } else if (order.status === "on_the_way" && !order.arrived_at_pickup) {
              if (!lastState || lastState.status !== "on_the_way") {
                toastMsg = "heading to pickup.";
              }
            } else if (order.status === "picked_up") {
              if (!lastState || lastState.status !== "picked_up") {
                toastMsg = "picked up by driver.";
              }
            } else if (order.status === "in_transit" && !order.arrived_at_dropoff) {
              if (!lastState || lastState.status !== "in_transit") {
                toastMsg = "in transit to delivery location.";
              }
            } else if (order.status === "in_transit" && order.arrived_at_dropoff) {
              if (!lastState || !lastState.arrived_at_dropoff) {
                toastMsg = "at delivery location.";
              }
            } else if (order.status === "delivered") {
              if (!lastState || lastState.status !== "delivered") {
                toastMsg = "delivered successfully!";
              }
            }

            if (toastMsg) {
              toast.success(
                <div className="flex flex-col gap-1 p-0.5">
                  <p className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                    📦 Status Alert
                  </p>
                  <p className="text-[10px] text-slate-500">
                    Shipment <span className="font-mono text-primary font-bold">PP-{order.id.slice(0, 8).toUpperCase()}</span> is now <span className="font-black text-slate-800 capitalize">{toastMsg}</span>.
                  </p>
                </div>
              );
            }
          }

          // Invalidate React Query cache to instantly reload views
          queryClient.invalidateQueries();
        }
      } catch (err) {
        console.error("[SSE] Error parsing notification:", err);
      }
    };

    eventSource.onerror = (err) => {
      console.warn("[SSE] EventSource encountered error. Reconnecting...", err);
    };

    return () => {
      eventSource.close();
    };
  }, [queryClient]);

  return (
    <div className="flex min-h-screen bg-slate-50 font-body">
      {/* Sidebar */}
      <aside className="w-64 border-r bg-card hidden md:flex flex-col sticky top-0 h-screen">
        <div className="p-6 flex items-center gap-2">
          <div className="h-8 w-8 bg-primary rounded-lg flex items-center justify-center shadow-lg shadow-primary/20">
            <Package className="text-primary-foreground h-5 w-5" />
          </div>
          <span className="font-heading text-xl font-bold tracking-tight">ParcelPal</span>
        </div>
        
        <nav className="flex-1 px-4 space-y-2">
          {/* Common Dashboard Link */}
          <Link to={isDriver ? "/driver" : "/dashboard"} 
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all font-medium ${
              isActive(isDriver ? "/driver" : "/dashboard") ? "bg-primary text-primary-foreground shadow-md" : "hover:bg-accent text-muted-foreground"
            }`}>
            <LayoutDashboard size={20} /> {isDriver ? "Driver Terminal" : "Overview"}
          </Link>

          {/* Conditional Links based on Role */}
          {!isDriver ? (
            <Link to="/send-package" 
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all font-medium ${
                isActive("/send-package") ? "bg-primary text-primary-foreground shadow-md" : "hover:bg-accent text-muted-foreground"
              }`}>
              <Send size={20} /> New Shipment
            </Link>
          ) : (
            <Link to="/driver" 
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all font-medium ${
                isActive("/driver") ? "bg-primary text-primary-foreground shadow-md" : "hover:bg-accent text-muted-foreground"
              }`}>
              <ClipboardList size={20} /> Available Jobs
            </Link>
          )}
        </nav>

        <div className="p-4 mt-auto">
          <div className="bg-muted/50 rounded-2xl p-4 mb-4 border border-dashed border-muted-foreground/20 text-center">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Active Role</p>
            <p className="text-xs font-black uppercase text-primary">{isDriver ? "Professional Driver" : "Valued Customer"}</p>
          </div>
          <Separator className="mb-4" />
          <Button variant="ghost" className="w-full justify-start gap-3 text-destructive rounded-xl" onClick={() => signOut()}>
            <LogOut size={20} /> Sign Out
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col">
        <header className="h-16 border-b bg-background/80 backdrop-blur-md flex items-center justify-between px-8 sticky top-0 z-40">
          <h2 className="font-heading text-lg font-bold text-slate-800">{title}</h2>
          <div className="flex items-center gap-4">
            <div className="relative hidden sm:block">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input className="pl-10 w-64 bg-slate-100 border-none rounded-xl" placeholder="Tracking ID..." />
            </div>
            <Button variant="outline" size="icon" className="rounded-xl"><Bell size={18} /></Button>
            <div className="h-9 w-9 bg-primary/10 rounded-xl flex items-center justify-center text-primary border border-primary/20 cursor-pointer">
              <User size={18} />
            </div>
          </div>
        </header>
        <div className="p-8 animate-in fade-in duration-500">{children}</div>
      </main>
    </div>
  );
};