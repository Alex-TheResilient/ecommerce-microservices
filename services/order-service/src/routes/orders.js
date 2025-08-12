const express = require('express');
const rateLimit = require('express-rate-limit');
const {
  getUserOrders,
  getOrderById,
  createOrder,
  updateOrderStatus,
  getAllOrders,
} = require('../controllers/orderController');

const router = express.Router();

// Rate limiting
const ordersLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // limit each IP to 50 requests per windowMs
  message: {
    success: false,
    message: 'Too many requests, please try again later',
  },
});

router.use(ordersLimiter);

// User routes
router.get('/my-orders', getUserOrders);
router.get('/:id', getOrderById);
router.post('/', createOrder);

// Admin routes
router.get('/', getAllOrders);
router.put('/:id/status', updateOrderStatus);

module.exports = router;
