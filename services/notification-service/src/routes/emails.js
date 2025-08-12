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

// Send generic email
router.post('/send', sendEmail);

// Send welcome email
router.post('/welcome', sendWelcomeEmail);

// Send order confirmation email
router.post('/order-confirmation', sendOrderConfirmationEmail);

// Get available templates
router.get('/templates', getTemplates);

// Get email service status
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
