// backend/routes/contactRoutes.js
const express = require('express');
const { createContactMessage, getAllMessages, deleteMessage,       // <-- Import
    updateMessageStatus  } = require('../controllers/contactController');
const router = express.Router();
const {protect} = require('../middleware/authMiddleware');
// POST a new message
router.route('/').post(createContactMessage);

// GET all messages (for a future admin panel)
router.route('/').get(getAllMessages);
router.route('/:id').delete(deleteMessage);
router.route('/:id/read').patch(updateMessageStatus);


module.exports = router;