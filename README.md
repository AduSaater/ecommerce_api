# E-Commerce REST API

A scalable, production-grade E-Commerce Backend REST API built with [NestJS](https://nestjs.com/), [Prisma ORM](https://www.prisma.io/), [PostgreSQL (Neon)](https://neon.tech/), and documented with [Swagger UI](https://swagger.io/).

---

## 🌟 Features

- **Authentication & Security**
  - Registration, verification, login, and refresh token rotation with bcrypt password hashing
  - **Account Verification Enforcement**: Users must verify their email with a 6-digit code before being allowed to log in
  - Account recovery: Forgot password and reset password via 6-digit code, and authenticated change password
  - JWT strategy with passport (`access token: 15m`, `refresh token: 7d`)
  - Role-Based Access Control (RBAC): `USER` and `ADMIN`
  - Current user and role extraction decorators (`@CurrentUser()`, `@Roles()`)
- **Product & Category Catalog**
  - Category management with automated URL slug generation
  - Product catalog with pagination, full-text search, price filtering, and stock filtering
  - Admin-only product creation, modification, and inventory management
- **Shopping Cart**
  - Add to cart with real-time stock validation
  - Adjust quantity, delete item, or clear cart
  - Subtotal and total calculation
- **Order Lifecycle & Checkout**
  - Atomic cart-to-order checkout via database transactions (`$transaction`)
  - Automatic inventory stock deduction upon checkout
  - Order status tracking: `PENDING`, `PROCESSING`, `SHIPPED`, `DELIVERED`, `CANCELLED`
  - Safe cancellation with automatic stock restoration
- **Payment Processing (Paystack Integration)**
  - Initialize checkout transaction with Paystack (`/initialize`) returning authorization URL and transaction reference
  - Verify transaction status (`/verify/:reference`) directly with Paystack API
  - Secure Paystack webhook listener (`/webhook`) with HMAC-SHA512 signature validation
  - Admin-initiated refund workflow with automated inventory restocking
- **API Documentation**
  - Interactive **Swagger UI** available out-of-the-box with JWT Bearer Auth testing

---

## 📖 Swagger UI Documentation

When running the application, access the interactive Swagger documentation at:

```
http://localhost:3001/docs
```

To test authenticated endpoints in Swagger UI:
1. Call `POST /api/v1/auth/register` or `POST /api/v1/auth/login`.
2. Copy the returned `accessToken`.
3. Click the **Authorize** button (top right of Swagger UI).
4. Enter your token into the `JWT-auth` field and click **Authorize**.

## 🚀 Deploying to Render

Create a Render **Web Service** from the repository and configure:

- **Build command:** `npm ci && npm run build`
- **Start command:** `npm start`

Set the required environment variables in Render's service settings (`DATABASE_URL`,
`JWT_SECRET`, `REFRESH_TOKEN_SECRET`, `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`,
`CLOUDINARY_API_SECRET`, and `PAYSTACK_SECRET_KEY`). Render supplies `PORT`
automatically. The build command generates the Prisma Client before compiling the
application.

---

## 🚀 Getting Started

### 1. Environment Variables

Create or configure your `.env` file:

```env
PORT=3001
NODE_ENV=development
DATABASE_URL="postgresql://user:password@host/dbname?sslmode=require"
JWT_SECRET="your-jwt-secret-key"
REFRESH_TOKEN_SECRET="your-refresh-token-secret-key"
CLOUDINARY_CLOUD_NAME="your-cloud-name"
CLOUDINARY_API_KEY="your-api-key"
CLOUDINARY_API_SECRET="your-api-secret"
PAYSTACK_SECRET_KEY="sk_test_your_paystack_secret_key"
PAYSTACK_CURRENCY="NGN"
```

### 2. Generate Prisma Client

```bash
NODE_OPTIONS="--experimental-require-module" npx prisma generate
```

### 3. Build & Run

```bash
# Build the TypeScript project
npm run build

# Start the server
npm start

# Or start in watch mode
npm run start:dev
```

