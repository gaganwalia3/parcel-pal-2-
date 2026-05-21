import express from 'express';
import { uploadImage } from '../services/cloudinary.js';
import { verifyToken } from '../middleware/auth.js';

const router = express.Router();

// Upload image (base64 string format)
router.post('/', verifyToken, async (req, res) => {
  try {
    const { image, folder } = req.body;
    
    if (!image) {
      return res.status(400).json({ error: 'Image data is required (base64 string)' });
    }
    
    // Acceptable subfolders are licenses, vehicles
    const subfolder = folder || 'general';
    
    console.log(`[Upload API] Received upload request for folder: ${subfolder}`);
    
    const imageUrl = await uploadImage(image, subfolder);
    
    res.json({ url: imageUrl });
  } catch (error) {
    console.error('[Upload API] Upload Error:', error);
    res.status(500).json({ error: error.message || 'Server error during file upload' });
  }
});

export default router;
