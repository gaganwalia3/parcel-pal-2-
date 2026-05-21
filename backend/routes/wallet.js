import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { Users } from '../data/db.js';
import { verifyToken } from '../middleware/auth.js';

const router = express.Router();

// GET wallet balance and transaction logs
router.get('/balance', verifyToken, (req, res) => {
  try {
    const driverId = req.user.id;
    const driver = Users.findById(driverId);
    
    if (!driver) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (driver.role !== 'driver') {
      return res.status(403).json({ error: 'Access denied. Wallet only available for drivers.' });
    }

    res.json({
      balance: driver.wallet_balance || 0,
      transactions: driver.wallet_transactions || []
    });
  } catch (error) {
    console.error('[Wallet API] Fetch Error:', error);
    res.status(500).json({ error: 'Server error fetching wallet balance' });
  }
});

// POST simulated bank withdrawal
router.post('/withdraw', verifyToken, (req, res) => {
  try {
    const driverId = req.user.id;
    const { amount, bankName, accountNumber, ifscCode } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Invalid withdrawal amount' });
    }

    if (!bankName || !accountNumber) {
      return res.status(400).json({ error: 'Bank details (name and account number) are required' });
    }

    const driver = Users.findById(driverId);
    if (!driver) {
      return res.status(404).json({ error: 'User not found' });
    }

    const currentBalance = Number(driver.wallet_balance) || 0;
    if (currentBalance < amount) {
      return res.status(400).json({ error: 'Insufficient wallet balance' });
    }

    // Process debit transaction
    const transactionId = uuidv4();
    const newTransaction = {
      id: transactionId,
      type: 'debit',
      amount: Number(amount),
      description: `Withdrawal to ${bankName} (A/C: ...${accountNumber.slice(-4)})`,
      date: new Date().toISOString()
    };

    const updatedTransactions = [newTransaction, ...(driver.wallet_transactions || [])];
    const newBalance = currentBalance - Number(amount);

    Users.update(driverId, {
      wallet_balance: newBalance,
      wallet_transactions: updatedTransactions
    });

    res.json({
      message: 'Withdrawal processed successfully',
      balance: newBalance,
      transaction: newTransaction
    });
  } catch (error) {
    console.error('[Wallet API] Withdrawal Error:', error);
    res.status(500).json({ error: 'Server error processing withdrawal' });
  }
});

export default router;
