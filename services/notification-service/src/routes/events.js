const express = require('express');
const router = express.Router();

const {
  processEvent,
  getSupportedEventTypes,
} = require('../controllers/eventController');

/**
 * @swagger
 * /api/events:
 *   post:
 *     summary: Process event from other microservices
 *     description: |
 *       **🚀 Event-Driven Architecture Endpoint**
 *
 *       This is the core of our event-driven notification system. When other microservices (Auth, Order, Product) emit events, they send them here for automatic notification processing.
 *
 *       **⚡ Advanced Features:**
 *       - **Multi-channel notifications**: Automatically sends both email AND in-app notifications
 *       - **Event routing**: Smart routing based on event type to specialized handlers
 *       - **Template selection**: Automatically selects appropriate email templates
 *       - **Priority management**: Different events get different priority levels
 *       - **Bulk job creation**: One event can trigger multiple notification jobs
 *       - **Data transformation**: Converts event data to notification-specific formats
 *
 *       **🎯 Supported Event Flow:**
 *       ```
 *       Auth Service → user.registered → Welcome Email + In-App Notification
 *       Order Service → order.created → Order Confirmation Email + In-App Notification
 *       Order Service → order.shipped → Tracking Email + In-App Notification
 *       Product Service → product.low_stock → Admin Alert Email
 *       ```
 *     tags: [Events]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/EventRequest'
 *           examples:
 *             userRegistered:
 *               summary: User Registration Event
 *               description: Triggers welcome email and in-app notification
 *               value:
 *                 eventType: "user.registered"
 *                 data:
 *                   user:
 *                     id: "user_123456"
 *                     email: "newuser@example.com"
 *                     firstName: "John"
 *                     lastName: "Doe"
 *                     createdAt: "2024-03-20T10:30:00Z"
 *             orderCreated:
 *               summary: Order Creation Event
 *               description: Triggers order confirmation email and in-app notification
 *               value:
 *                 eventType: "order.created"
 *                 data:
 *                   order:
 *                     id: "ORDER_789123"
 *                     total: 159.99
 *                     status: "confirmed"
 *                     items:
 *                       - id: "prod_1"
 *                         name: "Wireless Headphones"
 *                         quantity: 1
 *                         price: 129.99
 *                       - id: "prod_2"
 *                         name: "Phone Case"
 *                         quantity: 1
 *                         price: 29.99
 *                     createdAt: "2024-03-20T10:30:00Z"
 *                   user:
 *                     id: "user_123456"
 *                     email: "customer@example.com"
 *                     firstName: "Jane"
 *             orderShipped:
 *               summary: Order Shipped Event
 *               description: Triggers shipping confirmation with tracking
 *               value:
 *                 eventType: "order.shipped"
 *                 data:
 *                   order:
 *                     id: "ORDER_789123"
 *                     status: "shipped"
 *                   user:
 *                     id: "user_123456"
 *                     email: "customer@example.com"
 *                     firstName: "Jane"
 *                   trackingNumber: "TRK123456789"
 *             productLowStock:
 *               summary: Low Stock Alert Event
 *               description: Triggers admin alert for inventory management
 *               value:
 *                 eventType: "product.low_stock"
 *                 data:
 *                   product:
 *                     id: "prod_123"
 *                     name: "Wireless Headphones"
 *                     sku: "WH-001"
 *                   currentStock: 3
 *                   threshold: 10
 *             adminAction:
 *               summary: Admin Action Event
 *               description: Triggers admin audit notification
 *               value:
 *                 eventType: "admin.action"
 *                 data:
 *                   action: "product.deleted"
 *                   adminUser:
 *                     id: "admin_001"
 *                     email: "admin@example.com"
 *                     name: "Admin User"
 *                   details:
 *                     productId: "prod_123"
 *                     productName: "Deleted Product"
 *                     reason: "Discontinued"
 *                   timestamp: "2024-03-20T10:30:00Z"
 *     responses:
 *       202:
 *         description: Event processed successfully - notifications queued
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
 *                   example: "Event processed successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     eventType:
 *                       type: string
 *                       example: "order.created"
 *                     processedNotifications:
 *                       type: integer
 *                       description: Number of notification jobs created
 *                       example: 2
 *                     jobs:
 *                       type: array
 *                       description: List of created notification jobs
 *                       items:
 *                         type: object
 *                         properties:
 *                           type:
 *                             type: string
 *                             enum: [email, in-app]
 *                             example: "email"
 *                           jobId:
 *                             type: string
 *                             example: "job_123456"
 *                           action:
 *                             type: string
 *                             example: "order-confirmation"
 *             examples:
 *               orderCreatedResponse:
 *                 summary: Order Created Event Response
 *                 value:
 *                   success: true
 *                   message: "Event processed successfully"
 *                   data:
 *                     eventType: "order.created"
 *                     processedNotifications: 2
 *                     jobs:
 *                       - type: "email"
 *                         jobId: "email_job_123456"
 *                         action: "order-confirmation"
 *                       - type: "in-app"
 *                         jobId: "inapp_job_789123"
 *                         action: "order-created-notification"
 *               userRegisteredResponse:
 *                 summary: User Registered Event Response
 *                 value:
 *                   success: true
 *                   message: "Event processed successfully"
 *                   data:
 *                     eventType: "user.registered"
 *                     processedNotifications: 2
 *                     jobs:
 *                       - type: "email"
 *                         jobId: "email_job_welcome_123"
 *                         action: "welcome-email"
 *                       - type: "in-app"
 *                         jobId: "inapp_job_welcome_456"
 *                         action: "welcome-notification"
 *       400:
 *         description: Invalid event type or missing data
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
 *                   examples:
 *                     - "Invalid or missing event type"
 *                     - "Event data is required"
 *                     - "Unhandled event type: custom.event"
 *       401:
 *         description: Unauthorized - Invalid or missing JWT token
 *       422:
 *         description: Event data validation failed
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
 *                   example: "Missing required field: user.email"
 *       500:
 *         description: Internal server error during event processing
 */
