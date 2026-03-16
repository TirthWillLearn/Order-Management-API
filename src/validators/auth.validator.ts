import { body } from "express-validator";

export const registerValidator = [
  body("name").trim().notEmpty().withMessage("Name is required"),

  body("email").trim().isEmail().withMessage("Valid email is required"),

  body("password")
    .isLength({ min: 6 })
    .withMessage("Password must be at least 6 characters"),

  body("role")
    .isIn(["buyer", "seller"])
    .withMessage("Role must be buyer or seller"),
];
export const loginValidator = [
  body("email").trim().isEmail().withMessage("Valid email is required"),

  body("password").notEmpty().withMessage("Password is required"),
];
