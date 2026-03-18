# Order Management API

<div align="center">

![Node.js](https://img.shields.io/badge/Node.js-18.x-339933?style=flat-square&logo=node.js&logoColor=white)
![Express](https://img.shields.io/badge/Express-4.x-000000?style=flat-square&logo=express&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?style=flat-square&logo=typescript&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-4169E1?style=flat-square&logo=postgresql&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-Containerized-2496ED?style=flat-square&logo=docker&logoColor=white)
![JWT](https://img.shields.io/badge/Auth-JWT-000000?style=flat-square&logo=jsonwebtokens&logoColor=white)
![Render](https://img.shields.io/badge/Deployed-Render-46E3B7?style=flat-square&logo=render&logoColor=white)

**A production-style backend API for a multi-vendor order management system.**  
Buyers browse and order products. Sellers manage inventory and fulfil orders.  
Built with a focus on transactional integrity, concurrency safety, and scalable query design.

[Live API](https://order-management-api-ruqo.onrender.com) · [Docker Hub](https://hub.docker.com/r/itstirthpatel02/order-management-api) · [GitHub](https://github.com/TirthWillLearn/Order-Management-API)

</div>

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Docker](#docker)
- [Environment Variables](#environment-variables)
- [API Reference](#api-reference)
- [Key Engineering Decisions](#key-engineering-decisions)
- [Concurrency Handling](#concurrency-handling)
- [Security](#security)
- [Deployment](#deployment)
- [Author](#author)

---

## Overview

This API simulates the backend of a multi-vendor marketplace. It handles product listings, order placement, stock management, and order lifecycle tracking across two user roles — buyers and sellers.

The core engineering challenge: **two buyers attempting to purchase the last available unit simultaneously**. This is solved using PostgreSQL transactions combined with row-level locking (`SELECT FOR UPDATE`), ensuring only one order succeeds and stock never goes negative.

---

## Features

### Authentication & Access Control

- JWT-based authentication (register, login, protected routes)
- Role-based access control — `buyer` and `seller` roles enforced via middleware
- Passwords hashed using bcrypt

### Product Management

- Sellers can create and manage their own products
- Stock tracked per product and updated atomically on every order

### Order Management

- Buyers place orders containing multiple items in a single request
- Atomic order processing — inserts to `orders`, `order_items`, and stock updates happen inside a single transaction
- Order lifecycle: `pending → confirmed → shipped → delivered` or `cancelled`
- Role-enforced status transitions — sellers confirm and ship, buyers cancel (only when pending)

### Query Design

- JOINs used throughout to avoid N+1 query problems
- Dynamic SQL with pagination (`LIMIT` / `OFFSET`), filtering, and sorting
- Database indexes on foreign keys and frequently filtered columns

### Reliability & Architecture

- Layered architecture: Routes → Controllers → Services → Database
- Global error handler using custom `AppError` class
- `asyncHandler` wrapper eliminates repetitive try/catch in controllers
- Request validation with `express-validator`
- Rate limiting (100 requests per 15 minutes)
- Morgan request logging with environment-based format

---

## Tech Stack

| Layer            | Technology        |
| ---------------- | ----------------- |
| Runtime          | Node.js 18        |
| Framework        | Express.js        |
| Language         | TypeScript        |
| Database         | PostgreSQL 15     |
| Authentication   | JWT + bcrypt      |
| Validation       | express-validator |
| Logging          | Morgan            |
| Containerization | Docker            |
| Cloud Database   | AWS RDS           |
| Hosting          | Render            |

---

## Project Structure

```
src/
├── app.ts                  # App entry point, middleware registration
├── config/
│   └── db.ts               # PostgreSQL connection pool
├── controllers/
│   ├── auth.controller.ts
│   ├── product.controller.ts
│   └── order.controller.ts
├── services/
│   ├── auth.service.ts
│   ├── product.service.ts
│   └── order.service.ts    # Core transaction logic lives here
├── routes/
│   ├── auth.routes.ts
│   ├── product.routes.ts
│   └── order.routes.ts
├── middlewares/
│   ├── auth.middleware.ts   # JWT verification
│   ├── role.middleware.ts   # Buyer/seller access control
│   ├── validate.middleware.ts
│   └── error.middleware.ts  # Global error handler
└── utils/
    ├── AppError.ts          # Custom error class with status codes
    └── asyncHandler.ts      # Wraps async controllers
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL 15+
- npm

### 1. Clone the repository

```bash
git clone https://github.com/TirthWillLearn/Order-Management-API.git
cd Order-Management-API
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

```bash
cp .env.example .env
```

Fill in your database credentials and JWT secret (see [Environment Variables](#environment-variables)).

### 4. Create database tables

Run the following SQL against your PostgreSQL database:

```sql
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('buyer', 'seller')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE products (
    id SERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    description TEXT,
    price NUMERIC(10,2) NOT NULL,
    stock INT NOT NULL,
    seller_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE orders (
    id SERIAL PRIMARY KEY,
    buyer_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    total_amount NUMERIC(12,2) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE order_items (
    id SERIAL PRIMARY KEY,
    order_id INT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id INT NOT NULL REFERENCES products(id),
    quantity INT NOT NULL,
    price_at_time NUMERIC(10,2) NOT NULL
);

-- Indexes
CREATE INDEX idx_products_seller   ON products(seller_id);
CREATE INDEX idx_orders_buyer      ON orders(buyer_id);
CREATE INDEX idx_orders_status     ON orders(status);
CREATE INDEX idx_order_items_order ON order_items(order_id);
CREATE INDEX idx_order_items_product ON order_items(product_id);
```

### 5. Start the development server

```bash
npm run dev
```

Server runs at `http://localhost:10000`

---

## Docker

### Build and run locally

```bash
docker build -t order-api .
docker run --env-file .env -p 10000:10000 order-api
```

### Pull from Docker Hub

```bash
docker pull itstirthpatel02/order-management-api
docker run --env-file .env -p 10000:10000 itstirthpatel02/order-management-api
```

---

## Environment Variables

```ini
PORT=10000

DB_HOST=your_db_host
DB_PORT=5432
DB_USER=your_db_user
DB_PASSWORD=your_db_password
DB_NAME=order_management

JWT_SECRET=your_jwt_secret
NODE_ENV=development
```

> Never commit your `.env` file. Use `.env.example` as a reference template.

---

## API Reference

### Authentication

| Method | Endpoint         | Access | Description                 |
| ------ | ---------------- | ------ | --------------------------- |
| POST   | `/auth/register` | Public | Register as buyer or seller |
| POST   | `/auth/login`    | Public | Login and receive JWT       |

### Products

| Method | Endpoint    | Access      | Description                            |
| ------ | ----------- | ----------- | -------------------------------------- |
| GET    | `/products` | Public      | List products (pagination + filtering) |
| POST   | `/products` | Seller only | Create a new product                   |

### Orders

| Method | Endpoint             | Access     | Description                    |
| ------ | -------------------- | ---------- | ------------------------------ |
| POST   | `/orders`            | Buyer only | Place an order (transactional) |
| GET    | `/orders`            | Auth       | List orders                    |
| GET    | `/orders/:id`        | Auth       | Get order with items           |
| PATCH  | `/orders/:id/status` | Auth       | Update order status            |

---

### Example: Register

**POST** `/auth/register`

```json
{
  "name": "Tirth Patel",
  "email": "tirth@example.com",
  "password": "securepass",
  "role": "buyer"
}
```

```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "Tirth Patel",
    "email": "tirth@example.com",
    "role": "buyer"
  }
}
```

---

### Example: Place Order

**POST** `/orders` — `Authorization: Bearer <token>`

```json
{
  "items": [
    { "product_id": 1, "quantity": 2 },
    { "product_id": 3, "quantity": 1 }
  ]
}
```

```json
{
  "success": true,
  "message": "Order created successfully",
  "data": { "orderId": 101 }
}
```

---

### Example: Get Orders with Filters

**GET** `/orders?status=pending&page=1&limit=10` — `Authorization: Bearer <token>`

```json
{
  "success": true,
  "data": [
    {
      "id": 101,
      "status": "pending",
      "total_amount": "120000.00",
      "buyer_name": "Tirth Patel",
      "created_at": "2026-03-10T08:00:00.000Z"
    }
  ]
}
```

---

## Key Engineering Decisions

**Why SQL transactions for order creation?**  
Order creation touches three tables — `orders`, `order_items`, and `products` (stock update). If any step fails, all changes must be rolled back. Without a transaction, a partial failure would leave the database in an inconsistent state.

**Why `SELECT FOR UPDATE`?**  
When checking product stock before placing an order, there is a window between the read and the write where another concurrent transaction can read the same stock value and both proceed. `SELECT FOR UPDATE` locks the row at read time, forcing concurrent transactions to wait until the first completes.

**Why store `price_at_time` in `order_items`?**  
Product prices change over time. If order history referenced the current product price, all historical orders would show incorrect values after a price update. Storing the price at the moment of purchase preserves accurate records.

**Why separate `orders` and `order_items` tables?**  
A single order can contain multiple products. Storing multiple product references in one row violates first normal form and makes querying and aggregation significantly harder. Splitting into two tables correctly models the one-to-many relationship.

---

## Concurrency Handling

Consider two buyers simultaneously attempting to purchase the last unit of a product:

**Without locking:**

1. Buyer A reads `stock = 1` — proceeds
2. Buyer B reads `stock = 1` — proceeds
3. Both orders succeed — `stock = -1` ❌

**With `SELECT FOR UPDATE`:**

1. Buyer A acquires row lock, reads `stock = 1` — proceeds
2. Buyer B waits for the lock to be released
3. Buyer A commits — `stock = 0`
4. Buyer B acquires lock, reads `stock = 0` — order rejected with correct error ✅

---

## Security

- Passwords hashed with **bcrypt** (salt rounds: 10)
- JWT tokens expire after **24 hours**
- Role enforcement on every protected route via middleware
- Global rate limiting — 100 requests per 15 minutes per IP
- Sensitive credentials managed via environment variables only
- HTTP security headers via **Helmet**
- `.env` excluded from version control

---

## Deployment

| Resource           | Platform                                                                                 |
| ------------------ | ---------------------------------------------------------------------------------------- |
| API Server         | Render                                                                                   |
| Database           | AWS RDS (PostgreSQL)                                                                     |
| Container Registry | Docker Hub                                                                               |
| Live URL           | [order-management-api-ruqo.onrender.com](https://order-management-api-ruqo.onrender.com) |

---

## Author

**Tirth Patel** — Backend Developer

[![GitHub](https://img.shields.io/badge/GitHub-TirthWillLearn-181717?style=flat-square&logo=github)](https://github.com/TirthWillLearn)
[![LinkedIn](https://img.shields.io/badge/LinkedIn-tirth--k--patel-0A66C2?style=flat-square&logo=linkedin)](https://www.linkedin.com/in/tirth-k-patel/)
[![Portfolio](https://img.shields.io/badge/Portfolio-tirthdev.in-111111?style=flat-square&logo=firefox)](https://tirthdev.in)
