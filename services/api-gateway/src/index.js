require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { createProxyMiddleware } = require('http-proxy-middleware');
const { logger } = require('./utils/logger');
const { authMiddleware } = require('./middleware/auth');
const { requestLogger } = require('./middleware/requestLogger');
const { errorHandler } = require('./middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 3000;

const authRoutes = require('./routes/auth');

// Service URLs
const services = {
  auth: process.env.AUTH_SERVICE_URL || 'http://auth-service:3000',
  product: process.env.PRODUCT_SERVICE_URL || 'http://product-service:3000',
  order: process.env.ORDER_SERVICE_URL || 'http://order-service:3000',
  notification:
    process.env.NOTIFICATION_SERVICE_URL || 'http://notification-service:3000',
};

// Global middleware
app.use(helmet());
app.use(
  cors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || [
      'http://localhost:3000',
      'http://localhost:3001',
    ],
    credentials: true,
  })
);
app.use(express.json({ limit: '10mb' }));
app.use(requestLogger);
app.use('/api/auth', authRoutes);

// Global rate limiting
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // limit each IP to 1000 requests per windowMs
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later',
  },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(globalLimiter);

// Health check for API Gateway
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    service: 'api-gateway',
    timestamp: new Date().toISOString(),
    services: services,
  });
});

// Service health checks
app.get('/health/services', async (req, res) => {
  const healthChecks = {};

  for (const [serviceName, serviceUrl] of Object.entries(services)) {
    try {
      const axios = require('axios');
      const response = await axios.get(`${serviceUrl}/health`, {
        timeout: 5000,
      });
      healthChecks[serviceName] = {
        status: 'UP',
        responseTime: response.headers['x-response-time'] || 'N/A',
        data: response.data,
      };
    } catch (error) {
      healthChecks[serviceName] = {
        status: 'DOWN',
        error: error.message,
      };
    }
  }

  res.json({
    success: true,
    gateway: 'UP',
    services: healthChecks,
    timestamp: new Date().toISOString(),
  });
});

// Product Service Proxy (public endpoints)
app.use(
  '/api/products',
  createProxyMiddleware({
    target: services.product,
    changeOrigin: true,
    timeout: 30000, // 30 segundos timeout
    proxyTimeout: 30000, // timeout del proxy
    pathRewrite: {
      '^/api/products': '/api/products',
    },
    onError: (err, req, res) => {
      logger.error('Product service proxy error:', {
        error: err.message,
        code: err.code,
        target: services.product,
        path: req.path,
      });

      if (!res.headersSent) {
        res.status(503).json({
          success: false,
          message: 'Product service temporarily unavailable',
          error: err.code || 'SERVICE_UNAVAILABLE',
          timestamp: new Date().toISOString(),
        });
      }
    },
    onProxyReq: (proxyReq, req, res) => {
      logger.info(`Proxying to product service: ${req.method} ${req.path}`);

      // Set timeouts
      proxyReq.setTimeout(30000, () => {
        logger.error('Product service request timeout');
        proxyReq.destroy();
      });
    },
    onProxyRes: (proxyRes, req, res) => {
      logger.info(
        `Product service response: ${proxyRes.statusCode} for ${req.method} ${req.path}`
      );
    },
  })
);

