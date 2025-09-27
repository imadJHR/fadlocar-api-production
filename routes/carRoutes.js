const express = require('express');
const multer = require('multer');
const {protect} = require('../middleware/authMiddleware');
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

// Multer storage configuration
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});

const upload = multer({ storage: storage });
router.get('/related/:type/:currentCarSlug', getRelatedCars);
router.get('/slug/:slug', getCarBySlug); 
// Define routes
router.route('/')
  .post(protect,upload.fields([{ name: 'thumbnail', maxCount: 1 }, { name: 'newImages', maxCount: 10 }]), createCar)
  .get(getCars);

router.route('/:id')
  .get(getCarById)
  .put(protect,upload.fields([{ name: 'thumbnail', maxCount: 1 }, { name: 'newImages', maxCount: 10 }]), updateCar)
  .delete(protect,deleteCar);

module.exports = router;