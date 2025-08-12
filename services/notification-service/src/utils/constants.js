// Notification Types
const NOTIFICATION_TYPES = {
  EMAIL: 'EMAIL',
  IN_APP: 'IN_APP',
};

// Email Templates
const EMAIL_TEMPLATES = {
  WELCOME: 'welcome',
  ORDER_CONFIRMATION: 'order-confirmation',
  ORDER_SHIPPED: 'order-shipped',
  ORDER_DELIVERED: 'order-delivered',
  PASSWORD_RESET: 'password-reset',
  ADMIN_ALERT: 'admin-alert',
};

// Event Types
const EVENT_TYPES = {
  USER_REGISTERED: 'user.registered',
  ORDER_CREATED: 'order.created',
  ORDER_CONFIRMED: 'order.confirmed',
  ORDER_SHIPPED: 'order.shipped',
  ORDER_DELIVERED: 'order.delivered',
  ORDER_CANCELLED: 'order.cancelled',
  PRODUCT_LOW_STOCK: 'product.low_stock',
  ADMIN_ACTION: 'admin.action',
};

// Notification Status
const NOTIFICATION_STATUS = {
  PENDING: 'PENDING',
  PROCESSING: 'PROCESSING',
  SENT: 'SENT',
  DELIVERED: 'DELIVERED',
  FAILED: 'FAILED',
  RETRYING: 'RETRYING',
  READ: 'READ',
  UNREAD: 'UNREAD',
};

// Priority Levels
const PRIORITY_LEVELS = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  CRITICAL: 'CRITICAL',
};

// Queue Names
const QUEUE_NAMES = {
  EMAIL_QUEUE: 'email-notifications',
  IN_APP_QUEUE: 'in-app-notifications',
};

// Rate Limit Settings
const RATE_LIMITS = {
  EMAIL_PER_HOUR: 10,
  IN_APP_PER_HOUR: 100,
};

// Retry Settings
const RETRY_SETTINGS = {
  EMAIL: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000, // 5 seconds initial delay
    },
  },
  IN_APP: {
    attempts: 2,
    backoff: {
      type: 'fixed',
      delay: 2000, // 2 seconds
    },
  },
};

// In-App Notification Categories
const IN_APP_CATEGORIES = {
  ORDER: 'order',
  ACCOUNT: 'account',
  SYSTEM: 'system',
  PROMOTION: 'promotion',
};

module.exports = {
  NOTIFICATION_TYPES,
  EMAIL_TEMPLATES,
  EVENT_TYPES,
  NOTIFICATION_STATUS,
  PRIORITY_LEVELS,
  QUEUE_NAMES,
  RATE_LIMITS,
  RETRY_SETTINGS,
  IN_APP_CATEGORIES,
};
