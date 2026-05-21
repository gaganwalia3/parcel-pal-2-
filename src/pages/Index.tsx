import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { 
  Truck, ShieldCheck, Zap, ArrowRight, 
  MapPin, Package, Globe, Smartphone 
} from "lucide-react";

export default function Index() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans selection:bg-blue-100">
      
      {/* --- NAVIGATION --- */}
      <nav className="flex items-center justify-between px-8 py-6 max-w-7xl mx-auto border-b border-slate-50">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-100">
            <Package className="text-white" size={20} />
          </div>
          <span className="text-xl font-black tracking-tighter uppercase">ParcelPal</span>
        </div>
        <div className="hidden md:flex gap-8 text-sm font-bold text-slate-400">
          <a href="#" className="hover:text-blue-600 transition-colors">Solutions</a>
          <a href="#" className="hover:text-blue-600 transition-colors">Pricing</a>
          <a href="#" className="hover:text-blue-600 transition-colors">Track</a>
        </div>
        <Button 
          onClick={() => navigate("/auth")}
          className="rounded-full bg-blue-600 text-white px-8 hover:bg-blue-700 hover:scale-105 transition-all shadow-md shadow-blue-100"
        >
          Sign In
        </Button>
      </nav>

      {/* --- HERO SECTION --- */}
      <main className="max-w-7xl mx-auto px-8 pt-20 pb-32">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-1000">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-100 text-[10px] font-black uppercase tracking-widest text-blue-700">
              <Zap size={12} className="fill-blue-700" /> Now Live in Chandigarh
            </div>
            
            <h1 className="text-7xl md:text-8xl font-black tracking-tighter leading-[0.9]">
              Logistics <br /> 
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-700 to-blue-500">
                Redefined.
              </span>
            </h1>
            
            <p className="text-lg text-slate-500 max-w-md leading-relaxed font-medium">
              Experience the next generation of intra-city delivery. Secure, rapid, and managed by a pro-grade Node.js infrastructure.
            </p>

            <div className="flex flex-col sm:flex-row gap-4">
              <Button 
                onClick={() => navigate("/auth")}
                size="lg" 
                className="h-16 px-10 rounded-2xl bg-slate-900 text-white text-lg font-bold gap-3 shadow-2xl shadow-slate-200 hover:bg-blue-600 transition-all"
              >
                Start Shipping <ArrowRight size={20} />
              </Button>
              <div className="flex -space-x-3 items-center ml-4">
                {[1,2,3,4].map(i => (
                  <div key={i} className="w-10 h-10 rounded-full border-2 border-white bg-blue-100" />
                ))}
                <p className="pl-6 text-xs font-bold text-slate-400 uppercase tracking-widest">
                  Trusted by 2k+ Users
                </p>
              </div>
            </div>
          </div>

          {/* --- BENTO GRID VISUAL --- */}
          <div className="grid grid-cols-2 gap-4 animate-in fade-in zoom-in duration-1000">
            <div className="bg-slate-50 p-8 rounded-[2.5rem] flex flex-col justify-between aspect-square border border-slate-100">
              <Truck size={40} className="text-blue-600" />
              <div>
                <h3 className="font-bold text-xl tracking-tight">Rapid Fleet</h3>
                <p className="text-sm text-slate-400 font-medium">15-min average pickup</p>
              </div>
            </div>
            <div className="bg-blue-600 p-8 rounded-[2.5rem] flex flex-col justify-between aspect-square text-white shadow-xl shadow-blue-100">
              <ShieldCheck size={40} className="text-blue-200" />
              <div>
                <h3 className="font-bold text-xl tracking-tight">Secure</h3>
                <p className="text-sm text-blue-100 opacity-80">Fully insured transit</p>
              </div>
            </div>
            <div className="col-span-2 bg-blue-50 p-8 rounded-[2.5rem] border border-blue-100 flex items-center justify-between">
              <div className="space-y-1">
                <h3 className="font-bold text-2xl tracking-tight text-blue-900">Smart Tracking</h3>
                <p className="text-sm text-blue-700/60 font-bold uppercase tracking-tight">Powered by real-time Node.js</p>
              </div>
              <div className="h-16 w-32 bg-white rounded-2xl shadow-inner border border-blue-100" />
            </div>
          </div>

        </div>
      </main>

      {/* --- STATS STRIP --- */}
      <section className="bg-white border-y border-slate-100 py-12">
        <div className="max-w-7xl mx-auto px-8 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          <div>
            <p className="text-4xl font-black text-slate-900">99.9%</p>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Uptime</p>
          </div>
          <div>
            <p className="text-4xl font-black text-slate-900">₹40</p>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Base Fare</p>
          </div>
          <div>
            <p className="text-4xl font-black text-slate-900">200+</p>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Drivers</p>
          </div>
          <div>
            <p className="text-4xl font-black text-blue-600">10s</p>
            <p className="text-[10px] font-bold uppercase tracking-widest text-blue-400">Assignment</p>
          </div>
        </div>
      </section>
    </div>
  );
}