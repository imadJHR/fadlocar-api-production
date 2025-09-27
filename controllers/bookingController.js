// backend/controllers/bookingController.js
const Booking = require('../models/Booking');
const Car = require('../models/Car');

// @desc    Create a new booking
// @route   POST /api/bookings
exports.createBooking = async (req, res) => {
  try {
    const { carId, userEmail, userName, pickupDate, userPhone, returnDate, totalPrice } = req.body;

    // Basic validation
    if (!carId || !userEmail || !userName || !userPhone || !pickupDate || !returnDate || !totalPrice) {
      return res.status(400).json({ message: 'Please provide all required fields.' });
    }

    const car = await Car.findById(carId);
    if (!car) {
      return res.status(404).json({ message: 'Car not found.' });
    }

    const newBooking = new Booking({
      car: carId,
      userEmail,
      userName,
      pickupDate,
      returnDate,
      totalPrice,
      userPhone
    });

    let savedBooking = await newBooking.save();
    savedBooking = await savedBooking.populate('car', 'name brand');
    req.io.emit('newOrder', savedBooking);

    res.status(201).json({
      message: 'Booking successful!',
      booking: savedBooking,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error while creating booking.', error: error.message });
  }
};
exports.getAllBookings = async (req, res) => {
  try {
    const bookings = await Booking.find({})
      .populate('car', 'name brand thumbnail') // <-- This is the key part. It replaces the car ObjectId with actual car data.
      .sort({ createdAt: -1 }); // Show the newest bookings first
    const validBookings = bookings.filter(booking => booking.car !== null);
    res.status(200).json(validBookings);
    res.status(200).json(bookings);
    
    
  } catch (error) {
    res.status(500).json({ message: 'Server error while fetching bookings.', error: error.message });
  }
};
exports.deleteBooking = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);

    if (booking) {
      await booking.deleteOne(); // Use deleteOne() on the document
      res.json({ message: 'Booking removed' });
    } else {
      res.status(404).json({ message: 'Booking not found' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};
exports.updateBookingStatus = async (req, res) => {
    try {
        const { status } = req.body;
        const booking = await Booking.findById(req.params.id);

        // Check for valid status
        const validStatuses = ['confirmed', 'completed', 'cancelled'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ message: 'Invalid status provided.' });
        }

        if (booking) {
            booking.status = status;
            const updatedBooking = await booking.save();
            // We need to populate the car details again to send back to the frontend
            await updatedBooking.populate('car', 'name brand thumbnail');
            res.json(updatedBooking);
        } else {
            res.status(404).json({ message: 'Booking not found' });
        }
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};