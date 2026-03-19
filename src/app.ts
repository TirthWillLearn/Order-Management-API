import * as Sentry from "@sentry/node";
import express from "express";
import dotenv from "dotenv";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import { Request, Response } from "express";

import helmet from "helmet";
import { pool } from "./config/db";
import authRoutes from "./routes/authRoutes";
import productRoutes from "./routes/product.routes";
import orderRoutes from "./routes/order.routes";
import { authenticate } from "./middlewares/authMiddleware";
import { errorHandler } from "./middlewares/error.middleware";

dotenv.config();

const app = express();

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV || "development",
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
  integrations: [Sentry.expressIntegration()],
});

app.use(express.json());
app.use(helmet());
const isProduction = process.env.NODE_ENV === "production";

if (isProduction) {
  app.use(morgan("combined"));
} else {
  app.use(morgan("dev"));
}

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
});

app.use(limiter);

app.get("/", (req: Request, res: Response) => {
  res.json({
    service: "Order Management API",
    version: "1.0.0",
    status: "running",
    environment: process.env.NODE_ENV || "development",

    description:
      "Backend API for a multi-vendor order management system with authentication, product management, and order processing",

    server: {
      uptime: process.uptime(),
      timestamp: new Date(),
    },

    author: {
      name: "Tirth Patel",
      linkedin: "https://www.linkedin.com/in/tirth-k-patel",
      github: "https://github.com/TirthWillLearn",
    },

    auth: {
      register: {
        method: "POST",
        path: "/auth/register",
        description: "Register a new user (role: buyer or seller)",
      },
      login: {
        method: "POST",
        path: "/auth/login",
        description: "Login and receive JWT token",
      },
    },

    products: {
      list: {
        method: "GET",
        path: "/products",
        access: "Public",
        query: ["minPrice", "maxPrice", "sellerId", "page", "limit"],
      },
      create: {
        method: "POST",
        path: "/products",
        access: "Seller only",
      },
      update: {
        method: "PATCH",
        path: "/products/:id",
        access: "Seller only",
      },
    },

    orders: {
      create: {
        method: "POST",
        path: "/orders",
        access: "Authenticated buyer",
        description: "Create order with transaction and stock validation",
      },
      list: {
        method: "GET",
        path: "/orders",
        access: "Authenticated user",
        query: ["status", "page", "limit"],
      },
      details: {
        method: "GET",
        path: "/orders/:id",
        access: "Authenticated user",
      },
      updateStatus: {
        method: "PATCH",
        path: "/orders/:id/status",
        access: "Seller or buyer depending on action",
      },
    },

    meta: {
      health: "/health",
      repository: "https://github.com/TirthWillLearn/Order-Management-API",
      documentation: "See README.md on GitHub",
    },
  });
});

app.get("/protected", authenticate, (req, res) => {
  res.json({ message: "You accessed a protected route" });
});

app.use("/auth", authRoutes);
app.use("/products", productRoutes);
app.use("/orders", orderRoutes);

app.get("/health", async (req, res) => {
  try {
    // Check database connectivity
    await pool.query("SELECT 1");

    res.status(200).json({
      status: "ok",
      database: "connected",
    });
  } catch (error) {
    console.error("Health check DB error:", error);

    res.status(500).json({
      status: "error",
      database: "disconnected",
    });
  }
});

/* 404 handler */
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
  });
});

/* Sentry error handler — must be before global errorHandler */
Sentry.setupExpressErrorHandler(app);

/* global error handler */
app.use(errorHandler);

export default app;

if (require.main === module) {
  const PORT = process.env.PORT || 4243;
  app.listen(PORT, () => {
    console.log(`Server running on ${PORT}`);
  });
}
