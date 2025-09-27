// backend/routes/bookingRoutes.js
const express = require('express');
const { createBooking, getAllBookings, deleteBooking, updateBookingStatus } = require('../controllers/bookingController');
const router = express.Router();

router.route('/')
    .post(createBooking)
    .get(getAllBookings);
router.route('/:id').delete(deleteBooking);
router.route('/:id/status').patch(updateBookingStatus);

module.exports = router;