const nodemailer = require('nodemailer');
const { logger } = require('../utils/logger');

let transporter = null;

const initializeEmailService = async () => {
  try {
    // For development, you can use Ethereal Email (fake SMTP)
    if (process.env.NODE_ENV === 'development' && !process.env.SMTP_USER) {
      logger.info('Using Ethereal Email for development...');

      // Generate test account
      const testAccount = await nodemailer.createTestAccount();

      transporter = nodemailer.createTransporter({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
      });

      logger.info('✅ Ethereal Email configured for development', {
        user: testAccount.user,
        pass: testAccount.pass,
      });
    } else {
      // Production SMTP configuration
      transporter = nodemailer.createTransporter({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.SMTP_PORT) || 587,
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
        tls: {
          rejectUnauthorized: false,
        },
      });

      logger.info('✅ SMTP transporter configured', {
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT,
        user: process.env.SMTP_USER ? '***configured***' : 'not-set',
      });
    }

    // Verify connection
    await transporter.verify();
    logger.info('✅ Email service initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize email service:', error);

    // Fallback to console logging in development
    if (process.env.NODE_ENV === 'development') {
      logger.warn('Using console fallback for email service');
      transporter = {
        sendMail: async (mailOptions) => {
          logger.info('📧 EMAIL WOULD BE SENT:', {
            to: mailOptions.to,
            subject: mailOptions.subject,
            html: mailOptions.html ? 'HTML content present' : 'No HTML',
            text: mailOptions.text || 'No text content',
          });
          return {
            messageId: `fake-${Date.now()}@example.com`,
            preview: 'http://example.com/fake-preview',
          };
        },
      };
    } else {
      throw error;
    }
  }
};

const sendEmail = async (mailOptions) => {
  try {
    if (!transporter) {
      await initializeEmailService();
    }

    // Default sender
    const emailOptions = {
      from:
        process.env.SMTP_FROM ||
        process.env.SMTP_USER ||
        'noreply@ecommerce.com',
      ...mailOptions,
    };

    logger.info('Sending email', {
      to: emailOptions.to,
      subject: emailOptions.subject,
      hasHtml: !!emailOptions.html,
      hasText: !!emailOptions.text,
    });

    const result = await transporter.sendMail(emailOptions);

    logger.info('✅ Email sent successfully', {
      messageId: result.messageId,
      to: emailOptions.to,
      subject: emailOptions.subject,
      preview: result.preview || 'No preview available',
    });

    return {
      success: true,
      messageId: result.messageId,
      preview: result.preview,
    };
  } catch (error) {
    logger.error('❌ Failed to send email:', {
      error: error.message,
      to: mailOptions.to,
      subject: mailOptions.subject,
    });

    throw {
      success: false,
      error: error.message,
      code: error.code || 'EMAIL_SEND_ERROR',
    };
  }
};

const sendWelcomeEmail = async ({ to, firstName, loginUrl }) => {
  try {
    const templateService = require('./templateService');
    const html = await templateService.renderTemplate('welcome', {
      firstName,
      loginUrl: loginUrl || `${process.env.FRONTEND_URL}/login`,
    });

    return await sendEmail({
      to,
      subject: '¡Bienvenido a nuestra plataforma! 🎉',
      html,
    });
  } catch (error) {
    logger.error('Failed to send welcome email:', error);
    throw error;
  }
};

const sendOrderConfirmationEmail = async ({ to, firstName, order }) => {
  try {
    const templateService = require('./templateService');
    const html = await templateService.renderTemplate('order-confirmation', {
      firstName,
      orderId: order.id,
      items: order.items,
      total: order.total,
      orderDate: new Date(order.createdAt).toLocaleDateString(),
      trackingUrl: `${process.env.FRONTEND_URL}/orders/${order.id}`,
    });

    return await sendEmail({
      to,
      subject: `Confirmación de pedido #${order.id}`,
      html,
    });
  } catch (error) {
    logger.error('Failed to send order confirmation email:', error);
    throw error;
  }
};

const sendOrderShippedEmail = async ({
  to,
  firstName,
  order,
  trackingNumber,
}) => {
  try {
    const templateService = require('./templateService');
    const html = await templateService.renderTemplate('order-shipped', {
      firstName,
      orderId: order.id,
      trackingNumber,
      trackingUrl: `${process.env.FRONTEND_URL}/orders/${order.id}/tracking`,
      estimatedDelivery: '3-5 días hábiles',
    });

    return await sendEmail({
      to,
      subject: `Tu pedido #${order.id} ha sido enviado 📦`,
      html,
    });
  } catch (error) {
    logger.error('Failed to send order shipped email:', error);
    throw error;
  }
};

const sendAdminAlert = async ({ type, message, data }) => {
  try {
    const adminEmail = process.env.ADMIN_EMAIL || process.env.SMTP_USER;

    if (!adminEmail) {
      logger.warn('No admin email configured, skipping admin alert');
      return { success: false, reason: 'No admin email configured' };
    }

    const templateService = require('./templateService');
    const html = await templateService.renderTemplate('admin-alert', {
      alertType: type,
      message,
      data: JSON.stringify(data, null, 2),
      timestamp: new Date().toISOString(),
      dashboardUrl: `${process.env.FRONTEND_URL}/admin/dashboard`,
    });

    return await sendEmail({
      to: adminEmail,
      subject: `🚨 Admin Alert: ${type}`,
      html,
    });
  } catch (error) {
    logger.error('Failed to send admin alert email:', error);
    throw error;
  }
};

// Email validation
const validateEmailAddress = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Get email service status
const getEmailServiceStatus = async () => {
  try {
    if (!transporter) {
      return { status: 'not_initialized' };
    }

    if (typeof transporter.verify === 'function') {
      await transporter.verify();
      return {
        status: 'connected',
        type:
          process.env.NODE_ENV === 'development' && !process.env.SMTP_USER
            ? 'ethereal'
            : 'smtp',
      };
    } else {
      return {
        status: 'mock',
        type: 'console_fallback',
      };
    }
  } catch (error) {
    return {
      status: 'error',
      error: error.message,
    };
  }
};

module.exports = {
  initializeEmailService,
  sendEmail,
  sendWelcomeEmail,
  sendOrderConfirmationEmail,
  sendOrderShippedEmail,
  sendAdminAlert,
  validateEmailAddress,
  getEmailServiceStatus,
};
