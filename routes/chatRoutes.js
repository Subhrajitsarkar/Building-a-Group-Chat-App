// routes/chatRoutes.js
const express = require('express');
const router = express.Router();

const chatController = require('../controllers/chatController');
const { authenticate } = require('../middleware/auth');

// Example route for sending chat messages
router.post('/send', authenticate, chatController.sendChat);

module.exports = router;
