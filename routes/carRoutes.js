const express = require('express');
const multer = require('multer');
const { protect } = require('../middleware/authMiddleware');
const path = require('path');
const {
  createCar,
  getCars,
  getCarById,
  getCarBySlug,
  updateCar,
  deleteCar,
  getRelatedCars
} = require('../controllers/carController');

const router = express.Router();

// --- NOUVEAU : Fonction pour nettoyer les noms de fichiers ---
const sanitizeFilename = (filename) => {
  return filename
    .replace(/[^a-zA-Z0-9.\-_]/g, '_') // Remplace les caractères non valides par un _
    .replace(/_{2,}/g, '_');          // Remplace les multiples _ par un seul
};

// --- MISE À JOUR : Configuration de stockage Multer ---
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    // Utilise le nom de fichier nettoyé
    const sanitized = sanitizeFilename(file.originalname);
    cb(null, `${Date.now()}-${sanitized}`);
  },
});

const upload = multer({ storage: storage });

// --- Le reste de vos routes reste identique ---
router.get('/related/:type/:currentCarSlug', getRelatedCars);
router.get('/slug/:slug', getCarBySlug); 

router.route('/')
  .get(getCars)
  .post(protect, upload.fields([{ name: 'thumbnail', maxCount: 1 }, { name: 'newImages', maxCount: 10 }]), createCar);

router.route('/:id')
  .get(getCarById)
  .put(protect, upload.fields([{ name: 'thumbnail', maxCount: 1 }, { name: 'newImages', maxCount: 10 }]), updateCar)
  .delete(protect, deleteCar);

module.exports = router;