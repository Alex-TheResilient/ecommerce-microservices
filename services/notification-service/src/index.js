require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const { logger } = require('./utils/logger');
const { errorHandler } = require('./middleware/errorHandler');

// Routes
const notificationRoutes = require('./routes/notifications');
const emailRoutes = require('./routes/emails');
const eventRoutes = require('./routes/events');

// Services
const { initializeQueues } = require('./services/queueService');
const { initializeRedis } = require('./config/redis');
const { initializeEmailService } = require('./services/emailService');

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet());
app.use(
  cors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || [
      'http://localhost:3000',
    ],
    credentials: true,
  })
);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Global rate limiting
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later',
  },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api', globalLimiter);

// Request logging middleware
app.use((req, res, next) => {
  logger.info('Incoming request', {
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    timestamp: new Date().toISOString(),
  });

  // Add response time tracking
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info(`${req.method} ${req.url} - ${res.statusCode}`, {
      duration: `${duration}ms`,
      status: res.statusCode,
      timestamp: new Date().toISOString(),
    });
  });

  next();
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    service: 'notification-service',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
  });
});

// Detailed health check
app.get('/health/detailed', async (req, res) => {
  try {
    // Check Redis connection
    const redis = require('./config/redis');
    const redisStatus = await redis.ping();

    // Check queues status
    const queueService = require('./services/queueService');
    const queueStats = await queueService.getQueueStats();

    res.json({
      status: 'OK',
      service: 'notification-service',
      checks: {
        redis: redisStatus === 'PONG' ? 'UP' : 'DOWN',
        queues: queueStats,
        smtp: 'CONFIGURED', // We'll enhance this later
      },
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  } catch (error) {
    logger.error('Health check failed:', error);
    res.status(503).json({
      status: 'ERROR',
      service: 'notification-service',
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

// API Routes
app.use('/api/notifications', notificationRoutes);
app.use('/api/emails', emailRoutes);
app.use('/api/events', eventRoutes);

// Service info endpoint
app.get('/api/info', (req, res) => {
  res.json({
    success: true,
    service: 'notification-service',
    version: process.env.npm_package_version || '1.0.0',
    description: 'Microservice for handling notifications (email, SMS, push)',
    capabilities: [
      'Email notifications',
      'In-app notifications',
      'Event-driven processing',
      'Template-based messages',
      'Queue-based processing',
      'Rate limiting',
      'Retry logic',
    ],
    endpoints: {
      notifications: {
        'POST /api/notifications/send': 'Send notification',
        'GET /api/notifications/user/:userId': 'Get user notifications',
        'GET /api/notifications/:id': 'Get notification by ID',
        'PUT /api/notifications/:id/read': 'Mark as read',
      },
      emails: {
        'POST /api/emails/send': 'Send email',
        'GET /api/emails/templates': 'Get available templates',
        'POST /api/emails/welcome': 'Send welcome email',
        'POST /api/emails/order-confirmation': 'Send order confirmation',
      },
      'in-app': {
        'GET /api/notifications/user/:userId': 'Get user in-app notifications',
        'PUT /api/notifications/:id/read': 'Mark notification as read',
        'DELETE /api/notifications/:id': 'Delete notification',
      },
      events: {
        'POST /api/events': 'Process event',
        'GET /api/events/types': 'Get supported event types',
      },
    },
    timestamp: new Date().toISOString(),
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
    path: req.originalUrl,
    service: 'notification-service',
    availableEndpoints: [
      'GET /health',
      'GET /health/detailed',
      'GET /api/info',
      'POST /api/notifications/send',
      'GET /api/notifications/user/:userId',
      'POST /api/emails/send',
      'POST /api/events',
    ],
    timestamp: new Date().toISOString(),
  });
});

// Error handling middleware
app.use(errorHandler);

// Initialize services and start server
async function startServer() {
  try {
    // Initialize Redis
    logger.info('Connecting to Redis...');
    await initializeRedis();
    logger.info('✅ Redis connected successfully');

    // Initialize Email Service
    logger.info('Initializing email service...');
    await initializeEmailService();
    logger.info('✅ Email service initialized successfully');

    // Initialize queues
    logger.info('Initializing job queues...');
    await initializeQueues();
    logger.info('✅ Job queues initialized successfully');

    // Start server
    app.listen(PORT, () => {
      console.log(`🔔 Notification Service running on port ${PORT}`);
      console.log(`🏥 Health Check: http://localhost:${PORT}/health`);
      console.log(`📊 Service Info: http://localhost:${PORT}/api/info`);
      logger.info(`Notification Service started on port ${PORT}`, {
        environment: process.env.NODE_ENV || 'development',
        port: PORT,
      });
    });
  } catch (error) {
    logger.error('Failed to start Notification Service:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully...');

  // Close queues
  const queueService = require('./services/queueService');
  await queueService.closeQueues();

  // Close Redis connection
  const redis = require('./config/redis');
  await redis.disconnect();

  logger.info('Server shut down complete');
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully...');

  // Close queues
  const queueService = require('./services/queueService');
  await queueService.closeQueues();

  // Close Redis connection
  const redis = require('./config/redis');
  await redis.disconnect();

  logger.info('Server shut down complete');
  process.exit(0);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  logger.error('Unhandled Promise Rejection:', err);
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception:', err);
  process.exit(1);
});

// Start the server
startServer();
