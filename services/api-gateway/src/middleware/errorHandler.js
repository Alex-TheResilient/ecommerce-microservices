const { logger } = require('../utils/logger');

exports.errorHandler = (err, req, res, next) => {
  logger.error('Unhandled error in API Gateway:', err);

  res.status(500).json({
    success: false,
    message: 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && {
      error: err.message,
      stack: err.stack,
    }),
  });
};
