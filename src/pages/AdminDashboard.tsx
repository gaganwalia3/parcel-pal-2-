import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { 
  Users, Package, DollarSign, ShieldAlert, 
  BarChart3, ArrowUpRight, Loader2, Search, CloudRain, Zap
} from "lucide-react";
import { Input } from "@/components/ui/input";

export default function AdminDashboard() {
  const [config, setConfig] = useState<any>({
    manual_surge: false,
    manual_multiplier: 1.5,
    manual_reason: "High Demand (Manual Simulation)",
    use_weather_api: true
  });
  const [updatingConfig, setUpdatingConfig] = useState(false);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const token = localStorage.getItem("pp_token");
        const res = await fetch("http://localhost:3001/api/admin/config", {
          headers: {
            "Authorization": `Bearer ${token}`,
            "x-admin-token": "parcel-pal-secret-2026"
          }
        });
        if (res.ok) {
          const data = await res.json();
          setConfig(data);
        }
      } catch (err) {
        console.error("Failed to fetch admin config:", err);
      }
    };
    fetchConfig();
  }, []);

  const handleUpdateConfig = async (updates: any) => {
    setUpdatingConfig(true);
    try {
      const token = localStorage.getItem("pp_token");
      const res = await fetch("http://localhost:3001/api/admin/config", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
          "x-admin-token": "parcel-pal-secret-2026"
        },
        body: JSON.stringify(updates)
      });
      if (res.ok) {
        const data = await res.json();
        setConfig(data);
        toast.success("System configurations updated!");
      } else {
        throw new Error("Failed to update config");
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to update configurations");
    } finally {
      setUpdatingConfig(false);
    }
  };
  // 1. Fetch all orders for the entire platform
  const { data: allOrders, isLoading: ordersLoading } = useQuery({
    queryKey: ["admin-all-orders"],
    queryFn: async () => {
      const token = localStorage.getItem("pp_token");
      const res = await fetch("http://localhost:3001/api/orders", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Failed to fetch orders");
      const data = await res.json();
      return data.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    },
  });

  // 2. Fetch all user profiles
  const { data: profiles } = useQuery({
    queryKey: ["admin-profiles"],
    queryFn: async () => {
      const token = localStorage.getItem("pp_token");
      const res = await fetch("http://localhost:3001/api/admin/users", {
        headers: { "Authorization": `Bearer ${token}`, "x-admin-token": "parcel-pal-secret-2026" }
      });
      if (!res.ok) throw new Error("Failed to fetch profiles");
      return await res.json();
    },
  });

  // 3. Calculate Global Stats
  const totalRevenue = allOrders?.reduce((acc, curr) => acc + (curr.price || 0), 0) || 0;
  const pendingOrders = allOrders?.filter(o => o.status === 'pending').length || 0;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'delivered': return 'bg-green-500/10 text-green-600 border-green-500/20';
      case 'pending': return 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20';
      case 'assigned': return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
      default: return 'bg-slate-100 text-slate-600';
    }
  };

  return (
    <DashboardLayout title="System Administration">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Management Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-heading font-black tracking-tight text-slate-900">Master Control</h1>
            <p className="text-muted-foreground text-sm">Platform-wide analytics and shipment oversight.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="rounded-xl gap-2">
              <BarChart3 size={18} /> Export Data
            </Button>
            <Button className="rounded-xl gap-2 shadow-lg shadow-primary/20">
              <ShieldAlert size={18} /> System Logs
            </Button>
          </div>
        </div>

        {/* Global Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Total Revenue", val: `₹${totalRevenue.toLocaleString('en-IN')}`, icon: DollarSign, color: "text-green-600" },
            { label: "Total Users", val: profiles?.length || 0, icon: Users, color: "text-blue-600" },
            { label: "Active Orders", val: allOrders?.length || 0, icon: Package, color: "text-orange-600" },
            { label: "Pending Tasks", val: pendingOrders, icon: ArrowUpRight, color: "text-red-600" },
          ].map((s, i) => (
            <Card key={i} className="border-none shadow-sm">
              <CardContent className="pt-6">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{s.label}</p>
                    <h3 className="text-2xl font-black mt-1">{s.val}</h3>
                  </div>
                  <div className={`p-2 rounded-lg bg-slate-50 ${s.color}`}>
                    <s.icon size={20} />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Pricing Surge & Climate Controls */}
        <Card className="border-none shadow-sm overflow-hidden bg-slate-900 text-white">
          <CardHeader className="bg-slate-950 border-b border-slate-800 flex flex-row items-center justify-between p-6">
            <div>
              <CardTitle className="text-lg font-heading font-black tracking-tight text-white flex items-center gap-2">
                <Zap className="text-amber-500" size={20} /> Surge Pricing & Climate Simulation
              </CardTitle>
              <p className="text-[11px] text-slate-400 mt-1">Configure platform-wide surge multipliers or integrate with live weather conditions.</p>
            </div>
            {config.manual_surge && (
              <Badge className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-[10px] uppercase">
                {config.manual_multiplier}x Active
              </Badge>
            )}
          </CardHeader>
          <CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Control 1: Manual Surge Toggle */}
            <div className="flex flex-col justify-between p-4 bg-slate-800/50 rounded-2xl border border-slate-800 space-y-4">
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <h4 className="text-sm font-bold flex items-center gap-2">
                    <Zap size={16} className="text-amber-400" /> Manual Surge Override
                  </h4>
                  <p className="text-xs text-slate-400 leading-normal">
                    Instantly simulate high-demand conditions, applying a direct 1.5x multiplier to all new quotes.
                  </p>
                </div>
                <Switch 
                  checked={config.manual_surge} 
                  onCheckedChange={(checked) => handleUpdateConfig({ manual_surge: checked })}
                  disabled={updatingConfig}
                />
              </div>
              <div className="flex items-center gap-3 bg-slate-900/60 p-3 rounded-xl border border-slate-800/80">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Reason:</span>
                <span className="text-xs font-medium text-slate-200">{config.manual_reason}</span>
              </div>
            </div>

            {/* Control 2: Live Weather API Surge */}
            <div className="flex flex-col justify-between p-4 bg-slate-800/50 rounded-2xl border border-slate-800 space-y-4">
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <h4 className="text-sm font-bold flex items-center gap-2">
                    <CloudRain size={16} className="text-blue-400" /> Auto-Weather API Surge
                  </h4>
                  <p className="text-xs text-slate-400 leading-normal">
                    Dynamically query the Open-Meteo API using pickup coordinates. Automatically triggers a 1.5x surge if rain/snow is detected.
                  </p>
                </div>
                <Switch 
                  checked={config.use_weather_api} 
                  onCheckedChange={(checked) => handleUpdateConfig({ use_weather_api: checked })}
                  disabled={updatingConfig}
                />
              </div>
              <div className="flex items-center gap-3 bg-slate-900/60 p-3 rounded-xl border border-slate-800/80">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Status:</span>
                <span className="text-xs font-medium text-slate-200">
                  {config.use_weather_api ? "🟢 Connected to Open-Meteo" : "🔴 Weather Sync Suspended"}
                </span>
              </div>
            </div>

          </CardContent>
        </Card>

        {/* Master Order Table */}
        <Card className="border-none shadow-sm overflow-hidden">
          <CardHeader className="border-b bg-white flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-lg font-heading font-bold">All Platform Shipments</CardTitle>
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Filter by User or ID..." className="pl-10 w-64 bg-slate-50 border-none h-9 text-xs" />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {ordersLoading ? (
              <div className="flex justify-center py-20"><Loader2 className="animate-spin h-8 w-8 text-primary" /></div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-widest text-muted-foreground border-b">
                    <tr>
                      <th className="px-6 py-4">Order ID</th>
                      <th className="px-6 py-4">Customer</th>
                      <th className="px-6 py-4">Driver</th>
                      <th className="px-6 py-4">Route</th>
                      <th className="px-6 py-4">Status</th>
                      <th className="px-6 py-4 text-right">Fare</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {allOrders?.map((order) => (
                      <tr key={order.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-6 py-4 font-mono text-[10px] font-bold text-primary">
                          {order.id.slice(0, 8).toUpperCase()}
                        </td>
                        <td className="px-6 py-4">
                          <p className="font-bold text-xs">User ID: {order.user_id.slice(0, 5)}...</p>
                        </td>
                        <td className="px-6 py-4 text-xs">
                          {order.driver_name ? (
                            <span className="flex items-center gap-2">
                              <div className="h-2 w-2 rounded-full bg-green-500" />
                              {order.driver_name}
                            </span>
                          ) : (
                            <span className="text-muted-foreground italic">Unassigned</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-[10px] font-medium line-clamp-1 max-w-[150px]">
                            {order.pickup_location} → {order.drop_location}
                          </p>
                        </td>
                        <td className="px-6 py-4">
                          <Badge variant="outline" className={`rounded-full px-3 py-0.5 text-[9px] font-black uppercase ${getStatusColor(order.status)}`}>
                            {order.status}
                          </Badge>
                        </td>
                        <td className="px-6 py-4 text-right font-black">₹{order.price}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}