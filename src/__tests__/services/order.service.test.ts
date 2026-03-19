jest.mock("../../config/db", () => ({
  pool: {
    query: jest.fn(),
    connect: jest.fn(),
  },
}));

import { pool } from "../../config/db";
import {
  createOrderWithTransaction,
  updateOrderStatus,
  getOrders,
  getOrderDetails,
} from "../../services/order.service";
import { AppError } from "../../utils/AppError";

const mockPoolQuery = pool.query as jest.Mock;
const mockConnect = pool.connect as jest.Mock;

// Helper to build a mock DB client
const makeMockClient = (overrides: Partial<Record<string, jest.Mock>> = {}) => {
  const client = {
    query: jest.fn(),
    release: jest.fn(),
    ...overrides,
  };
  mockConnect.mockResolvedValue(client);
  return client;
};

beforeEach(() => jest.clearAllMocks());

// ─── createOrderWithTransaction ───────────────────────────────────────────────

describe("createOrderWithTransaction", () => {
  it("throws AppError for empty items array", async () => {
    await expect(createOrderWithTransaction(1, [])).rejects.toThrow(AppError);
  });

  it("throws AppError for quantity <= 0", async () => {
    const client = makeMockClient();
    client.query
      .mockResolvedValueOnce(undefined) // BEGIN
      .mockResolvedValueOnce({ rows: [{ price: 10, stock: 5 }] }); // SELECT product

    await expect(
      createOrderWithTransaction(1, [{ product_id: 1, quantity: 0 }]),
    ).rejects.toThrow("Quantity must be greater than 0");
  });

  it("throws AppError when product not found", async () => {
    const client = makeMockClient();
    client.query
      .mockResolvedValueOnce(undefined) // BEGIN
      .mockResolvedValueOnce({ rows: [] }); // SELECT product → not found

    await expect(
      createOrderWithTransaction(1, [{ product_id: 99, quantity: 1 }]),
    ).rejects.toThrow("Product not found");
  });

  it("throws AppError on insufficient stock", async () => {
    const client = makeMockClient();
    client.query
      .mockResolvedValueOnce(undefined) // BEGIN
      .mockResolvedValueOnce({ rows: [{ price: 10, stock: 1 }] }); // product with low stock

    await expect(
      createOrderWithTransaction(1, [{ product_id: 1, quantity: 5 }]),
    ).rejects.toThrow("Insufficient stock");
  });

  it("throws AppError for duplicate product_id in items", async () => {
    const client = makeMockClient();
    client.query
      .mockResolvedValueOnce(undefined) // BEGIN
      .mockResolvedValueOnce({ rows: [{ price: 10, stock: 20 }] }) // product 1 first occurrence
      .mockResolvedValueOnce(undefined); // rollback

    await expect(
      createOrderWithTransaction(1, [
        { product_id: 1, quantity: 1 },
        { product_id: 1, quantity: 2 },
      ]),
    ).rejects.toThrow("Duplicate product in order");
  });

  it("creates an order successfully and returns orderId", async () => {
    const client = makeMockClient();
    client.query
      .mockResolvedValueOnce(undefined) // BEGIN
      .mockResolvedValueOnce({ rows: [{ price: 20, stock: 10 }] }) // SELECT product
      .mockResolvedValueOnce({ rows: [{ id: 42 }] }) // INSERT order
      .mockResolvedValueOnce(undefined) // INSERT order_item
      .mockResolvedValueOnce({ rowCount: 1 }) // UPDATE stock
      .mockResolvedValueOnce(undefined); // COMMIT

    const orderId = await createOrderWithTransaction(1, [
      { product_id: 5, quantity: 2 },
    ]);

    expect(orderId).toBe(42);
    expect(client.release).toHaveBeenCalled();
  });
});

// ─── updateOrderStatus ────────────────────────────────────────────────────────

