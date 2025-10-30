const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');

// ⚠️ VÉRIFIEZ que ces variables d'environnement sont définies sur Render
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'fadlo-cars',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    // ⚠️ CORRECTION : format doit être une fonction ou undefined
    format: async (req, file) => {
      // Conversion automatique en webp pour optimisation
      return 'webp';
    },
    public_id: (req, file) => {
      return `car-${Date.now()}-${Math.round(Math.random() * 1E9)}`;
    },
  },
});

module.exports = { cloudinary, storage };