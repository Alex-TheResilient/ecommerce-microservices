const swaggerJSDoc = require('swagger-jsdoc');

const swaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'Order Service API',
    version: '1.0.0',
    description: 'Order management microservice for e-commerce platform',
    contact: {
      name: 'API Support',
      email: 'support@example.com',
    },
  },
  servers: [
    {
      url: 'http://localhost:3003',
      description: 'Development server (direct)',
    },
    {
      url: 'http://localhost:3000/api/orders',
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
      OrderItem: {
        type: 'object',
        properties: {
          productId: {
            type: 'string',
            example: '1',
          },
          productName: {
            type: 'string',
            example: 'iPhone 15 Pro',
          },
          quantity: {
            type: 'integer',
            minimum: 1,
            example: 2,
          },
          price: {
            type: 'number',
            format: 'float',
            example: 999.99,
          },
          total: {
            type: 'number',
            format: 'float',
            example: 1999.98,
          },
        },
      },
      Order: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'Unique order identifier',
          },
          userId: {
            type: 'string',
            description: 'User who created the order',
          },
          userEmail: {
            type: 'string',
            format: 'email',
            description: 'User email',
          },
          items: {
            type: 'array',
            items: {
              $ref: '#/components/schemas/OrderItem',
            },
          },
          total: {
            type: 'number',
            format: 'float',
            description: 'Total order amount',
          },
          status: {
            type: 'string',
            enum: ['PENDING', 'CONFIRMED', 'SHIPPED', 'DELIVERED', 'CANCELLED'],
            description: 'Order status',
          },
          createdAt: {
            type: 'string',
            format: 'date-time',
          },
          updatedAt: {
            type: 'string',
            format: 'date-time',
          },
        },
      },
      CreateOrderRequest: {
        type: 'object',
        required: ['items'],
        properties: {
          items: {
            type: 'array',
            minItems: 1,
            items: {
              type: 'object',
              required: ['productId', 'quantity'],
              properties: {
                productId: {
                  type: 'string',
                  example: '1',
                },
                quantity: {
                  type: 'integer',
                  minimum: 1,
                  example: 2,
                },
              },
            },
          },
        },
      },
      UpdateOrderStatusRequest: {
        type: 'object',
        required: ['status'],
        properties: {
          status: {
            type: 'string',
            enum: ['PENDING', 'CONFIRMED', 'SHIPPED', 'DELIVERED', 'CANCELLED'],
            example: 'CONFIRMED',
          },
          reason: {
            type: 'string',
            description: 'Reason for status change (optional)',
            example: 'Payment confirmed',
          },
        },
      },
      OrderResponse: {
        type: 'object',
        properties: {
          success: {
            type: 'boolean',
            example: true,
          },
          message: {
            type: 'string',
            example: 'Order created successfully',
          },
          data: {
            type: 'object',
            properties: {
              order: {
                $ref: '#/components/schemas/Order',
              },
            },
          },
        },
      },
      OrdersResponse: {
        type: 'object',
        properties: {
          success: {
            type: 'boolean',
            example: true,
          },
          data: {
            type: 'object',
            properties: {
              orders: {
                type: 'array',
                items: {
                  $ref: '#/components/schemas/Order',
                },
              },
              pagination: {
                type: 'object',
                properties: {
                  total: {
                    type: 'integer',
                    example: 25,
                  },
                  page: {
                    type: 'integer',
                    example: 1,
                  },
                  limit: {
                    type: 'integer',
                    example: 10,
                  },
                  totalPages: {
                    type: 'integer',
                    example: 3,
                  },
                },
              },
            },
          },
        },
      },
    },
  },
  tags: [
    {
      name: 'Orders',
      description: 'Order management operations',
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
