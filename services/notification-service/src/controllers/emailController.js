const { logger } = require('../utils/logger');
const { addEmailJob } = require('../services/queueService');
const { getAvailableTemplates } = require('../services/templateService');
const {
  getEmailServiceStatus,
  validateEmailAddress,
} = require('../services/emailService');
const { ValidationError } = require('../middleware/errorHandler');
const { EMAIL_TEMPLATES, PRIORITY_LEVELS } = require('../utils/constants');

// Send generic email
const sendEmail = async (req, res, next) => {
  try {
    const {
      to,
      subject,
      html,
      text,
      template,
      templateData,
      priority = 'MEDIUM',
      delay = 0,
    } = req.body;

    // Validation
    if (!to || !validateEmailAddress(to)) {
      throw new ValidationError('Valid email address is required');
    }

    if (!subject && !template) {
      throw new ValidationError('Subject or template is required');
    }

    if (!html && !text && !template) {
      throw new ValidationError(
        'Email content (html, text, or template) is required'
      );
    }

    if (!Object.values(PRIORITY_LEVELS).includes(priority)) {
      throw new ValidationError('Invalid priority level');
    }

    // Prepare job data
    const jobData = {
      to,
      subject,
      html,
      text,
      template,
      templateData,
    };

    // Add to queue
    const job = await addEmailJob('send-email', jobData, {
      priority: getPriorityValue(priority),
      delay: parseInt(delay),
    });

    logger.info('Email queued successfully', {
      to,
      subject,
      jobId: job.id,
      template,
      priority,
    });

    res.status(202).json({
      success: true,
      message: 'Email queued successfully',
      data: {
        jobId: job.id,
        to,
        subject,
        template,
        priority,
        estimatedProcessingTime: delay > 0 ? `${delay}ms` : 'immediate',
      },
    });
  } catch (error) {
    next(error);
  }
};

// Send welcome email
const sendWelcomeEmail = async (req, res, next) => {
  try {
    const { to, firstName, loginUrl, priority = 'HIGH', delay = 0 } = req.body;

    // Validation
    if (!to || !validateEmailAddress(to)) {
      throw new ValidationError('Valid email address is required');
    }

    if (!firstName) {
      throw new ValidationError('First name is required');
    }

    const jobData = {
      to,
      firstName,
      loginUrl: loginUrl || `${process.env.FRONTEND_URL}/login`,
    };

    const job = await addEmailJob('welcome-email', jobData, {
      priority: getPriorityValue(priority),
      delay: parseInt(delay),
    });

    logger.info('Welcome email queued successfully', {
      to,
      firstName,
      jobId: job.id,
    });

    res.status(202).json({
      success: true,
      message: 'Welcome email queued successfully',
      data: {
        jobId: job.id,
        to,
        firstName,
        type: 'welcome-email',
      },
    });
  } catch (error) {
    next(error);
  }
};

// Send order confirmation email
const sendOrderConfirmationEmail = async (req, res, next) => {
  try {
    const { to, firstName, order, priority = 'HIGH', delay = 0 } = req.body;

    // Validation
    if (!to || !validateEmailAddress(to)) {
      throw new ValidationError('Valid email address is required');
    }

    if (!firstName) {
      throw new ValidationError('First name is required');
    }

    if (!order || !order.id) {
      throw new ValidationError('Order information is required');
    }

    const jobData = {
      to,
      firstName,
      order,
    };

    const job = await addEmailJob('order-confirmation', jobData, {
      priority: getPriorityValue(priority),
      delay: parseInt(delay),
    });

    logger.info('Order confirmation email queued successfully', {
      to,
      orderId: order.id,
      jobId: job.id,
    });

    res.status(202).json({
      success: true,
      message: 'Order confirmation email queued successfully',
      data: {
        jobId: job.id,
        to,
        orderId: order.id,
        type: 'order-confirmation-email',
      },
    });
  } catch (error) {
    next(error);
  }
};

// Get available email templates
const getTemplates = async (req, res, next) => {
  try {
    const templates = getAvailableTemplates();

    const templateInfo = templates.map((templateName) => ({
      name: templateName,
      displayName: templateName
        .replace(/-/g, ' ')
        .replace(/\b\w/g, (l) => l.toUpperCase()),
      description: getTemplateDescription(templateName),
      requiredFields: getTemplateRequiredFields(templateName),
    }));

    res.json({
      success: true,
      data: {
        templates: templateInfo,
        count: templates.length,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Get email service status
const getServiceStatus = async (req, res, next) => {
  try {
    const status = await getEmailServiceStatus();

    res.json({
      success: true,
      data: {
        emailService: status,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    next(error);
  }
};

// Test email connectivity
const testEmail = async (req, res, next) => {
  try {
    const { to } = req.body;

    if (!to || !validateEmailAddress(to)) {
      throw new ValidationError('Valid test email address is required');
    }

    const jobData = {
      to,
      subject: 'Test Email - Notification Service',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #4F46E5;">✅ Test Email Successful</h1>
          <p>This is a test email from the Notification Service.</p>
          <p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
          <p><strong>Service:</strong> E-commerce Notification Service</p>
          <p style="color: #666; font-size: 12px;">
            If you received this email, the notification service is working correctly.
          </p>
        </div>
      `,
    };

    const job = await addEmailJob('send-email', jobData, {
      priority: getPriorityValue('HIGH'),
    });

    logger.info('Test email queued successfully', {
      to,
      jobId: job.id,
    });

    res.status(202).json({
      success: true,
      message: 'Test email queued successfully',
      data: {
        jobId: job.id,
        to,
        type: 'test-email',
      },
    });
  } catch (error) {
    next(error);
  }
};

// Helper functions
const getPriorityValue = (priority) => {
  const priorities = {
    LOW: 1,
    MEDIUM: 5,
    HIGH: 10,
    CRITICAL: 20,
  };
  return priorities[priority] || 5;
};

const getTemplateDescription = (templateName) => {
  const descriptions = {
    [EMAIL_TEMPLATES.WELCOME]: 'Welcome email for new users',
    [EMAIL_TEMPLATES.ORDER_CONFIRMATION]: 'Order confirmation email',
    [EMAIL_TEMPLATES.ORDER_SHIPPED]: 'Order shipped notification',
    [EMAIL_TEMPLATES.ORDER_DELIVERED]: 'Order delivered notification',
    [EMAIL_TEMPLATES.PASSWORD_RESET]: 'Password reset email',
    [EMAIL_TEMPLATES.ADMIN_ALERT]: 'Admin system alerts',
  };
  return descriptions[templateName] || 'Email template';
};

const getTemplateRequiredFields = (templateName) => {
  const requiredFields = {
    [EMAIL_TEMPLATES.WELCOME]: ['firstName', 'loginUrl'],
    [EMAIL_TEMPLATES.ORDER_CONFIRMATION]: [
      'firstName',
      'orderId',
      'items',
      'total',
    ],
    [EMAIL_TEMPLATES.ORDER_SHIPPED]: ['firstName', 'orderId', 'trackingNumber'],
    [EMAIL_TEMPLATES.ORDER_DELIVERED]: ['firstName', 'orderId'],
    [EMAIL_TEMPLATES.PASSWORD_RESET]: ['firstName', 'resetUrl'],
    [EMAIL_TEMPLATES.ADMIN_ALERT]: ['alertType', 'message', 'timestamp'],
  };
  return requiredFields[templateName] || [];
};

module.exports = {
  sendEmail,
  sendWelcomeEmail,
  sendOrderConfirmationEmail,
  getTemplates,
  getServiceStatus,
  testEmail,
};
