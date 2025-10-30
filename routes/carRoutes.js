const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const { upload, handleMulterError } = require('../path/to/your/multer/config'); // Adjust path
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

// Routes
router.get('/related/:type/:currentCarSlug', getRelatedCars);
router.get('/slug/:slug', getCarBySlug); 

router.route('/')
  .get(getCars)
  .post(
    protect, 
    upload.fields([
      { name: 'thumbnail', maxCount: 1 }, 
      { name: 'images', maxCount: 10 }
    ]),
    handleMulterError, // Add error handling middleware
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
    handleMulterError, // Add error handling middleware
    updateCar
  )
  .delete(protect, deleteCar);

module.exports = router;