// routes/userRoutes.js
const express = require('express');
const router = express.Router();

const userController = require('../controllers/userController');
const { authenticate } = require('../middleware/auth');

// User signup
router.post('/signup', userController.signup);

// User login
router.post('/login', userController.login);

// Search users
router.get('/search', authenticate, userController.search);

module.exports = router;
