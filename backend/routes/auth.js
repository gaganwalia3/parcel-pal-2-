import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { Users } from '../data/db.js';
import { verifyToken } from '../middleware/auth.js';

const router = express.Router();

const JWT_SECRET = 'super-secret-parcel-pal-key-2026';

// Register a new user
router.post('/register', async (req, res) => {
  try {
    const { email, password, role } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Check if user exists
    const existingUser = Users.findByEmail(email);
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user
    const newUser = {
      id: uuidv4(),
      email,
      password: hashedPassword,
      role: role || 'user', // 'user' or 'driver'
      full_name: email.split('@')[0],
      created_at: new Date().toISOString()
    };

    Users.create(newUser);

    res.status(201).json({ message: 'User created successfully', userId: newUser.id });
  } catch (error) {
    console.error('[Auth API] Registration Error:', error);
    res.status(500).json({ error: 'Server error during registration' });
  }
});

// Login user
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Check if user exists
    const user = Users.findByEmail(email);
    if (!user) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    // Validate password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    // Generate JWT
    const payload = {
      user: {
        id: user.id,
        role: user.role,
        email: user.email
      }
    };

    jwt.sign(
      payload,
      JWT_SECRET,
      { expiresIn: '5h' },
      (err, token) => {
        if (err) throw err;
        // The frontend expects Supabase-like response potentially, 
        // we return token and user object
        res.json({ 
          access_token: token, 
          user: {
            id: user.id,
            email: user.email,
            user_metadata: {
              role: user.role,
              full_name: user.full_name
            }
          } 
        });
      }
    );
  } catch (error) {
    console.error('[Auth API] Login Error:', error);
    res.status(500).json({ error: 'Server error during login' });
  }
});

// Get profile details
router.get('/profile', verifyToken, (req, res) => {
  try {
    const user = Users.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    const { password, ...safeUser } = user;
    res.json(safeUser);
  } catch (error) {
    console.error('[Auth API] Profile Get Error:', error);
    res.status(500).json({ error: 'Server error retrieving profile' });
  }
});

// Update profile details (saved locations, vehicle info, home location)
router.patch('/profile', verifyToken, (req, res) => {
  try {
    const userId = req.user.id;
    const updates = req.body;
    
    const user = Users.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Support merging home_location, saved_locations, vehicle_info, or general user metadata
    const updatedUser = Users.update(userId, updates);
    const { password, ...safeUser } = updatedUser;
    
    res.json(safeUser);
  } catch (error) {
    console.error('[Auth API] Profile Patch Error:', error);
    res.status(500).json({ error: 'Server error updating profile' });
  }
});

export default router;
