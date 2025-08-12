const redis = require('redis');
const { logger } = require('../utils/logger');

let client = null;

const initializeRedis = async () => {
  try {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

    client = redis.createClient({
      url: redisUrl,
      retry_strategy: (options) => {
        if (options.error && options.error.code === 'ECONNREFUSED') {
          logger.error('Redis server refused connection');
          return new Error('Redis server refused connection');
        }
        if (options.times_connected > 10) {
          logger.error('Redis connection retry limit reached');
          return new Error('Retry limit reached');
        }
        // Reconnect after
        return Math.min(options.attempt * 100, 3000);
      },
    });

    client.on('error', (err) => {
      logger.error('Redis client error:', err);
    });

    client.on('connect', () => {
      logger.info('Connected to Redis server');
    });

    client.on('ready', () => {
      logger.info('Redis client ready to use');
    });

    client.on('reconnecting', () => {
      logger.warn('Redis client reconnecting...');
    });

    await client.connect();

    // Test connection
    await client.ping();
    logger.info('✅ Redis connection established successfully');

    return client;
  } catch (error) {
    logger.error('Failed to connect to Redis:', error);
    throw error;
  }
};

const getRedisClient = () => {
  if (!client) {
    throw new Error(
      'Redis client not initialized. Call initializeRedis() first.'
    );
  }
  return client;
};

// In-App notifications storage helpers
const storeInAppNotification = async (notification) => {
  try {
    const client = getRedisClient();
    const key = `notification:${notification.userId}:${notification.id}`;

    await client.setEx(key, 86400 * 7, JSON.stringify(notification)); // 7 days TTL

    // Add to user's notification list
    const listKey = `notifications:${notification.userId}`;
    await client.lPush(listKey, notification.id);
    await client.expire(listKey, 86400 * 7); // 7 days TTL

    logger.info('In-app notification stored', {
      notificationId: notification.id,
      userId: notification.userId,
    });
  } catch (error) {
    logger.error('Error storing in-app notification:', error);
    throw error;
  }
};

const getUserNotifications = async (userId, limit = 50) => {
  try {
    const client = getRedisClient();
    const listKey = `notifications:${userId}`;

    // Get notification IDs
    const notificationIds = await client.lRange(listKey, 0, limit - 1);

    if (notificationIds.length === 0) {
      return [];
    }

    // Get notification details
    const notifications = [];
    for (const id of notificationIds) {
      const key = `notification:${userId}:${id}`;
      const data = await client.get(key);
      if (data) {
        notifications.push(JSON.parse(data));
      }
    }

    // Sort by createdAt desc
    notifications.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    return notifications;
  } catch (error) {
    logger.error('Error getting user notifications:', error);
    throw error;
  }
};

const markNotificationAsRead = async (userId, notificationId) => {
  try {
    const client = getRedisClient();
    const key = `notification:${userId}:${notificationId}`;

    const data = await client.get(key);
    if (!data) {
      throw new Error('Notification not found');
    }

    const notification = JSON.parse(data);
    notification.status = 'READ';
    notification.readAt = new Date().toISOString();

    await client.setEx(key, 86400 * 7, JSON.stringify(notification));

    logger.info('Notification marked as read', {
      notificationId,
      userId,
    });

    return notification;
  } catch (error) {
    logger.error('Error marking notification as read:', error);
    throw error;
  }
};

const deleteNotification = async (userId, notificationId) => {
  try {
    const client = getRedisClient();
    const key = `notification:${userId}:${notificationId}`;
    const listKey = `notifications:${userId}`;

    // Remove from storage
    await client.del(key);

    // Remove from user's list
    await client.lRem(listKey, 0, notificationId);

    logger.info('Notification deleted', {
      notificationId,
      userId,
    });
  } catch (error) {
    logger.error('Error deleting notification:', error);
    throw error;
  }
};

const getUnreadCount = async (userId) => {
  try {
    const notifications = await getUserNotifications(userId);
    const unreadCount = notifications.filter(
      (n) => n.status === 'unread'
    ).length;

    return unreadCount;
  } catch (error) {
    logger.error('Error getting unread count:', error);
    throw error;
  }
};

module.exports = {
  initializeRedis,
  getRedisClient,
  storeInAppNotification,
  getUserNotifications,
  markNotificationAsRead,
  deleteNotification,
  getUnreadCount,
};
