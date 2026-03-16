import { Router } from "express";
import {
  createProduct,
  getProducts,
  sellerDashboard,
} from "../controllers/product.controller";
import { authenticate } from "../middlewares/authMiddleware";
import { requireSeller } from "../middlewares/role.middleware";

const router = Router();

router.post("/", authenticate, requireSeller, createProduct);
router.get("/", getProducts);
router.get("/dashboard", authenticate, requireSeller, sellerDashboard);

export default router;
