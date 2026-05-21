import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { CreditCard, Landmark, Wallet, Banknote, ArrowLeft, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQueryClient } from "@tanstack/react-query";
import { API_URL } from "@/config";

export default function Payment() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [method, setMethod] = useState("cod");

  // Data passed from SendPackage.tsx
  const orderData = location.state || { 
    price: 0, 
    pickupLocation: "", 
    dropLocation: "", 
    distance: 0,
    weight: 1,
    category: "personal",
    pickupLat: 0,
    pickupLon: 0,
    dropLat: 0,
    dropLon: 0
  };

  const handleConfirmOrder = async () => {
    if (method !== "cod") {
      toast.error("Online payment is currently under maintenance. Please use COD.");
      return;
    }

    if (!user) return;
    setIsSubmitting(true);

    try {
      const token = localStorage.getItem("pp_token");
      const res = await fetch(`${API_URL}/api/orders`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          pickup_location: orderData.pickupLocation,
          pickup_lat: orderData.pickupLat || 30.7333, // Defaulting to city center if missing
          pickup_lng: orderData.pickupLon || 76.7794,
          drop_location: orderData.dropLocation,
          drop_lat: orderData.dropLat || 30.7333,
          drop_lng: orderData.dropLon || 76.7794,
          distance_km: orderData.distance,
          price: orderData.price,
          weight_category: `${orderData.weight}kg (${orderData.category})`
        })
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to place order");
      }

      await queryClient.invalidateQueries({ queryKey: ["orders"] });
      toast.success("Order Placed Successfully!");
      navigate("/dashboard");
    } catch (err: any) {
      toast.error(err.message || "Failed to place order");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <DashboardLayout title="Secure Checkout">
      <div className="max-w-xl mx-auto space-y-6">
        <Button variant="ghost" onClick={() => navigate(-1)} className="gap-2 text-muted-foreground">
          <ArrowLeft size={16} /> Edit Details
        </Button>

        <Card className="border-none shadow-xl overflow-hidden">
          <CardHeader className="bg-slate-900 text-white p-6">
            <CardTitle className="font-heading text-xl flex items-center gap-2">
              <ShieldCheck className="text-blue-400" /> Finalize Payment
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-8">
            <RadioGroup value={method} onValueChange={setMethod} className="grid gap-3">
              {[
                { id: "upi", label: "UPI / PhonePe", icon: Wallet, disabled: true },
                { id: "cod", label: "Cash on Delivery", icon: Banknote, disabled: false },
              ].map((item) => (
                <Label
                  key={item.id}
                  className={`flex items-center justify-between p-4 border-2 rounded-2xl transition-all ${
                    item.disabled ? "opacity-50 cursor-not-allowed bg-slate-50" : "cursor-pointer"
                  } ${method === item.id ? "border-primary bg-primary/5" : "border-transparent bg-slate-50"}`}
                >
                  <div className="flex items-center gap-3">
                    <item.icon size={20} className={method === item.id ? "text-primary" : "text-slate-400"} />
                    <span className="font-bold text-sm">{item.label}</span>
                  </div>
                  <RadioGroupItem value={item.id} disabled={item.disabled} />
                </Label>
              ))}
            </RadioGroup>

            <div className="bg-slate-900 rounded-3xl p-6 text-white space-y-4">
              <div className="flex justify-between items-end">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total Fare</p>
                  <p className="text-3xl font-black">₹{orderData.price}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Estimate</p>
                  <p className="font-bold text-sm">{orderData.distance} km</p>
                </div>
              </div>
              <Button 
                className="w-full h-14 rounded-2xl bg-white text-slate-900 hover:bg-slate-100 font-black text-lg transition-transform active:scale-95" 
                onClick={handleConfirmOrder}
                disabled={isSubmitting}
              >
                {isSubmitting ? "Processing..." : "Confirm & Ship"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}