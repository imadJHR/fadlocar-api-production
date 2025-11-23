const express = require('express');
const multer = require('multer');
const { protect } = require('../middleware/authMiddleware');
const path = require('path');
const fs = require('fs');
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
  searchCars
} = require('../controllers/carController');

const router = express.Router();

// ✅ Use absolute path for uploads directory
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log('✅ Uploads directory created:', uploadsDir);
}

// Multer configuration
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    const originalName = path.parse(file.originalname).name;
    const sanitizedName = originalName.replace(/[^a-zA-Z0-9]/g, '_');
    const extension = path.extname(file.originalname).toLowerCase();
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `${sanitizedName}-${uniqueSuffix}${extension}`);
  },
});

function checkFileType(file, cb) {
  const allowedFileTypes = {
    'image/jpeg': true,
    'image/jpg': true,
    'image/png': true,
    'image/gif': true,
    'image/webp': true
  };
  const isValidMimeType = allowedFileTypes[file.mimetype];
  const fileExtension = path.extname(file.originalname).toLowerCase().replace('.', '');
  const isValidExtension = /jpeg|jpg|png|gif|webp/.test(fileExtension);

  if (isValidMimeType && isValidExtension) {
    return cb(null, true);
  } else {
    const allowedExtensions = Object.keys(allowedFileTypes).join(', ').replace('image/', '');
    cb(new Error(`Invalid file type. Allowed types: ${allowedExtensions}.`));
  }
}

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
  fileFilter: function (req, file, cb) {
    checkFileType(file, cb);
  }
});

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
    if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        success: false,
        message: 'Too many files',
        error: 'Maximum 10 images allowed'
      });
    }
    if (error.code === 'LIMIT_PART_COUNT') {
      return res.status(400).json({
        success: false,
        message: 'Too many parts',
        error: 'Too many form parts'
      });
    }
    // Log other Multer errors
    console.error('❌ Unexpected Multer error:', error);
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

// Upload fields configuration
const uploadFields = upload.fields([
  { name: 'images', maxCount: 10 }
]);

// Middleware to log uploaded files
const logUploadedFiles = (req, res, next) => {
  if (!req.files || Object.keys(req.files).length === 0) {
    console.log('⚠️ No files uploaded.');
  } else {
    console.log('📁 Uploaded files:');
    Object.keys(req.files).forEach(fieldName => {
      req.files[fieldName].forEach(file => {
        console.log(`  - ${fieldName}: ${file.filename} (${(file.size / 1024).toFixed(2)} KB)`);
      });
    });
  }
  next();
};

// Public routes - specific paths first
router.get('/search', searchCars);
router.get('/available', getAvailableCars);
router.get('/featured', getFeaturedCars);
router.get('/related/:type/:currentCarSlug', getRelatedCars);
router.get('/slug/:slug', getCarBySlug);

// Public routes - general paths last
router.get('/', getCars);
router.get('/:id', getCarById);

// Admin routes (protected)
router.post(
  '/',
  protect,
  uploadFields,
  handleMulterError,
  logUploadedFiles,
  createCar
);

router.put(
  '/:id',
  protect,
  uploadFields,
  handleMulterError,
  logUploadedFiles,
  updateCar
);

router.delete('/:id', protect, deleteCar);
router.get('/search', searchCars);

module.exports = router;