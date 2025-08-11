require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const productRoutes = require('./routes/products');
const { errorHandler } = require('./middleware/errorHandler');
const { logger } = require('./utils/logger');

const app = express();
const PORT = process.env.PORT || 3000;

// Debug middleware
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Static files for product images
app.use('/uploads', express.static('uploads'));

// Routes
app.use('/api/products', productRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    service: 'product-service',
    timestamp: new Date().toISOString(),
  });
});

// Error handling
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`🛍️ Product Service running on port ${PORT}`);
  logger.info(`Product Service running on port ${PORT}`);
});
