const axios = require('axios');
const { logger } = require('../utils/logger');

exports.authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({
        success: false,
        message: 'Access token is required',
      });
    }

    const token = authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access token is required',
      });
    }

    // Verify token with auth service
    const authServiceUrl =
      process.env.AUTH_SERVICE_URL || 'http://auth-service:3000';
    const response = await axios.get(`${authServiceUrl}/api/auth/profile`, {
      headers: { Authorization: `Bearer ${token}` },
      timeout: 5000,
    });

    req.user = response.data.data.user;
    next();
  } catch (error) {
    logger.error('Authentication middleware error:', error);

    if (error.response?.status === 401) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired token',
      });
    }

    if (error.code === 'ECONNREFUSED' || error.code === 'TIMEOUT') {
      return res.status(503).json({
        success: false,
        message: 'Authentication service temporarily unavailable',
      });
    }

    res.status(500).json({
      success: false,
      message: 'Authentication error',
    });
  }
};
