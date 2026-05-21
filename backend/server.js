import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

import { adminAuth } from './middleware/auth.js';
import { rateLimiter } from './middleware/rateLimiter.js';
import { sendOrderConfirmation } from './services/notificationService.js';
import trackingRoutes from './routes/tracking.js';
import authRoutes from './routes/auth.js';
import orderRoutes from './routes/orders.js';
import adminRoutes from './routes/admin.js';
import invoiceRoutes from './routes/invoice.js';
import walletRoutes from './routes/wallet.js';
import uploadRoutes from './routes/upload.js';
import { initializeDB, Config } from './data/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3001;

// --- 1. GLOBAL MIDDLEWARE ---
app.use(cors()); // Enable Cross-Origin Resource Sharing
app.use(express.json()); // Parse incoming JSON payloads
app.use(rateLimiter); // Protect API from DDoS/Spam attacks

// --- 2. REQUEST LOGGER (For Viva Demo) ---
app.use((req, res, next) => {
  const timestamp = new Date().toLocaleTimeString();
  console.log(`[${timestamp}] 📥 ${req.method} → ${req.url}`);
  next();
});

// --- 3. DATABASE INITIALIZATION ---
initializeDB();

// Helper to get descriptive text for Open-Meteo weather codes
const getWeatherDescription = (code) => {
  if (code === 0) return "Clear sky";
  if ([1, 2, 3].includes(code)) return "Mainly clear / partly cloudy";
  if ([45, 48].includes(code)) return "Fog";
  if ([51, 53, 55].includes(code)) return "Drizzle";
  if ([61, 63, 65].includes(code)) return "Rain";
  if ([71, 73, 75, 77].includes(code)) return "Snow fall";
  if ([80, 81, 82].includes(code)) return "Rain showers";
  if ([85, 86].includes(code)) return "Snow showers";
  if ([95, 96, 99].includes(code)) return "Thunderstorm";
  return "Cloudy/Overcast";
};

// --- 4. MAIN BUSINESS LOGIC: PRICING ENGINE ---
app.post('/api/calculate-fare', async (req, res) => {
  try {
    const { distance, weight, tier, category, pickup_lat, pickup_lng } = req.body;

    // Pricing Logic (Kept secure on the backend)
    let ratePerKm = 3.5; 
    if (category === "commercial") ratePerKm = 5.0;

    const tierMultipliers = {
      instant: 4.5,
      twoHour: 2.5,
      oneDay: 1.5,
      standard: 0.5 
    };

    const multiplier = tierMultipliers[tier] || 1.0;
    const weightSurcharge = weight > 5 ? (weight * 2) : 0;
    const baseHandlingFee = 40;

    const baseFare = (distance * ratePerKm * multiplier) + weightSurcharge + baseHandlingFee;

    // Surge Calculations
    const config = Config.get();
    let surgeMultiplier = 1.0;
    let surgeReason = "none";
    let weatherInfo = null;

    if (config.manual_surge) {
      surgeMultiplier = config.manual_multiplier || 1.5;
      surgeReason = config.manual_reason || "Simulated High Demand";
    } else if (config.use_weather_api && pickup_lat && pickup_lng) {
      try {
        const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${pickup_lat}&longitude=${pickup_lng}&current=weather_code,temperature_2m`;
        const weatherRes = await fetch(weatherUrl);
        if (weatherRes.ok) {
          const weatherData = await weatherRes.json();
          const code = weatherData.current?.weather_code;
          const temp = weatherData.current?.temperature_2m;
          
          weatherInfo = {
            code,
            temp,
            description: getWeatherDescription(code)
          };

          // Rain/precip codes: 51,53,55 (Drizzle), 61,63,65 (Rain), 71,73,75 (Snow), 80,81,82 (Showers), 95,96,99 (Thunderstorm)
          const isPrecipitation = [51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 71, 73, 75, 77, 80, 81, 82, 85, 86, 95, 96, 99].includes(code);
          if (isPrecipitation) {
            surgeMultiplier = 1.5;
            surgeReason = `Rain/Inclement Weather detected (${weatherInfo.description}, ${temp}°C)`;
          }
        }
      } catch (err) {
        console.error("[Weather Service] Failed to check weather:", err);
      }
    }

    const totalFare = Math.round(baseFare * surgeMultiplier);

    res.json({ 
      fare: totalFare,
      baseFare: Math.round(baseFare),
      surgeMultiplier,
      surgeReason,
      weather: weatherInfo,
      status: surgeMultiplier > 1.0 ? "Surged Pricing Active" : "Calculated via Node.js Engine"
    });
  } catch (error) {
    console.error("[Pricing Engine] Error:", error);
    res.status(500).json({ error: "Failed to calculate pricing" });
  }
});

// --- 5. MODULAR ROUTING ---
app.use('/api/auth', authRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/orders', invoiceRoutes); // Mount invoice endpoints under /api/orders
app.use('/api/wallet', walletRoutes);
app.use('/api/tracking', trackingRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// --- 6. PROTECTED ADMIN ROUTES (Middleware Demo) ---
app.get('/api/admin/system-health', adminAuth, (req, res) => {
  res.json({
    status: "Healthy",
    uptime: `${process.uptime().toFixed(0)}s`,
    memory: `${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)} MB`,
    architecture: "Modular Node.js Express",
    environment: "Viva Presentation Mode"
  });
});

// --- 7. GLOBAL ERROR HANDLER ---
app.use((err, req, res, next) => {
  console.error("🚨 SERVER ERROR:", err.stack);
  res.status(500).json({ 
    error: 'Internal Server Error',
    message: 'The Node.js engine encountered an unhandled exception.' 
  });
});

// --- 8. SERVER INITIALIZATION ---
app.listen(PORT, () => {
  console.log(`
  =========================================
  🚀 PARCELPAL MULTI-FILE BACKEND ACTIVE
  =========================================
  📍 Main API      : http://localhost:${PORT}
  📍 Health Check  : http://localhost:${PORT}/api/admin/system-health
  📍 Status        : Systems Operational
  -----------------------------------------
  (Keep this terminal open for live logs)
  `);
});