import { useState, useEffect, useRef, useCallback } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { 
  MapPin, Navigation, CheckCircle2, Loader2, Handshake, Box, 
  Map as MapIcon, Wallet, Landmark, ArrowUpRight, ArrowDownLeft,
  Send, MessageSquare, Sparkles, Truck
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { haversineDistance } from "@/lib/geo";
import { AnimatedRouteMap } from "@/components/AnimatedRouteMap";
import { cn } from "@/lib/utils";

export default function DriverDashboard() {
  const { user, refreshProfile } = useAuth();
  const queryClient = useQueryClient();
  const getDriverToken = () => localStorage.getItem("pp_driver_token") || localStorage.getItem("pp_token");
  const [loadingId, setLoadingId] = useState<string | null>(null);
  
  // Geofence states
  const [devBypass, setDevBypass] = useState(true); // Default true for the demo presentation
  const [otpDialogItem, setOtpDialogItem] = useState<any>(null);
  const [otpInput, setOtpInput] = useState("");

  // Wallet States
  const [wallet, setWallet] = useState<any>({ balance: 0, transactions: [] });
  const [loadingWallet, setLoadingWallet] = useState(false);
  const [withdrawDialogOpen, setWithdrawDialogOpen] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [withdrawing, setWithdrawing] = useState(false);

  // New Simulation, Chat, & POD States
  const [simulatingJobId, setSimulatingJobId] = useState<string | null>(null);
  const [activeChatJobId, setActiveChatJobId] = useState<string | null>(null);
  const [chatInput, setChatInput] = useState("");
  const [podDialogItem, setPodDialogItem] = useState<any>(null);
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const [sendingMsg, setSendingMsg] = useState(false);
  const [optimizingOpen, setOptimizingOpen] = useState(false);

  // Vehicle Info States
  const [vehicleType, setVehicleType] = useState("bike");
  const [vehicleModel, setVehicleModel] = useState("");
  const [vehiclePlate, setVehiclePlate] = useState("");
  const [vehiclePhotoBase64, setVehiclePhotoBase64] = useState<string | null>(null);
  const [licensePhotoBase64, setLicensePhotoBase64] = useState<string | null>(null);
  const [registeringVehicle, setRegisteringVehicle] = useState(false);
  const [vehicleDialogOpen, setVehicleDialogOpen] = useState(false);

  const isVehicleMissing = !user?.vehicle_info || !user?.vehicle_info.plate || !user?.vehicle_info.model;
  const showVehicleModal = isVehicleMissing || vehicleDialogOpen;

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawingRef = useRef(false);
  const simIntervals = useRef<{ [orderId: string]: NodeJS.Timeout }>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Wallet fetch definition wrapped in useCallback
  const fetchWallet = useCallback(async () => {
    setLoadingWallet(true);
    try {
      const token = getDriverToken();
      const res = await fetch("http://localhost:3001/api/wallet/balance", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setWallet(data);
      }
    } catch (err) {
      console.error("Failed to fetch driver wallet:", err);
    } finally {
      setLoadingWallet(false);
    }
  }, []);

  // Cleanup simulation timers on unmount
  useEffect(() => {
    return () => {
      Object.values(simIntervals.current).forEach(clearInterval);
    };
  }, []);

  // SSE Notifications for real-time order and chat updates
  useEffect(() => {
    const token = getDriverToken();
    if (!token) return;

    const eventSource = new EventSource(`http://localhost:3001/api/orders/notifications/sse?token=${token}`);

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "order_updated") {
          queryClient.invalidateQueries({ queryKey: ["driver-jobs"] });
          if (data.order && data.order.status === "delivered") {
            fetchWallet();
          }
        }
      } catch (err) {
        console.error("SSE parse error in Driver Dashboard:", err);
      }
    };

    eventSource.onerror = (err) => {
      console.error("SSE connection error in Driver Dashboard, closing...", err);
      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  }, [queryClient, fetchWallet]);

  useEffect(() => {
    fetchWallet();
  }, [fetchWallet]);

  useEffect(() => {
    refreshProfile();
  }, [refreshProfile]);

  useEffect(() => {
    if (user?.vehicle_info) {
      setVehicleType(user.vehicle_info.type || "bike");
      setVehicleModel(user.vehicle_info.model || "");
      setVehiclePlate(user.vehicle_info.plate || "");
      setVehiclePhotoBase64(user.vehicle_info.photo || null);
      setLicensePhotoBase64(user.vehicle_info.license_photo || null);
    }
  }, [user]);

  const uploadImageFile = async (base64Data: string, folder: string): Promise<string> => {
    const token = getDriverToken();
    const res = await fetch("http://localhost:3001/api/upload", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({ image: base64Data, folder })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Failed to upload image");
    }
    const data = await res.json();
    return data.url;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, setBase64: (val: string | null) => void) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (!file.type.startsWith('image/')) {
      toast.error("Please upload an image file");
      return;
    }
    
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image size should be less than 5MB");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setBase64(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleRegisterVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vehicleModel.trim() || !vehiclePlate.trim()) {
      toast.error("Please fill in all vehicle details");
      return;
    }
    if (!vehiclePhotoBase64) {
      toast.error("Please upload a vehicle photo");
      return;
    }
    if (!licensePhotoBase64) {
      toast.error("Please upload your driving license photo");
      return;
    }
    setRegisteringVehicle(true);
    try {
      let finalVehiclePhotoUrl = vehiclePhotoBase64;
      let finalLicensePhotoUrl = licensePhotoBase64;

      if (vehiclePhotoBase64.startsWith("data:")) {
        finalVehiclePhotoUrl = await uploadImageFile(vehiclePhotoBase64, "vehicles");
      }
      if (licensePhotoBase64.startsWith("data:")) {
        finalLicensePhotoUrl = await uploadImageFile(licensePhotoBase64, "licenses");
      }

      const token = getDriverToken();
      const res = await fetch("http://localhost:3001/api/auth/profile", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          vehicle_info: {
            type: vehicleType,
            model: vehicleModel,
            plate: vehiclePlate,
            photo: finalVehiclePhotoUrl,
            license_photo: finalLicensePhotoUrl
          }
        })
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to save vehicle details");
      }
      toast.success(isVehicleMissing ? "Vehicle registered successfully! You can now accept deliveries." : "Vehicle details updated successfully!");
      setVehicleDialogOpen(false);
      await refreshProfile();
    } catch (err: any) {
      toast.error(err.message || "Failed to save vehicle details");
    } finally {
      setRegisteringVehicle(false);
    }
  };

  const handleWithdraw = async () => {
    if (!withdrawAmount || !bankName || !accountNumber) return;
    setWithdrawing(true);
    try {
      const token = getDriverToken();
      const res = await fetch("http://localhost:3001/api/wallet/withdraw", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          amount: Number(withdrawAmount),
          bankName,
          accountNumber
        })
      });

      if (res.ok) {
        toast.success(`Withdrawal of ₹${withdrawAmount} successful!`);
        setWithdrawDialogOpen(false);
        setWithdrawAmount("");
        setBankName("");
        setAccountNumber("");
        fetchWallet();
      } else {
        const err = await res.json();
        throw new Error(err.error || "Withdrawal failed");
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setWithdrawing(false);
    }
  };

  const { data: jobs, isLoading } = useQuery({
    queryKey: ["driver-jobs", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const token = getDriverToken();
      const res = await fetch("http://localhost:3001/api/orders", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Failed to fetch jobs");
      const data = await res.json();
      return data.filter((o: any) => o.status !== "delivered" && o.status !== "cancelled" && (o.status === "pending" || (user?.id && o.driver_id === user.id)))
                 .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    },
  });

  // Auto-scroll messages list to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [jobs, activeChatJobId]);

  const verifyLocation = async (targetLat: number, targetLng: number): Promise<boolean> => {
    if (devBypass) return true; // Instantly return true if bypass is on

    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        toast.error("Geolocation is not supported by your browser");
        resolve(false);
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          // Calculate distance in KM
          const distKm = haversineDistance(latitude, longitude, targetLat, targetLng);
          const distMeters = distKm * 1000;
          
          if (distMeters <= 100) {
            resolve(true);
          } else {
            toast.error(`You are ${Math.round(distMeters)}m away! Must be within 100m to proceed.`);
            resolve(false);
          }
        },
        (error) => {
          toast.error("Failed to get location. Enable GPS permissions.");
          resolve(false);
        },
        { enableHighAccuracy: true }
      );
    });
  };

  // Chat message submit handler
  const handleSendChatMessage = async (jobId: string) => {
    if (!chatInput.trim()) return;
    setSendingMsg(true);
    try {
      const token = getDriverToken();
      const res = await fetch(`http://localhost:3001/api/orders/${jobId}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ text: chatInput, sender_role: "driver" })
      });
      if (res.ok) {
        setChatInput("");
        queryClient.invalidateQueries({ queryKey: ["driver-jobs"] });
      } else {
        throw new Error("Failed to send message");
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSendingMsg(false);
    }
  };

  // Start route coordinate simulation from Driver to Pickup (Assigned -> Arrived)
  const runPickupSimulation = (job: any) => {
    if (simIntervals.current[job.id]) return;
    setSimulatingJobId(job.id);
    let step = 0;
    const totalSteps = 12;
    const startLat = job.pickup_lat - 0.008;
    const startLng = job.pickup_lng - 0.008;

    executePatch(job.id, { 
      status: "on_the_way", 
      driver_lat: startLat, 
      driver_lng: startLng,
      eta_mins: 8,
      remaining_km: 1.5,
      arrived_at_pickup: false
    }, "on_the_way");

    const timer = setInterval(async () => {
      step++;
      const pct = step / totalSteps;
      const curLat = startLat + (job.pickup_lat - startLat) * pct;
      const curLng = startLng + (job.pickup_lng - startLng) * pct;
      const remainingKm = Math.max(0, 1.5 * (1 - pct));
      const etaMins = Math.max(0, Math.ceil(8 * (1 - pct)));

      const isDone = step >= totalSteps;
      
      const patchData: any = {
        driver_lat: curLat,
        driver_lng: curLng,
        eta_mins: etaMins,
        remaining_km: remainingKm
      };

      if (isDone) {
        clearInterval(timer);
        delete simIntervals.current[job.id];
        setSimulatingJobId(null);
        patchData.status = "assigned";
        patchData.arrived_at_pickup = true;
      }

      try {
        const token = getDriverToken();
        await fetch(`http://localhost:3001/api/orders/${job.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
          body: JSON.stringify(patchData)
        });
        queryClient.invalidateQueries({ queryKey: ["driver-jobs"] });
        if (isDone) {
          toast.success("You have arrived at the pickup location!");
        }
      } catch (err) {
        console.error(err);
      }
    }, 1500);

    simIntervals.current[job.id] = timer;
  };

  // Start route coordinate simulation from Pickup to Dropoff (Picked Up -> Arrived)
  const runDropoffSimulation = (job: any) => {
    if (simIntervals.current[job.id]) return;
    setSimulatingJobId(job.id);
    let step = 0;
    const totalSteps = 15;
    const startLat = job.pickup_lat;
    const startLng = job.pickup_lng;

    executePatch(job.id, { 
      status: "in_transit", 
      driver_lat: startLat, 
      driver_lng: startLng,
      eta_mins: 15,
      remaining_km: job.distance_km,
      arrived_at_dropoff: false
    }, "in_transit");

    const timer = setInterval(async () => {
      step++;
      const pct = step / totalSteps;
      const curLat = startLat + (job.drop_lat - startLat) * pct;
      const curLng = startLng + (job.drop_lng - startLng) * pct;
      const remainingKm = Math.max(0, job.distance_km * (1 - pct));
      const etaMins = Math.max(0, Math.ceil(15 * (1 - pct)));

      const isDone = step >= totalSteps;
      
      const patchData: any = {
        driver_lat: curLat,
        driver_lng: curLng,
        eta_mins: etaMins,
        remaining_km: remainingKm
      };

      if (isDone) {
        clearInterval(timer);
        delete simIntervals.current[job.id];
        setSimulatingJobId(null);
        patchData.status = "picked_up";
        patchData.arrived_at_dropoff = true;
      }

      try {
        const token = getDriverToken();
        await fetch(`http://localhost:3001/api/orders/${job.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
          body: JSON.stringify(patchData)
        });
        queryClient.invalidateQueries({ queryKey: ["driver-jobs"] });
        if (isDone) {
          toast.success("You have arrived at the destination dropoff!");
        }
      } catch (err) {
        console.error(err);
      }
    }, 1500);

    simIntervals.current[job.id] = timer;
  };

  const handleStatusUpdate = async (jobId: string, currentStatus: string, jobData: any) => {
    if (currentStatus === "pending") {
      setLoadingId(jobId);
      const updateData = { 
        status: "assigned", 
        driver_id: user?.id,
        driver_name: user?.user_metadata?.full_name || user?.email?.split('@')[0],
        driver_lat: jobData.pickup_lat - 0.008,
        driver_lng: jobData.pickup_lng - 0.008,
        eta_mins: 8,
        remaining_km: 1.5,
        arrived_at_pickup: false
      };
      await executePatch(jobId, updateData, "assigned");
      setLoadingId(null);
      return;
    }

    if (currentStatus === "assigned") {
      // If driver has not arrived at pickup, start simulated run
      if (!jobData.arrived_at_pickup) {
        runPickupSimulation(jobData);
        return;
      }
      // If driver is at pickup, verify OTP
      setOtpInput("");
      setOtpDialogItem(jobData);
      return;
    }

    if (currentStatus === "picked_up" || currentStatus === "in_transit") {
      // If driver hasn't started movement, start delivery simulation
      if (!jobData.arrived_at_dropoff) {
        runDropoffSimulation(jobData);
        return;
      }
      // Open POD Dialog
      setPhotoBase64(null);
      setPodDialogItem(jobData);
      // Wait for DOM paint then configure canvas size
      setTimeout(clearCanvas, 100);
      return;
    }
  };

  const handleVerifyOTP = async () => {
    if (!otpDialogItem || !otpInput) return;
    
    setLoadingId(otpDialogItem.id);
    try {
      const token = getDriverToken();
      const res = await fetch(`http://localhost:3001/api/orders/${otpDialogItem.id}/verify-pickup`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ otp: otpInput })
      });
      
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to verify OTP");
      }
      
      toast.success(`OTP Verified! Shipment picked up.`);
      setOtpDialogItem(null);
      queryClient.invalidateQueries({ queryKey: ["driver-jobs"] });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoadingId(null);
    }
  };

  // Proof of delivery signature canvas methods
  const getCanvasMousePos = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  };

  const getCanvasTouchPos = (e: React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || e.touches.length === 0) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches[0];
    return {
      x: touch.clientX - rect.left,
      y: touch.clientY - rect.top
    };
  };

  const startDrawing = (pos: { x: number, y: number }) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    isDrawingRef.current = true;
  };

  const draw = (pos: { x: number, y: number }) => {
    if (!isDrawingRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.lineTo(pos.x, pos.y);
    ctx.strokeStyle = "#10b981"; // Emerald color drawing line
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke();
  };

  const stopDrawing = () => {
    isDrawingRef.current = false;
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const handlePhotoSelect = (mockUrl: string) => {
    setPhotoBase64(mockUrl);
    toast.success("Delivery photo attached!");
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setPhotoBase64(reader.result as string);
      toast.success("Custom door photo uploaded!");
    };
    reader.readAsDataURL(file);
  };

  const submitProofOfDelivery = async () => {
    const canvas = canvasRef.current;
    if (!canvas || !podDialogItem) return;
    
    setLoadingId(podDialogItem.id);
    try {
      const signature = canvas.toDataURL(); // Get base64 PNG

      const token = getDriverToken();
      const res = await fetch(`http://localhost:3001/api/orders/${podDialogItem.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ 
          status: "delivered",
          signature
        })
      });

      if (!res.ok) throw new Error("Failed to submit proof of delivery");

      toast.success("Shipment successfully delivered with Proof of Delivery!");
      setPodDialogItem(null);
      fetchWallet();
      queryClient.invalidateQueries({ queryKey: ["driver-jobs"] });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoadingId(null);
    }
  };

  // Multi-stop Route Optimizer TSP greedy solver
  const getOptimizedStops = (activeJobs: any[]) => {
    const driverPos = { lat: 30.6847538, lng: 76.852397 };
    
    const stops: any[] = [];
    activeJobs.forEach(job => {
      if (job.status === 'assigned' || job.status === 'on_the_way') {
        stops.push({
          id: `${job.id}-pickup`,
          type: 'Pickup Point',
          address: job.pickup_location,
          lat: job.pickup_lat,
          lng: job.pickup_lng,
          tracking: job.tracking_number,
          jobId: job.id
        });
      }
      stops.push({
        id: `${job.id}-dropoff`,
        type: 'Destination Dropoff',
        address: job.drop_location,
        lat: job.drop_lat,
        lng: job.drop_lng,
        tracking: job.tracking_number,
        jobId: job.id
      });
    });

    let current = driverPos;
    const ordered: any[] = [];
    const visited = new Set<string>();
    const pickedUp = new Set<string>();

    activeJobs.forEach(job => {
      if (job.status === 'picked_up' || job.status === 'in_transit') {
        pickedUp.add(job.id);
      }
    });

    while (stops.length > ordered.length) {
      let bestStop: any = null;
      let minDistance = Infinity;

      for (const stop of stops) {
        if (visited.has(stop.id)) continue;

        // Cannot drop off unless pickup stop has been visited
        if (stop.id.endsWith('-dropoff') && !pickedUp.has(stop.jobId)) {
          const hasPickup = ordered.some(s => s.id === `${stop.jobId}-pickup`);
          if (!hasPickup) continue;
        }

        const dist = haversineDistance(current.lat, current.lng, stop.lat, stop.lng);
        if (dist < minDistance) {
          minDistance = dist;
          bestStop = stop;
        }
      }

      if (!bestStop) break;

      visited.add(bestStop.id);
      ordered.push(bestStop);
      current = { lat: bestStop.lat, lng: bestStop.lng };
    }

    return ordered;
  };

  const executePatch = async (jobId: string, updateData: any, nextStatus: string) => {
    try {
      const token = getDriverToken();
      const res = await fetch(`http://localhost:3001/api/orders/${jobId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify(updateData)
      });
      if (!res.ok) throw new Error("Failed to update status");
      toast.success(`Shipment updated to ${nextStatus.replace('_', ' ')}`);
      queryClient.invalidateQueries({ queryKey: ["driver-jobs"] });
      if (nextStatus === "delivered") {
        fetchWallet();
      }
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleCancelJob = async (jobId: string) => {
    if (!window.confirm("Are you sure you want to cancel/release this job? It will be returned to the pending queue for other drivers.")) {
      return;
    }
    setLoadingId(jobId);
    try {
      // Clear simulation interval if running
      if (simIntervals.current[jobId]) {
        clearInterval(simIntervals.current[jobId]);
        delete simIntervals.current[jobId];
      }
      if (simulatingJobId === jobId) {
        setSimulatingJobId(null);
      }

      const token = getDriverToken();
      const res = await fetch(`http://localhost:3001/api/orders/${jobId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ status: "pending" })
      });
      
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to cancel/release job");
      }
      
      toast.success("Job released and returned to public pool");
      queryClient.invalidateQueries({ queryKey: ["driver-jobs"] });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoadingId(null);
    }
  };


  // Accepted driver jobs list (not delivered)
  const acceptedJobs = jobs ? jobs.filter((j: any) => j.status !== "pending") : [];

  return (
    <DashboardLayout title="Driver Terminal">
      <div className="max-w-5xl mx-auto space-y-6 pb-20">
        
        {/* Dev Bypass Toggle for Evaluation Demo */}
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3 text-amber-750">
            <MapIcon size={20} />
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-amber-550">Demo Override</p>
              <p className="text-[10px] opacity-80 text-amber-600">Bypass the strict 100m GPS Geofence requirement for the presentation.</p>
            </div>
          </div>
          <Switch checked={devBypass} onCheckedChange={setDevBypass} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          {/* Main Area: Active Log */}
          <div className="lg:col-span-2 space-y-6">
            <header className="flex justify-between items-center flex-wrap gap-4">
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-black tracking-tighter">Active Log</h1>
                <Badge className="bg-primary/10 text-primary border-primary/20 hover:bg-primary/10 px-4 py-1 rounded-full uppercase text-[10px] font-black">
                  Available Routes: {jobs?.length || 0}
                </Badge>
              </div>
              {acceptedJobs.length > 1 && (
                <Button 
                  onClick={() => setOptimizingOpen(true)}
                  className="rounded-xl px-4 py-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white font-black text-xs gap-2 shadow-lg shadow-indigo-500/20"
                >
                  <Sparkles size={14} /> Optimize Multi-Stop Route ({acceptedJobs.length} Jobs)
                </Button>
              )}
            </header>

            {isLoading ? (
              <div className="flex justify-center py-20"><Loader2 className="animate-spin h-10 w-10 text-primary" /></div>
            ) : jobs && jobs.length > 0 ? (
              <div className="grid grid-cols-1 gap-6">
                {jobs.map((job) => (
                  <Card key={job.id} className="border border-slate-200 shadow-sm overflow-hidden group bg-white text-slate-900">
                    <div className="flex flex-col lg:flex-row">
                      {/* Left Side: Info */}
                      <div className="flex-1">
                        <CardHeader className="bg-slate-55 border-b border-slate-200 p-4 flex flex-row justify-between items-center">
                          <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">ID: {job.id.slice(0, 8)}</span>
                          <p className="font-black text-primary text-lg">₹{job.price}</p>
                        </CardHeader>
                        <CardContent className="p-6 space-y-6">
                          <div className="space-y-4">
                            <div className="flex gap-4">
                              <div className="mt-1"><Navigation size={16} className="text-blue-500" /></div>
                              <div>
                                <p className="text-[10px] font-black text-slate-500 uppercase">Pickup Point</p>
                                <p className="text-sm font-bold text-slate-800">{job.pickup_location}</p>
                              </div>
                            </div>
                            <div className="flex gap-4">
                              <div className="mt-1"><MapPin size={16} className="text-orange-500" /></div>
                              <div>
                                <p className="text-[10px] font-black text-slate-500 uppercase">Destination</p>
                                <p className="text-sm font-bold text-slate-800">{job.drop_location}</p>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-3 pt-4 border-t border-slate-200 flex-wrap justify-between">
                            <Badge variant="outline" className="capitalize font-bold text-[10px] py-1 px-3 border-slate-200 text-slate-600 bg-slate-50">
                              {job.status.replace('_', ' ')}
                            </Badge>
                            
                            <div className="flex items-center gap-2">
                              <Button 
                                onClick={() => handleStatusUpdate(job.id, job.status, job)}
                                disabled={isVehicleMissing || loadingId === job.id || job.status === "on_the_way" || job.status === "in_transit"}
                                className="rounded-xl px-6 font-black text-xs gap-2"
                              >
                                {loadingId === job.id ? <Loader2 className="animate-spin h-4 w-4" /> : (
                                  job.status === "pending" ? <><Handshake size={16}/> Accept Job</> :
                                  job.status === "on_the_way" ? <><Loader2 className="animate-spin h-4 w-4"/> Transit Active</> :
                                  job.status === "assigned" && !job.arrived_at_pickup ? <><Navigation size={16}/> Start Transit</> :
                                  job.status === "assigned" && job.arrived_at_pickup ? <><Box size={16}/> Enter Pickup OTP</> :
                                  job.status === "picked_up" && !job.arrived_at_dropoff ? <><Navigation size={16}/> Start Transit</> :
                                  job.status === "in_transit" ? <><Loader2 className="animate-spin h-4 w-4"/> Delivering...</> :
                                  <><CheckCircle2 size={16}/> Deliver (POD)</>
                                )}
                              </Button>

                              {(job.status === "assigned" || job.status === "on_the_way") && (
                                <Button
                                  variant="outline"
                                  onClick={() => handleCancelJob(job.id)}
                                  disabled={loadingId === job.id}
                                  className="rounded-xl px-4 font-black text-xs gap-2 border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 hover:text-rose-800 animate-fade-in"
                                >
                                  Cancel Job
                                </Button>
                              )}

                              {job.status !== "pending" && (
                                <Button
                                  variant="outline"
                                  onClick={() => setActiveChatJobId(job.id)}
                                  className="rounded-xl px-4 font-black text-xs gap-2 border-slate-200 bg-white hover:bg-slate-50 text-slate-700"
                                >
                                  <MessageSquare size={16} />
                                  Chat {job.messages && job.messages.length > 0 && (
                                    <span className="bg-primary text-primary-foreground text-[9px] font-black h-4.5 w-4.5 flex items-center justify-center rounded-full ml-1 animate-pulse">
                                      {job.messages.length}
                                    </span>
                                  )}
                                </Button>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </div>
                      
                      {/* Right Side: Map Embed (Only visible if assigned/picked_up/in_transit) */}
                      {job.status !== "pending" && (
                        <div className="lg:w-[400px] h-[320px] lg:h-auto border-l border-slate-200 bg-white flex flex-col justify-center">
                          <AnimatedRouteMap
                            pickupLat={job.pickup_lat}
                            pickupLng={job.pickup_lng}
                            dropLat={job.drop_lat}
                            dropLng={job.drop_lng}
                            driverLat={job.driver_lat}
                            driverLng={job.driver_lng}
                            status={job.status}
                            etaMins={job.eta_mins}
                            remainingKm={job.remaining_km}
                          />
                        </div>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="border-dashed border-2 border-slate-200 bg-transparent flex flex-col items-center justify-center py-16 text-center">
                <Box size={40} className="text-slate-300 mb-4 animate-pulse" />
                <p className="text-sm font-semibold text-slate-500">No active delivery jobs</p>
                <p className="text-xs text-slate-400">New customer requests will appear here in real-time.</p>
              </Card>
            )}
          </div>

          {/* Right Column: Fintech Earnings Wallet */}
          <div className="space-y-6">
            <Card className="border border-slate-200 shadow-sm overflow-hidden bg-white text-slate-900 relative">
              <div className="absolute top-0 right-0 p-4 opacity-5">
                <Wallet size={120} />
              </div>
              <CardContent className="p-6 space-y-6">
                <div className="flex items-center gap-2">
                  <div className="bg-slate-100 p-2 rounded-lg">
                    <Wallet size={20} className="text-slate-800" />
                  </div>
                  <span className="text-xs font-black uppercase tracking-wider text-slate-500">Payout Wallet</span>
                </div>
                
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-slate-500">Available Balance</p>
                  <p className="text-4xl font-black tracking-tight text-slate-900">
                    ₹{Number(wallet.balance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </p>
                </div>

                <Button 
                  onClick={() => setWithdrawDialogOpen(true)}
                  disabled={Number(wallet.balance || 0) <= 0}
                  className="w-full bg-slate-900 text-white hover:bg-slate-800 rounded-xl font-black text-xs h-11 flex items-center justify-center gap-2 transition-transform active:scale-95 animate-fade-in"
                >
                  <Landmark size={16} />
                  Withdraw to Bank
                </Button>
              </CardContent>
            </Card>

            {/* Vehicle Info Card */}
            {user?.vehicle_info && (
              <Card className="border border-slate-200 shadow-sm bg-white text-slate-900 overflow-hidden">
                {user.vehicle_info.photo && (
                  <div className="w-full h-32 overflow-hidden border-b border-slate-100 relative bg-slate-50 flex items-center justify-center">
                    <img 
                      src={user.vehicle_info.photo} 
                      alt="Registered Vehicle" 
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute top-2 right-2 bg-emerald-500/90 backdrop-blur-sm text-white px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider flex items-center gap-1 shadow-sm">
                      <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" /> Active Vehicle
                    </div>
                  </div>
                )}
                <CardContent className="p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="bg-slate-100 p-2 rounded-lg">
                        <Truck size={20} className="text-slate-800" />
                      </div>
                      <span className="text-xs font-black uppercase tracking-wider text-slate-500">Registered Vehicle</span>
                    </div>
                    <Button 
                      variant="ghost" 
                      onClick={() => setVehicleDialogOpen(true)}
                      className="text-xs font-bold text-primary hover:text-primary/80 h-auto p-0"
                    >
                      Edit Info
                    </Button>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 pt-2">
                    <div>
                      <p className="text-[10px] font-semibold text-slate-400 uppercase">Type</p>
                      <p className="text-sm font-black capitalize text-slate-800">{user.vehicle_info.type}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold text-slate-400 uppercase">Model</p>
                      <p className="text-sm font-black text-slate-800">{user.vehicle_info.model}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold text-slate-400 uppercase">Plate Number</p>
                      <p className="text-sm font-black tracking-wider text-slate-800 uppercase">{user.vehicle_info.plate}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold text-slate-400 uppercase">License Status</p>
                      <span className="inline-flex items-center gap-1 mt-0.5 text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100">
                        <CheckCircle2 size={12} className="text-emerald-500" /> Verified
                      </span>
                    </div>
                  </div>

                  {user.vehicle_info.license_photo && (
                    <div className="pt-2 border-t border-slate-100">
                      <p className="text-[10px] font-semibold text-slate-400 uppercase mb-1">Driving License Photo</p>
                      <div className="relative w-full h-16 rounded-lg overflow-hidden border border-slate-200 bg-slate-50 flex items-center justify-center">
                        <img 
                          src={user.vehicle_info.license_photo} 
                          alt="Driving License" 
                          className="h-full w-auto object-contain"
                        />
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            <Card className="border border-slate-200 shadow-sm bg-white text-slate-900">
              <CardHeader className="p-4 border-b border-slate-200">
                <CardTitle className="text-[10px] font-black uppercase tracking-wider flex items-center gap-2 text-slate-400">
                  Transaction Ledger
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {loadingWallet ? (
                  <div className="flex justify-center py-8"><Loader2 className="animate-spin h-6 w-6 text-slate-400" /></div>
                ) : wallet.transactions && wallet.transactions.length > 0 ? (
                  <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
                    {wallet.transactions.map((tx: any) => (
                      <div key={tx.id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg ${tx.type === 'credit' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-rose-500/10 text-rose-600'}`}>
                            {tx.type === 'credit' ? <ArrowUpRight size={18} /> : <ArrowDownLeft size={18} />}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-bold text-slate-800 truncate">{tx.description}</p>
                            <p className="text-[10px] text-slate-400 font-semibold">
                              {new Date(tx.date).toLocaleDateString('en-IN', {
                                day: 'numeric',
                                month: 'short',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </p>
                          </div>
                        </div>
                        <span className={`text-sm font-black whitespace-nowrap ${tx.type === 'credit' ? 'text-emerald-600' : 'text-slate-800'}`}>
                          {tx.type === 'credit' ? '+' : '-'}₹{tx.amount}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-8 text-center text-slate-400">
                    <p className="text-xs font-semibold">No transactions yet</p>
                    <p className="text-[10px] opacity-85 mt-1">Earnings from deliveries and payouts will show up here.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* OTP Dialog for Pickup */}
        <Dialog open={!!otpDialogItem} onOpenChange={() => setOtpDialogItem(null)}>
          <DialogContent className="sm:max-w-md border border-slate-200 shadow-2xl p-8 bg-white text-slate-900">
            <DialogHeader className="text-center">
              <div className="mx-auto w-12 h-12 bg-primary/10 text-primary rounded-full flex items-center justify-center mb-4">
                <Box size={24} />
              </div>
              <DialogTitle className="text-2xl font-black font-heading tracking-tight text-slate-900">Verify Pickup</DialogTitle>
              <DialogDescription className="text-slate-500 text-sm mt-2">
                Ask the sender for the 4-digit Secret OTP to verify package handoff.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-6 mt-4">
              <Input 
                type="text" 
                maxLength={4}
                value={otpInput}
                onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, ''))}
                placeholder="0000"
                className="h-16 text-center text-4xl font-black tracking-[0.5em] bg-slate-55 border-slate-200 text-slate-900 animate-pulse"
              />
              <Button 
                onClick={handleVerifyOTP} 
                disabled={otpInput.length !== 4 || loadingId === otpDialogItem?.id}
                className="w-full h-12 font-bold text-lg"
              >
                {loadingId === otpDialogItem?.id ? <Loader2 className="animate-spin h-5 w-5" /> : "Verify & Pick Up"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Withdraw Payout Dialog */}
        <Dialog open={withdrawDialogOpen} onOpenChange={setWithdrawDialogOpen}>
          <DialogContent className="sm:max-w-md border border-slate-205 shadow-2xl p-8 bg-white text-slate-900">
            <DialogHeader className="text-center">
              <div className="mx-auto w-12 h-12 bg-primary/10 text-primary rounded-full flex items-center justify-center mb-4">
                <Landmark size={24} />
              </div>
              <DialogTitle className="text-2xl font-black font-heading tracking-tight text-slate-900">Withdraw Earnings</DialogTitle>
              <DialogDescription className="text-slate-500 text-sm mt-2">
                Transfer your wallet balance directly to your bank account.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Amount (₹)</label>
                <Input 
                  type="number" 
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  placeholder={`Max ₹${wallet.balance}`}
                  max={wallet.balance}
                  min={1}
                  className="font-bold bg-slate-50 border-slate-205 text-slate-900"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Bank Name</label>
                <Input 
                  type="text" 
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  placeholder="e.g. HDFC Bank, ICICI Bank"
                  className="font-bold bg-slate-50 border-slate-205 text-slate-900"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Account Number</label>
                <Input 
                  type="text" 
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  placeholder="12 to 16 digit account number"
                  className="font-bold bg-slate-50 border-slate-205 text-slate-900"
                />
              </div>
              <Button 
                onClick={handleWithdraw} 
                disabled={!withdrawAmount || Number(withdrawAmount) <= 0 || Number(withdrawAmount) > wallet.balance || !bankName || !accountNumber || withdrawing}
                className="w-full h-12 font-bold text-lg mt-2"
              >
                {withdrawing ? <Loader2 className="animate-spin h-5 w-5" /> : "Transfer to Bank"}
              </Button>
            </div>
          </DialogContent>
               {/* Proof of Delivery (POD) Dialog */}
        <Dialog open={!!podDialogItem} onOpenChange={() => setPodDialogItem(null)}>
          <DialogContent className="sm:max-w-md border border-slate-200 shadow-2xl p-6 bg-white text-slate-900">
            <DialogHeader className="text-center">
              <div className="mx-auto w-12 h-12 bg-emerald-550/10 text-emerald-600 rounded-full flex items-center justify-center mb-2">
                <CheckCircle2 size={24} />
              </div>
              <DialogTitle className="text-xl font-black font-heading tracking-tight text-slate-900">Proof of Delivery</DialogTitle>
              <DialogDescription className="text-slate-500 text-xs mt-1">
                Obtain customer signature to complete delivery.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] font-black uppercase text-slate-505 tracking-wider">Receiver Signature</label>
                  <Button variant="ghost" onClick={clearCanvas} className="h-6 text-[10px] text-rose-600 hover:text-rose-500 p-0 font-bold">Clear</Button>
                </div>
                <div className="bg-slate-50 rounded-xl overflow-hidden border border-slate-200">
                  <canvas
                    ref={canvasRef}
                    width={400}
                    height={150}
                    className="w-full bg-slate-55 cursor-crosshair touch-none"
                    onMouseDown={(e) => startDrawing(getCanvasMousePos(e))}
                    onMouseMove={(e) => draw(getCanvasMousePos(e))}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                    onTouchStart={(e) => {
                      e.preventDefault();
                      startDrawing(getCanvasTouchPos(e));
                    }}
                    onTouchMove={(e) => {
                      e.preventDefault();
                      draw(getCanvasTouchPos(e));
                    }}
                    onTouchEnd={stopDrawing}
                  />
                </div>
              </div>

              <Button 
                onClick={submitProofOfDelivery} 
                disabled={loadingId === podDialogItem?.id}
                className="w-full h-11 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-sm mt-2 gap-2"
              >
                {loadingId === podDialogItem?.id ? <Loader2 className="animate-spin h-4 w-4" /> : <><CheckCircle2 size={16}/> Complete Order Delivery</>}
              </Button>
            </div>
          </DialogContent>
        </Dialog>   </Dialog>          {/* Route Optimizer Dialog */}
        <Dialog open={optimizingOpen} onOpenChange={setOptimizingOpen}>
          <DialogContent className="sm:max-w-md border border-slate-200 shadow-2xl p-6 bg-white text-slate-900">
            <DialogHeader className="text-center">
              <div className="mx-auto w-12 h-12 bg-indigo-500/10 text-indigo-650 rounded-full flex items-center justify-center mb-2">
                <Sparkles size={24} />
              </div>
              <DialogTitle className="text-xl font-black font-heading tracking-tight text-slate-900 font-sans">Multi-Stop Route Optimizer</DialogTitle>
              <DialogDescription className="text-slate-550 text-xs mt-1">
                Stops calculated dynamically using the TSP solver to minimize driving distance.
              </DialogDescription>
            </DialogHeader>
            <div className="mt-4 max-h-[350px] overflow-y-auto pr-1 space-y-4">
              {acceptedJobs.length > 0 ? (
                <div className="relative border-l border-slate-200 pl-6 ml-3 space-y-6">
                  {getOptimizedStops(acceptedJobs).map((stop, idx) => {
                    const isPickup = stop.type === 'Pickup Point';
                    return (
                      <div key={stop.id} className="relative">
                        <div className={cn(
                          "absolute -left-[33px] top-0.5 h-4 w-4 rounded-full border-2 bg-white flex items-center justify-center",
                          isPickup ? "border-blue-500" : "border-emerald-500"
                        )}>
                          <div className={cn("h-1.5 w-1.5 rounded-full", isPickup ? "bg-blue-500" : "bg-emerald-500")} />
                        </div>
                        
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black uppercase text-slate-500">Stop {idx + 1}</span>
                            <Badge className={cn(
                              "text-[8px] font-black px-1.5 py-0.5 rounded-full uppercase",
                              isPickup ? "bg-blue-500/10 text-blue-600 border-blue-500/20" : "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                            )}>
                              {isPickup ? "Pickup" : "Dropoff"}
                            </Badge>
                          </div>
                          <p className="text-xs font-bold text-slate-800">{stop.address}</p>
                          <p className="text-[9px] font-semibold text-slate-500 uppercase tracking-widest">ID: PP-{stop.jobId.slice(0, 8).toUpperCase()}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-center text-xs text-slate-500 py-6">No active delivery stops to optimize.</p>
              )}
            </div>
            <div className="mt-6 flex justify-end">
              <Button onClick={() => setOptimizingOpen(false)} className="rounded-xl px-6 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs">
                Close Planner
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Chat Drawer/Dialog */}
        <Dialog open={!!activeChatJobId} onOpenChange={() => setActiveChatJobId(null)}>
          <DialogContent className="sm:max-w-md border border-slate-200 shadow-2xl p-6 bg-white text-slate-900 flex flex-col h-[500px]">
            {(() => {
              const activeJob = jobs?.find((j: any) => j.id === activeChatJobId);
              if (!activeJob) return null;
              return (
                <>
                  <DialogHeader className="border-b border-slate-200 pb-3 flex-shrink-0">
                    <div className="flex items-center gap-3 text-left">
                      <div className="h-9 w-9 bg-primary/10 text-primary rounded-full flex items-center justify-center">
                        <MessageSquare size={18} />
                      </div>
                      <div>
                        <DialogTitle className="text-sm font-black text-slate-900 font-sans">
                          Chat Support - Order PP-{activeJob.id.slice(0, 8).toUpperCase()}
                        </DialogTitle>
                        <DialogDescription className="text-slate-500 text-[10px] uppercase font-bold tracking-wider mt-0.5">
                          Connected to: {activeJob.user_name || "Customer"}
                        </DialogDescription>
                      </div>
                    </div>
                  </DialogHeader>

                  <div className="flex-1 overflow-y-auto py-4 space-y-3 min-h-0">
                    {activeJob.messages && activeJob.messages.length > 0 ? (
                      activeJob.messages.map((msg: any) => {
                        const isMe = msg.sender_role === "driver";
                        return (
                          <div key={msg.id} className={cn("flex flex-col max-w-[80%]", isMe ? "ml-auto items-end" : "mr-auto items-start")}>
                            <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest mb-1">
                              {isMe ? "You" : (activeJob.user_name || msg.sender_name || "Customer")}
                            </span>
                            <div className={cn(
                              "p-3 rounded-2xl text-xs leading-relaxed",
                              isMe 
                                ? "bg-primary text-primary-foreground rounded-tr-none shadow-lg shadow-primary/10" 
                                : "bg-slate-105 text-slate-800 rounded-tl-none border border-slate-200"
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
                        <p className="text-[10px] text-slate-400 mt-1">Ask the sender about delivery directions or coordinates.</p>
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
                        if (e.key === "Enter") handleSendChatMessage(activeJob.id);
                      }}
                      placeholder="Type message here..."
                      className="bg-slate-50 border-slate-200 text-xs rounded-xl focus:ring-primary focus:border-primary text-slate-800 font-medium"
                    />
                    <Button 
                      onClick={() => handleSendChatMessage(activeJob.id)} 
                      disabled={sendingMsg || !chatInput.trim()}
                      className="rounded-xl px-4 bg-primary text-primary-foreground font-bold text-xs gap-1.5"
                    >
                      {sendingMsg ? <Loader2 className="animate-spin h-3.5 w-3.5" /> : <Send size={14} />}
                    </Button>
                  </div>
                </>
              );
            })()}
          </DialogContent>
        </Dialog>

        {/* Vehicle Details Dialog */}
        <Dialog 
          open={showVehicleModal} 
          onOpenChange={(open) => {
            if (isVehicleMissing) return;
            setVehicleDialogOpen(open);
          }}
        >
          <DialogContent 
            className={cn("sm:max-w-md border border-slate-200 shadow-2xl p-8 bg-white text-slate-900", isVehicleMissing && "[&>button]:hidden")}
            onPointerDownOutside={(e) => { if (isVehicleMissing) e.preventDefault(); }}
            onEscapeKeyDown={(e) => { if (isVehicleMissing) e.preventDefault(); }}
          >
            <DialogHeader className="text-center">
              <div className="mx-auto w-12 h-12 bg-primary/10 text-primary rounded-full flex items-center justify-center mb-4">
                <Truck size={24} />
              </div>
              <DialogTitle className="text-2xl font-black font-heading tracking-tight text-slate-900">
                {isVehicleMissing ? "Vehicle Registration" : "Update Vehicle"}
              </DialogTitle>
              <DialogDescription className="text-slate-500 text-sm mt-2">
                {isVehicleMissing 
                  ? "Enter your vehicle details to begin accepting parcel delivery jobs." 
                  : "Update your vehicle details. This info is shown to users for OTP safety verification."}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleRegisterVehicle} className="space-y-4 mt-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Vehicle Type</label>
                <div className="grid grid-cols-3 gap-2">
                  {["bike", "car", "truck"].map((type) => (
                    <Button
                      key={type}
                      type="button"
                      variant={vehicleType === type ? "default" : "outline"}
                      onClick={() => setVehicleType(type)}
                      className="capitalize font-bold h-10 border-slate-200"
                    >
                      {type}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Vehicle Model</label>
                <Input 
                  type="text" 
                  value={vehicleModel}
                  onChange={(e) => setVehicleModel(e.target.value)}
                  placeholder="e.g. Hero Splendor, Tata Ace"
                  className="font-bold bg-slate-50 border-slate-205 text-slate-900"
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Number Plate</label>
                <Input 
                  type="text" 
                  value={vehiclePlate}
                  onChange={(e) => setVehiclePlate(e.target.value)}
                  placeholder="e.g. CH-01-AX-1234"
                  className="font-bold bg-slate-50 border-slate-205 text-slate-900 uppercase"
                  required
                />
              </div>
              
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Vehicle Photo</label>
                <div className="relative group border-2 border-dashed border-slate-200 hover:border-primary/50 transition-colors rounded-xl p-4 flex flex-col items-center justify-center bg-slate-50 cursor-pointer overflow-hidden min-h-[120px]">
                  {vehiclePhotoBase64 ? (
                    <div className="relative w-full h-24 flex items-center justify-center">
                      <img src={vehiclePhotoBase64} alt="Vehicle preview" className="h-full w-auto object-cover rounded-lg" />
                      <button 
                        type="button" 
                        onClick={(e) => { e.stopPropagation(); setVehiclePhotoBase64(null); }} 
                        className="absolute top-1 right-1 bg-rose-500 hover:bg-rose-600 text-white rounded-full p-1 shadow-md transition-transform hover:scale-105"
                      >
                        <span className="sr-only">Remove</span>
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12"></path></svg>
                      </button>
                    </div>
                  ) : (
                    <>
                      <Truck className="h-8 w-8 text-slate-400 group-hover:text-primary transition-colors mb-2" />
                      <span className="text-xs font-bold text-slate-600 group-hover:text-primary transition-colors">Upload Vehicle Photo</span>
                      <span className="text-[9px] text-slate-400 font-semibold mt-0.5">JPG, PNG up to 5MB</span>
                    </>
                  )}
                  <input 
                    type="file" 
                    accept="image/*" 
                    onChange={(e) => handleFileChange(e, setVehiclePhotoBase64)}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Driving License Photo</label>
                <div className="relative group border-2 border-dashed border-slate-200 hover:border-primary/50 transition-colors rounded-xl p-4 flex flex-col items-center justify-center bg-slate-50 cursor-pointer overflow-hidden min-h-[120px]">
                  {licensePhotoBase64 ? (
                    <div className="relative w-full h-24 flex items-center justify-center">
                      <img src={licensePhotoBase64} alt="License preview" className="h-full w-auto object-cover rounded-lg" />
                      <button 
                        type="button" 
                        onClick={(e) => { e.stopPropagation(); setLicensePhotoBase64(null); }} 
                        className="absolute top-1 right-1 bg-rose-500 hover:bg-rose-600 text-white rounded-full p-1 shadow-md transition-transform hover:scale-105"
                      >
                        <span className="sr-only">Remove</span>
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12"></path></svg>
                      </button>
                    </div>
                  ) : (
                    <>
                      <Box className="h-8 w-8 text-slate-400 group-hover:text-primary transition-colors mb-2" />
                      <span className="text-xs font-bold text-slate-600 group-hover:text-primary transition-colors">Upload License Photo</span>
                      <span className="text-[9px] text-slate-400 font-semibold mt-0.5">JPG, PNG up to 5MB</span>
                    </>
                  )}
                  <input 
                    type="file" 
                    accept="image/*" 
                    onChange={(e) => handleFileChange(e, setLicensePhotoBase64)}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />
                </div>
              </div>

              <Button 
                type="submit"
                disabled={registeringVehicle || !vehicleModel.trim() || !vehiclePlate.trim()}
                className="w-full h-12 font-bold text-lg mt-2"
              >
                {registeringVehicle ? <Loader2 className="animate-spin h-5 w-5" /> : (isVehicleMissing ? "Register Vehicle" : "Save Changes")}
              </Button>
            </form>
          </DialogContent>
        </Dialog>

      </div>
    </DashboardLayout>
  );
}