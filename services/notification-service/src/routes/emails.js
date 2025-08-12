const express = require('express');
const router = express.Router();

const {
  sendEmail,
  sendWelcomeEmail,
  sendOrderConfirmationEmail,
  getTemplates,
  getServiceStatus,
  testEmail,
} = require('../controllers/emailController');

/**
 * @swagger
 * /api/emails/send:
 *   post:
 *     summary: Send custom email
 *     description: |
 *       Send a custom email with HTML/text content or using a template. Supports priority levels, delayed delivery, and template rendering with Handlebars.
 *
 *       **📧 Email Features:**
 *       - Custom HTML/text email content
 *       - Template-based emails with data injection
 *       - Priority-based queue processing
 *       - Delayed delivery scheduling
 *       - SMTP validation and error handling
 *     tags: [Emails]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - to
 *             properties:
 *               to:
 *                 type: string
 *                 format: email
 *                 description: Recipient email address
 *                 example: "user@example.com"
 *               subject:
 *                 type: string
 *                 description: Email subject (required if not using template)
 *                 example: "Important Update"
 *               html:
 *                 type: string
 *                 description: HTML content (required if not using template)
 *                 example: "<h1>Hello!</h1><p>This is an important update.</p>"
 *               text:
 *                 type: string
 *                 description: Plain text content (optional)
 *                 example: "Hello! This is an important update."
 *               template:
 *                 type: string
 *                 description: Template name (alternative to html/text)
 *                 example: "welcome"
 *               templateData:
 *                 type: object
 *                 description: Data for template rendering
 *                 example:
 *                   firstName: "John"
 *                   loginUrl: "https://app.example.com/login"
 *               priority:
 *                 type: string
 *                 enum: [LOW, MEDIUM, HIGH, CRITICAL]
 *                 default: MEDIUM
 *                 example: "HIGH"
 *               delay:
 *                 type: integer
 *                 description: Delay in milliseconds before sending
 *                 default: 0
 *                 example: 5000
 *           examples:
 *             customEmail:
 *               summary: Custom HTML email
 *               value:
 *                 to: "user@example.com"
 *                 subject: "Account Update"
 *                 html: "<h1>Account Updated</h1><p>Your account has been successfully updated.</p>"
 *                 priority: "MEDIUM"
 *             templateEmail:
 *               summary: Template-based email
 *               value:
 *                 to: "user@example.com"
 *                 template: "welcome"
 *                 templateData:
 *                   firstName: "John"
 *                   loginUrl: "https://app.example.com/login"
 *                 priority: "HIGH"
 *             delayedEmail:
 *               summary: Delayed email (10 seconds)
 *               value:
 *                 to: "user@example.com"
 *                 subject: "Reminder"
 *                 html: "<p>This is a delayed reminder.</p>"
 *                 delay: 10000
 *     responses:
 *       202:
 *         description: Email queued successfully
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
 *                   example: "Email queued successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     jobId:
 *                       type: string
 *                       example: "email_job_123456"
 *                     to:
 *                       type: string
 *                       example: "user@example.com"
 *                     subject:
 *                       type: string
 *                       example: "Important Update"
 *                     template:
 *                       type: string
 *                       example: "welcome"
 *                     priority:
 *                       type: string
 *                       example: "HIGH"
 *                     estimatedProcessingTime:
 *                       type: string
 *                       example: "immediate"
 *       400:
 *         description: Validation error (invalid email, missing content, etc.)
 *       401:
 *         description: Unauthorized
 */
router.post('/send', sendEmail);

