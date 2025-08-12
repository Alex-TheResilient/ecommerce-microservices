const axios = require('axios');
const { logger } = require('../utils/logger');

const NOTIFICATION_SERVICE_URL =
  process.env.NOTIFICATION_SERVICE_URL || 'http://notification-service:3000';

/**
 * Send event to notification service
 */
const sendNotificationEvent = async (eventType, data) => {
  try {
    logger.info('Sending notification event', {
      eventType,
      notificationServiceUrl: NOTIFICATION_SERVICE_URL,
      dataKeys: Object.keys(data),
    });

    const response = await axios.post(
      `${NOTIFICATION_SERVICE_URL}/api/events`,
      {
        eventType,
        data,
      },
      {
        timeout: 5000,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Order-Service',
        },
      }
    );

    logger.info('Notification event sent successfully', {
      eventType,
      responseStatus: response.status,
      processedNotifications: response.data.data?.processedNotifications || 0,
    });

    return response.data;
  } catch (error) {
    logger.error('Failed to send notification event', {
      eventType,
      error: error.message,
      status: error.response?.status,
      responseData: error.response?.data,
    });

    // Don't throw error - notifications shouldn't break order flow
    return null;
  }
};

/**
 * Send order created event
 */
const notifyOrderCreated = async (order, user) => {
  return await sendNotificationEvent('order.created', {
    order: {
      id: order.id,
      total: order.total,
      items: order.items,
      status: order.status,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    },
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName || user.name || 'Usuario',
    },
  });
};

/**
 * Send order confirmed event
 */
const notifyOrderConfirmed = async (order, user) => {
  return await sendNotificationEvent('order.confirmed', {
    order: {
      id: order.id,
      total: order.total,
      status: order.status,
      updatedAt: order.updatedAt,
    },
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName || user.name || 'Usuario',
    },
  });
};

/**
 * Send order shipped event
 */
const notifyOrderShipped = async (order, user, trackingNumber) => {
  return await sendNotificationEvent('order.shipped', {
    order: {
      id: order.id,
      total: order.total,
      status: order.status,
      updatedAt: order.updatedAt,
    },
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName || user.name || 'Usuario',
    },
    trackingNumber:
      trackingNumber || `TRACK-${order.id.slice(0, 8).toUpperCase()}`,
  });
};

/**
 * Send order cancelled event
 */
const notifyOrderCancelled = async (order, user, reason) => {
  return await sendNotificationEvent('order.cancelled', {
    order: {
      id: order.id,
      total: order.total,
      status: order.status,
      updatedAt: order.updatedAt,
    },
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName || user.name || 'Usuario',
    },
    reason: reason || 'No especificada',
  });
};

/**
 * Test notification service connectivity
 */
const testNotificationService = async () => {
  try {
    const response = await axios.get(`${NOTIFICATION_SERVICE_URL}/health`, {
      timeout: 3000,
    });

    return {
      status: 'UP',
      response: response.data,
    };
  } catch (error) {
    return {
      status: 'DOWN',
      error: error.message,
    };
  }
};

module.exports = {
  sendNotificationEvent,
  notifyOrderCreated,
  notifyOrderConfirmed,
  notifyOrderShipped,
  notifyOrderCancelled,
  testNotificationService,
};
