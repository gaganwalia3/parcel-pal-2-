import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Package, Truck, User } from "lucide-react";

export default function Auth() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [isDriver, setIsDriver] = useState(false); // Toggle state for Role
  const navigate = useNavigate();

  const { updateSession } = useAuth(); // We need to import useAuth and use its updateSession method

  const handleAuth = async (type: "login" | "signup") => {
    setLoading(true);
    try {
      if (type === "signup") {
        const res = await fetch('http://localhost:3001/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email,
            password,
            role: isDriver ? "driver" : "user"
          })
        });
        
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Registration failed');
        
        toast.success("Account created! Please log in.");
        // Switch to login tab in a real app, but for now we'll just show the toast
      } else {
        const res = await fetch('http://localhost:3001/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Login failed');

        toast.success("Welcome back!");
        // Update session locally
        updateSession(data.user, data.access_token);
        navigate("/"); // App.tsx will handle the redirect based on the role
      }
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4 font-body">
      <Card className="w-full max-w-md border-none shadow-2xl">
        <CardHeader className="text-center space-y-1">
          <div className="mx-auto h-12 w-12 bg-primary rounded-xl flex items-center justify-center mb-4">
            <Package className="text-primary-foreground h-6 w-6" />
          </div>
          <CardTitle className="text-2xl font-heading font-bold">ParcelPal</CardTitle>
          <CardDescription>Premium Logistics for the Modern World</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="login" className="space-y-6">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Login</TabsTrigger>
              <TabsTrigger value="signup">Sign Up</TabsTrigger>
            </TabsList>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email text-xs uppercase font-bold text-muted-foreground">Email Address</Label>
                <Input 
                  id="email" 
                  type="email" 
                  placeholder="name@example.com" 
                  value={email} 
                  onChange={(e) => setEmail(e.target.value)} 
                  className="h-11"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password text-xs uppercase font-bold text-muted-foreground">Password</Label>
                <Input 
                  id="password" 
                  type="password" 
                  value={password} 
                  onChange={(e) => setPassword(e.target.value)} 
                  className="h-11"
                />
              </div>

              {/* Role Toggle - Visible on Signup */}
              <TabsContent value="signup" className="pt-2">
                <div className="flex items-center justify-between p-4 bg-muted/50 rounded-xl border border-dashed border-muted-foreground/20">
                  <div className="flex items-center gap-3">
                    {isDriver ? <Truck className="text-primary" size={20} /> : <User className="text-primary" size={20} />}
                    <div>
                      <p className="text-sm font-bold capitalize">Register as {isDriver ? "Driver" : "Customer"}</p>
                      <p className="text-[10px] text-muted-foreground">I want to {isDriver ? "deliver packages" : "send packages"}</p>
                    </div>
                  </div>
                  <Switch 
                    checked={isDriver} 
                    onCheckedChange={setIsDriver} 
                  />
                </div>
              </TabsContent>

              <TabsContent value="login">
                <Button 
                  className="w-full h-11 font-bold" 
                  onClick={() => handleAuth("login")} 
                  disabled={loading}
                >
                  {loading ? "Authenticating..." : "Sign In"}
                </Button>
              </TabsContent>

              <TabsContent value="signup">
                <Button 
                  className="w-full h-11 font-bold shadow-lg shadow-primary/20" 
                  onClick={() => handleAuth("signup")} 
                  disabled={loading}
                >
                  {loading ? "Creating Account..." : `Join as ${isDriver ? "Driver" : "Customer"}`}
                </Button>
              </TabsContent>
            </div>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}