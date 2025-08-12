const axios = require('axios');
const { logger } = require('../utils/logger');

const NOTIFICATION_SERVICE_URL =
  process.env.NOTIFICATION_SERVICE_URL || 'http://notification-service:3000';

/**
 * Send user registration event to notification service
 */
const notifyUserRegistered = async (user) => {
  try {
    logger.info('Sending user registered notification', {
      userId: user.id,
      userEmail: user.email,
    });

    const response = await axios.post(
      `${NOTIFICATION_SERVICE_URL}/api/events`,
      {
        eventType: 'user.registered',
        data: {
          user: {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            createdAt: user.createdAt,
          },
        },
      },
      {
        timeout: 5000,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Auth-Service',
        },
      }
    );

    logger.info('User registration notification sent successfully', {
      userId: user.id,
      responseStatus: response.status,
      processedNotifications: response.data.data?.processedNotifications || 0,
    });

    return response.data;
  } catch (error) {
    logger.error('Failed to send user registration notification', {
      userId: user.id,
      error: error.message,
      status: error.response?.status,
    });

    // Don't throw error - notifications shouldn't break registration flow
    return null;
  }
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
  notifyUserRegistered,
  testNotificationService,
};
