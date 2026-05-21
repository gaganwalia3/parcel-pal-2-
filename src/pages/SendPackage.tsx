import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { 
  Package, ArrowRight, Zap, Clock, 
  Calendar, Truck, MapPin, Navigation, Search, Loader2,
  Home, Briefcase, Building, Plus, Trash, Edit, Save
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { searchLocation, haversineDistance, GeocodingResult } from "@/lib/geo";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { API_URL } from "@/config";

export default function SendPackage() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { user, refreshProfile } = useAuth();
  const [loading, setLoading] = useState(false);

  // Address/Location States
  const [pickupQuery, setPickupQuery] = useState("");
  const [dropQuery, setDropQuery] = useState("");
  const [pickupResults, setPickupResults] = useState<GeocodingResult[]>([]);
  const [dropResults, setDropResults] = useState<GeocodingResult[]>([]);
  const [pickup, setPickup] = useState<GeocodingResult | null>(null);
  const [drop, setDrop] = useState<GeocodingResult | null>(null);

  // Delivery Options States
  const [deliveryTier, setDeliveryTier] = useState("standard");
  const [weight, setWeight] = useState(1);
  const [category, setCategory] = useState("personal");
  
  // Backend Pricing States
  const [backendPrice, setBackendPrice] = useState<number | null>(null);
  const [distance, setDistance] = useState(0);
  const [surgeMultiplier, setSurgeMultiplier] = useState<number>(1.0);
  const [surgeReason, setSurgeReason] = useState<string>("none");

  // Saved Places State
  const [placeDialogOpen, setPlaceDialogOpen] = useState(false);
  const [editingPlace, setEditingPlace] = useState<any>(null); // null if adding new
  const [placeLabel, setPlaceLabel] = useState("Home"); // Home, Work, Office, Custom
  const [placeCustomLabel, setPlaceCustomLabel] = useState("");
  const [placeAddressQuery, setPlaceAddressQuery] = useState("");
  const [placeAddressResults, setPlaceAddressResults] = useState<GeocodingResult[]>([]);
  const [selectedPlaceGeo, setSelectedPlaceGeo] = useState<GeocodingResult | null>(null);
  const [savingPlace, setSavingPlace] = useState(false);

  const getHomeGeocodingResult = (homeLoc: any): GeocodingResult | null => {
    if (!homeLoc) return null;
    if (typeof homeLoc === 'string') {
      return { display_name: homeLoc, lat: 30.7333, lon: 76.7794 };
    }
    if (homeLoc.display_name) {
      return {
        display_name: homeLoc.display_name,
        lat: Number(homeLoc.lat) || 30.7333,
        lon: Number(homeLoc.lon) || 76.7794
      };
    }
    return null;
  };

  const getIconForLabel = (label: string) => {
    const lowercase = label.toLowerCase();
    if (lowercase === 'home') return <Home size={14} className="text-blue-500" />;
    if (lowercase === 'work') return <Briefcase size={14} className="text-orange-500" />;
    if (lowercase === 'office') return <Building size={14} className="text-violet-500" />;
    return <MapPin size={14} className="text-teal-500" />;
  };

  // Debounced Real-time Address Search
  useEffect(() => {
    const t = setTimeout(() => {
      if (pickupQuery.length >= 3 && !pickup) searchLocation(pickupQuery).then(setPickupResults);
    }, 400);
    return () => clearTimeout(t);
  }, [pickupQuery, pickup]);

  useEffect(() => {
    const t = setTimeout(() => {
      if (dropQuery.length >= 3 && !drop) searchLocation(dropQuery).then(setDropResults);
    }, 400);
    return () => clearTimeout(t);
  }, [dropQuery, drop]);

  // Debounced Search for Place Dialog
  useEffect(() => {
    const t = setTimeout(() => {
      if (placeAddressQuery.length >= 3 && !selectedPlaceGeo) {
        searchLocation(placeAddressQuery).then(setPlaceAddressResults);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [placeAddressQuery, selectedPlaceGeo]);

  // Geolocation detection effect
  useEffect(() => {
    const detectCurrentLocation = async () => {
      const freshUser = await refreshProfile();
      if (navigator.geolocation && freshUser && !freshUser.home_location) {
        navigator.geolocation.getCurrentPosition(
          async (position) => {
            const { latitude, longitude } = position.coords;
            const sector = Math.floor(Math.abs(latitude * 100 + longitude * 100) % 50) + 1;
            const mockAddress = `Sector ${sector}, Chandigarh`;
            const homeLoc = {
              display_name: mockAddress,
              lat: latitude,
              lon: longitude
            };
            const currentSaved = freshUser.saved_locations || [];
            const hasHomeInSaved = currentSaved.some((loc: any) => loc.id === 'home' || loc.label.toLowerCase() === 'home');
            const updatedSaved = [...currentSaved];
            if (!hasHomeInSaved) {
              updatedSaved.push({
                id: 'home',
                label: 'Home',
                display_name: mockAddress,
                lat: latitude,
                lon: longitude
              });
            }
            try {
              const token = localStorage.getItem("pp_token");
              const res = await fetch(`${API_URL}/api/auth/profile`, {
                method: "PATCH",
                headers: {
                  "Content-Type": "application/json",
                  "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({
                  home_location: homeLoc,
                  saved_locations: updatedSaved
                })
              });
              if (res.ok) {
                const updatedProfile = await refreshProfile();
                if (updatedProfile?.home_location) {
                  const resolvedHome = getHomeGeocodingResult(updatedProfile.home_location);
                  if (resolvedHome) {
                    setPickup(resolvedHome);
                    setPickupQuery(resolvedHome.display_name);
                  }
                }
                toast({ title: "Home Location Detected", description: `Automatically set pickup to your home: ${mockAddress}` });
              }
            } catch (err) {
              console.error("Failed to save detected home location:", err);
            }
          },
          (error) => {
            console.warn("Geolocation lookup failed or denied:", error);
          },
          { enableHighAccuracy: true }
        );
      } else if (freshUser?.home_location) {
        const resolvedHome = getHomeGeocodingResult(freshUser.home_location);
        if (resolvedHome) {
          setPickup(resolvedHome);
          setPickupQuery(resolvedHome.display_name);
        }
      }
    };
    detectCurrentLocation();
  }, []);

  // Saved Location Handlers
  const handleOpenSaveLocationModal = (loc?: any) => {
    if (loc) {
      setEditingPlace(loc);
      setPlaceLabel(loc.label);
      if (!["Home", "Work", "Office"].includes(loc.label)) {
        setPlaceLabel("Custom");
        setPlaceCustomLabel(loc.label);
      } else {
        setPlaceCustomLabel("");
      }
      setPlaceAddressQuery(loc.display_name);
      setSelectedPlaceGeo({ display_name: loc.display_name, lat: loc.lat, lon: loc.lon });
    } else {
      setEditingPlace(null);
      setPlaceLabel("Home");
      setPlaceCustomLabel("");
      setPlaceAddressQuery("");
      setSelectedPlaceGeo(null);
    }
    setPlaceAddressResults([]);
    setPlaceDialogOpen(true);
  };

  const handleSelectSavedLocation = (loc: any, target: 'pickup' | 'dropoff') => {
    const geo: GeocodingResult = {
      display_name: loc.display_name,
      lat: Number(loc.lat),
      lon: Number(loc.lon)
    };
    if (target === 'pickup') {
      setPickup(geo);
      setPickupQuery(geo.display_name);
    } else {
      setDrop(geo);
      setDropQuery(geo.display_name);
    }
    toast({ title: `${target === 'pickup' ? 'Pickup' : 'Dropoff'} Location Set`, description: `${loc.label}: ${loc.display_name}` });
  };

  const handleDeleteSavedLocation = async (id: string) => {
    if (!user) return;
    const currentSaved = user.saved_locations || [];
    const updatedSaved = currentSaved.filter((loc: any) => loc.id !== id);
    const locToDelete = currentSaved.find((loc: any) => loc.id === id);
    const updates: any = { saved_locations: updatedSaved };
    if (locToDelete && (locToDelete.id === 'home' || locToDelete.label.toLowerCase() === 'home')) {
      updates.home_location = null;
    }
    try {
      const token = localStorage.getItem("pp_token");
      const res = await fetch(`${API_URL}/api/auth/profile`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(updates)
      });
      if (res.ok) {
        await refreshProfile();
        toast({ title: "Place Deleted", description: "Saved place removed successfully." });
      }
    } catch (err) {
      toast({ title: "Error", description: "Failed to delete saved place", variant: "destructive" });
    }
  };

  const handleSavePlace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlaceGeo) {
      toast({ title: "Select Address", description: "Please select an address from search results", variant: "destructive" });
      return;
    }
    setSavingPlace(true);
    try {
      const token = localStorage.getItem("pp_token");
      const finalLabel = placeLabel === "Custom" ? placeCustomLabel : placeLabel;
      const currentSaved = user?.saved_locations || [];
      const newPlace = {
        id: editingPlace ? editingPlace.id : (finalLabel.toLowerCase() === 'home' ? 'home' : Math.random().toString(36).substr(2, 9)),
        label: finalLabel,
        display_name: selectedPlaceGeo.display_name,
        lat: selectedPlaceGeo.lat,
        lon: selectedPlaceGeo.lon
      };
      let updatedSaved = [];
      if (editingPlace) {
        updatedSaved = currentSaved.map((loc: any) => loc.id === editingPlace.id ? newPlace : loc);
      } else {
        if (["home", "work", "office"].includes(finalLabel.toLowerCase())) {
          updatedSaved = currentSaved.filter((loc: any) => loc.label.toLowerCase() !== finalLabel.toLowerCase());
        } else {
          updatedSaved = [...currentSaved];
        }
        updatedSaved.push(newPlace);
      }
      const updates: any = { saved_locations: updatedSaved };
      if (finalLabel.toLowerCase() === 'home') {
        updates.home_location = {
          display_name: selectedPlaceGeo.display_name,
          lat: selectedPlaceGeo.lat,
          lon: selectedPlaceGeo.lon
        };
      }
      const res = await fetch(`${API_URL}/api/auth/profile`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(updates)
      });
      if (!res.ok) throw new Error("Failed to save location");
      await refreshProfile();
      setPlaceDialogOpen(false);
      toast({ title: "Place Saved", description: `${finalLabel} saved successfully!` });
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to save place", variant: "destructive" });
    } finally {
      setSavingPlace(false);
    }
  };

  // Sync with Express Backend for Pricing
  useEffect(() => {
    const fetchPrice = async () => {
      if (!pickup || !drop) return;

      const dist = haversineDistance(pickup.lat, pickup.lon, drop.lat, drop.lon);
      setDistance(Math.round(dist));

      try {
        const response = await fetch(`${API_URL}/api/calculate-fare`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            distance: dist, 
            weight, 
            tier: deliveryTier, 
            category,
            pickup_lat: pickup.lat,
            pickup_lng: pickup.lon
          }),
        });
        
        const data = await response.json();
        setBackendPrice(typeof data.fare === 'number' && !isNaN(data.fare) ? data.fare : null);
        setSurgeMultiplier(data.surgeMultiplier || 1.0);
        setSurgeReason(data.surgeReason || "none");
      } catch (err) {
        console.error("Express Server Connectivity Error:", err);
        setBackendPrice(null);
        setSurgeMultiplier(1.0);
        setSurgeReason("none");
      }
    };

    fetchPrice();
  }, [pickup, drop, weight, deliveryTier, category]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pickup || !drop || backendPrice === null) {
      toast({ title: "Check Connections", description: "Please select locations and ensure the backend is running.", variant: "destructive" });
      return;
    }
    setLoading(true);

    // Navigate to Payment page with state
    setTimeout(() => {
      setLoading(false);
      navigate("/payment", { 
        state: { 
          price: backendPrice,
          distance: distance,
          pickupLocation: pickup.display_name,
          dropLocation: drop.display_name,
          pickupLat: pickup.lat,
          pickupLon: pickup.lon,
          dropLat: drop.lat,
          dropLon: drop.lon,
          weight: weight,
          category: category,
          tier: deliveryTier
        } 
      });
    }, 800);
  };

  return (
    <DashboardLayout title="Create Shipment">
      <form onSubmit={handleSubmit} className="max-w-5xl mx-auto space-y-6 pb-28">
        
        {/* Step 1 & 2: Geocoding Location Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="border-none shadow-sm relative z-30">
            <CardHeader className="pb-3">
              <CardTitle className="text-md font-heading flex items-center gap-2">
                <Navigation size={18} className="text-primary"/> Pickup From
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Search pickup area..." 
                  value={pickup ? pickup.display_name : pickupQuery}
                  onChange={(e) => { setPickup(null); setPickupQuery(e.target.value); }}
                  className="pl-9 h-11"
                />
                {pickupResults?.length > 0 && !pickup && (
                  <ul className="absolute w-full mt-2 bg-card border rounded-xl shadow-2xl divide-y max-h-48 overflow-auto z-50">
                    {pickupResults.map((r, i) => (
                      <li key={i} className="px-4 py-3 text-sm hover:bg-accent cursor-pointer"
                          onClick={() => { setPickup(r); setPickupResults([]); }}>
                        {r.display_name}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <Textarea placeholder="House/Flat No, Landmark" className="min-h-[70px] resize-none" required />
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm relative z-20">
            <CardHeader className="pb-3">
              <CardTitle className="text-md font-heading flex items-center gap-2">
                <MapPin size={18} className="text-orange-500"/> Delivery To
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Search delivery area..." 
                  value={drop ? drop.display_name : dropQuery}
                  onChange={(e) => { setDrop(null); setDropQuery(e.target.value); }}
                  className="pl-9 h-11"
                />
                {dropResults?.length > 0 && !drop && (
                  <ul className="absolute w-full mt-2 bg-card border rounded-xl shadow-2xl divide-y max-h-48 overflow-auto z-50">
                    {dropResults.map((r, i) => (
                      <li key={i} className="px-4 py-3 text-sm hover:bg-accent cursor-pointer"
                          onClick={() => { setDrop(r); setDropResults([]); }}>
                        {r.display_name}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <Textarea placeholder="Recipient detailed address" className="min-h-[70px] resize-none" required />
            </CardContent>
          </Card>
        </div>

        {/* Saved Places Panel */}
        <Card className="border-none shadow-sm bg-white">
          <CardHeader className="pb-3">
            <CardTitle className="text-md font-heading flex items-center justify-between">
              <span className="flex items-center gap-2">
                <MapPin size={18} className="text-primary" /> Saved Places
              </span>
              <Button 
                type="button" 
                variant="outline" 
                size="sm" 
                onClick={() => handleOpenSaveLocationModal()} 
                className="rounded-xl h-8 text-xs font-bold gap-1 border-slate-200"
              >
                <Plus size={14} /> Add Place
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {user?.saved_locations && user.saved_locations.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {user.saved_locations.map((loc) => (
                  <div key={loc.id} className="p-3 border rounded-xl hover:border-primary/50 transition-colors flex flex-col justify-between gap-2 bg-slate-50/50">
                    <div>
                      <div className="flex items-center gap-2 justify-between">
                        <span className="text-xs font-black uppercase text-slate-600 tracking-wider flex items-center gap-1.5">
                          {getIconForLabel(loc.label)} {loc.label}
                        </span>
                        <div className="flex items-center gap-1">
                          <Button 
                            type="button"
                            variant="ghost" 
                            size="icon" 
                            onClick={() => handleOpenSaveLocationModal(loc)}
                            className="h-6 w-6 text-slate-500 hover:text-slate-800"
                          >
                            <Edit size={12} />
                          </Button>
                          <Button 
                            type="button"
                            variant="ghost" 
                            size="icon" 
                            onClick={() => handleDeleteSavedLocation(loc.id)}
                            className="h-6 w-6 text-rose-500 hover:text-rose-700"
                          >
                            <Trash size={12} />
                          </Button>
                        </div>
                      </div>
                      <p className="text-xs font-medium text-slate-500 mt-1 line-clamp-2">{loc.display_name}</p>
                    </div>
                    
                    <div className="flex gap-2 mt-1">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => handleSelectSavedLocation(loc, 'pickup')}
                        className="flex-1 text-[10px] font-bold h-7 bg-white border border-slate-200 hover:bg-slate-50"
                      >
                        📍 Pickup
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => handleSelectSavedLocation(loc, 'dropoff')}
                        className="flex-1 text-[10px] font-bold h-7 bg-white border border-slate-200 hover:bg-slate-50"
                      >
                        🏁 Drop
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 text-muted-foreground border-dashed border rounded-xl bg-slate-50/30">
                <MapPin size={24} className="mx-auto text-slate-300 mb-1" />
                <p className="text-xs font-semibold">No saved places found</p>
                <p className="text-[10px]">Add your frequent addresses (Home, Work, etc.) for instant booking.</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Step 3: Package Details */}
        <Card className="border-none shadow-sm">
          <CardContent className="pt-6 space-y-6">
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Category</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="personal">Personal Use</SelectItem>
                    <SelectItem value="commercial">Commercial / Truck Load</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Weight (kg)</Label>
                <Input type="number" value={weight} onChange={(e) => setWeight(Number(e.target.value))} min="1" className="h-11" />
              </div>
            </div>

            <div className="space-y-3">
              <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Delivery Speed</Label>
              <RadioGroup value={deliveryTier} onValueChange={setDeliveryTier} className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                  { id: "instant", label: "Instant", icon: Zap },
                  { id: "twoHour", label: "2 Hour", icon: Clock },
                  { id: "oneDay", label: "1 Day", icon: Calendar },
                  { id: "standard", label: "Economy", icon: Truck },
                ].map((t) => (
                  <Label key={t.id} className={`flex flex-col items-center p-3 border rounded-xl cursor-pointer transition-all ${deliveryTier === t.id ? "border-primary bg-primary/5 ring-1 ring-primary shadow-sm" : "hover:bg-muted"}`}>
                    <RadioGroupItem value={t.id} className="sr-only" />
                    <t.icon size={20} className={deliveryTier === t.id ? "text-primary" : "text-muted-foreground"} />
                    <span className="text-[10px] font-bold mt-2 uppercase tracking-tight">{t.label}</span>
                  </Label>
                ))}
              </RadioGroup>
            </div>
          </CardContent>
        </Card>

        {/* Professional Action Bar */}
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[calc(100%-2.5rem)] max-w-4xl z-50">
          <div className="bg-background/90 backdrop-blur-xl border border-border shadow-2xl rounded-2xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="h-11 w-11 bg-green-500/10 rounded-full flex items-center justify-center text-green-600">
                <Package size={22} />
              </div>
              <div>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest leading-none mb-1">
                  Secure Backend Quote • {distance} km
                </p>
                <div className="flex items-center gap-2">
                  <p className="text-2xl font-heading font-bold tracking-tight">
                    {typeof backendPrice === 'number' && !isNaN(backendPrice) ? `₹${backendPrice.toLocaleString('en-IN')}` : "..."}
                  </p>
                  {surgeMultiplier > 1.0 && (
                    <span className="text-[9px] font-black uppercase text-amber-700 bg-amber-500/10 border border-amber-500/25 px-2 py-0.5 rounded-full">
                      {surgeMultiplier}x Surge
                    </span>
                  )}
                </div>
                {surgeMultiplier > 1.0 && surgeReason !== "none" && (
                  <p className="text-[9px] text-amber-600 font-bold uppercase mt-1 leading-none">
                    ⚠️ {surgeReason}
                  </p>
                )}
              </div>
            </div>
            
            <Button type="submit" size="lg" className="rounded-xl px-10 font-bold gap-2 shadow-xl shadow-primary/20 h-12" disabled={loading || !pickup || !drop || backendPrice === null}>
              {loading ? <Loader2 className="animate-spin h-5 w-5" /> : "Confirm Booking"} <ArrowRight size={18} />
            </Button>
          </div>
        </div>

      </form>

      {/* Add/Edit Saved Place Dialog */}
      <Dialog open={placeDialogOpen} onOpenChange={setPlaceDialogOpen}>
        <DialogContent className="sm:max-w-md border border-slate-200 shadow-2xl p-8 bg-white text-slate-900">
          <DialogHeader className="text-center">
            <DialogTitle className="text-2xl font-black tracking-tight text-slate-900">
              {editingPlace ? "Edit Saved Place" : "Add Saved Place"}
            </DialogTitle>
            <DialogDescription className="text-slate-500 text-sm mt-2">
              Save this address for quick selection during parcel bookings.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSavePlace} className="space-y-4 mt-4">
            <div className="space-y-1">
              <Label className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Label / Type</Label>
              <div className="grid grid-cols-4 gap-2">
                {["Home", "Work", "Office", "Custom"].map((lbl) => (
                  <Button
                    key={lbl}
                    type="button"
                    variant={placeLabel === lbl ? "default" : "outline"}
                    onClick={() => setPlaceLabel(lbl)}
                    className="capitalize font-bold h-10 border-slate-200"
                  >
                    {lbl}
                  </Button>
                ))}
              </div>
            </div>

            {placeLabel === "Custom" && (
              <div className="space-y-1">
                <Label className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Custom Label Name</Label>
                <Input 
                  type="text" 
                  value={placeCustomLabel}
                  onChange={(e) => setPlaceCustomLabel(e.target.value)}
                  placeholder="e.g. Parents, Gym"
                  className="font-bold bg-slate-50 border-slate-205 text-slate-900"
                  required
                />
              </div>
            )}

            <div className="space-y-1">
              <Label className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Search Address</Label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Search address..." 
                  value={selectedPlaceGeo ? selectedPlaceGeo.display_name : placeAddressQuery}
                  onChange={(e) => { setSelectedPlaceGeo(null); setPlaceAddressQuery(e.target.value); }}
                  className="pl-9 h-11 bg-slate-50 border-slate-205 text-slate-900"
                  required
                />
                {placeAddressResults?.length > 0 && !selectedPlaceGeo && (
                  <ul className="absolute w-full mt-2 bg-card border rounded-xl shadow-2xl divide-y max-h-48 overflow-auto z-50">
                    {placeAddressResults.map((r, i) => (
                      <li 
                        key={i} 
                        className="px-4 py-3 text-sm hover:bg-accent cursor-pointer text-slate-800"
                        onClick={() => { setSelectedPlaceGeo(r); setPlaceAddressResults([]); }}
                      >
                        {r.display_name}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <Button 
              type="submit"
              disabled={savingPlace || !selectedPlaceGeo}
              className="w-full h-12 font-bold text-lg mt-2"
            >
              {savingPlace ? <Loader2 className="animate-spin h-5 w-5" /> : "Save Place"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}