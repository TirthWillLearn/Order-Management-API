// Mock the DB pool before importing services
jest.mock("../../config/db", () => ({
  pool: { query: jest.fn() },
}));

import { pool } from "../../config/db";
import { findUserByEmail, createUser } from "../../services/authService";

const mockQuery = pool.query as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
});

describe("findUserByEmail", () => {
  it("returns the first matching user row", async () => {
    const user = { id: 1, name: "Alice", email: "alice@example.com", role: "buyer" };
    mockQuery.mockResolvedValueOnce({ rows: [user] });

    const result = await findUserByEmail("alice@example.com");

    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining("where email"),
      ["alice@example.com"],
    );
    expect(result).toEqual(user);
  });

  it("returns undefined when no user found", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    const result = await findUserByEmail("nobody@example.com");
    expect(result).toBeUndefined();
  });
});

describe("createUser", () => {
  it("inserts a user and returns the created row", async () => {
    const created = { id: 2, name: "Bob", email: "bob@example.com", role: "seller" };
    mockQuery.mockResolvedValueOnce({ rows: [created] });

    const result = await createUser("Bob", "bob@example.com", "hashed", "seller");

    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO users"),
      ["Bob", "bob@example.com", "hashed", "seller"],
    );
    expect(result).toEqual(created);
  });
});
