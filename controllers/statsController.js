// backend/controllers/statsController.js
const Car = require('../models/Car');
const Booking = require('../models/Booking');
const Contact = require('../models/Contact');

/**
 * @desc    Get dashboard statistics
 * @route   GET /api/stats/dashboard
 * @access  Private
 */
exports.getDashboardStats = async (req, res) => {
    try {
        // Use Promise.all to fetch all counts concurrently for better performance
        const [carCount, newOrdersCount, unreadMessagesCount] = await Promise.all([
            Car.countDocuments(),
            Booking.countDocuments({ status: 'confirmed' }),
            Contact.countDocuments({ isRead: false })
        ]);

        res.status(200).json({
            totalCars: carCount,
            newOrders: newOrdersCount,
            unreadMessages: unreadMessagesCount,
        });

    } catch (error) {
        console.error('STATS FETCHING ERROR:', error);
        res.status(500).json({ message: 'Server Error: Could not fetch stats.' });
    }
};