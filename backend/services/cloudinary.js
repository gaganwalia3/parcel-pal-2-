import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { v2 as cloudinary } from 'cloudinary';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env variables manually from .env at root
const loadEnv = () => {
  const env = {};
  const envPath = path.resolve(__dirname, '../../.env');
  if (fs.existsSync(envPath)) {
    try {
      const content = fs.readFileSync(envPath, 'utf-8');
      const lines = content.split(/\r?\n/);
      for (const line of lines) {
        const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
        if (match) {
          let key = match[1];
          let value = match[2] || '';
          if (value.length > 0 && value.charAt(0) === '"' && value.charAt(value.length - 1) === '"') {
            value = value.substring(1, value.length - 1);
          }
          env[key] = value;
        }
      }
    } catch (err) {
      console.error('[Cloudinary Service] Error reading .env file:', err);
    }
  }
  return env;
};

const env = loadEnv();

const cloudName = env.CLOUDINARY_CLOUD_NAME || process.env.CLOUDINARY_CLOUD_NAME;
const apiKey = env.CLOUDINARY_API_KEY || process.env.CLOUDINARY_API_KEY;
const apiSecret = env.CLOUDINARY_API_SECRET || process.env.CLOUDINARY_API_SECRET;

const isCloudinaryConfigured = !!(cloudName && apiKey && apiSecret);

if (isCloudinaryConfigured) {
  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret
  });
  console.log('[Cloudinary Service] Initialized successfully with credentials.');
} else {
  console.log('[Cloudinary Service] Credentials missing. Running in local filesystem fallback mode.');
}

/**
 * Uploads a base64 encoded image to Cloudinary (or local filesystem fallback).
 * @param {string} base64Data - Base64 data URI (e.g. data:image/png;base64,...)
 * @param {string} folder - Subfolder name ('licenses' or 'vehicles')
 * @returns {Promise<string>} - The resolved public URL of the uploaded image
 */
export const uploadImage = async (base64Data, folder = 'general') => {
  if (!base64Data) {
    throw new Error('No image data provided');
  }

  if (isCloudinaryConfigured) {
    try {
      // Cloudinary SDK handles base64 data URIs directly
      const result = await cloudinary.uploader.upload(base64Data, {
        folder: `parcel-pal/${folder}`,
        resource_type: 'image'
      });
      return result.secure_url;
    } catch (error) {
      console.error('[Cloudinary Service] Cloudinary upload failed, falling back to local storage:', error);
      // Fall through to local storage if Cloudinary upload fails
    }
  }

  // Local filesystem fallback
  try {
    // Parse base64 data (robust to accept application/octet-stream or empty mime-type from Windows)
    const matches = base64Data.match(/^data:([A-Za-z-+\/]*);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      throw new Error('Invalid base64 image format');
    }

    const mimeType = matches[1] || 'image/jpeg';
    const imageBuffer = Buffer.from(matches[2], 'base64');
    
    let extension = 'jpg';
    if (mimeType.includes('/')) {
      const part = mimeType.split('/')[1];
      if (part && part !== 'octet-stream') {
        extension = part === 'jpeg' ? 'jpg' : part;
      }
    } else if (mimeType && mimeType !== 'base64') {
      extension = mimeType === 'jpeg' ? 'jpg' : mimeType;
    }

    const filename = `${folder}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}.${extension}`;
    
    const uploadsDir = path.resolve(__dirname, '../uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const filePath = path.join(uploadsDir, filename);
    fs.writeFileSync(filePath, imageBuffer);
    
    // Return relative backend URL served statically
    const backendUrl = env.BACKEND_URL || process.env.BACKEND_URL || "http://localhost:3001";
    return `${backendUrl}/uploads/${filename}`;
  } catch (error) {
    console.error('[Cloudinary Service] Local upload fallback failed:', error);
    throw new Error(`Failed to upload image: ${error.message}`);
  }
};
