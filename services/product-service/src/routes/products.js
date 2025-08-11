const express = require('express');
const rateLimit = require('express-rate-limit');
const {
  getAllProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
} = require('../controllers/productController');

const router = express.Router();

// Rate limiting
const productsLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    success: false,
    message: 'Too many requests, please try again later',
  },
});

// Apply rate limiting to all routes
router.use(productsLimiter);

// Public routes
router.get('/', getAllProducts);
router.get('/:id', getProductById);

// Admin routes
router.post('/', createProduct);
router.put('/:id', updateProduct);
router.delete('/:id', deleteProduct);

module.exports = router;
