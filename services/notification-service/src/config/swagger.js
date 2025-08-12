const swaggerJSDoc = require('swagger-jsdoc');

const swaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'Notification Service API',
    version: '1.0.0',
    description:
      'Event-driven notification microservice with email and in-app notifications',
    contact: {
      name: 'API Support',
      email: 'support@example.com',
    },
  },
  servers: [
    {
      url: 'http://localhost:3004',
      description: 'Development server (direct)',
    },
    {
      url: 'http://localhost:3000/api/notifications',
      description: 'Development server (via API Gateway)',
    },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
    },
    schemas: {
      SendNotificationRequest: {
        type: 'object',
        required: ['type', 'recipient', 'title', 'message'],
        properties: {
          type: {
            type: 'string',
            enum: ['EMAIL', 'IN_APP'],
            example: 'IN_APP',
          },
          recipient: {
            type: 'string',
            description:
              'Email address for EMAIL type, User ID for IN_APP type',
            example: 'user123',
          },
          title: {
            type: 'string',
            example: 'Welcome to our platform!',
          },
          message: {
            type: 'string',
            example: 'Thank you for joining us.',
          },
          priority: {
            type: 'string',
            enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
            default: 'MEDIUM',
            example: 'HIGH',
          },
          template: {
            type: 'string',
            description: 'Template name for EMAIL notifications',
            example: 'welcome',
          },
          templateData: {
            type: 'object',
            description: 'Data for template rendering',
            example: {
              firstName: 'John',
              loginUrl: 'https://app.example.com/login',
            },
          },
          actionUrl: {
            type: 'string',
            description: 'URL for notification action (IN_APP only)',
            example: '/orders/123',
          },
          delay: {
            type: 'integer',
            description: 'Delay in milliseconds before sending',
            default: 0,
            example: 5000,
          },
        },
      },
      InAppNotification: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'Unique notification ID',
          },
          userId: {
            type: 'string',
            description: 'Recipient user ID',
          },
          title: {
            type: 'string',
            example: 'Order Confirmation',
          },
          message: {
            type: 'string',
            example: 'Your order #123 has been confirmed',
          },
          category: {
            type: 'string',
            enum: ['order', 'account', 'system', 'promotion'],
            example: 'order',
          },
          priority: {
            type: 'string',
            enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
            example: 'HIGH',
          },
          status: {
            type: 'string',
            enum: ['unread', 'read'],
            example: 'unread',
          },
          actionUrl: {
            type: 'string',
            example: '/orders/123',
          },
          data: {
            type: 'object',
            description: 'Additional notification data',
          },
          createdAt: {
            type: 'string',
            format: 'date-time',
          },
          readAt: {
            type: 'string',
            format: 'date-time',
            nullable: true,
          },
        },
      },
      EventRequest: {
        type: 'object',
        required: ['eventType', 'data'],
        properties: {
          eventType: {
            type: 'string',
            enum: [
              'user.registered',
              'order.created',
              'order.confirmed',
              'order.shipped',
              'order.delivered',
              'order.cancelled',
              'product.low_stock',
              'admin.action',
            ],
            example: 'order.created',
          },
          data: {
            type: 'object',
            description: 'Event-specific data',
            example: {
              order: {
                id: '123',
                total: 99.99,
                items: [],
              },
              user: {
                id: 'user123',
                email: 'user@example.com',
                firstName: 'John',
              },
            },
          },
        },
      },
      QueueStats: {
        type: 'object',
        properties: {
          email: {
            type: 'object',
            properties: {
              waiting: { type: 'integer', example: 5 },
              active: { type: 'integer', example: 2 },
              completed: { type: 'integer', example: 150 },
              failed: { type: 'integer', example: 3 },
            },
          },
          inApp: {
            type: 'object',
            properties: {
              waiting: { type: 'integer', example: 1 },
              active: { type: 'integer', example: 0 },
              completed: { type: 'integer', example: 75 },
              failed: { type: 'integer', example: 1 },
            },
          },
        },
      },
    },
  },
  tags: [
    {
      name: 'Notifications',
      description: 'Send and manage notifications',
    },
    {
      name: 'Events',
      description: 'Process events from other services',
    },
    {
      name: 'Emails',
      description: 'Email notification operations',
    },
    {
      name: 'Admin',
      description: 'Administrative operations',
    },
  ],
};

const options = {
  definition: swaggerDefinition,
  apis: ['./src/routes/*.js', './src/controllers/*.js'],
};

const swaggerSpec = swaggerJSDoc(options);

module.exports = swaggerSpec;
