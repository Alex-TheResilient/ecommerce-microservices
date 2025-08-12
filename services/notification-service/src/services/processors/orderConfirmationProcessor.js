const { logger } = require('../../utils/logger');
const emailService = require('../emailService');

module.exports = async function processOrderConfirmationEmailJob(job) {
  try {
    const { to, firstName, order } = job.data;

    logger.info('Processing order confirmation email job', {
      jobId: job.id,
      to: to,
      orderId: order.id,
      orderTotal: order.total,
    });

    const result = await emailService.sendOrderConfirmationEmail({
      to,
      firstName,
      order,
    });

    logger.info('Order confirmation email job completed successfully', {
      jobId: job.id,
      messageId: result.messageId,
      to: to,
      orderId: order.id,
    });

    return {
      success: true,
      type: 'order-confirmation-email',
      messageId: result.messageId,
      preview: result.preview,
      orderId: order.id,
      sentAt: new Date().toISOString(),
    };
  } catch (error) {
    logger.error('Order confirmation email job failed', {
      jobId: job.id,
      error: error.message,
      to: job.data.to,
      orderId: job.data.order?.id,
    });

    throw error;
  }
};
