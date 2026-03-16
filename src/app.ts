import express from "express";
import dotenv from "dotenv";
import morgan from "morgan";
import { pool } from "./config/db";
import authRoutes from "./routes/authRoutes";
import productRoutes from "./routes/product.routes";
import orderRoutes from "./routes/order.routes";
import { authenticate } from "./middlewares/authMiddleware";
import { errorHandler } from "./middlewares/error.middleware";
import rateLimit from "express-rate-limit";

dotenv.config();

const app = express();

app.use(express.json());
app.use(morgan("dev"));

app.use((req, res) => {
  res.status(404).json({ message: "Route not found" });
});
app.use(errorHandler);

app.get("/", (req, res) => {
  res.send("API is Running");
});

app.use("/auth", authRoutes);
app.use("/products", productRoutes);
app.use("/orders", orderRoutes);

app.get("/protected", authenticate, (req, res) => {
  res.json({ message: "You accessed a protected route" });
});

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
});

app.use(limiter);

pool
  .connect()
  .then(() => console.log("PostgreSQL connected"))
  .catch((err: Error) => console.error("DB connection error", err));

const PORT = process.env.PORT || 4243;

app.listen(PORT, () => {
  console.log(`Server is running on ${PORT}`);
});
