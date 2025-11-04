// api/routes/carRoutes.js
const express = require('express');
const { protect, admin } = require('../middleware/authMiddleware');
const { uploadFields } = require('../config/multerConfig');
const {
  createCar,
  getCars,
  getCarById,
  getCarBySlug,
  updateCar,
  deleteCar,
  getRelatedCars,
  getAvailableCars,
  getFeaturedCars,
  searchCars,
  getCarStats,
  getCarsByType,
  getCarsByFuel,
  getPopularCars
} = require('../controllers/carController');

const router = express.Router();

// Multer error handling middleware
const handleMulterError = (error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    console.error('❌ Multer error:', error.message);
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'File too large',
        error: 'File size must be less than 5MB'
      });
    }
    if (error.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({
        success: false,
        message: 'Unexpected field',
        error: 'Invalid field name for file upload'
      });
    }
    return res.status(400).json({
      success: false,
      message: 'File upload error',
      error: error.message
    });
  } else if (error) {
    console.error('❌ File upload error:', error);
    return res.status(400).json({
      success: false,
      message: 'File upload error',
      error: error.message
    });
  }
  next();
};

// Middleware to log uploaded files
const logUploadedFiles = (req, res, next) => {
  if (!req.files || Object.keys(req.files).length === 0) {
    console.log('⚠️ No files uploaded.');
  } else {
    console.log('📁 Files ready for Firebase upload:');
    Object.keys(req.files).forEach(fieldName => {
      req.files[fieldName].forEach(file => {
        console.log(`  - ${fieldName}: ${file.originalname} (${(file.size / 1024).toFixed(2)} KB)`);
      });
    });
  }
  next();
};

// Middleware to handle empty files
const handleEmptyFiles = (req, res, next) => {
  if (!req.files) {
    req.files = {};
  }
  next();
};

// === PUBLIC ROUTES ===

// Search routes
router.get('/search', searchCars);

// Filter routes
router.get('/available', getAvailableCars);
router.get('/featured', getFeaturedCars);
router.get('/popular', getPopularCars);
router.get('/type/:type', getCarsByType);
router.get('/fuel/:fuel', getCarsByFuel);

// Specific car routes
router.get('/related/:type/:currentCarSlug', getRelatedCars);
router.get('/slug/:slug', getCarBySlug);

// Stats route
router.get('/stats', getCarStats);

// General routes (keep these last)
router.get('/', getCars);
router.get('/:id', getCarById);

// === ADMIN ROUTES (PROTECTED) ===

// Create car
router.post('/',
  protect,
  admin,
  uploadFields,
  handleMulterError,
  handleEmptyFiles,
  logUploadedFiles,
  createCar
);

// Update car
router.put('/:id',
  protect,
  admin,
  uploadFields,
  handleMulterError,
  handleEmptyFiles,
  logUploadedFiles,
  updateCar
);

// Delete car
router.delete('/:id',
  protect,
  admin,
  deleteCar
);

module.exports = router;