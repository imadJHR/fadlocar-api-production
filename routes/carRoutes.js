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

// --- Sanitize Filename Function ---
// This function removes special characters to prevent URL encoding issues.
const sanitizeFilename = (filename) => {
  return filename
    .replace(/[^a-zA-Z0-9.\-_]/g, '_') // Replace invalid characters with an underscore
    .replace(/_{2,}/g, '_');          // Replace multiple underscores with a single one
};

// --- Updated Multer Storage Configuration ---
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    // Sanitize the original filename before saving
    const sanitized = sanitizeFilename(file.originalname);
    cb(null, `${Date.now()}-${sanitized}`);
  },
});

const upload = multer({ storage: storage });

// --- Define Routes ---

// Public routes for fetching car data
router.get('/related/:type/:currentCarSlug', getRelatedCars);
router.get('/slug/:slug', getCarBySlug);

// Main routes for getting all cars and creating a new car
router.route('/')
  .get(getCars) // Public
  .post(protect, upload.fields([{ name: 'thumbnail', maxCount: 1 }, { name: 'newImages', maxCount: 10 }]), createCar); // Protected

// Routes for a specific car by ID
router.route('/:id')
  .get(getCarById) // Public
  .put(protect, upload.fields([{ name: 'thumbnail', maxCount: 1 }, { name: 'newImages', maxCount: 10 }]), updateCar) // Protected
  .delete(protect, deleteCar); // Protected

module.exports = router;