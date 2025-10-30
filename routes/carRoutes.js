const express = require('express');
const multer = require('multer');
const { protect } = require('../middleware/authMiddleware');
const {
  createCar,
  getCars,
  getCarById,
  getCarBySlug,
  updateCar,
  deleteCar,
  getRelatedCars
} = require('../controllers/carController');

// ⚡ IMPORTATION DE LA CONFIGURATION CLOUDINARY
const { storage } = require('../config/cloudinary');

const router = express.Router();

// ⚡ CONFIGURATION MULTER AVEC CLOUDINARY (plus simple !)
const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max
  },
  fileFilter: (req, file, cb) => {
    // Vérifier le type de fichier
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Seules les images sont autorisées!'), false);
    }
  }
});

// --- Routes restent identiques ---
router.get('/related/:type/:currentCarSlug', getRelatedCars);
router.get('/slug/:slug', getCarBySlug); 

router.route('/')
  .get(getCars)
  // ⚡ MODIFICATION : Utilisation de Cloudinary pour l'upload
  .post(protect, upload.fields([{ name: 'thumbnail', maxCount: 1 }, { name: 'newImages', maxCount: 10 }]), createCar);

router.route('/:id')
  .get(getCarById)
  // ⚡ MODIFICATION : Utilisation de Cloudinary pour l'upload
  .put(protect, upload.fields([{ name: 'thumbnail', maxCount: 1 }, { name: 'newImages', maxCount: 10 }]), updateCar)
  .delete(protect, deleteCar);

module.exports = router;