import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import { Plus, Package, Clock, CheckCircle, TrendingUp, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const UserDashboard = () => {
  const { user } = useAuth();

  // 1. Fetch real orders from Supabase
  const { data: orders, isLoading } = useQuery({
    queryKey: ["orders", user?.id],
    queryFn: async () => {
      const token = localStorage.getItem("pp_token");
      const res = await fetch(`http://localhost:3001/api/orders/user/${user?.id}`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Failed to fetch orders");
      const data = await res.json();
      return data.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    },
    enabled: !!user?.id,
  });

  // 2. Calculate dynamic stats based on real data
  const stats = [
    { 
      label: "Total Shipments", 
      value: orders?.length || 0, 
      icon: Package, 
      color: "text-blue-500" 
    },
    { 
      label: "In Transit", 
      value: orders?.filter(o => o.status === "in_transit").length || 0, 
      icon: Clock, 
      color: "text-yellow-500" 
    },
    { 
      label: "Delivered", 
      value: orders?.filter(o => o.status === "delivered").length || 0, 
      icon: CheckCircle, 
      color: "text-green-500" 
    },
  ];

  const getStatusVariant = (status: string) => {
    switch (status.toLowerCase()) {
      case 'delivered': return 'success';
      case 'pending': return 'secondary';
      case 'in_transit': return 'warning';
      default: return 'outline';
    }
  };

  return (
    <DashboardLayout title="Overview">
      <div className="space-y-8">
        <div className="flex justify-between items-end">
          <div>
            <h1 className="font-heading text-3xl font-bold tracking-tight">Welcome back!</h1>
            <p className="text-muted-foreground text-sm">Monitor your active shipments and delivery history.</p>
          </div>
          <Button asChild className="gap-2 shadow-lg shadow-primary/20">
            <Link to="/send-package"><Plus size={18} /> New Shipment</Link>
          </Button>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-3">
          {stats.map((stat) => (
            <Card key={stat.label} className="border-none shadow-sm bg-card">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  {stat.label}
                </CardTitle>
                <stat.icon className={`h-4 w-4 ${stat.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Recent Shipments / Order History Table */}
        <Card className="border-none shadow-sm overflow-hidden">
          <CardHeader>
            <CardTitle className="font-heading text-xl">Order History</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : orders && orders.length > 0 ? (
              <div className="relative w-full overflow-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-muted-foreground border-b uppercase text-[10px] font-bold tracking-wider">
                    <tr>
                      <th className="px-4 py-3">Tracking ID</th>
                      <th className="px-4 py-3">Destination</th>
                      <th className="px-4 py-3">Type</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Price</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {orders.map((order) => (
                      <tr key={order.id} className="hover:bg-muted/50 transition-colors group">
                        <td className="px-4 py-4 font-mono text-xs font-bold">
                          <Link to={`/order/${order.id}`} className="text-primary hover:underline">
                            {order.id.slice(0, 8).toUpperCase()}
                          </Link>
                        </td>
                        <td className="px-4 py-4 max-w-[200px] truncate">
                          {order.drop_location}
                        </td>
                        <td className="px-4 py-4 text-xs text-muted-foreground">
                          {order.weight_category}
                        </td>
                        <td className="px-4 py-4">
                          <Badge variant={getStatusVariant(order.status) as any} className="rounded-full px-3 capitalize">
                            {order.status.replace('_', ' ')}
                          </Badge>
                        </td>
                        <td className="px-4 py-4 text-right font-bold">
                          ₹{order.price}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-12 border-2 border-dashed rounded-xl">
                <Package className="mx-auto h-12 w-12 text-muted-foreground/30 mb-4" />
                <h3 className="font-bold text-lg">No orders yet</h3>
                <p className="text-muted-foreground text-sm mb-6">Your shipping history will appear here once you place an order.</p>
                <Button variant="outline" asChild>
                  <Link to="/send-package">Create your first shipment</Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default UserDashboard;