const { logger } = require('../../utils/logger');
const emailService = require('../emailService');

module.exports = async function processWelcomeEmailJob(job) {
  try {
    const { to, firstName, loginUrl } = job.data;

    logger.info('Processing welcome email job', {
      jobId: job.id,
      to: to,
      firstName: firstName,
    });

    const result = await emailService.sendWelcomeEmail({
      to,
      firstName,
      loginUrl,
    });

    logger.info('Welcome email job completed successfully', {
      jobId: job.id,
      messageId: result.messageId,
      to: to,
    });

    return {
      success: true,
      type: 'welcome-email',
      messageId: result.messageId,
      preview: result.preview,
      sentAt: new Date().toISOString(),
    };
  } catch (error) {
    logger.error('Welcome email job failed', {
      jobId: job.id,
      error: error.message,
      to: job.data.to,
    });

    throw error;
  }
};