describe("updateOrderStatus", () => {
  it("throws AppError for invalid status", async () => {
    await expect(
      updateOrderStatus(1, "invalid-status", 1, "buyer"),
    ).rejects.toThrow("Invalid order status");
  });

  it("throws AppError when order not found", async () => {
    mockPoolQuery.mockResolvedValueOnce({ rows: [] });
    await expect(updateOrderStatus(99, "confirmed", 1, "seller")).rejects.toThrow(
      "Order not found",
    );
  });

  it("throws AppError when non-buyer tries to cancel", async () => {
    mockPoolQuery.mockResolvedValueOnce({
      rows: [{ buyer_id: 2, status: "pending" }],
    });
    await expect(updateOrderStatus(1, "cancelled", 99, "buyer")).rejects.toThrow(
      "Only buyer can cancel this order",
    );
  });

  it("throws AppError when cancelling a non-pending order", async () => {
    mockPoolQuery.mockResolvedValueOnce({
      rows: [{ buyer_id: 1, status: "confirmed" }],
    });
    await expect(updateOrderStatus(1, "cancelled", 1, "buyer")).rejects.toThrow(
      "Cannot cancel after confirmation",
    );
  });

  it("throws AppError when non-seller tries to confirm", async () => {
    mockPoolQuery.mockResolvedValueOnce({
      rows: [{ buyer_id: 1, status: "pending" }],
    });
    await expect(
      updateOrderStatus(1, "confirmed", 1, "buyer"),
    ).rejects.toThrow("Only seller can update this status");
  });

  it("throws AppError when shipping a pending order (skipping confirmation)", async () => {
    mockPoolQuery.mockResolvedValueOnce({
      rows: [{ buyer_id: 1, status: "pending" }],
    });
    await expect(
      updateOrderStatus(1, "shipped", 1, "seller"),
    ).rejects.toThrow("Order must be confirmed before shipping");
  });

  it("successfully updates order status", async () => {
    mockPoolQuery
      .mockResolvedValueOnce({ rows: [{ buyer_id: 1, status: "confirmed" }] }) // SELECT
      .mockResolvedValueOnce({ rowCount: 1 }); // UPDATE

    const result = await updateOrderStatus(1, "shipped", 1, "seller");
    expect(result).toBe("Status updated");
  });
});

// ─── getOrders ────────────────────────────────────────────────────────────────

describe("getOrders", () => {
  it("throws AppError for invalid status filter", async () => {
    await expect(getOrders(1, "buyer", 1, 10, "bogus")).rejects.toThrow(
      "Invalid order status filter",
    );
  });

  it("returns orders filtered by buyer", async () => {
    const rows = [{ id: 1, status: "pending", total_amount: "50.00" }];
    mockPoolQuery.mockResolvedValueOnce({ rows });

    const result = await getOrders(1, "buyer", 1, 10);
    expect(result).toEqual(rows);
    const [query] = mockPoolQuery.mock.calls[0];
    expect(query).toContain("o.buyer_id");
  });

  it("returns all orders for a seller (no buyer_id filter)", async () => {
    const rows = [{ id: 2, status: "shipped", total_amount: "200.00" }];
    mockPoolQuery.mockResolvedValueOnce({ rows });

    const result = await getOrders(5, "seller", 1, 10);
    expect(result).toEqual(rows);
    // Seller's userId (5) should NOT appear as a WHERE filter value
    const [, values] = mockPoolQuery.mock.calls[0];
    expect(values).not.toContain(5);
  });
});

// ─── getOrderDetails ──────────────────────────────────────────────────────────

describe("getOrderDetails", () => {
  it("returns grouped order details", async () => {
    const rows = [
      { order_id: 1, status: "pending", total_amount: "30.00", product_id: 10, quantity: 3, price_at_time: "10.00" },
      { order_id: 1, status: "pending", total_amount: "30.00", product_id: 11, quantity: 1, price_at_time: "20.00" },
    ];
    mockPoolQuery.mockResolvedValueOnce({ rows });

    const result = await getOrderDetails(1);

    expect(result).toHaveLength(1);
    expect(result[0].items).toHaveLength(2);
    expect(result[0].order_id).toBe(1);
  });

  it("returns empty array when buyer has no orders", async () => {
    mockPoolQuery.mockResolvedValueOnce({ rows: [] });
    const result = await getOrderDetails(99);
    expect(result).toEqual([]);
  });
});
