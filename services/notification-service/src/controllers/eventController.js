const { logger } = require('../utils/logger');
const { addEmailJob, addInAppJob } = require('../services/queueService');
const { ValidationError } = require('../middleware/errorHandler');
const { EVENT_TYPES, IN_APP_CATEGORIES } = require('../utils/constants');

// Process incoming events from other services
const processEvent = async (req, res, next) => {
  try {
    const { eventType, data } = req.body;

    if (!eventType || !Object.values(EVENT_TYPES).includes(eventType)) {
      throw new ValidationError('Invalid or missing event type');
    }

    if (!data) {
      throw new ValidationError('Event data is required');
    }

    logger.info('Processing event', {
      eventType,
      dataKeys: Object.keys(data),
    });

    let processedEvents = [];

    // Route event to appropriate handlers
    switch (eventType) {
      case EVENT_TYPES.USER_REGISTERED:
        processedEvents = await handleUserRegistered(data);
        break;

      case EVENT_TYPES.ORDER_CREATED:
        processedEvents = await handleOrderCreated(data);
        break;

      case EVENT_TYPES.ORDER_CONFIRMED:
        processedEvents = await handleOrderConfirmed(data);
        break;

      case EVENT_TYPES.ORDER_SHIPPED:
        processedEvents = await handleOrderShipped(data);
        break;

      case EVENT_TYPES.ORDER_DELIVERED:
        processedEvents = await handleOrderDelivered(data);
        break;

      case EVENT_TYPES.ORDER_CANCELLED:
        processedEvents = await handleOrderCancelled(data);
        break;

      case EVENT_TYPES.PRODUCT_LOW_STOCK:
        processedEvents = await handleProductLowStock(data);
        break;

      case EVENT_TYPES.ADMIN_ACTION:
        processedEvents = await handleAdminAction(data);
        break;

      default:
        logger.warn('Unhandled event type', { eventType });
        throw new ValidationError(`Unhandled event type: ${eventType}`);
    }

    logger.info('Event processed successfully', {
      eventType,
      processedCount: processedEvents.length,
    });

    res.status(202).json({
      success: true,
      message: 'Event processed successfully',
      data: {
        eventType,
        processedNotifications: processedEvents.length,
        jobs: processedEvents,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Event handlers
const handleUserRegistered = async (data) => {
  const { user } = data;
  const jobs = [];

  // Send welcome email
  if (user.email && user.firstName) {
    const emailJob = await addEmailJob(
      'welcome-email',
      {
        to: user.email,
        firstName: user.firstName,
        loginUrl: `${process.env.FRONTEND_URL}/login`,
      },
      { priority: 10 }
    );

    jobs.push({ type: 'email', jobId: emailJob.id, action: 'welcome-email' });
  }

  // Send in-app notification
  const inAppJob = await addInAppJob({
    userId: user.id,
    title: '¡Bienvenido!',
    message: `Hola ${user.firstName}, tu cuenta ha sido creada exitosamente.`,
    category: IN_APP_CATEGORIES.ACCOUNT,
    priority: 'MEDIUM',
    actionUrl: '/profile',
  });

  jobs.push({
    type: 'in-app',
    jobId: inAppJob.id,
    action: 'welcome-notification',
  });

  return jobs;
};

const handleOrderCreated = async (data) => {
  const { order, user } = data;
  const jobs = [];

  // Send order confirmation email
  if (user.email && user.firstName) {
    const emailJob = await addEmailJob(
      'order-confirmation',
      {
        to: user.email,
        firstName: user.firstName,
        order,
      },
      { priority: 15 }
    );

    jobs.push({
      type: 'email',
      jobId: emailJob.id,
      action: 'order-confirmation',
    });
  }

  // Send in-app notification
  const inAppJob = await addInAppJob({
    userId: user.id,
    title: 'Pedido confirmado',
    message: `Tu pedido #${order.id} por $${order.total} ha sido confirmado.`,
    category: IN_APP_CATEGORIES.ORDER,
    priority: 'HIGH',
    data: { orderId: order.id, total: order.total },
    actionUrl: `/orders/${order.id}`,
  });

  jobs.push({
    type: 'in-app',
    jobId: inAppJob.id,
    action: 'order-created-notification',
  });

  return jobs;
};

const handleOrderConfirmed = async (data) => {
  const { order, user } = data;
  const jobs = [];

  // Send in-app notification
  const inAppJob = await addInAppJob({
    userId: user.id,
    title: 'Pedido en preparación',
    message: `Tu pedido #${order.id} está siendo preparado para envío.`,
    category: IN_APP_CATEGORIES.ORDER,
    priority: 'MEDIUM',
    data: { orderId: order.id, status: order.status },
    actionUrl: `/orders/${order.id}`,
  });

  jobs.push({
    type: 'in-app',
    jobId: inAppJob.id,
    action: 'order-confirmed-notification',
  });

  return jobs;
};

const handleOrderShipped = async (data) => {
  const { order, user, trackingNumber } = data;
  const jobs = [];

  // Send shipped email
  if (user.email && user.firstName) {
    const emailJob = await addEmailJob(
      'send-email',
      {
        to: user.email,
        template: 'order-shipped',
        templateData: {
          firstName: user.firstName,
          orderId: order.id,
          trackingNumber,
          trackingUrl: `${process.env.FRONTEND_URL}/orders/${order.id}/tracking`,
          estimatedDelivery: '3-5 días hábiles',
        },
      },
      { priority: 15 }
    );

    jobs.push({
      type: 'email',
      jobId: emailJob.id,
      action: 'order-shipped-email',
    });
  }

  // Send in-app notification
  const inAppJob = await addInAppJob({
    userId: user.id,
    title: '¡Pedido enviado! 📦',
    message: `Tu pedido #${order.id} ha sido enviado. Número de seguimiento: ${trackingNumber}`,
    category: IN_APP_CATEGORIES.ORDER,
    priority: 'HIGH',
    data: { orderId: order.id, trackingNumber, status: 'shipped' },
    actionUrl: `/orders/${order.id}/tracking`,
  });

  jobs.push({
    type: 'in-app',
    jobId: inAppJob.id,
    action: 'order-shipped-notification',
  });

  return jobs;
};

const handleOrderDelivered = async (data) => {
  const { order, user } = data;
  const jobs = [];

  // Send in-app notification
  const inAppJob = await addInAppJob({
    userId: user.id,
    title: '¡Pedido entregado! ✅',
    message: `Tu pedido #${order.id} ha sido entregado exitosamente.`,
    category: IN_APP_CATEGORIES.ORDER,
    priority: 'HIGH',
    data: { orderId: order.id, status: 'delivered' },
    actionUrl: `/orders/${order.id}/review`,
  });

  jobs.push({
    type: 'in-app',
    jobId: inAppJob.id,
    action: 'order-delivered-notification',
  });

  return jobs;
};

const handleOrderCancelled = async (data) => {
  const { order, user, reason } = data;
  const jobs = [];

  // Send in-app notification
  const inAppJob = await addInAppJob({
    userId: user.id,
    title: 'Pedido cancelado',
    message: `Tu pedido #${order.id} ha sido cancelado. ${
      reason ? `Razón: ${reason}` : ''
    }`,
    category: IN_APP_CATEGORIES.ORDER,
    priority: 'MEDIUM',
    data: { orderId: order.id, reason, status: 'cancelled' },
    actionUrl: `/orders/${order.id}`,
  });

  jobs.push({
    type: 'in-app',
    jobId: inAppJob.id,
    action: 'order-cancelled-notification',
  });

  return jobs;
};

const handleProductLowStock = async (data) => {
  const { product, currentStock, threshold } = data;
  const jobs = [];

  // Send admin alert email
  const emailJob = await addEmailJob(
    'send-email',
    {
      to: process.env.ADMIN_EMAIL || process.env.SMTP_USER,
      template: 'admin-alert',
      templateData: {
        alertType: 'Stock bajo',
        message: `El producto "${product.name}" tiene stock bajo`,
        data: {
          productId: product.id,
          productName: product.name,
          currentStock,
          threshold,
        },
        timestamp: new Date().toISOString(),
        dashboardUrl: `${process.env.FRONTEND_URL}/admin/inventory`,
      },
    },
    { priority: 10 }
  );

  jobs.push({ type: 'email', jobId: emailJob.id, action: 'low-stock-alert' });

  return jobs;
};

const handleAdminAction = async (data) => {
  const { action, adminUser, details } = data;
  const jobs = [];

  // Send admin alert email
  if (process.env.ADMIN_EMAIL) {
    const emailJob = await addEmailJob(
      'send-email',
      {
        to: process.env.ADMIN_EMAIL,
        template: 'admin-alert',
        templateData: {
          alertType: 'Acción de administrador',
          message: `${adminUser.email} realizó: ${action}`,
          data: details,
          timestamp: new Date().toISOString(),
          dashboardUrl: `${process.env.FRONTEND_URL}/admin/logs`,
        },
      },
      { priority: 5 }
    );

    jobs.push({
      type: 'email',
      jobId: emailJob.id,
      action: 'admin-action-alert',
    });
  }

  return jobs;
};

// Get supported event types
const getSupportedEventTypes = async (req, res, next) => {
  try {
    const eventTypes = Object.values(EVENT_TYPES).map((eventType) => ({
      type: eventType,
      description: getEventTypeDescription(eventType),
      requiredFields: getEventRequiredFields(eventType),
    }));

    res.json({
      success: true,
      data: {
        eventTypes,
        count: eventTypes.length,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Helper functions
const getEventTypeDescription = (eventType) => {
  const descriptions = {
    [EVENT_TYPES.USER_REGISTERED]: 'New user registration',
    [EVENT_TYPES.ORDER_CREATED]: 'New order created',
    [EVENT_TYPES.ORDER_CONFIRMED]: 'Order confirmed by admin',
    [EVENT_TYPES.ORDER_SHIPPED]: 'Order shipped',
    [EVENT_TYPES.ORDER_DELIVERED]: 'Order delivered',
    [EVENT_TYPES.ORDER_CANCELLED]: 'Order cancelled',
    [EVENT_TYPES.PRODUCT_LOW_STOCK]: 'Product stock is low',
    [EVENT_TYPES.ADMIN_ACTION]: 'Admin performed an action',
  };
  return descriptions[eventType] || 'System event';
};

const getEventRequiredFields = (eventType) => {
  const requiredFields = {
    [EVENT_TYPES.USER_REGISTERED]: ['user.id', 'user.email', 'user.firstName'],
    [EVENT_TYPES.ORDER_CREATED]: [
      'order.id',
      'order.total',
      'order.items',
      'user.id',
      'user.email',
    ],
    [EVENT_TYPES.ORDER_CONFIRMED]: ['order.id', 'user.id'],
    [EVENT_TYPES.ORDER_SHIPPED]: ['order.id', 'user.id', 'trackingNumber'],
    [EVENT_TYPES.ORDER_DELIVERED]: ['order.id', 'user.id'],
    [EVENT_TYPES.ORDER_CANCELLED]: ['order.id', 'user.id', 'reason?'],
    [EVENT_TYPES.PRODUCT_LOW_STOCK]: [
      'product.id',
      'product.name',
      'currentStock',
      'threshold',
    ],
    [EVENT_TYPES.ADMIN_ACTION]: ['action', 'adminUser.email', 'details?'],
  };
  return requiredFields[eventType] || [];
};

module.exports = {
  processEvent,
  getSupportedEventTypes,
};
