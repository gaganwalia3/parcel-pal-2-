import express from 'express';
import { Orders } from '../data/db.js';
import { verifyToken } from '../middleware/auth.js';
import PDFDocument from 'pdfkit';

const router = express.Router();

// Generate PDF Invoice for a delivered order
router.get('/:id/invoice', verifyToken, (req, res) => {
  try {
    const { id } = req.params;
    const order = Orders.findById(id);

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Usually invoices are only available after delivery, but we allow it for demo purposes if needed
    // However, best practice is to ensure status is delivered.
    if (order.status !== 'delivered' && !req.query.force) {
      return res.status(400).json({ error: 'Invoice only available for delivered orders' });
    }

    // Set headers for PDF download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=Invoice-${order.id.slice(0, 8)}.pdf`);

    // Initialize PDF Document
    const doc = new PDFDocument({ margin: 50 });

    // Pipe the PDF document directly to the Express response
    doc.pipe(res);

    // --- PDF Content Generation ---
    
    // Header
    doc.fontSize(25).font('Helvetica-Bold').text('ParcelPal Logistics', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(10).font('Helvetica').text('Official Tax Invoice & Delivery Receipt', { align: 'center', color: 'gray' });
    doc.moveDown(2);

    // Order Details
    doc.fontSize(14).font('Helvetica-Bold').text('Shipment Details');
    doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
    doc.moveDown(0.5);

    doc.fontSize(10).font('Helvetica');
    doc.text(`Tracking ID: PP-${order.id.slice(0, 8).toUpperCase()}`);
    doc.text(`Order Date: ${new Date(order.created_at).toLocaleString()}`);
    doc.text(`Status: DELIVERED`);
    if (order.driver_name) {
      doc.text(`Handled By: ${order.driver_name}`);
    }
    doc.moveDown(1);

    // Route Details
    doc.fontSize(12).font('Helvetica-Bold').text('Route Information');
    doc.moveDown(0.5);
    doc.fontSize(10).font('Helvetica');
    doc.text(`Pickup From:`);
    doc.font('Helvetica-Bold').text(order.pickup_location || 'N/A', { indent: 20 });
    doc.moveDown(0.5);
    doc.font('Helvetica').text(`Delivered To:`);
    doc.font('Helvetica-Bold').text(order.drop_location || 'N/A', { indent: 20 });
    doc.moveDown(1);

    // Package Details
    doc.fontSize(12).font('Helvetica-Bold').text('Package Specifications');
    doc.moveDown(0.5);
    doc.fontSize(10).font('Helvetica');
    doc.text(`Weight: ${order.weight_category || 'Standard'}`);
    doc.text(`Distance Billed: ${order.distance_km || 0} km`);
    doc.moveDown(1.5);

    // Billing Summary
    doc.fontSize(14).font('Helvetica-Bold').text('Billing Summary');
    doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
    doc.moveDown(0.5);

    doc.fontSize(12).font('Helvetica');
    doc.text(`Base Fare:`, { continued: true }).text(`Rs. ${Math.round(order.price * 0.8)}`, { align: 'right' });
    doc.text(`Taxes & Surcharges:`, { continued: true }).text(`Rs. ${Math.round(order.price * 0.2)}`, { align: 'right' });
    doc.moveDown(0.5);
    doc.fontSize(16).font('Helvetica-Bold');
    doc.text(`Total Paid:`, { continued: true }).text(`Rs. ${order.price}`, { align: 'right' });

    // Proof of Delivery Signature
    if (order.signature) {
      try {
        const base64Data = order.signature.replace(/^data:image\/png;base64,/, "");
        const signatureBuffer = Buffer.from(base64Data, 'base64');
        doc.moveDown(1.5);
        doc.fontSize(10).font('Helvetica-Bold').text('Proof of Delivery Signature:');
        doc.image(signatureBuffer, { width: 140, height: 50 });
      } catch (err) {
        console.error("Failed to embed signature in PDF invoice:", err);
      }
    }

    // Footer
    doc.moveDown(2);
    doc.fontSize(9).font('Helvetica-Oblique').text('Thank you for choosing ParcelPal! This is an electronically generated receipt.', { align: 'center', color: 'gray' });

    // Finalize the PDF and end the stream
    doc.end();

  } catch (error) {
    console.error('[Invoice API] Error generating PDF:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Server error generating invoice' });
    }
  }
});

export default router;
