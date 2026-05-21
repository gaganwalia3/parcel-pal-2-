// services/notificationService.js
export const sendOrderConfirmation = (orderId, email) => {
  // In a real app, this would use Nodemailer or Twilio
  console.log(`[Notification Service] 📧 Email sent to ${email} for Order #${orderId.slice(0,8)}`);
  
  // Return a mock success response
  return { status: 'sent', provider: 'ParcelPal SMTP' };
};