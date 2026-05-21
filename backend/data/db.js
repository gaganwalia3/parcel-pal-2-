import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_FILE = path.join(__dirname, 'database.json');

// Initial database structure
const INITIAL_DATA = {
  users: [],
  orders: []
};

// Ensure DB file exists
export const initializeDB = () => {
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify(INITIAL_DATA, null, 2));
    console.log('[DB] Initialized database.json');
  }
};

// Read from DB
export const readDB = () => {
  try {
    const data = fs.readFileSync(DB_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('[DB] Error reading DB:', error);
    return INITIAL_DATA;
  }
};

// Write to DB
export const writeDB = (data) => {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('[DB] Error writing DB:', error);
  }
};

// Helper methods for Users
export const Users = {
  findAll: () => readDB().users,
  findById: (id) => readDB().users.find(u => u.id === id),
  findByEmail: (email) => readDB().users.find(u => u.email === email),
  create: (user) => {
    const db = readDB();
    db.users.push(user);
    writeDB(db);
    return user;
  },
  update: (id, updates) => {
    const db = readDB();
    const index = db.users.findIndex(u => u.id === id);
    if (index !== -1) {
      db.users[index] = { ...db.users[index], ...updates };
      writeDB(db);
      return db.users[index];
    }
    return null;
  }
};

// Helper methods for Orders
export const Orders = {
  findAll: () => readDB().orders,
  findById: (id) => readDB().orders.find(o => o.id === id),
  findByUserId: (userId) => readDB().orders.filter(o => o.user_id === userId),
  create: (order) => {
    const db = readDB();
    db.orders.push(order);
    writeDB(db);
    return order;
  },
  update: (id, updates) => {
    const db = readDB();
    const index = db.orders.findIndex(o => o.id === id);
    if (index !== -1) {
      db.orders[index] = { ...db.orders[index], ...updates };
      writeDB(db);
      return db.orders[index];
    }
    return null;
  }
};

// Helper methods for Config (Surge Pricing settings)
export const Config = {
  get: () => {
    const db = readDB();
    if (!db.config) {
      db.config = {
        manual_surge: false,
        manual_multiplier: 1.5,
        manual_reason: "High Demand (Manual Simulation)",
        use_weather_api: true
      };
      writeDB(db);
    }
    return db.config;
  },
  update: (updates) => {
    const db = readDB();
    db.config = { ...db.config, ...updates };
    writeDB(db);
    return db.config;
  }
};
