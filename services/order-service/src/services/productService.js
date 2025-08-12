const axios = require('axios');

class ProductService {
  static async getProductById(productId) {
    try {
      const response = await axios.get(
        `${
          process.env.PRODUCT_SERVICE_URL || 'http://product-service:3000'
        }/api/products/${productId}`
      );
      return response.data.data.product;
    } catch (error) {
      if (error.response && error.response.status === 404) {
        return null;
      }
      throw error;
    }
  }
}

module.exports = { ProductService };
