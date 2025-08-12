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

/**
 * @swagger
 * /api/notifications/send:
 *   post:
 *     summary: Send a notification (Email or In-App)
 *     description: |
 *       Queue a notification for processing. Supports both email and in-app notifications with template rendering, priority levels, and delayed delivery.
 *
 *       **🚀 Key Features:**
 *       - Multi-channel notifications (EMAIL, IN_APP)
 *       - Priority-based queue processing
 *       - Template support with Handlebars
 *       - Delayed delivery scheduling
 *       - Redis-backed queue with Bull
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SendNotificationRequest'
 *           examples:
 *             emailNotification:
 *               summary: Email notification with template
 *               value:
 *                 type: "EMAIL"
 *                 recipient: "user@example.com"
 *                 title: "Welcome to our platform!"
 *                 template: "welcome"
 *                 templateData:
 *                   firstName: "John"
 *                   loginUrl: "https://app.example.com/login"
 *                 priority: "HIGH"
 *                 delay: 0
 *             inAppNotification:
 *               summary: In-app notification
 *               value:
 *                 type: "IN_APP"
 *                 recipient: "user123"
 *                 title: "Order confirmed!"
 *                 message: "Your order #123 has been confirmed and is being processed."
 *                 priority: "HIGH"
 *                 actionUrl: "/orders/123"
 *             delayedEmail:
 *               summary: Delayed email (5 seconds)
 *               value:
 *                 type: "EMAIL"
 *                 recipient: "user@example.com"
 *                 title: "Don't forget your cart!"
 *                 message: "You have items waiting in your cart."
 *                 priority: "MEDIUM"
 *                 delay: 5000
 *     responses:
 *       202:
 *         description: Notification queued successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Notification queued successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     jobId:
 *                       type: string
 *                       example: "job_123456"
 *                     type:
 *                       type: string
 *                       example: "EMAIL"
 *                     recipient:
 *                       type: string
 *                       example: "user@example.com"
 *                     priority:
 *                       type: string
 *                       example: "HIGH"
 *                     estimatedProcessingTime:
 *                       type: string
 *                       example: "immediate"
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: string
 *                   example: "Invalid notification type"
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.post('/send', sendNotification);

/**
 * @swagger
 * /api/notifications/user/{userId}:
 *   get:
 *     summary: Get user's in-app notifications
 *     description: |
 *       Retrieve paginated in-app notifications for a specific user with optional filtering.
 *
 *       **📱 Features:**
 *       - Paginated results with customizable limit
 *       - Unread-only filtering
 *       - Unread count tracking
 *       - Redis-based storage for real-time access
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID to get notifications for
 *         example: "user123"
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *           minimum: 1
 *           maximum: 100
 *         description: Maximum number of notifications to return
 *         example: 10
 *       - in: query
 *         name: unreadOnly
 *         schema:
 *           type: boolean
 *           default: false
 *         description: Filter to show only unread notifications
 *         example: true
 *     responses:
 *       200:
 *         description: Notifications retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     notifications:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/InAppNotification'
 *                     totalCount:
 *                       type: integer
 *                       example: 25
 *                     unreadCount:
 *                       type: integer
 *                       example: 5
 *                     hasMore:
 *                       type: boolean
 *                       example: true
 *             examples:
 *               notificationsList:
 *                 summary: User notifications response
 *                 value:
 *                   success: true
 *                   data:
 *                     notifications:
 *                       - id: "notif_123"
 *                         userId: "user123"
 *                         title: "Order Confirmed"
 *                         message: "Your order #456 has been confirmed"
 *                         category: "order"
 *                         priority: "HIGH"
 *                         status: "unread"
 *                         actionUrl: "/orders/456"
 *                         createdAt: "2024-03-20T10:30:00Z"
 *                         readAt: null
 *                     totalCount: 25
 *                     unreadCount: 5
 *                     hasMore: true
 *       400:
 *         description: Invalid user ID
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get('/user/:userId', getUserNotificationsController);

/**
 * @swagger
 * /api/notifications/user/{userId}/stats:
 *   get:
 *     summary: Get notification statistics for user
 *     description: |
 *       Get comprehensive statistics about a user's notifications including counts by category, priority, and read status.
 *
 *       **📊 Analytics Features:**
 *       - Total notification counts
 *       - Read/unread breakdown
 *       - Category-based statistics
 *       - Priority distribution
 *       - Real-time data from Redis
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID to get statistics for
 *         example: "user123"
 *     responses:
 *       200:
 *         description: Statistics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     stats:
 *                       type: object
 *                       properties:
 *                         total:
 *                           type: integer
 *                           example: 45
 *                         unread:
 *                           type: integer
 *                           example: 8
 *                         read:
 *                           type: integer
 *                           example: 37
 *                         byCategory:
 *                           type: object
 *                           properties:
 *                             order:
 *                               type: integer
 *                               example: 25
 *                             account:
 *                               type: integer
 *                               example: 5
 *                             system:
 *                               type: integer
 *                               example: 10
 *                             promotion:
 *                               type: integer
 *                               example: 5
 *                         byPriority:
 *                           type: object
 *                           properties:
 *                             LOW:
 *                               type: integer
 *                               example: 10
 *                             MEDIUM:
 *                               type: integer
 *                               example: 20
 *                             HIGH:
 *                               type: integer
 *                               example: 12
 *                             CRITICAL:
 *                               type: integer
 *                               example: 3
 *       400:
 *         description: Invalid user ID
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get('/user/:userId/stats', getNotificationStats);

/**
 * @swagger
 * /api/notifications/{id}/read:
 *   put:
 *     summary: Mark notification as read
 *     description: |
 *       Mark a specific in-app notification as read and update the read timestamp.
 *
 *       **✅ Features:**
 *       - Instant read status update
 *       - Automatic timestamp tracking
 *       - Redis-based real-time updates
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Notification ID to mark as read
 *         example: "notif_123"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *             properties:
 *               userId:
 *                 type: string
 *                 description: User ID who owns the notification
 *                 example: "user123"
 *           example:
 *             userId: "user123"
 *     responses:
 *       200:
 *         description: Notification marked as read
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Notification marked as read"
 *                 data:
 *                   type: object
 *                   properties:
 *                     notification:
 *                       $ref: '#/components/schemas/InAppNotification'
 *       400:
 *         description: Invalid notification ID or user ID
 *       404:
 *         description: Notification not found
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.put('/:id/read', markAsRead);

/**
 * @swagger
 * /api/notifications/{id}:
 *   delete:
 *     summary: Delete notification
 *     description: |
 *       Permanently delete a specific in-app notification from the user's notification list.
 *
 *       **🗑️ Features:**
 *       - Permanent deletion from Redis
 *       - User ownership validation
 *       - Instant removal from user's feed
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Notification ID to delete
 *         example: "notif_123"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *             properties:
 *               userId:
 *                 type: string
 *                 description: User ID who owns the notification
 *                 example: "user123"
 *           example:
 *             userId: "user123"
 *     responses:
 *       200:
 *         description: Notification deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Notification deleted successfully"
 *       400:
 *         description: Invalid notification ID or user ID
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
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
