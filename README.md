# 🚀 E-commerce Microservices Platform

> Enterprise-grade microservices architecture with event-driven notifications system

![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-5+-blue.svg)
![Docker](https://img.shields.io/badge/Docker-Containerized-blue.svg)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-blue.svg)
![Redis](https://img.shields.io/badge/Redis-7-red.svg)
![License](https://img.shields.io/badge/License-MIT-yellow.svg)

## 📋 Table of Contents

- [🏗️ Architecture Overview](#️-architecture-overview)
- [✨ Features](#-features)
- [🛠️ Tech Stack](#️-tech-stack)
- [🚀 Quick Start](#-quick-start)
- [📡 API Documentation](#-api-documentation)
- [🧪 Testing the System](#-testing-the-system)
- [📊 Monitoring](#-monitoring)
- [🔧 Development](#-development)

## 🏗️ Architecture Overview

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Client/App    │────│   API Gateway   │────│  Load Balancer  │
│   (Frontend)    │    │   (Port 3000)   │    │   (Future)      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                              │
                    ┌─────────┴─────────┐
                    │                   │
        ┌───────────▼─────────┐ ┌───────▼──────────┐
        │  Authentication     │ │   Notification   │
        │   Service (3001)    │ │   Service (3004) │
        └───────────┬─────────┘ └──────────────────┘
                    │                   │
        ┌───────────▼─────────┐ ┌───────▼──────────┐
        │   Product Service   │ │   Order Service  │
        │     (Port 3002)     │ │   (Port 3003)    │
        └─────────────────────┘ └──────────────────┘
                    │                   │
        ┌───────────▼─────────┐ ┌───────▼──────────┐
        │   PostgreSQL DB     │ │   Redis Cache    │
        │     (Port 5432)     │ │   (Port 6379)    │
        └─────────────────────┘ └──────────────────┘
```

### 🔄 Event-Driven Flow

```
User Registration → Auth Service → Event → Notification Service → Welcome Email + In-App
Order Creation   → Order Service → Event → Notification Service → Confirmation Email + In-App
Status Updates   → Order Service → Event → Notification Service → Update Notifications
```

## ✨ Features

### 🔐 Authentication & Authorization

- **JWT-based authentication** with refresh tokens
- **Role-based access control** (USER/ADMIN)
- **Secure password hashing** with bcrypt
- **Token validation middleware**

### 🛒 E-commerce Core

- **Product catalog** with categories and search
- **Shopping cart management**
- **Order processing** with inventory validation
- **Order status tracking** (PENDING → CONFIRMED → SHIPPED → DELIVERED)

### 🔔 Smart Notifications

- **Event-driven notifications** system
- **Email templates** with Handlebars
- **In-app notifications** with Redis storage
- **Queue-based processing** with retry logic
- **Multiple notification channels** (Email + In-App)

### 🏗️ Architecture Patterns

- **API Gateway** pattern for unified entry point
- **Microservices** architecture with Docker
- **Event-driven communication** between services
- **CQRS** for read/write separation
- **Circuit breaker** pattern (implemented in gateway)

### 🔧 DevOps & Infrastructure

- **Docker containerization** for all services
- **Docker Compose** orchestration
- **Health checks** and monitoring
- **Centralized logging** with Winston
- **Environment-based configuration**

## 🛠️ Tech Stack

### Backend Services

- **Node.js 22** - Runtime environment
- **Express.js** - Web application framework
- **Prisma** - Database ORM and migration tool
- **Zod** - Runtime type validation

### Databases & Cache

- **PostgreSQL 15** - Primary database for persistent data
- **Redis 7** - Cache and session storage + Queue management

### Notification System

- **Bull** - Job queue processing
- **Nodemailer** - Email service integration
- **Handlebars** - Email template engine

### Security & Validation

- **JWT** - JSON Web Tokens for authentication
- **bcryptjs** - Password hashing
- **Helmet** - Security headers
- **express-rate-limit** - Request rate limiting
- **CORS** - Cross-origin resource sharing

### Development & Deployment

- **Docker & Docker Compose** - Containerization
- **pnpm** - Package management
- **Winston** - Logging framework
- **Nodemon** - Development server

## 🚀 Quick Start

### Prerequisites

- **Docker** and **Docker Compose**
- **Node.js 18+** (for local development)
- **pnpm** (recommended) or npm

### 1. Clone the Repository

```bash
git clone https://github.com/Alex-TheResilient/ecommerce-microservices.git
cd ecommerce-microservices
```

### 2. Environment Setup

```bash
# Copy environment files
cp services/auth-service/.env.example services/auth-service/.env
cp services/product-service/.env.example services/product-service/.env
cp services/order-service/.env.example services/order-service/.env
cp services/notification-service/.env.example services/notification-service/.env
cp services/api-gateway/.env.example services/api-gateway/.env
```

### 3. Start the Platform

```bash
# Build and start all services
docker-compose up --build

# Or run in background
docker-compose up -d --build
```

### 4. Verify Installation

```bash
# Check all services are running
docker ps

# Test API Gateway
curl http://localhost:3000/health

# Test individual services
curl http://localhost:3001/health  # Auth Service
curl http://localhost:3002/health  # Product Service
curl http://localhost:3003/health  # Order Service
curl http://localhost:3004/health  # Notification Service
```

## 📡 API Documentation

### 🔗 Base URLs

- **API Gateway**: `http://localhost:3000` (Production entry point)
- **Auth Service**: `http://localhost:3001` (Direct access)
- **Product Service**: `http://localhost:3002` (Direct access)
- **Order Service**: `http://localhost:3003` (Direct access)
- **Notification Service**: `http://localhost:3004` (Direct access)

### 🔐 Authentication Endpoints

```bash
# Register a new user
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "password": "securepassword"
  }'

# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "securepassword"
  }'

# Get user profile (requires auth)
curl http://localhost:3000/api/auth/profile \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### 📦 Product Endpoints

```bash
# Get all products
curl http://localhost:3000/api/products

# Get product by ID
curl http://localhost:3000/api/products/1

# Search products
curl "http://localhost:3000/api/products?search=phone&category=electronics"
```

### 🛒 Order Endpoints

```bash
# Create an order (requires auth)
curl -X POST http://localhost:3000/api/orders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "items": [
      {
        "productId": "1",
        "quantity": 2
      }
    ]
  }'

# Get user orders
curl http://localhost:3000/api/orders \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Get order by ID
curl http://localhost:3000/api/orders/ORDER_ID \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### 🔔 Notification Endpoints

```bash
# Get user notifications
curl http://localhost:3000/api/notifications/user/USER_ID \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Mark notification as read
curl -X PUT http://localhost:3000/api/notifications/NOTIFICATION_ID/read \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"userId": "USER_ID"}'

# Send custom notification
curl -X POST http://localhost:3000/api/notifications/send \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "type": "IN_APP",
    "recipient": "USER_ID",
    "title": "Custom Notification",
    "message": "This is a custom message",
    "priority": "HIGH"
  }'
```

## 🧪 Testing the System

### End-to-End User Flow

```bash
# 1. Register a new user (triggers welcome email + in-app notification)
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "firstName": "Test",
    "lastName": "User",
    "password": "password123"
  }'

# 2. Login to get authentication token
TOKEN=$(curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }' | jq -r '.data.token')

# 3. Create an order (triggers confirmation email + in-app notification)
curl -X POST http://localhost:3000/api/orders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "items": [
      {
        "productId": "1",
        "quantity": 1
      }
    ]
  }'

# 4. Check notifications
USER_ID="GET_FROM_REGISTER_RESPONSE"
curl http://localhost:3000/api/notifications/user/$USER_ID \
  -H "Authorization: Bearer $TOKEN"
```

### Load Testing Example

```bash
# Install Apache Bench
sudo apt-get install apache2-utils

# Test API Gateway performance
ab -n 1000 -c 10 http://localhost:3000/health

# Test product service
ab -n 1000 -c 10 http://localhost:3000/api/products
```

## 📊 Monitoring

### Health Checks

```bash
# Overall system health
curl http://localhost:3000/health

# Individual service health
curl http://localhost:3000/health/services

# Notification service queue stats
curl http://localhost:3004/api/notifications/admin/queue/stats
```

### Service Information

```bash
# API Gateway info
curl http://localhost:3000/api/docs

# Notification service capabilities
curl http://localhost:3004/api/info

# Queue statistics
curl http://localhost:3004/api/notifications/admin/queue/stats
```

### Docker Service Status

```bash
# Check all containers
docker-compose ps

# View logs
docker-compose logs -f

# Check resource usage
docker stats
```

## 🔧 Development

### Project Structure

```
ecommerce-microservices/
├── services/
│   ├── api-gateway/           # API Gateway (Port 3000)
│   ├── auth-service/          # Authentication (Port 3001)
│   ├── product-service/       # Product Management (Port 3002)
│   ├── order-service/         # Order Processing (Port 3003)
│   └── notification-service/  # Notifications (Port 3004)
├── docker-compose.yml         # Service orchestration
└── README.md
```

### Local Development Setup

```bash
# Install dependencies for a specific service
cd services/auth-service
pnpm install

# Run service in development mode
pnpm run dev

# Run database migrations (for services using Prisma)
pnpm run db:migrate
```

### Adding New Services

1. Create service directory in `services/`
2. Add Dockerfile
3. Update `docker-compose.yml`
4. Add service URLs to API Gateway
5. Implement health checks

### Environment Variables

Each service uses the following pattern:

- `NODE_ENV` - Environment (development/production)
- `PORT` - Service port (3000 internal)
- `DATABASE_URL` - PostgreSQL connection
- `REDIS_URL` - Redis connection
- `JWT_SECRET` - Authentication secret

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Express.js** community for excellent documentation
- **Docker** for containerization platform
- **PostgreSQL** for reliable database system
- **Redis** for high-performance caching
- **Node.js** ecosystem for rich package availability

---
