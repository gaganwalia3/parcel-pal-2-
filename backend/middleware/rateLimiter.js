// middleware/rateLimiter.js
const requestCounts = new Map();

export const rateLimiter = (req, res, next) => {
  // Bypass rate limiting for simulated driver location coordinate updates
  if (req.method === 'PATCH' && req.path.startsWith('/api/orders/')) {
    return next();
  }

  const ip = req.ip;
  const now = Date.now();
  const WINDOW_MS = 60000; 
  const MAX_LIMIT = 2000;    

  if (!requestCounts.has(ip)) {
    requestCounts.set(ip, { count: 1, startTime: now });
    return next();
  }

  const data = requestCounts.get(ip);

  if (now - data.startTime > WINDOW_MS) {
    requestCounts.set(ip, { count: 1, startTime: now });
    return next();
  }

  data.count++;
  if (data.count > MAX_LIMIT) {
    console.log(`[Rate Limiter] Blocked IP: ${ip} (Too many requests: ${data.count})`);
    return res.status(429).json({ error: "Too many requests. Please wait a minute." });
  }

  next();
};