import { Router } from "express";
import { register, login } from "../controllers/authController";
import {
  registerValidator,
  loginValidator,
} from "../validators/auth.validator";
import { validate } from "../middlewares/validate.middleware";

const router = Router();

router.post("/register", registerValidator, validate, register);
router.post("/login", loginValidator, validate, login);

export default router;
