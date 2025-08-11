const axios = require('axios');
const { z } = require('zod');
const { logger } = require('../utils/logger');

// Mock database (luego esto será una DB real)
let products = [
  {
    id: '1',
    name: 'iPhone 15 Pro',
    description: 'Latest Apple smartphone with A17 Pro chip',
    price: 999.99,
    stock: 50,
    category: 'Electronics',
    images: ['https://example.com/iphone15.jpg'],
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: '2',
    name: 'Nike Air Max 90',
    description: 'Classic sneakers with Air cushioning',
    price: 129.99,
    stock: 25,
    category: 'Footwear',
    images: ['https://example.com/airmax90.jpg'],
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

// Validation schemas
const createProductSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  price: z.number().positive(),
  stock: z.number().int().min(0),
  category: z.string().min(1),
  images: z.array(z.string().url()).optional().default([]),
});

const updateProductSchema = createProductSchema.partial();

// Verify JWT token by calling auth service
const verifyToken = async (token) => {
  try {
    const response = await axios.get(
      `${
        process.env.AUTH_SERVICE_URL || 'http://auth-service:3000'
      }/api/auth/profile`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    return response.data.data.user;
  } catch (error) {
    throw new Error('Invalid token');
  }
};

// Get all products
exports.getAllProducts = async (req, res) => {
  try {
    const {
      category,
      search,
      page = 1,
      limit = 10,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = req.query;

    let filteredProducts = products.filter((p) => p.isActive);

    // Filter by category
    if (category) {
      filteredProducts = filteredProducts.filter((p) =>
        p.category.toLowerCase().includes(category.toLowerCase())
      );
    }

    // Search by name or description
    if (search) {
      filteredProducts = filteredProducts.filter(
        (p) =>
          p.name.toLowerCase().includes(search.toLowerCase()) ||
          (p.description &&
            p.description.toLowerCase().includes(search.toLowerCase()))
      );
    }

    // Sort
    filteredProducts.sort((a, b) => {
      if (sortOrder === 'asc') {
        return a[sortBy] > b[sortBy] ? 1 : -1;
      }
      return a[sortBy] < b[sortBy] ? 1 : -1;
    });

    // Pagination
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + parseInt(limit);
    const paginatedProducts = filteredProducts.slice(startIndex, endIndex);

    res.json({
      success: true,
      data: {
        products: paginatedProducts,
        pagination: {
          total: filteredProducts.length,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(filteredProducts.length / limit),
        },
      },
    });
  } catch (error) {
    logger.error('Get products error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// Get product by ID
exports.getProductById = async (req, res) => {
  try {
    const { id } = req.params;

    const product = products.find((p) => p.id === id && p.isActive);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found',
      });
    }

    res.json({
      success: true,
      data: { product },
    });
  } catch (error) {
    logger.error('Get product error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// Create product (Admin only)
exports.createProduct = async (req, res) => {
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
    const user = await verifyToken(token);

    // Check if user is admin
    if (user.role !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required',
      });
    }

    // Validate input
    const validatedData = createProductSchema.parse(req.body);

    // Create new product
    const newProduct = {
      id: (products.length + 1).toString(),
      ...validatedData,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    products.push(newProduct);

    logger.info(`Product created: ${newProduct.name} by ${user.email}`);

    res.status(201).json({
      success: true,
      message: 'Product created successfully',
      data: { product: newProduct },
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

    logger.error('Create product error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// Update product (Admin only)
exports.updateProduct = async (req, res) => {
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
    const user = await verifyToken(token);

    // Check if user is admin
    if (user.role !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required',
      });
    }

    // Find product
    const productIndex = products.findIndex((p) => p.id === id);

    if (productIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Product not found',
      });
    }

    // Validate input
    const validatedData = updateProductSchema.parse(req.body);

    // Update product
    products[productIndex] = {
      ...products[productIndex],
      ...validatedData,
      updatedAt: new Date().toISOString(),
    };

    logger.info(
      `Product updated: ${products[productIndex].name} by ${user.email}`
    );

    res.json({
      success: true,
      message: 'Product updated successfully',
      data: { product: products[productIndex] },
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

    logger.error('Update product error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// Delete product (Admin only)
exports.deleteProduct = async (req, res) => {
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
    const user = await verifyToken(token);

    // Check if user is admin
    if (user.role !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required',
      });
    }

    // Find product
    const productIndex = products.findIndex((p) => p.id === id);

    if (productIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Product not found',
      });
    }

    // Soft delete
    products[productIndex].isActive = false;
    products[productIndex].updatedAt = new Date().toISOString();

    logger.info(
      `Product deleted: ${products[productIndex].name} by ${user.email}`
    );

    res.json({
      success: true,
      message: 'Product deleted successfully',
    });
  } catch (error) {
    if (error.message === 'Invalid token') {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired token',
      });
    }

    logger.error('Delete product error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};
