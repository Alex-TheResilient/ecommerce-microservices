const express = require('express');
const router = express.Router();

const {
  processEvent,
  getSupportedEventTypes,
} = require('../controllers/eventController');

// Process incoming events from other services
router.post('/', processEvent);

// Get supported event types
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
