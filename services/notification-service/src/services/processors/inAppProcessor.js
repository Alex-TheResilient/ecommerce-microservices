const { v4: uuidv4 } = require('uuid');
const { logger } = require('../../utils/logger');
const { storeInAppNotification } = require('../../config/redis');
const { IN_APP_CATEGORIES } = require('../../utils/constants');

module.exports = async function processInAppNotificationJob(job) {
  try {
    const {
      userId,
      title,
      message,
      category = IN_APP_CATEGORIES.SYSTEM,
      priority = 'MEDIUM',
      data = {},
      actionUrl,
    } = job.data;

    logger.info('Processing in-app notification job', {
      jobId: job.id,
      userId: userId,
      title: title,
      category: category,
    });

    // Create notification object
    const notification = {
      id: uuidv4(),
      userId,
      title,
      message,
      category,
      priority,
      data,
      actionUrl,
      status: 'unread',
      createdAt: new Date().toISOString(),
      readAt: null,
    };

    // Store in Redis
    await storeInAppNotification(notification);

    logger.info('In-app notification job completed successfully', {
      jobId: job.id,
      notificationId: notification.id,
      userId: userId,
    });

    return {
      success: true,
      type: 'in-app-notification',
      notificationId: notification.id,
      userId: userId,
      sentAt: new Date().toISOString(),
    };
  } catch (error) {
    logger.error('In-app notification job failed', {
      jobId: job.id,
      error: error.message,
      userId: job.data.userId,
    });

    throw error;
  }
};
