import express from "express";
import dotenv from "dotenv";
import morgan from "morgan";
import rateLimit from "express-rate-limit";

import { pool } from "./config/db";
import authRoutes from "./routes/authRoutes";
import productRoutes from "./routes/product.routes";
import orderRoutes from "./routes/order.routes";
import { authenticate } from "./middlewares/authMiddleware";
import { errorHandler } from "./middlewares/error.middleware";

dotenv.config();

const app = express();

app.use(express.json());
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

app.get("/", (req, res) => {
  res.send("API is Running");
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

/* global error handler */
app.use(errorHandler);

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

const PORT = process.env.PORT || 4243;

app.listen(PORT, () => {
  console.log(`Server running on ${PORT}`);
});