// Order Service Proxy (auth required) - FIXED VERSION
app.use('/api/orders', authMiddleware, async (req, res) => {
  try {
    const axios = require('axios');

    // Log de la request
    logger.info('🚀 Manual forwarding to order service', {
      method: req.method,
      path: req.path,
      originalUrl: req.originalUrl,
      target: services.order,
      userId: req.user?.id,
      hasAuth: !!req.headers.authorization,
    });

    // Construir la URL del target
    const targetUrl = `${services.order}${req.originalUrl}`;

    // Preparar headers
    const forwardHeaders = {
      'Content-Type': req.headers['content-type'] || 'application/json',
      'User-Agent': 'API-Gateway-Manual-Forward',
    };

    // Forward auth headers
    if (req.headers.authorization) {
      forwardHeaders['Authorization'] = req.headers.authorization;
    }

    // Forward user info
    if (req.user) {
      forwardHeaders['X-User-Id'] = req.user.id.toString();
      forwardHeaders['X-User-Role'] = req.user.role;
      forwardHeaders['X-User-Email'] = req.user.email || '';
    }

    // Configuración de axios
    const axiosConfig = {
      method: req.method.toLowerCase(),
      url: targetUrl,
      headers: forwardHeaders,
      timeout: 30000, // 30 segundos
      // Forward query parameters
      ...(Object.keys(req.query).length > 0 && { params: req.query }),
      // Forward body for POST/PUT/PATCH
      ...(req.body &&
        ['post', 'put', 'patch'].includes(req.method.toLowerCase()) && {
          data: req.body,
        }),
    };

    logger.info('📤 Forwarding request', {
      config: {
        method: axiosConfig.method,
        url: axiosConfig.url,
        headers: axiosConfig.headers,
        hasData: !!axiosConfig.data,
        hasParams: !!axiosConfig.params,
      },
    });

    // Realizar la request
    const startTime = Date.now();
    const response = await axios(axiosConfig);
    const duration = Date.now() - startTime;

    logger.info('✅ Order service response received', {
      status: response.status,
      duration: `${duration}ms`,
      contentType: response.headers['content-type'],
      dataLength: JSON.stringify(response.data).length,
    });

    // Forward response headers importantes
    const responseHeaders = {};
    if (response.headers['content-type']) {
      responseHeaders['content-type'] = response.headers['content-type'];
    }
    if (response.headers['cache-control']) {
      responseHeaders['cache-control'] = response.headers['cache-control'];
    }

    // Enviar respuesta
    res.set(responseHeaders);
    res.status(response.status).json(response.data);
  } catch (error) {
    const duration =
      Date.now() - (error.config?.metadata?.startTime || Date.now());

    logger.error('❌ Order service forwarding failed', {
      error: error.message,
      code: error.code,
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      duration: `${duration}ms`,
      method: req.method,
      path: req.path,
      target: services.order,
    });

    // Manejar diferentes tipos de errores
    if (error.code === 'ECONNABORTED') {
      return res.status(408).json({
        success: false,
        message: 'Order service request timeout',
        error: 'TIMEOUT',
        timestamp: new Date().toISOString(),
      });
    }

    if (error.code === 'ECONNREFUSED') {
      return res.status(503).json({
        success: false,
        message: 'Order service unavailable',
        error: 'SERVICE_UNAVAILABLE',
        timestamp: new Date().toISOString(),
      });
    }

    // Error de respuesta del servicio
    if (error.response) {
      return res.status(error.response.status).json(error.response.data);
    }

    // Error genérico
    res.status(500).json({
      success: false,
      message: 'Internal server error while forwarding to order service',
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

// Admin routes (enhanced auth + admin check)
app.use('/api/admin', authMiddleware, async (req, res, next) => {
  try {
    // Get user info from auth service
    const axios = require('axios');
    const response = await axios.get(`${services.auth}/api/auth/profile`, {
      headers: { Authorization: req.headers.authorization },
      timeout: 10000, // 10 segundos timeout
    });

    const user = response.data.data.user;
    if (user.role !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required',
      });
    }

    req.user = user;
    next();
  } catch (error) {
    logger.error('Admin verification error:', {
      error: error.message,
      status: error.response?.status,
      target: services.auth,
    });
    res.status(401).json({
      success: false,
      message: 'Invalid or expired token',
    });
  }
});

// Admin dashboard endpoint
app.get('/api/admin/dashboard', async (req, res) => {
  try {
    const axios = require('axios');

    // Get stats from all services with timeout
    const [productsRes, ordersRes] = await Promise.allSettled([
      axios.get(`${services.product}/api/products`, { timeout: 10000 }),
      axios.get(`${services.order}/api/orders`, {
        headers: { Authorization: req.headers.authorization },
        timeout: 10000,
      }),
    ]);

    const stats = {
      products: {
        total:
          productsRes.status === 'fulfilled'
            ? productsRes.value.data.data.products.length
            : 0,
        status: productsRes.status === 'fulfilled' ? 'UP' : 'DOWN',
        error:
          productsRes.status === 'rejected' ? productsRes.reason.message : null,
      },
      orders: {
        total:
          ordersRes.status === 'fulfilled'
            ? ordersRes.value.data.data.orders.length
            : 0,
        status: ordersRes.status === 'fulfilled' ? 'UP' : 'DOWN',
        error:
          ordersRes.status === 'rejected' ? ordersRes.reason.message : null,
      },
    };

    res.json({
      success: true,
      data: {
        stats,
        user: req.user,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    logger.error('Admin dashboard error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching dashboard data',
    });
  }
});

// Test connectivity endpoint
app.get('/api/test/connectivity', async (req, res) => {
  const axios = require('axios');
  const results = {};

  for (const [name, url] of Object.entries(services)) {
    try {
      const start = Date.now();
      const response = await axios.get(`${url}/health`, { timeout: 5000 });
      const duration = Date.now() - start;

      results[name] = {
        status: 'UP',
        responseTime: `${duration}ms`,
        statusCode: response.status,
      };
    } catch (error) {
      results[name] = {
        status: 'DOWN',
        error: error.code || error.message,
        timeout: error.code === 'ECONNABORTED',
      };
    }
  }

  res.json({
    success: true,
    connectivity: results,
    timestamp: new Date().toISOString(),
  });
});

// API Documentation endpoint
app.get('/api/docs', (req, res) => {
  res.json({
    success: true,
    title: 'E-commerce Microservices API',
    version: '1.0.0',
    description: 'API Gateway for E-commerce Microservices Architecture',
    services: {
      auth: {
        baseUrl: '/api/auth',
        endpoints: {
          'POST /register': 'Register new user',
          'POST /login': 'User login',
          'GET /profile': 'Get user profile (requires auth)',
          'POST /make-admin': 'Make user admin (dev only)',
        },
      },
      products: {
        baseUrl: '/api/products',
        endpoints: {
          'GET /':
            'Get all products (supports ?category, ?search, ?page, ?limit)',
          'GET /:id': 'Get product by ID',
          'POST /': 'Create product (admin only)',
          'PUT /:id': 'Update product (admin only)',
          'DELETE /:id': 'Delete product (admin only)',
        },
      },
      orders: {
        baseUrl: '/api/orders',
        endpoints: {
          'GET /my-orders': 'Get user orders (requires auth)',
          'GET /:id': 'Get order by ID (requires auth)',
          'POST /': 'Create order (requires auth)',
          'GET /': 'Get all orders (admin only)',
          'PUT /:id/status': 'Update order status (admin only)',
        },
      },
      admin: {
        baseUrl: '/api/admin',
        endpoints: {
          'GET /dashboard': 'Admin dashboard with stats (admin only)',
        },
      },
    },
    examples: {
      authHeaders: {
        Authorization: 'Bearer <your-jwt-token>',
      },
      createOrder: {
        items: [
          { productId: '1', quantity: 2 },
          { productId: '2', quantity: 1 },
        ],
      },
    },
  });
});

app.use(
  '/api/orders',
  authMiddleware,
  (req, res, next) => {
    // Log completo de la request antes del proxy
    logger.info('📋 FULL REQUEST DEBUG', {
      method: req.method,
      path: req.path,
      originalUrl: req.originalUrl,
      headers: req.headers,
      body: req.body,
      query: req.query,
      user: req.user,
      contentLength: req.headers['content-length'],
      contentType: req.headers['content-type'],
    });
    next();
  },
  createProxyMiddleware({
    target: services.order,
    changeOrigin: true,
    timeout: 60000, // Incrementamos a 60 segundos
    proxyTimeout: 60000,
    pathRewrite: {
      '^/api/orders': '/api/orders',
    },
    onError: (err, req, res) => {
      logger.error('🚨 ORDER PROXY ERROR:', {
        error: err.message,
        code: err.code,
        stack: err.stack,
        target: services.order,
        path: req.path,
        method: req.method,
        userAgent: req.headers['user-agent'],
        contentType: req.headers['content-type'],
        timestamp: new Date().toISOString(),
      });

      if (!res.headersSent) {
        res.status(503).json({
          success: false,
          message: 'Order service temporarily unavailable',
          error: err.code || 'SERVICE_UNAVAILABLE',
          debug: {
            target: services.order,
            path: req.path,
            method: req.method,
          },
          timestamp: new Date().toISOString(),
        });
      }
    },
    onProxyReq: (proxyReq, req, res) => {
      const startTime = Date.now();

      logger.info('🚀 PROXY REQUEST START', {
        method: req.method,
        path: req.path,
        target: services.order,
        hasAuth: !!req.headers.authorization,
        userId: req.user?.id,
        userRole: req.user?.role,
        contentType: req.headers['content-type'],
        contentLength: req.headers['content-length'],
        userAgent: req.headers['user-agent'],
        startTime: startTime,
      });

      // Forward auth headers
      if (req.headers.authorization) {
        proxyReq.setHeader('Authorization', req.headers.authorization);
        logger.info('✅ Authorization header forwarded');
      }

      // Forward user info as headers
      if (req.user) {
        proxyReq.setHeader('X-User-Id', req.user.id.toString());
        proxyReq.setHeader('X-User-Role', req.user.role);
        proxyReq.setHeader('X-User-Email', req.user.email || '');
        logger.info('✅ User headers forwarded', {
          userId: req.user.id,
          userRole: req.user.role,
        });
      }

      // Ensure proper content type
      if (req.method === 'POST' || req.method === 'PUT') {
        if (!proxyReq.getHeader('content-type')) {
          proxyReq.setHeader('Content-Type', 'application/json');
          logger.info('✅ Content-Type header set to application/json');
        }
      }

      // Log final headers being sent
      logger.info('📤 FINAL PROXY HEADERS', {
        headers: proxyReq.getHeaders(),
        path: proxyReq.path,
        method: proxyReq.method,
      });

      // Set timeout with detailed logging
      proxyReq.setTimeout(60000, () => {
        const duration = Date.now() - startTime;
        logger.error('⏰ ORDER SERVICE REQUEST TIMEOUT', {
          duration: `${duration}ms`,
          path: req.path,
          method: req.method,
          target: services.order,
        });
        proxyReq.destroy();
      });

      // Monitor for errors
      proxyReq.on('error', (err) => {
        const duration = Date.now() - startTime;
        logger.error('❌ PROXY REQUEST ERROR', {
          error: err.message,
          code: err.code,
          duration: `${duration}ms`,
          path: req.path,
        });
      });
    },
    onProxyRes: (proxyRes, req, res) => {
      const duration = Date.now() - req.startTime;

      logger.info('✅ ORDER SERVICE RESPONSE RECEIVED', {
        statusCode: proxyRes.statusCode,
        statusMessage: proxyRes.statusMessage,
        headers: proxyRes.headers,
        method: req.method,
        path: req.path,
        duration: `${duration}ms`,
        contentType: proxyRes.headers['content-type'],
        contentLength: proxyRes.headers['content-length'],
      });

      // Log response body for debugging (solo en desarrollo)
      if (process.env.NODE_ENV === 'development') {
        let body = '';
        proxyRes.on('data', (chunk) => {
          body += chunk;
        });
        proxyRes.on('end', () => {
          logger.info('📥 ORDER SERVICE RESPONSE BODY', {
            body: body.substring(0, 1000), // Solo primeros 1000 caracteres
            path: req.path,
            method: req.method,
          });
        });
      }
    },
  })
);

// Notification Service Routes (auth required for user endpoints)
app.use('/api/notifications', authMiddleware, async (req, res) => {
  try {
    const axios = require('axios');

    logger.info('🔔 Manual forwarding to notification service', {
      method: req.method,
      path: req.path,
      originalUrl: req.originalUrl,
      target: services.notification,
      userId: req.user?.id,
      hasAuth: !!req.headers.authorization,
    });

    // Construir la URL del target
    const targetUrl = `${services.notification}${req.originalUrl}`;

    // Preparar headers
    const forwardHeaders = {
      'Content-Type': req.headers['content-type'] || 'application/json',
      'User-Agent': 'API-Gateway-Notification-Forward',
    };

    // Forward auth headers
    if (req.headers.authorization) {
      forwardHeaders['Authorization'] = req.headers.authorization;
    }

    // Forward user info
    if (req.user) {
      forwardHeaders['X-User-Id'] = req.user.id.toString();
      forwardHeaders['X-User-Role'] = req.user.role;
      forwardHeaders['X-User-Email'] = req.user.email || '';
    }

    // Configuración de axios
    const axiosConfig = {
      method: req.method.toLowerCase(),
      url: targetUrl,
      headers: forwardHeaders,
      timeout: 30000,
      ...(Object.keys(req.query).length > 0 && { params: req.query }),
      ...(req.body &&
        ['post', 'put', 'patch'].includes(req.method.toLowerCase()) && {
          data: req.body,
        }),
    };

    logger.info('📤 Forwarding notification request', {
      method: axiosConfig.method,
      url: axiosConfig.url,
      hasData: !!axiosConfig.data,
    });

    // Realizar la request
    const startTime = Date.now();
    const response = await axios(axiosConfig);
    const duration = Date.now() - startTime;

    logger.info('✅ Notification service response received', {
      status: response.status,
      duration: `${duration}ms`,
    });

    // Enviar respuesta
    res.status(response.status).json(response.data);
  } catch (error) {
    logger.error('❌ Notification service forwarding failed', {
      error: error.message,
      status: error.response?.status,
      method: req.method,
      path: req.path,
    });

    if (error.response) {
      return res.status(error.response.status).json(error.response.data);
    }

    res.status(500).json({
      success: false,
      message: 'Internal server error while forwarding to notification service',
      timestamp: new Date().toISOString(),
    });
  }
});

// Add public endpoint for notification webhooks (no auth)
app.use('/api/events', async (req, res) => {
  try {
    const axios = require('axios');

    logger.info('📨 Forwarding event to notification service', {
      eventType: req.body.eventType,
      source: 'api-gateway',
    });

    const response = await axios.post(
      `${services.notification}/api/events`,
      req.body,
      {
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'API-Gateway-Event-Forward',
        },
        timeout: 10000,
      }
    );

    res.status(response.status).json(response.data);
  } catch (error) {
    logger.error('❌ Event forwarding failed', {
      error: error.message,
      eventType: req.body?.eventType,
    });

    if (error.response) {
      return res.status(error.response.status).json(error.response.data);
    }

    res.status(500).json({
      success: false,
      message: 'Failed to forward event',
      timestamp: new Date().toISOString(),
    });
  }
});

// Test direct proxy
app.post('/api/test/order-direct', authMiddleware, async (req, res) => {
  try {
    const axios = require('axios');

    logger.info('🧪 DIRECT AXIOS TEST TO ORDER SERVICE', {
      target: services.order,
      body: req.body,
      user: req.user,
    });

    const response = await axios.post(
      `${services.order}/api/orders`,
      req.body,
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: req.headers.authorization,
          'X-User-Id': req.user?.id?.toString(),
          'X-User-Role': req.user?.role,
          'User-Agent': 'API-Gateway-Direct-Test',
        },
        timeout: 30000,
      }
    );

    logger.info('✅ DIRECT AXIOS SUCCESS', {
      status: response.status,
      data: response.data,
    });

    res.json({
      success: true,
      message: 'Direct axios call successful',
      data: response.data,
      method: 'direct-axios',
    });
  } catch (error) {
    logger.error('❌ DIRECT AXIOS FAILED', {
      error: error.message,
      status: error.response?.status,
      data: error.response?.data,
    });

    res.status(500).json({
      success: false,
      message: 'Direct axios call failed',
      error: error.message,
      method: 'direct-axios',
    });
  }
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
    path: req.originalUrl,
    availableRoutes: [
      'GET /health',
      'GET /health/services',
      'GET /api/test/connectivity',
      'GET /api/docs',
      'POST /api/auth/register',
      'POST /api/auth/login',
      'GET /api/products',
      'POST /api/orders',
    ],
  });
});

// Error handling
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`🚪 API Gateway running on port ${PORT}`);
  console.log(`📚 API Documentation: http://localhost:${PORT}/api/docs`);
  console.log(`🏥 Health Check: http://localhost:${PORT}/health`);
  console.log(
    `🔧 Connectivity Test: http://localhost:${PORT}/api/test/connectivity`
  );
  logger.info(`API Gateway running on port ${PORT}`);
});
