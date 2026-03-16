import { Router } from "express";
import { authenticate } from "../middlewares/authMiddleware";
import {
  createOrder,
  changeOrderStatus,
  listOrders,
  getMyOrders,
} from "../controllers/order.controller";

const router = Router();

router.post("/", authenticate, createOrder);
router.get("/", authenticate, listOrders);
router.get("/my-orders", authenticate, getMyOrders);
router.patch("/:id/status", authenticate, changeOrderStatus);

export default router;
