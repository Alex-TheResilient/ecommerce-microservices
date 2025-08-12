const { v4: uuidv4 } = require('uuid');
const { z } = require('zod');
const { logger } = require('../utils/logger');
const { AuthService } = require('../services/authService');
const { ProductService } = require('../services/productService');
const {
  notifyOrderCreated,
  notifyOrderConfirmed,
  notifyOrderShipped,
  notifyOrderCancelled,
} = require('../services/notificationService');

// Mock database
let orders = [];

// Validation schemas
const createOrderSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.string(),
        quantity: z.number().int().positive(),
      })
    )
    .min(1),
});

const updateOrderStatusSchema = z.object({
  status: z.enum(['PENDING', 'CONFIRMED', 'SHIPPED', 'DELIVERED', 'CANCELLED']),
});

// Get user orders
exports.getUserOrders = async (req, res) => {
  try {
    // Verify authentication
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({
        success: false,
        message: 'Access token required',
      });
    }

    const token = authHeader.split(' ')[1];
    const user = await AuthService.verifyToken(token);

    // Get user orders
    const userOrders = orders.filter((order) => order.userId === user.id);

    // Sort by creation date (newest first)
    userOrders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json({
      success: true,
      data: { orders: userOrders },
    });
  } catch (error) {
    if (error.message === 'Invalid token') {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired token',
      });
    }

    logger.error('Get user orders error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// Get order by ID
exports.getOrderById = async (req, res) => {
  try {
    const { id } = req.params;

    // Verify authentication
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({
        success: false,
        message: 'Access token required',
      });
    }

    const token = authHeader.split(' ')[1];
    const user = await AuthService.verifyToken(token);

    // Find order
    const order = orders.find((o) => o.id === id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found',
      });
    }

    // Check if user owns the order or is admin
    if (order.userId !== user.id && user.role !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        message: 'Access denied',
      });
    }

    res.json({
      success: true,
      data: { order },
    });
  } catch (error) {
    if (error.message === 'Invalid token') {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired token',
      });
    }

    logger.error('Get order error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// Create order
exports.createOrder = async (req, res) => {
  try {
    // Verify authentication
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({
        success: false,
        message: 'Access token required',
      });
    }

    const token = authHeader.split(' ')[1];
    const user = await AuthService.verifyToken(token);

    // Validate input
    const validatedData = createOrderSchema.parse(req.body);

    // Verify products exist and calculate total
    let total = 0;
    const orderItems = [];

    for (const item of validatedData.items) {
      const product = await ProductService.getProductById(item.productId);

      if (!product) {
        return res.status(400).json({
          success: false,
          message: `Product with ID ${item.productId} not found`,
        });
      }

      if (product.stock < item.quantity) {
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for product ${product.name}. Available: ${product.stock}, Requested: ${item.quantity}`,
        });
      }

      const itemTotal = product.price * item.quantity;
      total += itemTotal;

      orderItems.push({
        productId: item.productId,
        productName: product.name,
        quantity: item.quantity,
        price: product.price,
        total: itemTotal,
      });
    }

    // Create order
    const newOrder = {
      id: uuidv4(),
      userId: user.id,
      userEmail: user.email,
      items: orderItems,
      total: total,
      status: 'PENDING',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    orders.push(newOrder);

    logger.info(
      `Order created: ${newOrder.id} by ${user.email}, total: $${total}`
    );

    try {
      await notifyOrderCreated(newOrder, user);
      logger.info('Order creation notification sent successfully', {
        orderId: newOrder.id,
        userId: user.id,
      });
    } catch (notificationError) {
      // Log error but don't fail the order creation
      logger.warn('Failed to send order creation notification', {
        orderId: newOrder.id,
        userId: user.id,
        error: notificationError.message,
      });
    }

    res.status(201).json({
      success: true,
      message: 'Order created successfully',
      data: { order: newOrder },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.errors,
      });
    }

    if (error.message === 'Invalid token') {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired token',
      });
    }

    logger.error('Create order error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// Update order status (Admin only)
exports.updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;

    // Verify authentication
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({
        success: false,
        message: 'Access token required',
      });
    }

    const token = authHeader.split(' ')[1];
    const user = await AuthService.verifyToken(token);

    // Check if user is admin
    if (user.role !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required',
      });
    }

    // Validate input
    const validatedData = updateOrderStatusSchema.parse(req.body);

    // Find order
    const orderIndex = orders.findIndex((o) => o.id === id);

    if (orderIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Order not found',
      });
    }

    const order = orders[orderIndex];
    const previousStatus = order.status;

    // Update order status
    orders[orderIndex].status = validatedData.status;
    orders[orderIndex].updatedAt = new Date().toISOString();

    const updatedOrder = orders[orderIndex];

    logger.info(
      `Order status updated: ${id} from ${previousStatus} to ${validatedData.status} by ${user.email}`
    );

    try {
      // Get the user who made the order for notifications
      const orderUser = {
        id: order.userId,
        email: order.userEmail,
        firstName: order.userEmail.split('@')[0], // Fallback if no firstName
      };

      switch (validatedData.status) {
        case 'CONFIRMED':
          await notifyOrderConfirmed(updatedOrder, orderUser);
          logger.info('Order confirmed notification sent', { orderId: id });
          break;

        case 'SHIPPED':
          await notifyOrderShipped(updatedOrder, orderUser);
          logger.info('Order shipped notification sent', { orderId: id });
          break;

        case 'CANCELLED':
          const reason = req.body.reason || 'Cancelled by admin';
          await notifyOrderCancelled(updatedOrder, orderUser, reason);
          logger.info('Order cancelled notification sent', { orderId: id });
          break;

        // For DELIVERED and other statuses, we could add more notifications
        default:
          logger.info('No specific notification for status', {
            orderId: id,
            status: validatedData.status,
          });
      }
    } catch (notificationError) {
      // Log error but don't fail the status update
      logger.warn('Failed to send order status notification', {
        orderId: id,
        status: validatedData.status,
        error: notificationError.message,
      });
    }

    res.json({
      success: true,
      message: 'Order status updated successfully',
      data: { order: updatedOrder },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.errors,
      });
    }

    if (error.message === 'Invalid token') {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired token',
      });
    }

    logger.error('Update order status error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// Get all orders (Admin only)
exports.getAllOrders = async (req, res) => {
  try {
    // Verify authentication
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({
        success: false,
        message: 'Access token required',
      });
    }

    const token = authHeader.split(' ')[1];
    const user = await AuthService.verifyToken(token);

    // Check if user is admin
    if (user.role !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required',
      });
    }

    const { status, page = 1, limit = 10 } = req.query;

    let filteredOrders = [...orders];

    // Filter by status
    if (status) {
      filteredOrders = filteredOrders.filter((o) => o.status === status);
    }

    // Sort by creation date (newest first)
    filteredOrders.sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );

    // Pagination
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + parseInt(limit);
    const paginatedOrders = filteredOrders.slice(startIndex, endIndex);

    res.json({
      success: true,
      data: {
        orders: paginatedOrders,
        pagination: {
          total: filteredOrders.length,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(filteredOrders.length / limit),
        },
      },
    });
  } catch (error) {
    if (error.message === 'Invalid token') {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired token',
      });
    }

    logger.error('Get all orders error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

exports.testNotifications = async (req, res) => {
  try {
    const {
      testNotificationService,
    } = require('../services/notificationService');
    const result = await testNotificationService();

    res.json({
      success: true,
      message: 'Notification service connectivity test from Order Service',
      data: result,
    });
  } catch (error) {
    logger.error('Test notifications error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};
