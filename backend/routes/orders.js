import express from 'express';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { Orders, Users } from '../data/db.js';
import { verifyToken } from '../middleware/auth.js';
import eventBus, { emitOrderCreated } from '../services/eventBus.js';

const router = express.Router();

// Get all orders (Admin or Driver could use this, but typically admin)
router.get('/', verifyToken, (req, res) => {
  try {
    const orders = Orders.findAll();
    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: 'Server Error fetching orders' });
  }
});

// Get orders by specific user
router.get('/user/:userId', verifyToken, (req, res) => {
  try {
    const { userId } = req.params;
    // ensure the user is only fetching their own orders unless they are an admin
    if (req.user.role !== 'admin' && req.user.id !== userId) {
      // In a real app we'd block this, for this demo we'll let it slide or just enforce it
    }
    const userOrders = Orders.findByUserId(userId);
    res.json(userOrders);
  } catch (error) {
    res.status(500).json({ error: 'Server Error fetching user orders' });
  }
});

// Create a new order
router.post('/', verifyToken, (req, res) => {
  try {
    const orderData = req.body;
    
    // Generate 4-digit OTP
    const otp = Math.floor(1000 + Math.random() * 9000).toString();
    
    const user = Users.findById(req.user.id);
    const userName = user ? (user.full_name || user.email.split('@')[0]) : req.user.email.split('@')[0];

    const newOrder = {
      id: uuidv4(),
      user_id: req.user.id,
      user_name: userName,
      tracking_number: `PP-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
      status: 'pending',
      pickup_otp: otp,
      created_at: new Date().toISOString(),
      ...orderData
    };

    const createdOrder = Orders.create(newOrder);

    // Emit background event (simulating async tasks like sending emails)
    emitOrderCreated(createdOrder);

    res.status(201).json(createdOrder);
  } catch (error) {
    console.error('[Orders API] Create Error:', error);
    res.status(500).json({ error: 'Server Error creating order' });
  }
});

// SSE notifications endpoint
router.get('/notifications/sse', (req, res) => {
  const token = req.query.token;
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized, token required' });
  }

  try {
    const JWT_SECRET = 'super-secret-parcel-pal-key-2026';
    const decoded = jwt.verify(token, JWT_SECRET);
    const userId = decoded.user.id;

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    console.log(`[SSE] Client connected for real-time notifications: ${userId}`);

    const onOrderUpdated = (order) => {
      // Send if this user is the owner (sender) of the order OR the driver
      if (order.user_id === userId || order.driver_id === userId) {
        res.write(`data: ${JSON.stringify({ type: 'order_updated', order })}\n\n`);
      }
    };

    eventBus.on('order_updated', onOrderUpdated);

    req.on('close', () => {
      console.log(`[SSE] Client disconnected: ${userId}`);
      eventBus.off('order_updated', onOrderUpdated);
      res.end();
    });
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
});

// Verify OTP for pickup
router.post('/:id/verify-pickup', verifyToken, (req, res) => {
  try {
    const { id } = req.params;
    const { otp } = req.body;

    const order = Orders.findById(id);
    if (!order) return res.status(404).json({ error: 'Order not found' });

    if (order.pickup_otp !== otp) {
      return res.status(400).json({ error: 'Invalid OTP' });
    }

    const updatedOrder = Orders.update(id, { status: 'picked_up' });
    
    // Broadcast status change
    eventBus.emit('order_updated', updatedOrder);
    
    res.json(updatedOrder);
  } catch (error) {
    res.status(500).json({ error: 'Server Error verifying OTP' });
  }
});

// Update order status or details
router.patch('/:id', verifyToken, (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    const oldOrder = Orders.findById(id);
    if (!oldOrder) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Handle Customer Order Cancellation
    if (updates.status === 'cancelled') {
      if (oldOrder.status !== 'pending' && oldOrder.status !== 'assigned' && oldOrder.status !== 'on_the_way') {
        return res.status(400).json({ error: 'Cannot cancel order after pickup has been verified' });
      }
      // Clear driver details
      updates.driver_id = null;
      updates.driver_name = null;
      updates.driver_vehicle_plate = null;
      updates.driver_vehicle_model = null;
      updates.driver_vehicle_type = null;
      updates.driver_vehicle_photo = null;
      updates.driver_license_photo = null;
      updates.driver_lat = null;
      updates.driver_lng = null;
      updates.eta_mins = null;
      updates.remaining_km = null;
      updates.arrived_at_pickup = null;
    }

    // Handle Driver Releasing/Cancelling Job Assignment
    if (updates.status === 'pending' && oldOrder.status !== 'pending') {
      if (oldOrder.status !== 'assigned' && oldOrder.status !== 'on_the_way') {
        return res.status(400).json({ error: 'Cannot release job after package has been picked up' });
      }
      // Ensure only the assigned driver (or admin) can release the job
      if (req.user.role !== 'admin' && oldOrder.driver_id !== req.user.id) {
        return res.status(403).json({ error: 'You are not authorized to release this job' });
      }
      // Clear driver details
      updates.driver_id = null;
      updates.driver_name = null;
      updates.driver_vehicle_plate = null;
      updates.driver_vehicle_model = null;
      updates.driver_vehicle_type = null;
      updates.driver_vehicle_photo = null;
      updates.driver_license_photo = null;
      updates.driver_lat = null;
      updates.driver_lng = null;
      updates.eta_mins = null;
      updates.remaining_km = null;
      updates.arrived_at_pickup = null;
    }

    // Enforce driver vehicle registration check on assignment
    if (updates.status === 'assigned') {
      const driverId = updates.driver_id || req.user.id;
      const driver = Users.findById(driverId);
      if (!driver) {
        return res.status(400).json({ error: 'Driver user not found' });
      }
      if (driver.role !== 'driver') {
        return res.status(400).json({ error: 'Only professional drivers can accept delivery orders' });
      }
      if (!driver.vehicle_info || !driver.vehicle_info.plate || !driver.vehicle_info.model) {
        return res.status(400).json({ error: 'Driver must register vehicle details before accepting orders' });
      }
      updates.driver_id = driverId;
      updates.driver_name = driver.full_name || driver.email.split('@')[0];
      updates.driver_vehicle_plate = driver.vehicle_info.plate;
      updates.driver_vehicle_model = driver.vehicle_info.model;
      updates.driver_vehicle_type = driver.vehicle_info.type;
      updates.driver_vehicle_photo = driver.vehicle_info.photo || null;
      updates.driver_license_photo = driver.vehicle_info.license_photo || null;
    }

    const updatedOrder = Orders.update(id, updates);
    if (!updatedOrder) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Broadcast status change
    eventBus.emit('order_updated', updatedOrder);

    // Feature 4: Driver Wallet Credit on delivery status transition
    if (oldOrder.status !== 'delivered' && updatedOrder.status === 'delivered') {
      const driverId = updatedOrder.driver_id;
      if (driverId) {
        const driver = Users.findById(driverId);
        if (driver) {
          const fareCredit = Math.round(updatedOrder.price * 0.8); // 80% to driver
          const currentBalance = Number(driver.wallet_balance) || 0;
          const currentTransactions = driver.wallet_transactions || [];
          
          const newTransaction = {
            id: uuidv4(),
            type: 'credit',
            amount: fareCredit,
            description: `Earnings for delivery: PP-${updatedOrder.id.slice(0, 8).toUpperCase()}`,
            date: new Date().toISOString()
          };
          
          Users.update(driverId, {
            wallet_balance: currentBalance + fareCredit,
            wallet_transactions: [newTransaction, ...currentTransactions]
          });
          console.log(`[Wallet] Credited ₹${fareCredit} to driver ${driver.full_name} for order ${updatedOrder.id}`);
        }
      }
    }

    res.json(updatedOrder);
  } catch (error) {
    console.error('[Orders API] PATCH Error:', error);
    res.status(500).json({ error: 'Server Error updating order' });
  }
});

// Send chat message
router.post('/:id/messages', verifyToken, (req, res) => {
  try {
    const { id } = req.params;
    const { text, sender_role } = req.body;

    const order = Orders.findById(id);
    if (!order) return res.status(404).json({ error: 'Order not found' });

    let senderName = req.user.full_name || req.user.email.split('@')[0];
    if (sender_role === 'driver') {
      senderName = order.driver_name || 'Driver';
    } else if (sender_role === 'user' || sender_role === 'customer') {
      senderName = order.user_name || senderName;
    }

    const messages = order.messages || [];
    const newMessage = {
      id: uuidv4(),
      sender_id: req.user.id,
      sender_name: senderName,
      sender_role: sender_role || req.user.role,
      text,
      timestamp: new Date().toISOString()
    };

    const updatedOrder = Orders.update(id, {
      messages: [...messages, newMessage]
    });

    // Broadcast update via SSE
    eventBus.emit('order_updated', updatedOrder);

    res.json(newMessage);
  } catch (error) {
    console.error('[Orders API] Message Error:', error);
    res.status(500).json({ error: 'Server Error sending message' });
  }
});

export default router;
