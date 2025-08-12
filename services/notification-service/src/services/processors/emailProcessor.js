const { logger } = require('../../utils/logger');
const emailService = require('../emailService');

module.exports = async function processEmailJob(job) {
  try {
    const { to, subject, html, text, template, templateData } = job.data;

    logger.info('Processing email job', {
      jobId: job.id,
      to: to,
      subject: subject,
      hasTemplate: !!template,
    });

    let emailContent = { html, text };

    // If template is specified, render it
    if (template && templateData) {
      const templateService = require('../templateService');
      emailContent.html = await templateService.renderTemplate(
        template,
        templateData
      );
    }

    // Send email
    const result = await emailService.sendEmail({
      to,
      subject,
      ...emailContent,
    });

    logger.info('Email job completed successfully', {
      jobId: job.id,
      messageId: result.messageId,
      to: to,
    });

    return {
      success: true,
      messageId: result.messageId,
      preview: result.preview,
      sentAt: new Date().toISOString(),
    };
  } catch (error) {
    logger.error('Email job failed', {
      jobId: job.id,
      error: error.message,
      to: job.data.to,
    });

    throw error;
  }
};
