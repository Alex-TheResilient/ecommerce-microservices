const axios = require('axios');

class AuthService {
  static async verifyToken(token) {
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
  }
}

module.exports = { AuthService };
