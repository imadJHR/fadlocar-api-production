// backend/routes/statsRoutes.js
const express = require('express');
const { getDashboardStats } = require('../controllers/statsController');
const { protect } = require('../middleware/authMiddleware'); // Import protect middleware
const router = express.Router();

// This route should be protected so only admins can see the stats
router.route('/dashboard').get(protect, getDashboardStats);

module.exports = router;