The API will be available at: `http://localhost:3001/api/v1`  
Swagger UI will be available at: `http://localhost:3001/docs`

---

## 📡 API Endpoints Overview

### Health
- `GET /api/v1` - Service health status

### Authentication
- `POST /api/v1/auth/register` - Create an account, retrieve tokens, and receive verification code
- `POST /api/v1/auth/login` - Authenticate with email and password
- `POST /api/v1/auth/verify-account` - Verify email using the 6-digit verification code
- `POST /api/v1/auth/resend-verification` - Resend a new verification code
- `POST /api/v1/auth/forgot-password` - Request a password reset code
- `POST /api/v1/auth/reset-password` - Reset password using the verification code
- `POST /api/v1/auth/change-password` - Update password for logged-in user (Protected)
- `POST /api/v1/auth/refresh` - Refresh access token using refresh token
- `POST /api/v1/auth/logout` - Invalidate refresh token (Protected)
- `GET /api/v1/auth/me` - Get authenticated user profile (Protected)

### Users
- `GET /api/v1/users/profile` - Get user profile
- `PATCH /api/v1/users/profile` - Update user profile
- `GET /api/v1/users` - List all users with pagination (Admin only)
- `GET /api/v1/users/:id` - Get user by ID (Admin only)
- `PATCH /api/v1/users/:id/role` - Update user role (Admin only)

### Categories
- `GET /api/v1/categories` - List categories
- `GET /api/v1/categories/:id` - Get category by ID
- `GET /api/v1/categories/slug/:slug` - Get category by slug
- `POST /api/v1/categories` - Create new category (Admin only)
- `PATCH /api/v1/categories/:id` - Update category (Admin only)
- `DELETE /api/v1/categories/:id` - Delete category (Admin only)

### Products
- `GET /api/v1/products` - List products (supports `page`, `limit`, `search`, `categoryId`, `minPrice`, `maxPrice`, `inStock`, `sortBy`)
- `GET /api/v1/products/:id` - Get product by ID
- `GET /api/v1/products/sku/:sku` - Get product by SKU
- `POST /api/v1/products` - Create product (Admin only)
- `PATCH /api/v1/products/:id` - Update product (Admin only)
- `DELETE /api/v1/products/:id` - Delete product (Admin only)

### Cart
- `GET /api/v1/cart` - View current user cart with totals
- `POST /api/v1/cart/items` - Add item to cart
- `PATCH /api/v1/cart/items/:itemId` - Update item quantity
- `DELETE /api/v1/cart/items/:itemId` - Remove item from cart
- `DELETE /api/v1/cart` - Empty shopping cart

### Orders
- `POST /api/v1/orders/checkout` - Convert cart to order and reserve inventory
- `GET /api/v1/orders` - View user orders (or all orders for Admin)
- `GET /api/v1/orders/:id` - View order details
- `PATCH /api/v1/orders/:id/status` - Update order status (Admin only)
- `POST /api/v1/orders/:id/cancel` - Cancel pending order (Restores stock)

### Payments (Paystack)
- `POST /api/v1/payments/initialize` - Initialize Paystack checkout session for an order (returns authorization URL & reference)
- `GET /api/v1/payments/verify/:reference` - Verify transaction status with Paystack and complete payment
- `POST /api/v1/payments/webhook` - Webhook receiver for Paystack events (validates HMAC signature)
- `GET /api/v1/payments/order/:orderId` - View payment status for an order
- `GET /api/v1/payments` - List all payments (Admin only)
- `POST /api/v1/payments/:id/refund` - Refund payment & cancel order (Admin only)

### Uploads (Cloudinary)
- `POST /api/v1/upload/image` - Upload general image to Cloudinary (Protected)
- `POST /api/v1/upload/product/:productId` - Upload and link image directly to product (Admin only)
- `POST /api/v1/upload/category/:categoryId` - Upload and link image directly to category (Admin only)
