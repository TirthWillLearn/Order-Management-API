jest.mock("../../config/db", () => ({
  pool: { query: jest.fn() },
}));

import { pool } from "../../config/db";
import {
  createProduct,
  getProducts,
  getSellerDashboard,
} from "../../services/product.service";
import { AppError } from "../../utils/AppError";

const mockQuery = pool.query as jest.Mock;

beforeEach(() => jest.clearAllMocks());

// ─── createProduct ────────────────────────────────────────────────────────────

describe("createProduct", () => {
  it("inserts product and returns the row", async () => {
    const row = { id: 1, name: "Widget", description: "A widget", price: 9.99, stock: 10, seller_id: 5 };
    mockQuery.mockResolvedValueOnce({ rows: [row] });

    const result = await createProduct("Widget", "A widget", 9.99, 10, 5);

    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO products"),
      ["Widget", "A widget", 9.99, 10, 5],
    );
    expect(result).toEqual(row);
  });
});

// ─── getProducts ──────────────────────────────────────────────────────────────

describe("getProducts", () => {
  it("returns product rows for a basic query", async () => {
    const rows = [{ id: 1, name: "Widget", price: 9.99, stock: 10, seller_name: "Alice" }];
    mockQuery.mockResolvedValueOnce({ rows });

    const result = await getProducts(1, 10);
    expect(result).toEqual(rows);
  });

  it("throws AppError when minPrice > maxPrice", async () => {
    await expect(getProducts(1, 10, 100, 10)).rejects.toThrow(AppError);
    await expect(getProducts(1, 10, 100, 10)).rejects.toThrow(
      "minPrice cannot be greater than maxPrice",
    );
  });

  it("applies minPrice, maxPrice and sellerId filters", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    await getProducts(1, 5, 5, 50, 3);

    const [query, values] = mockQuery.mock.calls[0];
    expect(query).toContain("p.price >=");
    expect(query).toContain("p.price <=");
    expect(query).toContain("p.seller_id =");
    expect(values).toContain(5);
    expect(values).toContain(50);
    expect(values).toContain(3);
  });
});

// ─── getSellerDashboard ───────────────────────────────────────────────────────

describe("getSellerDashboard", () => {
  it("returns revenue and order count for seller", async () => {
    const row = { total_revenue: "150.00", total_orders: "3" };
    mockQuery.mockResolvedValueOnce({ rows: [row] });

    const result = await getSellerDashboard(5);
    expect(result).toEqual(row);
    expect(mockQuery).toHaveBeenCalledWith(expect.any(String), [5]);
  });
});
