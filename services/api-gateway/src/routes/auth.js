const express = require('express');
const axios = require('axios');
const { logger } = require('../utils/logger');

const router = express.Router();

const AUTH_SERVICE_URL =
  process.env.AUTH_SERVICE_URL || 'http://auth-service:3000';

// Create axios instance with optimized settings
const authServiceClient = axios.create({
  baseURL: AUTH_SERVICE_URL,
  timeout: 8000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Forward register request
router.post('/register', async (req, res) => {
  try {
    logger.info('Forwarding register request to auth service');

    const response = await authServiceClient.post(
      '/api/auth/register',
      req.body
    );

    logger.info('Register request successful');
    res.status(response.status).json(response.data);
  } catch (error) {
    logger.error('Auth register forward error:', error.message);

    if (error.response) {
      // Auth service responded with an error
      res.status(error.response.status).json(error.response.data);
    } else if (error.code === 'ECONNREFUSED') {
      res.status(503).json({
        success: false,
        message: 'Auth service unavailable',
      });
    } else if (error.code === 'ETIMEDOUT') {
      res.status(504).json({
        success: false,
        message: 'Auth service timeout',
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Gateway error',
      });
    }
  }
});

// Forward login request
router.post('/login', async (req, res) => {
  try {
    logger.info('Forwarding login request to auth service');

    const response = await authServiceClient.post('/api/auth/login', req.body);

    logger.info('Login request successful');
    res.status(response.status).json(response.data);
  } catch (error) {
    logger.error('Auth login forward error:', error.message);

    if (error.response) {
      res.status(error.response.status).json(error.response.data);
    } else if (error.code === 'ECONNREFUSED') {
      res.status(503).json({
        success: false,
        message: 'Auth service unavailable',
      });
    } else if (error.code === 'ETIMEDOUT') {
      res.status(504).json({
        success: false,
        message: 'Auth service timeout',
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Gateway error',
      });
    }
  }
});

// Forward profile request
router.get('/profile', async (req, res) => {
  try {
    logger.info('Forwarding profile request to auth service');

    const response = await authServiceClient.get('/api/auth/profile', {
      headers: {
        Authorization: req.headers.authorization,
      },
    });

    logger.info('Profile request successful');
    res.status(response.status).json(response.data);
  } catch (error) {
    logger.error('Auth profile forward error:', error.message);

    if (error.response) {
      res.status(error.response.status).json(error.response.data);
    } else {
      res.status(500).json({
        success: false,
        message: 'Gateway error',
      });
    }
  }
});

// Forward make-admin request
router.post('/make-admin', async (req, res) => {
  try {
    logger.info('Forwarding make-admin request to auth service');

    const response = await authServiceClient.post(
      '/api/auth/make-admin',
      req.body
    );

    logger.info('Make-admin request successful');
    res.status(response.status).json(response.data);
  } catch (error) {
    logger.error('Auth make-admin forward error:', error.message);

    if (error.response) {
      res.status(error.response.status).json(error.response.data);
    } else {
      res.status(500).json({
        success: false,
        message: 'Gateway error',
      });
    }
  }
});

module.exports = router;
