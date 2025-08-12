const { logger } = require('../utils/logger');
const { addEmailJob, addInAppJob } = require('../services/queueService');
const {
  getUserNotifications,
  markNotificationAsRead,
  deleteNotification,
  getUnreadCount,
} = require('../config/redis');
const {
  ValidationError,
  NotFoundError,
} = require('../middleware/errorHandler');
const { NOTIFICATION_TYPES, PRIORITY_LEVELS } = require('../utils/constants');

// Send notification (generic endpoint)
const sendNotification = async (req, res, next) => {
  try {
    const {
      type,
      recipient, // email or userId
      title,
      message,
      priority = 'MEDIUM',
      template,
      templateData,
      delay = 0,
    } = req.body;

    // Validation
    if (!type || !Object.values(NOTIFICATION_TYPES).includes(type)) {
      throw new ValidationError('Invalid notification type');
    }

    if (!recipient) {
      throw new ValidationError('Recipient is required');
    }

    if (!priority || !Object.values(PRIORITY_LEVELS).includes(priority)) {
      throw new ValidationError('Invalid priority level');
    }

    let job;
    let jobData;

    if (type === NOTIFICATION_TYPES.EMAIL) {
      // Email notification
      if (!title && !template) {
        throw new ValidationError(
          'Email subject (title) or template is required'
        );
      }

      jobData = {
        to: recipient,
        subject: title,
        message,
        template,
        templateData,
      };

      if (template) {
        job = await addEmailJob('send-email', jobData, {
          priority: getPriorityValue(priority),
          delay,
        });
      } else {
        job = await addEmailJob(
          'send-email',
          {
            ...jobData,
            html: message,
          },
          {
            priority: getPriorityValue(priority),
            delay,
          }
        );
      }
    } else if (type === NOTIFICATION_TYPES.IN_APP) {
      // In-app notification
      if (!title || !message) {
        throw new ValidationError(
          'Title and message are required for in-app notifications'
        );
      }

      jobData = {
        userId: recipient,
        title,
        message,
        priority,
        data: templateData || {},
        actionUrl: req.body.actionUrl,
      };

      job = await addInAppJob(jobData, {
        priority: getPriorityValue(priority),
        delay,
      });
    }

    logger.info('Notification queued successfully', {
      type,
      recipient,
      jobId: job.id,
      priority,
    });

    res.status(202).json({
      success: true,
      message: 'Notification queued successfully',
      data: {
        jobId: job.id,
        type,
        recipient,
        priority,
        estimatedProcessingTime: delay > 0 ? `${delay}ms` : 'immediate',
      },
    });
  } catch (error) {
    next(error);
  }
};

// Get user notifications (in-app only)
const getUserNotificationsController = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { limit = 20, unreadOnly = false } = req.query;

    if (!userId) {
      throw new ValidationError('User ID is required');
    }

    const notifications = await getUserNotifications(userId, parseInt(limit));

    // Filter unread if requested
    const filteredNotifications =
      unreadOnly === 'true'
        ? notifications.filter((n) => n.status === 'unread')
        : notifications;

    const unreadCount = await getUnreadCount(userId);

    logger.info('User notifications retrieved', {
      userId,
      totalCount: notifications.length,
      unreadCount,
      returnedCount: filteredNotifications.length,
    });

    res.json({
      success: true,
      data: {
        notifications: filteredNotifications,
        totalCount: notifications.length,
        unreadCount,
        hasMore: notifications.length >= parseInt(limit),
      },
    });
  } catch (error) {
    next(error);
  }
};

// Mark notification as read
const markAsRead = async (req, res, next) => {
  try {
    const { id: notificationId } = req.params;
    const { userId } = req.body;

    if (!notificationId || !userId) {
      throw new ValidationError('Notification ID and User ID are required');
    }

    const notification = await markNotificationAsRead(userId, notificationId);

    logger.info('Notification marked as read', {
      notificationId,
      userId,
    });

    res.json({
      success: true,
      message: 'Notification marked as read',
      data: { notification },
    });
  } catch (error) {
    if (error.message === 'Notification not found') {
      next(new NotFoundError('Notification not found'));
    } else {
      next(error);
    }
  }
};

// Delete notification
const deleteNotificationController = async (req, res, next) => {
  try {
    const { id: notificationId } = req.params;
    const { userId } = req.body;

    if (!notificationId || !userId) {
      throw new ValidationError('Notification ID and User ID are required');
    }

    await deleteNotification(userId, notificationId);

    logger.info('Notification deleted', {
      notificationId,
      userId,
    });

    res.json({
      success: true,
      message: 'Notification deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

// Get notification statistics
const getNotificationStats = async (req, res, next) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      throw new ValidationError('User ID is required');
    }

    const notifications = await getUserNotifications(userId, 1000); // Get many for stats
    const unreadCount = await getUnreadCount(userId);

    const stats = {
      total: notifications.length,
      unread: unreadCount,
      read: notifications.length - unreadCount,
      byCategory: {},
      byPriority: {},
    };

    // Calculate stats by category and priority
    notifications.forEach((notification) => {
      // By category
      const category = notification.category || 'unknown';
      stats.byCategory[category] = (stats.byCategory[category] || 0) + 1;

      // By priority
      const priority = notification.priority || 'MEDIUM';
      stats.byPriority[priority] = (stats.byPriority[priority] || 0) + 1;
    });

    logger.info('Notification stats retrieved', {
      userId,
      totalNotifications: stats.total,
    });

    res.json({
      success: true,
      data: { stats },
    });
  } catch (error) {
    next(error);
  }
};

// Helper function to convert priority to numeric value for queue
const getPriorityValue = (priority) => {
  const priorities = {
    LOW: 1,
    MEDIUM: 5,
    HIGH: 10,
    CRITICAL: 20,
  };
  return priorities[priority] || 5;
};

module.exports = {
  sendNotification,
  getUserNotificationsController,
  markAsRead,
  deleteNotificationController,
  getNotificationStats,
};
