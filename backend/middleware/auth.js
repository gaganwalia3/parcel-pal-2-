import jwt from 'jsonwebtoken';

const JWT_SECRET = 'super-secret-parcel-pal-key-2026';

export const verifyToken = (req, res, next) => {
  const token = req.header('Authorization')?.split(' ')[1]; // Expecting "Bearer <token>"

  if (!token) {
    return res.status(401).json({ error: 'No token, authorization denied' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded.user;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Token is not valid' });
  }
};

export const adminAuth = (req, res, next) => {
  const adminToken = req.headers['x-admin-token'];
  
  // Simulated Admin Check
  if (adminToken === 'parcel-pal-secret-2026') {
    console.log("[Auth Middleware] Admin Access Granted");
    next(); // Move to the next function
  } else {
    console.log("[Auth Middleware] Access Denied");
    res.status(403).json({ error: "Unauthorized access to Admin API" });
  }
};