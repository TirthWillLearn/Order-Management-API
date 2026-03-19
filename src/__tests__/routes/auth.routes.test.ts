// Mock DB and Sentry before anything else
jest.mock("../../config/db", () => ({ pool: { query: jest.fn() } }));
jest.mock("@sentry/node", () => ({
  init: jest.fn(),
  expressIntegration: jest.fn(() => ({})),
  setupExpressErrorHandler: jest.fn((_app: any) => {}),
  setUser: jest.fn(),
  captureException: jest.fn(),
}));

import request from "supertest";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { pool } from "../../config/db";
import app from "../../app";

const mockQuery = pool.query as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  process.env.JWT_SECRET = "test-secret";
});

// ─── POST /auth/register ──────────────────────────────────────────────────────

describe("POST /auth/register", () => {
  const validBody = {
    name: "Alice",
    email: "alice@example.com",
    password: "password123",
    role: "buyer",
  };

  it("returns 400 when name is missing", async () => {
    const res = await request(app)
      .post("/auth/register")
      .send({ ...validBody, name: "" });
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("errors");
  });

  it("returns 400 when email is invalid", async () => {
    const res = await request(app)
      .post("/auth/register")
      .send({ ...validBody, email: "not-an-email" });
    expect(res.status).toBe(400);
  });

  it("returns 400 when password is too short", async () => {
    const res = await request(app)
      .post("/auth/register")
      .send({ ...validBody, password: "123" });
    expect(res.status).toBe(400);
  });

  it("returns 400 when role is invalid", async () => {
    const res = await request(app)
      .post("/auth/register")
      .send({ ...validBody, role: "admin" });
    expect(res.status).toBe(400);
  });

  it("returns 400 when email already exists", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 1 }] }); // findUserByEmail → found
    const res = await request(app).post("/auth/register").send(validBody);
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/already exists/i);
  });

  it("returns 201 and user data on successful registration", async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [] }) // findUserByEmail → not found
      .mockResolvedValueOnce({             // createUser
        rows: [{ id: 2, name: "Alice", email: "alice@example.com", role: "buyer" }],
      });

    const res = await request(app).post("/auth/register").send(validBody);
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({ email: "alice@example.com", role: "buyer" });
  });
});

// ─── POST /auth/login ─────────────────────────────────────────────────────────

describe("POST /auth/login", () => {
  it("returns 400 when email is invalid", async () => {
    const res = await request(app)
      .post("/auth/login")
      .send({ email: "bad", password: "password123" });
    expect(res.status).toBe(400);
  });

  it("returns 400 when password is missing", async () => {
    const res = await request(app)
      .post("/auth/login")
      .send({ email: "alice@example.com", password: "" });
    expect(res.status).toBe(400);
  });

  it("returns 401 when user not found", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    const res = await request(app)
      .post("/auth/login")
      .send({ email: "nobody@example.com", password: "password123" });
    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/invalid credentials/i);
  });

  it("returns 401 when password does not match", async () => {
    const hashed = await bcrypt.hash("correct-password", 10);
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 1, email: "alice@example.com", password: hashed, role: "buyer" }],
    });

    const res = await request(app)
      .post("/auth/login")
      .send({ email: "alice@example.com", password: "wrong-password" });
    expect(res.status).toBe(401);
  });

  it("returns 200 and a JWT token on valid credentials", async () => {
    const hashed = await bcrypt.hash("password123", 10);
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 1, email: "alice@example.com", password: hashed, role: "buyer" }],
    });

    const res = await request(app)
      .post("/auth/login")
      .send({ email: "alice@example.com", password: "password123" });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty("token");

    const decoded: any = jwt.verify(res.body.data.token, "test-secret");
    expect(decoded.id).toBe(1);
    expect(decoded.role).toBe("buyer");
  });
});
