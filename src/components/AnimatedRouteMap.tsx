import React, { useMemo } from "react";
import { Navigation, MapPin, Truck, HelpCircle } from "lucide-react";

interface AnimatedRouteMapProps {
  pickupLat: number;
  pickupLng: number;
  dropLat: number;
  dropLng: number;
  driverLat?: number;
  driverLng?: number;
  status: string;
  etaMins?: number;
  remainingKm?: number;
}

export function AnimatedRouteMap({
  pickupLat,
  pickupLng,
  dropLat,
  dropLng,
  driverLat,
  driverLng,
  status,
  etaMins,
  remainingKm
}: AnimatedRouteMapProps) {
  const width = 600;
  const height = 320;

  // 1. Calculate boundaries to project coordinates into SVG viewport
  const coords = useMemo(() => {
    const pLat = Number(pickupLat);
    const pLng = Number(pickupLng);
    const dLat = Number(dropLat);
    const dLng = Number(dropLng);

    const validPickupLat = isNaN(pLat) ? 30.7333 : pLat;
    const validPickupLng = isNaN(pLng) ? 76.7794 : pLng;
    const validDropLat = isNaN(dLat) ? 30.7333 : dLat;
    const validDropLng = isNaN(dLng) ? 76.7794 : dLng;

    const lats = [validPickupLat, validDropLat];
    const lngs = [validPickupLng, validDropLng];

    const drLatVal = (driverLat !== undefined && driverLat !== null) ? Number(driverLat) : NaN;
    const drLngVal = (driverLng !== undefined && driverLng !== null) ? Number(driverLng) : NaN;
    const hasDrv = !isNaN(drLatVal) && !isNaN(drLngVal);

    if (hasDrv) {
      lats.push(drLatVal);
      lngs.push(drLngVal);
    }

    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);

    const latDiff = maxLat - minLat || 0.005;
    const lngDiff = maxLng - minLng || 0.005;

    // Projection helpers (normalize and scale to width/height with 60px padding)
    const padding = 60;
    
    const getX = (lng: number) => {
      const cleanLng = (lng !== undefined && lng !== null && !isNaN(Number(lng))) ? Number(lng) : validPickupLng;
      const pct = (cleanLng - minLng) / lngDiff;
      return padding + pct * (width - padding * 2);
    };

    const getY = (lat: number) => {
      const cleanLat = (lat !== undefined && lat !== null && !isNaN(Number(lat))) ? Number(lat) : validPickupLat;
      const pct = (cleanLat - minLat) / latDiff;
      // Invert Y so higher latitude is at the top
      return height - padding - pct * (height - padding * 2);
    };

    return { getX, getY, hasDrv, validPickupLat, validPickupLng, validDropLat, validDropLng };
  }, [pickupLat, pickupLng, dropLat, dropLng, driverLat, driverLng]);

  const pX = coords.getX(coords.validPickupLng);
  const pY = coords.getY(coords.validPickupLat);
  const dX = coords.getX(coords.validDropLng);
  const dY = coords.getY(coords.validDropLat);
  
  const hasDriver = coords.hasDrv;
  const drX = hasDriver ? coords.getX(Number(driverLng)) : pX;
  const drY = hasDriver ? coords.getY(Number(driverLat)) : pY;

  // 2. Generate building blocks
  const buildingBlocks = useMemo(() => [
    // Sector 1: Top-Left (not overlapping Green Park which is at x=40 y=30 w=110 h=70)
    { x: 160, y: 30, w: 30, h: 25 },
    { x: 200, y: 30, w: 25, h: 25 },
    { x: 235, y: 30, w: 35, h: 25 },
    { x: 160, y: 65, w: 30, h: 35 },
    { x: 200, y: 65, w: 25, h: 35 },
    { x: 235, y: 65, w: 35, h: 35 },

    // Sector 2: Top-Right
    { x: 380, y: 30, w: 40, h: 25 },
    { x: 430, y: 30, w: 40, h: 25 },
    { x: 480, y: 30, w: 45, h: 25 },
    { x: 535, y: 30, w: 35, h: 25 },
    { x: 380, y: 65, w: 40, h: 35 },
    { x: 430, y: 65, w: 40, h: 35 },
    { x: 480, y: 65, w: 45, h: 35 },
    { x: 535, y: 65, w: 35, h: 35 },

    // Sector 3: Bottom-Left
    { x: 40, y: 220, w: 30, h: 25 },
    { x: 80, y: 220, w: 30, h: 25 },
    { x: 120, y: 220, w: 35, h: 25 },
    { x: 165, y: 220, w: 40, h: 25 },
    { x: 40, y: 255, w: 30, h: 30 },
    { x: 80, y: 255, w: 30, h: 30 },
    { x: 120, y: 255, w: 35, h: 30 },
    { x: 165, y: 255, w: 40, h: 30 },

    // Sector 4: Bottom-Right (not overlapping Eastside Reserve which is at x=440 y=210 w=120 h=60)
    { x: 320, y: 210, w: 30, h: 25 },
    { x: 360, y: 210, w: 35, h: 25 },
    { x: 320, y: 245, w: 30, h: 35 },
    { x: 360, y: 245, w: 35, h: 35 },
  ], []);

  // 3. Generate a stylized Manhattan grid road path connecting pickup and dropoff
  const roadSegments = useMemo(() => {
    const lines = [];
    // Vertical grid roads
    for (let x = 30; x < width; x += 80) {
      lines.push({ x1: x, y1: 10, x2: x, y2: height - 10 });
    }
    // Horizontal grid roads
    for (let y = 30; y < height; y += 60) {
      lines.push({ x1: 10, y1: y, x2: width - 10, y2: y });
    }
    return lines;
  }, []);

  // 4. The route path
  const midX = (pX + dX) / 2;
  
  const routePointsString = useMemo(() => {
    return `${pX},${pY} ${midX},${pY} ${midX},${dY} ${dX},${dY}`;
  }, [pX, pY, dX, dY, midX]);

  // If driver is active, draw path from driver to pickup/dropoff
  const driverRoutePoints = useMemo(() => {
    if (!hasDriver) return "";
    const targetX = (status === "assigned" || status === "on_the_way") ? pX : dX;
    const targetY = (status === "assigned" || status === "on_the_way") ? pY : dY;
    return `${drX},${drY} ${drX},${targetY} ${targetX},${targetY}`;
  }, [hasDriver, drX, drY, pX, pY, dX, dY, status]);

  // Determine status message and icon
  const hudInfo = useMemo(() => {
    if (status === "pending") {
      return { label: "Awaiting Driver", color: "text-amber-600", bg: "bg-amber-50" };
    }
    if (status === "assigned") {
      return { label: "Driver Accepted", color: "text-blue-600", bg: "bg-blue-50" };
    }
    if (status === "on_the_way") {
      return { label: "Driver Heading to Pickup", color: "text-cyan-600", bg: "bg-cyan-50" };
    }
    if (status === "picked_up" || status === "in_transit") {
      return { label: "Out for Delivery", color: "text-indigo-600", bg: "bg-indigo-50" };
    }
    if (status === "delivered") {
      return { label: "Delivered Successfully", color: "text-emerald-600", bg: "bg-emerald-50" };
    }
    return { label: "Order Active", color: "text-slate-600", bg: "bg-slate-50" };
  }, [status]);

  return (
    <div className="w-full bg-slate-100 rounded-2xl overflow-hidden border border-slate-200 shadow-xl relative font-sans text-slate-900 select-none">
      
      {/* Map HUD Dashboard Header */}
      <div className="absolute top-4 left-4 z-10 bg-white/90 backdrop-blur-md px-3 py-2 rounded-xl border border-slate-200 flex flex-col gap-1 min-w-[150px] shadow-lg">
        <div className="flex items-center gap-1.5">
          <div className={`h-2.5 w-2.5 rounded-full ${status === 'delivered' ? 'bg-emerald-500 animate-pulse' : 'bg-blue-500 animate-ping'}`} />
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Live Satellite HUD</span>
        </div>
        <p className={`text-xs font-bold ${hudInfo.color}`}>{hudInfo.label}</p>
      </div>

      {/* Map HUD ETA & Remaining Km */}
      {status !== "pending" && status !== "delivered" && (
        <div className="absolute top-4 right-4 z-10 bg-white/90 backdrop-blur-md px-3 py-2 rounded-xl border border-slate-200 flex items-center gap-4 shadow-lg text-xs font-bold text-slate-800">
          <div>
            <p className="text-[9px] uppercase tracking-widest text-slate-500 font-medium">ETA</p>
            <p className="text-sm font-black text-indigo-600">{etaMins ?? Math.round(remainingKm ? remainingKm * 2.5 : 8)} mins</p>
          </div>
          <div className="h-6 w-[1px] bg-slate-200" />
          <div>
            <p className="text-[9px] uppercase tracking-widest text-slate-500 font-medium">Distance</p>
            <p className="text-sm font-black text-slate-800">{(remainingKm ?? 2.5).toFixed(1)} km</p>
          </div>
        </div>
      )}

      {/* SVG Canvas Map */}
      <svg 
        width="100%" 
        height={height} 
        viewBox={`0 0 ${width} ${height}`} 
        className="w-full h-full"
        style={{ backgroundColor: '#f1f5f9' }}
      >
        <defs>
          {/* Glowing Filters */}
          <filter id="glow-blue" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="glow-green" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="glow-orange" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* Gradients */}
          <linearGradient id="route-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#3b82f6" />
            <stop offset="50%" stopColor="#6366f1" />
            <stop offset="100%" stopColor="#a855f7" />
          </linearGradient>
        </defs>

        {/* 1. Geographic Water Body (Winding Blue River) */}
        <path
          d="M -20,160 C 150,110 250,220 400,160 T 620,120"
          fill="none"
          stroke="#bae6fd"
          strokeWidth="32"
          strokeLinecap="round"
          opacity="0.8"
        />
        <path
          d="M -20,160 C 150,110 250,220 400,160 T 620,120"
          fill="none"
          stroke="#e0f2fe"
          strokeWidth="12"
          strokeLinecap="round"
          opacity="0.9"
        />

        {/* 2. Green Parks */}
        <rect x="40" y="30" width="110" height="70" rx="8" fill="#dcfce7" stroke="#bbf7d0" strokeWidth="1.5" />
        <rect x="440" y="210" width="120" height="60" rx="8" fill="#dcfce7" stroke="#bbf7d0" strokeWidth="1.5" />

        {/* 3. Building Blocks Outline */}
        <g fill="#ffffff" stroke="#e2e8f0" strokeWidth="1">
          {buildingBlocks.map((b, idx) => (
            <rect key={idx} x={b.x} y={b.y} width={b.w} height={b.h} rx="3" />
          ))}
        </g>

        {/* 4. Background Street Network (Casing + White Street lines) */}
        <g stroke="#e2e8f0" strokeWidth="8" strokeLinecap="round">
          {roadSegments.map((road, idx) => (
            <line key={idx} x1={road.x1} y1={road.y1} x2={road.x2} y2={road.y2} />
          ))}
        </g>
        <g stroke="#ffffff" strokeWidth="6" strokeLinecap="round">
          {roadSegments.map((road, idx) => (
            <line key={idx} x1={road.x1} y1={road.y1} x2={road.x2} y2={road.y2} />
          ))}
        </g>

        {/* 5. Full delivery route boulevard casing & road */}
        <polyline
          points={routePointsString}
          fill="none"
          stroke="#e2e8f0"
          strokeWidth="14"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ opacity: 0.6 }}
        />
        <polyline
          points={routePointsString}
          fill="none"
          stroke="#ffffff"
          strokeWidth="10"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* 6. Glowing route path */}
        <polyline
          points={routePointsString}
          fill="none"
          stroke="url(#route-gradient)"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="opacity-90"
          filter="url(#glow-blue)"
        />

        {/* 7. Active segment (if driver is on the way) */}
        {hasDriver && (status === "on_the_way" || status === "in_transit" || status === "picked_up") && (
          <polyline
            points={driverRoutePoints}
            fill="none"
            stroke="#f59e0b"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="6, 6"
            className="animate-[dash_10s_linear_infinite]"
            filter="url(#glow-orange)"
          />
        )}

        {/* 8. Scale Indicator */}
        <g transform="translate(20, 295)">
          <line x1="0" y1="0" x2="50" y2="0" stroke="#475569" strokeWidth="2" />
          <line x1="0" y1="-3" x2="0" y2="3" stroke="#475569" strokeWidth="2" />
          <line x1="50" y1="-3" x2="50" y2="3" stroke="#475569" strokeWidth="2" />
          <text x="25" y="-5" textAnchor="middle" fill="#475569" fontSize="8" fontWeight="bold" className="font-sans">500 m</text>
        </g>

        {/* 9. Compass Rose */}
        <g transform="translate(565, 290)">
          <circle cx="0" cy="0" r="14" fill="#ffffff" stroke="#cbd5e1" strokeWidth="1" />
          <polygon points="0,-10 3,0 0,1" fill="#ef4444" />
          <polygon points="0,10 3,0 0,1" fill="#94a3b8" />
          <text x="0" y="-13" textAnchor="middle" fill="#ef4444" fontSize="8" fontWeight="black" className="font-sans">N</text>
        </g>

        {/* 10. Neighborhood/Sector labels */}
        <g opacity="0.65">
          <text x="95" y="65" textAnchor="middle" fill="#16a34a" fontSize="8" fontWeight="bold" className="font-sans uppercase tracking-wider">Green Park</text>
          <text x="500" y="245" textAnchor="middle" fill="#16a34a" fontSize="8" fontWeight="bold" className="font-sans uppercase tracking-wider">Eastside Reserve</text>
          <text x="225" y="80" textAnchor="middle" fill="#64748b" fontSize="8" fontWeight="bold" className="font-sans uppercase tracking-wider">Sector 11</text>
          <text x="480" y="85" textAnchor="middle" fill="#64748b" fontSize="8" fontWeight="bold" className="font-sans uppercase tracking-wider">Tech Enclave</text>
          <text x="345" y="275" textAnchor="middle" fill="#64748b" fontSize="8" fontWeight="bold" className="font-sans uppercase tracking-wider">Downtown</text>
          <text x="280" y="165" fill="#0284c7" fontSize="7" fontWeight="bold" className="font-sans uppercase tracking-widest" transform="rotate(-10, 280, 165)">Blue Creek</text>
        </g>

        {/* 11. Pickup Point (Base and Pulse) */}
        <g>
          {status !== "delivered" && status !== "picked_up" && status !== "in_transit" && (
            <circle cx={pX} cy={pY} r="14" fill="#3b82f6" opacity="0.3" className="animate-ping" />
          )}
          <circle cx={pX} cy={pY} r="6" fill="#3b82f6" filter="url(#glow-blue)" />
          <circle cx={pX} cy={pY} r="2" fill="#ffffff" />
          
          {/* Label */}
          <text x={pX + 10} y={pY - 10} fill="#475569" fontSize="9" fontWeight="bold" className="uppercase tracking-widest bg-white px-1 font-sans">
            Pickup
          </text>
        </g>

        {/* 12. Destination Point (Base and Pulse) */}
        <g>
          {status === "picked_up" || status === "in_transit" ? (
            <circle cx={dX} cy={dY} r="14" fill="#10b981" opacity="0.3" className="animate-ping" />
          ) : null}
          <circle cx={dX} cy={dY} r="6" fill="#10b981" filter="url(#glow-green)" />
          <circle cx={dX} cy={dY} r="2" fill="#ffffff" />
          
          {/* Label */}
          <text x={dX + 10} y={dY + 15} fill="#475569" fontSize="9" fontWeight="bold" className="uppercase tracking-widest bg-white px-1 font-sans">
            Dropoff
          </text>
        </g>

        {/* 13. Moving Driver Icon (Truck SVG) */}
        {hasDriver && status !== "delivered" && (
          <g transform={`translate(${drX - 14}, ${drY - 14})`}>
            {/* Pulsing Shadow */}
            <circle cx="14" cy="14" r="16" fill="#f59e0b" opacity="0.3" className="animate-pulse" />
            
            {/* Driver Box */}
            <rect x="0" y="0" width="28" height="28" rx="8" fill="#f59e0b" className="shadow-lg border border-orange-200" filter="url(#glow-orange)" />
            <Truck className="h-4.5 w-4.5 text-white absolute top-1.5 left-1.5" style={{ margin: "5px" }} />
          </g>
        )}
      </svg>

      {/* Street Name / HUD Details Footer */}
      <div className="absolute bottom-3 left-4 right-4 z-10 flex justify-between items-center bg-white/90 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-200 text-[10px] text-slate-600 font-bold uppercase tracking-widest shadow-sm">
        <span>📍 Road: {status === 'on_the_way' ? 'Transit Way' : 'Logistics Highway'}</span>
        <span>Speed: {status === 'delivered' ? '0' : '48'} km/h</span>
      </div>
    </div>
  );
}
