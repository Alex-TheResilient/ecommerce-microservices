const express = require('express');
const router = express.Router();

const {
  sendNotification,
  getUserNotificationsController,
  markAsRead,
  deleteNotificationController,
  getNotificationStats,
} = require('../controllers/notificationController');

const { getQueueStats, retryFailedJobs } = require('../services/queueService');
const { logger } = require('../utils/logger');

// Send notification (generic endpoint)
router.post('/send', sendNotification);

// Get user notifications
router.get('/user/:userId', getUserNotificationsController);

// Get user notification stats
router.get('/user/:userId/stats', getNotificationStats);

// Mark notification as read
router.put('/:id/read', markAsRead);

// Delete notification
router.delete('/:id', deleteNotificationController);

// Admin endpoints for queue management
router.get('/admin/queue/stats', async (req, res, next) => {
  try {
    const stats = await getQueueStats();

    res.json({
      success: true,
      data: {
        queues: stats,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    next(error);
  }
});

// Retry failed jobs
router.post('/admin/queue/retry', async (req, res, next) => {
  try {
    const { queueType = 'all' } = req.body;

    const retriedCount = await retryFailedJobs(queueType);

    logger.info('Failed jobs retried', { queueType, retriedCount });

    res.json({
      success: true,
      message: `Retried ${retriedCount} failed jobs`,
      data: {
        retriedCount,
        queueType,
      },
    });
  } catch (error) {
    next(error);
  }
});

// Health check for notification service components
router.get('/health', async (req, res, next) => {
  try {
    const { getRedisClient } = require('../config/redis');
    const { getEmailServiceStatus } = require('../services/emailService');

    // Check Redis
    let redisStatus = 'UP';
    try {
      const client = getRedisClient();
      await client.ping();
    } catch (error) {
      redisStatus = 'DOWN';
    }

    // Check Email Service
    const emailStatus = await getEmailServiceStatus();

    // Check Queues
    const queueStats = await getQueueStats();

    const isHealthy =
      redisStatus === 'UP' &&
      emailStatus.status !== 'error' &&
      queueStats.email !== null;

    res.status(isHealthy ? 200 : 503).json({
      success: isHealthy,
      service: 'notification-service',
      components: {
        redis: redisStatus,
        email: emailStatus,
        queues: queueStats,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
