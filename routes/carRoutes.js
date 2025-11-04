const express = require('express');
const router = express.Router();
const {
    getAllCars,
    getCarById,
    getCarBySlug,
    createCar,
    updateCar,
    deleteCar,
    getFeaturedCars,
    getCarTypes
} = require('../controllers/carController');
const upload = require('../config/multerConfig');
const { protect, admin } = require('../middleware/authMiddleware');

// Routes publiques
router.get('/', getAllCars);
router.get('/featured', getFeaturedCars);
router.get('/types', getCarTypes);
router.get('/slug/:slug', getCarBySlug);
router.get('/:id', getCarById);

// Routes protégées (Admin)
router.post('/', protect, admin, upload.array('images', 10), createCar);
router.put('/:id', protect, admin, upload.array('images', 10), updateCar);
router.delete('/:id', protect, admin, deleteCar);

module.exports = router;