// backend/controllers/contactController.js
const Contact = require('../models/Contact');

/**
 * @desc    Create a new contact message
 * @route   POST /api/contact
 */
exports.createContactMessage = async (req, res) => {
  try {
    const { firstName, lastName, email, phone, inquiryType, message } = req.body;

    // Basic validation
    if (!firstName || !lastName || !email || !inquiryType || !message) {
      return res.status(400).json({ message: 'Please fill out all required fields.' });
    }

    const newMessage = await Contact.create({
      firstName,
      lastName,
      email,
      phone,
      inquiryType,
      message,
    });
     req.io.emit('newMessage', newMessage);

    res.status(201).json({ 
      success: true, 
      message: 'Thank you for your message! We will get back to you shortly.',
      data: newMessage 
    });
  } catch (error) {
    console.error('CONTACT FORM ERROR:', error);
    res.status(500).json({ success: false, message: 'Something went wrong. Please try again later.' });
  }
};

/**
 * @desc    Get all contact messages (for admin)
 * @route   GET /api/contact
 */
exports.getAllMessages = async (req, res) => {
    try {
        const messages = await Contact.find({}).sort({ createdAt: -1 });
        res.status(200).json({
            success: true,
            count: messages.length,
            data: messages
        });
    } catch (error) {
        console.error('GET MESSAGES ERROR:', error);
        res.status(500).json({ success: false, message: 'Failed to retrieve messages.' });
    }
}
exports.deleteMessage = async (req, res) => {
    try {
        const message = await Contact.findById(req.params.id);
        if (!message) {
            return res.status(404).json({ success: false, message: 'Message not found.' });
        }
        await message.deleteOne();
        res.status(200).json({ success: true, message: 'Message deleted successfully.' });
    } catch (error) {
        console.error('DELETE MESSAGE ERROR:', error);
        res.status(500).json({ success: false, message: 'Failed to delete message.' });
    }
};

/**
 * @desc    Update a message's read status
 * @route   PATCH /api/contact/:id/read
 */
exports.updateMessageStatus = async (req, res) => {
    try {
        const message = await Contact.findById(req.params.id);
        if (!message) {
            return res.status(404).json({ success: false, message: 'Message not found.' });
        }
        message.isRead = req.body.isRead;
        const updatedMessage = await message.save();
        res.status(200).json({ success: true, data: updatedMessage });
    } catch (error) {
        console.error('UPDATE MESSAGE STATUS ERROR:', error);
        res.status(500).json({ success: false, message: 'Failed to update message status.' });
    }
};