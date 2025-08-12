const express = require('express');
const rateLimit = require('express-rate-limit');
const {
  register,
  login,
  getProfile,
  makeAdmin,
  testNotifications,
} = require('../controllers/authController');

const { authenticate } = require('../middleware/auth');

const router = express.Router();

// Rate limiting
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 requests per windowMs
  message: {
    success: false,
    message: 'Too many authentication attempts, please try again later',
  },
});

// Routes
router.post('/register', authLimiter, register);
router.post('/login', authLimiter, login);
router.get('/profile', authenticate, getProfile);
router.post('/make-admin', makeAdmin);
router.get('/test-notifications', testNotifications);

module.exports = router;
