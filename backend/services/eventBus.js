import { EventEmitter } from 'events';
import { sendOrderConfirmation } from './notificationService.js';
import { Users } from '../data/db.js';

class ParcelPalEventBus extends EventEmitter {}
const eventBus = new ParcelPalEventBus();

// Listeners
eventBus.on('order_created', (order) => {
  console.log(`[EventBus] Processing background tasks for Order ${order.id}...`);
  
  // Find user email to send confirmation
  const user = Users.findById(order.user_id);
  const email = user ? user.email : 'customer@parcelpal.com';
  
  // Call the mock notification service
  sendOrderConfirmation(order.id, email);
});

// Emitters
export const emitOrderCreated = (order) => {
  eventBus.emit('order_created', order);
};

export default eventBus;
