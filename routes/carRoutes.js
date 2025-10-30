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

// Assurer que le dossier uploads existe
const uploadsDir = '../uploads';
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log('Uploads directory created');
}

// Configuration Multer
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
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp'
  };

  const isValidMimeType = allowedFileTypes[file.mimetype];
  const fileExtension = path.extname(file.originalname).toLowerCase().replace('.', '');
  const isValidExtension = /jpeg|jpg|png|gif|webp/.test(fileExtension);

  if (isValidMimeType && isValidExtension) {
    return cb(null, true);
  } else {
    cb(new Error(`Error: Invalid file type. Only JPEG, JPG, PNG, GIF, WEBP are allowed.`));
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

// Middleware de gestion d'erreurs Multer
const handleMulterError = (error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        message: 'File too large',
        error: 'File size must be less than 5MB'
      });
    }
    if (error.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({
        message: 'Unexpected field',
        error: 'Invalid field name for file upload'
      });
    }
  } else if (error) {
    return res.status(400).json({
      message: 'File upload error',
      error: error.message
    });
  }
  next();
};

// Routes publiques
router.get('/related/:type/:currentCarSlug', getRelatedCars);
router.get('/slug/:slug', getCarBySlug);
router.get('/available', getAvailableCars);
router.get('/featured', getFeaturedCars);
router.get('/search', searchCars);

// Routes protégées (admin)
router.route('/')
  .get(getCars)
  .post(
    protect,
    upload.fields([
      { name: 'thumbnail', maxCount: 1 },
      { name: 'images', maxCount: 10 }
    ]),
    handleMulterError,
    createCar
  );

router.route('/:id')
  .get(getCarById)
  .put(
    protect,
    upload.fields([
      { name: 'thumbnail', maxCount: 1 },
      { name: 'images', maxCount: 10 }
    ]),
    handleMulterError,
    updateCar
  )
  .delete(protect, deleteCar);

module.exports = router;