router.post('/', processEvent);

/**
 * @swagger
 * /api/events/types:
 *   get:
 *     summary: Get supported event types and their schemas
 *     description: |
 *       **📋 Event Types Documentation**
 *
 *       Retrieve comprehensive information about all supported event types, their required data fields, and descriptions. Essential for microservice integration.
 *
 *       **🎯 Integration Guide:**
 *       - **Event types**: All supported event types with descriptions
 *       - **Required fields**: Exact data structure needed for each event
 *       - **Data validation**: Field requirements and formats
 *       - **Integration examples**: How other services should structure their event payloads
 *
 *       **🔗 Microservice Integration:**
 *       ```javascript
 *       // Auth Service integration
 *       await fetch('http://notification-service:3004/api/events', {
 *         method: 'POST',
 *         headers: { 'Content-Type': 'application/json' },
 *         body: JSON.stringify({
 *           eventType: 'user.registered',
 *           data: { user: { id, email, firstName } }
 *         })
 *       });
 *       ```
 *     tags: [Events]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Event types retrieved successfully
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
 *                     eventTypes:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           type:
 *                             type: string
 *                             example: "user.registered"
 *                           description:
 *                             type: string
 *                             example: "New user registration"
 *                           requiredFields:
 *                             type: array
 *                             items:
 *                               type: string
 *                             example: ["user.id", "user.email", "user.firstName"]
 *                     count:
 *                       type: integer
 *                       example: 8
 *             example:
 *               success: true
 *               data:
 *                 eventTypes:
 *                   - type: "user.registered"
 *                     description: "New user registration"
 *                     requiredFields: ["user.id", "user.email", "user.firstName"]
 *                   - type: "order.created"
 *                     description: "New order created"
 *                     requiredFields: ["order.id", "order.total", "order.items", "user.id", "user.email"]
 *                   - type: "order.confirmed"
 *                     description: "Order confirmed by admin"
 *                     requiredFields: ["order.id", "user.id"]
 *                   - type: "order.shipped"
 *                     description: "Order shipped"
 *                     requiredFields: ["order.id", "user.id", "trackingNumber"]
 *                   - type: "order.delivered"
 *                     description: "Order delivered"
 *                     requiredFields: ["order.id", "user.id"]
 *                   - type: "order.cancelled"
 *                     description: "Order cancelled"
 *                     requiredFields: ["order.id", "user.id", "reason?"]
 *                   - type: "product.low_stock"
 *                     description: "Product stock is low"
 *                     requiredFields: ["product.id", "product.name", "currentStock", "threshold"]
 *                   - type: "admin.action"
 *                     description: "Admin performed an action"
 *                     requiredFields: ["action", "adminUser.email", "details?"]
 *                 count: 8
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get('/types', getSupportedEventTypes);

// Webhook endpoint for external services
router.post('/webhook', async (req, res, next) => {
  try {
    const { source, eventType, data, timestamp } = req.body;

    const { logger } = require('../utils/logger');

    logger.info('Webhook received', {
      source,
      eventType,
      timestamp,
      dataKeys: data ? Object.keys(data) : [],
    });

    // Process the webhook as a regular event
    req.body = { eventType, data };
    await processEvent(req, res, next);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
