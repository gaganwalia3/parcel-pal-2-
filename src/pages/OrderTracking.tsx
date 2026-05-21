import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Package, MapPin, CheckCircle2, 
  ArrowLeft, Truck, ShieldCheck, Box, Navigation, Loader2, FileText,
  Send, MessageSquare, Sparkles
} from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { AnimatedRouteMap } from "@/components/AnimatedRouteMap";
import { cn } from "@/lib/utils";
import { API_URL } from "@/config";

export default function OrderTracking() {
  const { id } = useParams();
  const navigate = useNavigate();
  const getCustomerToken = () => localStorage.getItem("pp_customer_token") || localStorage.getItem("pp_token");
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [downloadingInvoice, setDownloadingInvoice] = useState(false);

  const { user } = useAuth();
  const [chatOpen, setChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [sendingMsg, setSendingMsg] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const handleDownloadInvoice = async () => {
    if (!id || !order) return;
    setDownloadingInvoice(true);
    try {
      const token = getCustomerToken();
      const res = await fetch(`${API_URL}/api/orders/${id}/invoice`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to download invoice");
      }
      
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Invoice-${order.id.slice(0, 8).toUpperCase()}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast.success("Invoice PDF downloaded successfully!");
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to generate invoice PDF");
    } finally {
      setDownloadingInvoice(false);
    }
  };

  const [cancellingOrder, setCancellingOrder] = useState(false);
  const handleCancelOrder = async () => {
    if (!window.confirm("Are you sure you want to cancel this order? This action cannot be undone.")) {
      return;
    }
    
    setCancellingOrder(true);
    try {
      const token = getCustomerToken();
      const res = await fetch(`${API_URL}/api/orders/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ status: "cancelled" })
      });
      
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to cancel order");
      }
      
      toast.success("Order cancelled successfully");
      fetchOrder();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setCancellingOrder(false);
    }
  };


  const fetchOrder = async () => {
    if (!id) return;
    try {
      const token = getCustomerToken();
      const res = await fetch(`${API_URL}/api/orders`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Failed to fetch order");
      const orders = await res.json();
      const orderData = orders.find((o: any) => o.id === id);
      
      if (orderData) setOrder(orderData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrder();

    // SSE connection for real-time tracking
    const token = getCustomerToken();
    if (!token) return;

    const eventSource = new EventSource(`${API_URL}/api/orders/notifications/sse?token=${token}`);

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "order_updated" && data.order.id === id) {
          setOrder(data.order);
        }
      } catch (err) {
        console.error("SSE parse error in Order Tracking:", err);
      }
    };

    eventSource.onerror = (err) => {
      console.error("SSE connection error in Order Tracking, closing...", err);
      eventSource.close();
    };

    // Simulate real-time by polling every 5 seconds as a fallback
    const pollInterval = setInterval(fetchOrder, 5000);

    return () => {
      eventSource.close();
      clearInterval(pollInterval);
    };
  }, [id]);

  const handleSendChatMessage = async () => {
    if (!chatInput.trim() || !id) return;
    setSendingMsg(true);
    try {
      const token = getCustomerToken();
      const res = await fetch(`${API_URL}/api/orders/${id}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ text: chatInput, sender_role: "user" })
      });
      if (res.ok) {
        setChatInput("");
        fetchOrder();
      } else {
        throw new Error("Failed to send message");
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSendingMsg(false);
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [order?.messages, chatOpen]);

  if (loading) {
    return (
      <DashboardLayout title="Tracking">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  if (!order) {
    return (
      <DashboardLayout title="Not Found">
        <div className="text-center py-20">
          <h2 className="text-2xl font-bold font-heading">Order not found</h2>
          <Button onClick={() => navigate("/dashboard")} className="mt-6">Return to Dashboard</Button>
        </div>
      </DashboardLayout>
    );
  }

  const steps = [
    { label: "Placed", status: "pending", icon: Box },
    { label: "Assigned", status: "assigned", icon: ShieldCheck },
    { label: "In Transit", status: "in_transit", icon: Truck },
    { label: "Delivered", status: "delivered", icon: CheckCircle2 },
  ];

  const currentStepIndex = steps.findIndex(s => s.status === order.status);
  const progressValue = ((currentStepIndex + 1) / steps.length) * 100;

  return (
    <DashboardLayout title="Track Shipment">
      <div className="max-w-4xl mx-auto space-y-6">
        <Button variant="ghost" onClick={() => navigate("/dashboard")} className="gap-2 mb-2">
          <ArrowLeft size={16} /> Back to Dashboard
        </Button>

        {/* Header Summary */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-card border p-6 rounded-2xl shadow-sm">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Tracking ID</p>
            <h2 className="text-xl font-heading font-bold">{order.id.slice(0, 12).toUpperCase()}</h2>
          </div>
          <div className="flex gap-2">
            <Badge variant="outline" className="px-3 py-1 rounded-full text-[10px] uppercase font-bold">
              {order.weight_category ?? "Standard"}
            </Badge>
            <Badge className="px-3 py-1 rounded-full bg-primary text-[10px] uppercase font-bold">
              {order.status?.replace('_', ' ') ?? "Pending"}
            </Badge>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Progress Timeline */}
          <Card className="lg:col-span-2 border-none shadow-sm">
            <CardHeader><CardTitle className="font-heading text-lg text-primary">Live Status</CardTitle></CardHeader>
            <CardContent className="space-y-10">
              {order.status === "cancelled" ? (
                <div className="bg-rose-50 border border-rose-250 text-rose-850 rounded-xl p-4 flex items-center gap-3 animate-fade-in">
                  <div className="h-10 w-10 rounded-full bg-rose-100 flex items-center justify-center text-rose-600 flex-shrink-0">
                    <Box size={20} />
                  </div>
                  <div>
                    <p className="font-bold text-sm">Order Cancelled</p>
                    <p className="text-[11px] opacity-90 mt-0.5">This shipment has been cancelled. No driver will be assigned and it will not be processed further.</p>
                  </div>
                </div>
              ) : (
                <div className="px-4">
                  <Progress value={progressValue} className="h-1.5" />
                  <div className="relative flex justify-between -mt-4">
                    {steps.map((step, idx) => {
                      const isActive = idx <= currentStepIndex;
                      return (
                        <div key={step.label} className="flex flex-col items-center">
                          <div className={`h-8 w-8 rounded-full flex items-center justify-center z-10 ${
                            isActive ? "bg-primary text-primary-foreground shadow-lg" : "bg-muted text-muted-foreground"
                          }`}>
                            <step.icon size={16} />
                          </div>
                          <span className={`text-[9px] font-black uppercase mt-3 tracking-widest ${isActive ? "text-primary" : "text-muted-foreground"}`}>
                            {step.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Locations & Map */}
              <div className="pt-6 border-t space-y-6">
                <div className="flex items-start gap-4">
                  <div className="p-2 bg-primary/10 rounded-lg text-primary"><Navigation size={18} /></div>
                  <div>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase mb-1">Pickup Point</p>
                    <p className="text-sm font-medium">{order.pickup_location}</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="p-2 bg-orange-500/10 rounded-lg text-orange-600"><MapPin size={18} /></div>
                  <div>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase mb-1">Destination</p>
                    <p className="text-sm font-medium">{order.drop_location}</p>
                  </div>
                </div>

                {/* Map Embed */}
                {order.pickup_lat && order.pickup_lng && (
                  <div className="w-full rounded-2xl overflow-hidden border border-slate-200 shadow-lg">
                    <AnimatedRouteMap
                      pickupLat={Number(order.pickup_lat)}
                      pickupLng={Number(order.pickup_lng)}
                      dropLat={Number(order.drop_lat)}
                      dropLng={Number(order.drop_lng)}
                      driverLat={order.driver_lat !== undefined && order.driver_lat !== null ? Number(order.driver_lat) : undefined}
                      driverLng={order.driver_lng !== undefined && order.driver_lng !== null ? Number(order.driver_lng) : undefined}
                      status={order.status}
                      etaMins={order.eta_mins !== undefined && order.eta_mins !== null ? Number(order.eta_mins) : undefined}
                      remainingKm={order.remaining_km !== undefined && order.remaining_km !== null ? Number(order.remaining_km) : undefined}
                    />
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Shipment Summary */}
          <div className="space-y-6">
            <Card className="border-none shadow-sm">
              <CardHeader className="pb-3 border-b">
                <CardTitle className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Shipment Info</CardTitle>
              </CardHeader>
              <CardContent className="pt-4 space-y-4">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-muted-foreground font-medium">Total Bill</span>
                  <span className="font-bold text-foreground">₹{order.price ?? 0}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-muted-foreground font-medium">Distance</span>
                  <span className="font-bold text-foreground">{order.distance_km ?? 0} km</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-muted-foreground font-medium">Payment</span>
                  <span className="font-bold text-green-600">
                    {order.payment_method ?? "COD"}
                  </span>
                </div>
                {order.status === "delivered" && (
                  <Button 
                    onClick={handleDownloadInvoice}
                    disabled={downloadingInvoice}
                    className="w-full mt-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs h-11 flex items-center justify-center gap-2 transition-transform active:scale-95 animate-fade-in"
                  >
                    {downloadingInvoice ? (
                      <Loader2 className="animate-spin h-4 w-4" />
                    ) : (
                      <FileText size={16} />
                    )}
                    Download Invoice
                  </Button>
                )}
                {(order.status === "pending" || order.status === "assigned" || order.status === "on_the_way") && (
                  <Button 
                    onClick={handleCancelOrder}
                    disabled={cancellingOrder}
                    className="w-full mt-4 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold text-xs h-11 flex items-center justify-center gap-2 transition-transform active:scale-95"
                  >
                    {cancellingOrder ? (
                      <Loader2 className="animate-spin h-4 w-4" />
                    ) : (
                      "Cancel Order"
                    )}
                  </Button>
                )}
              </CardContent>
            </Card>

            <Card className="border border-slate-205 shadow-sm bg-white text-slate-900">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3 mb-3">
                  <ShieldCheck className="text-blue-600" size={18} />
                  <span className="font-bold text-sm">ParcelPal Secure</span>
                </div>
                <p className="text-[10px] text-slate-500 leading-relaxed mb-5 uppercase font-bold tracking-tight">
                  Driver: {order.driver_name ?? "Assigning soon..."}
                </p>

                {/* Display OTP to Sender */}
                {order.status === "assigned" && (
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 mb-5 text-center">
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1">Pickup Secret OTP</p>
                    <p className="text-3xl font-black tracking-[0.2em] text-slate-900">{order.pickup_otp}</p>
                    <p className="text-[9px] text-slate-500 mt-2 leading-tight">Share this with the driver only when they arrive at the pickup location.</p>
                  </div>
                )}

                {/* Secure Delivery Glassmorphism Disclaimer */}
                {order.status === "assigned" && order.driver_id && (
                  <div className="backdrop-blur-md bg-white/70 border border-slate-200/50 shadow-lg rounded-xl p-4 mb-5 text-slate-800 text-xs flex flex-col gap-2.5">
                    <div className="flex items-center gap-2 text-amber-600 font-bold">
                      <ShieldCheck size={16} />
                      <span>Secure Delivery Verification</span>
                    </div>
                    <div className="space-y-1.5 border-t border-slate-200/50 pt-2 text-[11px] text-slate-600">
                      <div className="flex justify-between">
                        <span className="font-semibold text-slate-500 uppercase tracking-tight">Driver Name</span>
                        <span className="font-bold text-slate-800">{order.driver_name || "Professional Partner"}</span>
                      </div>
                      {order.driver_vehicle_plate && (
                        <div className="flex justify-between">
                          <span className="font-semibold text-slate-500 uppercase tracking-tight">Vehicle Plate</span>
                          <span className="font-mono font-bold text-slate-900 uppercase bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">{order.driver_vehicle_plate}</span>
                        </div>
                      )}
                      {order.driver_vehicle_model && (
                        <div className="flex justify-between">
                          <span className="font-semibold text-slate-500 uppercase tracking-tight">Vehicle Model</span>
                          <span className="font-bold text-slate-800 capitalize">{order.driver_vehicle_type || 'Vehicle'} - {order.driver_vehicle_model}</span>
                        </div>
                      )}
                      {order.driver_vehicle_photo && (
                        <div className="mt-2 overflow-hidden rounded-lg border border-slate-200 bg-slate-50 relative aspect-[16/9] max-h-32 flex items-center justify-center">
                          <img 
                            src={order.driver_vehicle_photo} 
                            alt="Driver Vehicle" 
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )}
                    </div>
                    <div className="bg-amber-500/10 border border-amber-500/20 text-amber-800 rounded-lg p-2.5 text-[10px] leading-relaxed mt-1">
                      <strong>⚠️ Secure Delivery Warning:</strong> Please check and match the driver's vehicle plate (<strong>{order.driver_vehicle_plate || 'N/A'}</strong>) and model (<strong>{order.driver_vehicle_model || 'N/A'}</strong>) before sharing the Secret OTP.
                    </div>
                  </div>
                )}

                {order.driver_id ? (
                  <Button 
                    onClick={() => setChatOpen(true)}
                    className="w-full text-xs font-bold h-10 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl flex items-center justify-center gap-2 transition-all"
                  >
                    <MessageSquare size={14} />
                    Chat with Driver
                    {order.messages && order.messages.length > 0 && (
                      <span className="bg-red-500 text-white text-[9px] font-black h-5 w-5 flex items-center justify-center rounded-full ml-1 animate-pulse">
                        {order.messages.length}
                      </span>
                    )}
                  </Button>
                ) : (
                  <Button variant="outline" className="w-full text-[10px] font-bold h-9 border-slate-200 text-slate-400 bg-slate-50" disabled>
                    Waiting for Driver
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* Proof of Delivery Card */}
            {order.status === "delivered" && order.signature && (
              <Card className="border border-slate-200 shadow-sm bg-white text-slate-900 overflow-hidden">
                <CardHeader className="pb-3 border-b border-slate-200">
                  <CardTitle className="text-xs font-black uppercase tracking-widest text-emerald-600 flex items-center gap-2">
                    <ShieldCheck size={16} /> Proof of Delivery
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4 space-y-4">
                  <div className="space-y-1">
                    <p className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Receiver Signature</p>
                    <div className="h-24 w-full rounded-xl overflow-hidden border border-slate-200 bg-slate-50 p-2 flex items-center justify-center">
                      <img src={order.signature} alt="Customer Signature" className="max-h-full max-w-full object-contain" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>        {/* Chat Dialog */}
        <Dialog open={chatOpen} onOpenChange={setChatOpen}>
          <DialogContent className="sm:max-w-md border border-slate-200 shadow-2xl p-6 bg-white text-slate-900 flex flex-col h-[500px]">
            <DialogHeader className="border-b border-slate-200 pb-3 flex-shrink-0">
              <div className="flex items-center gap-3 text-left">
                <div className="h-9 w-9 bg-primary/10 text-primary rounded-full flex items-center justify-center">
                  <MessageSquare size={18} />
                </div>
                <div>
                  <DialogTitle className="text-sm font-black text-slate-900 font-sans">
                    Chat with Driver
                  </DialogTitle>
                  <DialogDescription className="text-slate-500 text-[10px] uppercase font-bold tracking-wider mt-0.5">
                    Order PP-{order.id.slice(0, 8).toUpperCase()} • Driver: {order.driver_name || "Driver"}
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>
 
            <div className="flex-1 overflow-y-auto py-4 space-y-3 min-h-0">
              {order.messages && order.messages.length > 0 ? (
                order.messages.map((msg: any) => {
                  const isMe = msg.sender_role === "user" || msg.sender_role === "customer";
                  return (
                    <div key={msg.id} className={cn("flex flex-col max-w-[80%]", isMe ? "ml-auto items-end" : "mr-auto items-start")}>
                      <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest mb-1">
                        {isMe ? "You" : (order.driver_name || msg.sender_name || "Driver")}
                      </span>
                      <div className={cn(
                        "p-3 rounded-2xl text-xs leading-relaxed",
                        isMe 
                          ? "bg-primary text-primary-foreground rounded-tr-none shadow-lg shadow-primary/10" 
                          : "bg-slate-100 text-slate-800 rounded-tl-none border border-slate-200"
                      )}>
                        {msg.text}
                      </div>
                      <span className="text-[7px] text-slate-400 mt-1">
                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  );
                })
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center p-4">
                  <MessageSquare size={32} className="text-slate-300 mb-2 animate-bounce" />
                  <p className="text-xs font-bold text-slate-500">No chat history</p>
                  <p className="text-[10px] text-slate-400 mt-1">Send a message to coordinate pickup or delivery details with the driver.</p>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
 
            <div className="border-t border-slate-200 pt-3 flex-shrink-0 flex gap-2">
              <Input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSendChatMessage();
                }}
                placeholder="Type message here..."
                className="bg-slate-50 border-slate-200 text-xs rounded-xl focus:ring-primary focus:border-primary text-slate-800 font-medium"
              />
              <Button 
                onClick={handleSendChatMessage} 
                disabled={sendingMsg || !chatInput.trim()}
                className="rounded-xl px-4 bg-primary text-primary-foreground font-bold text-xs gap-1.5"
              >
                {sendingMsg ? <Loader2 className="animate-spin h-3.5 w-3.5" /> : <Send size={14} />}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}