/**
 * @swagger
 * /api/emails/welcome:
 *   post:
 *     summary: Send welcome email to new user
 *     description: |
 *       Send a welcome email using the predefined welcome template. Automatically triggered when new users register.
 *
 *       **🎉 Welcome Email Features:**
 *       - Branded welcome template with Handlebars
 *       - Personalized greeting with user's name
 *       - Custom login URL integration
 *       - High priority processing
 *       - Automatic tracking and logging
 *     tags: [Emails]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - to
 *               - firstName
 *             properties:
 *               to:
 *                 type: string
 *                 format: email
 *                 description: New user's email address
 *                 example: "newuser@example.com"
 *               firstName:
 *                 type: string
 *                 description: User's first name for personalization
 *                 example: "John"
 *               loginUrl:
 *                 type: string
 *                 format: uri
 *                 description: Custom login URL (optional, defaults to env variable)
 *                 example: "https://app.example.com/login"
 *               priority:
 *                 type: string
 *                 enum: [LOW, MEDIUM, HIGH, CRITICAL]
 *                 default: HIGH
 *                 example: "HIGH"
 *               delay:
 *                 type: integer
 *                 description: Delay in milliseconds before sending
 *                 default: 0
 *                 example: 2000
 *           example:
 *             to: "newuser@example.com"
 *             firstName: "John"
 *             loginUrl: "https://app.example.com/login"
 *             priority: "HIGH"
 *     responses:
 *       202:
 *         description: Welcome email queued successfully
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
 *                   example: "Welcome email queued successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     jobId:
 *                       type: string
 *                       example: "welcome_job_123456"
 *                     to:
 *                       type: string
 *                       example: "newuser@example.com"
 *                     firstName:
 *                       type: string
 *                       example: "John"
 *                     type:
 *                       type: string
 *                       example: "welcome-email"
 *       400:
 *         description: Validation error (invalid email, missing name, etc.)
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.post('/welcome', sendWelcomeEmail);

/**
 * @swagger
 * /api/emails/order-confirmation:
 *   post:
 *     summary: Send order confirmation email
 *     description: |
 *       Send an order confirmation email with detailed order information using the order-confirmation template.
 *
 *       **🛒 Order Email Features:**
 *       - Detailed order confirmation template
 *       - Order items and pricing breakdown
 *       - Personalized customer greeting
 *       - Order tracking information
 *       - High priority processing for time-sensitive communications
 *     tags: [Emails]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - to
 *               - firstName
 *               - order
 *             properties:
 *               to:
 *                 type: string
 *                 format: email
 *                 description: Customer's email address
 *                 example: "customer@example.com"
 *               firstName:
 *                 type: string
 *                 description: Customer's first name for personalization
 *                 example: "Jane"
 *               order:
 *                 type: object
 *                 description: Complete order information
 *                 required:
 *                   - id
 *                 properties:
 *                   id:
 *                     type: string
 *                     example: "ORDER_123456"
 *                   total:
 *                     type: number
 *                     example: 99.99
 *                   items:
 *                     type: array
 *                     items:
 *                       type: object
 *                       properties:
 *                         name:
 *                           type: string
 *                         quantity:
 *                           type: integer
 *                         price:
 *                           type: number
 *                     example:
 *                       - name: "Product A"
 *                         quantity: 2
 *                         price: 49.99
 *                   createdAt:
 *                     type: string
 *                     format: date-time
 *                     example: "2024-03-20T10:30:00Z"
 *                   status:
 *                     type: string
 *                     example: "confirmed"
 *               priority:
 *                 type: string
 *                 enum: [LOW, MEDIUM, HIGH, CRITICAL]
 *                 default: HIGH
 *                 example: "HIGH"
 *               delay:
 *                 type: integer
 *                 description: Delay in milliseconds before sending
 *                 default: 0
 *                 example: 1000
 *           example:
 *             to: "customer@example.com"
 *             firstName: "Jane"
 *             order:
 *               id: "ORDER_123456"
 *               total: 99.99
 *               items:
 *                 - name: "Wireless Headphones"
 *                   quantity: 1
 *                   price: 79.99
 *                 - name: "Phone Case"
 *                   quantity: 1
 *                   price: 19.99
 *               createdAt: "2024-03-20T10:30:00Z"
 *               status: "confirmed"
 *             priority: "HIGH"
 *     responses:
 *       202:
 *         description: Order confirmation email queued successfully
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
 *                   example: "Order confirmation email queued successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     jobId:
 *                       type: string
 *                       example: "order_job_123456"
 *                     to:
 *                       type: string
 *                       example: "customer@example.com"
 *                     orderId:
 *                       type: string
 *                       example: "ORDER_123456"
 *                     type:
 *                       type: string
 *                       example: "order-confirmation-email"
 *       400:
 *         description: Validation error (invalid email, missing order data, etc.)
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.post('/order-confirmation', sendOrderConfirmationEmail);

/**
 * @swagger
 * /api/emails/templates:
 *   get:
 *     summary: Get available email templates
 *     description: |
 *       Retrieve a list of all available Handlebars email templates with their descriptions and required fields.
 *
 *       **📋 Template Information:**
 *       - Template names and display names
 *       - Required data fields for each template
 *       - Template descriptions and use cases
 *       - Real-time template availability
 *     tags: [Emails]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Templates retrieved successfully
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
 *                     templates:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           name:
 *                             type: string
 *                             example: "welcome"
 *                           displayName:
 *                             type: string
 *                             example: "Welcome"
 *                           description:
 *                             type: string
 *                             example: "Welcome email for new users"
 *                           requiredFields:
 *                             type: array
 *                             items:
 *                               type: string
 *                             example: ["firstName", "loginUrl"]
 *                     count:
 *                       type: integer
 *                       example: 6
 *             example:
 *               success: true
 *               data:
 *                 templates:
 *                   - name: "welcome"
 *                     displayName: "Welcome"
 *                     description: "Welcome email for new users"
 *                     requiredFields: ["firstName", "loginUrl"]
 *                   - name: "order-confirmation"
 *                     displayName: "Order Confirmation"
 *                     description: "Order confirmation email"
 *                     requiredFields: ["firstName", "orderId", "items", "total"]
 *                   - name: "order-shipped"
 *                     displayName: "Order Shipped"
 *                     description: "Order shipped notification"
 *                     requiredFields: ["firstName", "orderId", "trackingNumber"]
 *                 count: 6
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get('/templates', getTemplates);

// Get email service status
/**
 * @swagger
 * /api/emails/status:
 *   get:
 *     summary: Get email service status
 *     description: |
 *       Returns the current status of the email service, including health, connectivity, and configuration details.
 *
 *       **🔎 Service Status Features:**
 *       - Health check for email service
 *       - SMTP/queue connectivity status
 *       - Service configuration summary
 *       - Useful for monitoring and debugging
 *     tags: [Emails]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Email service status retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 status:
 *                   type: string
 *                   example: "healthy"
 *                 details:
 *                   type: object
 *                   properties:
 *                     smtp:
 *                       type: string
 *                       example: "connected"
 *                     queue:
 *                       type: string
 *                       example: "active"
 *                     config:
 *                       type: object
 *                       example:
 *                         host: "smtp.example.com"
 *                         port: 587
 *       500:
 *         description: Internal server error
 */
router.get('/status', getServiceStatus);

// Test email functionality
router.post('/test', testEmail);

// Render template preview (useful for development)
router.post('/templates/:templateName/preview', async (req, res, next) => {
  try {
    const { templateName } = req.params;
    const { templateData = {} } = req.body;

    const { renderTemplate } = require('../services/templateService');
    const html = await renderTemplate(templateName, templateData);

    res.set('Content-Type', 'text/html');
    res.send(html);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
