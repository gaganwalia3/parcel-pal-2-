import express from 'express';
import { Orders, Users, Config } from '../data/db.js';
import { adminAuth } from '../middleware/auth.js';

const router = express.Router();

// GET admin analytics dashboard stats
router.get('/stats', adminAuth, (req, res) => {
  try {
    const allOrders = Orders.findAll();
    const allUsers = Users.findAll();

    const totalRevenue = allOrders.reduce((sum, order) => sum + (Number(order.price) || 0), 0);
    const activeDeliveries = allOrders.filter(o => ['in_transit', 'picked_up'].includes(o.status)).length;
    const totalDeliveries = allOrders.length;
    const activeDrivers = allUsers.filter(u => u.role === 'driver').length;

    res.json({
      revenue: totalRevenue,
      activeDeliveries,
      totalDeliveries,
      activeDrivers,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[Admin Stats API] Error:', error);
    res.status(500).json({ error: 'Server error fetching stats' });
  }
});

// GET all users (Admin view)
router.get('/users', adminAuth, (req, res) => {
  try {
    const users = Users.findAll().map(u => ({
      id: u.id,
      email: u.email,
      role: u.role,
      full_name: u.full_name,
      created_at: u.created_at
    })); // Strip out passwords
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: 'Server error fetching users' });
  }
});

// GET active config (Surge controls)
router.get('/config', adminAuth, (req, res) => {
  try {
    const config = Config.get();
    res.json(config);
  } catch (error) {
    res.status(500).json({ error: 'Server error fetching configuration' });
  }
});

// POST update config (Surge controls)
router.post('/config', adminAuth, (req, res) => {
  try {
    const updates = req.body;
    const updated = Config.update(updates);
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Server error updating configuration' });
  }
});

export default router;
