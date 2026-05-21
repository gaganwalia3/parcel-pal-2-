// routes/tracking.js
import express from 'express';
const router = express.Router();

router.post('/eta', (req, res) => {
  const { distance, trafficLevel } = req.body;
  
  // Backend calculation logic
  const speedKmh = trafficLevel === 'high' ? 20 : 40;
  const timeHours = distance / speedKmh;
  const timeMinutes = Math.round(timeHours * 60) + 10; // +10 mins for pickup

  res.json({
    eta_minutes: timeMinutes,
    provider: "ParcelPal Express Engine",
    timestamp: new Date().toISOString()
  });
});

export default router;