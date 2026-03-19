// Runs before any test module is loaded — sets env vars for auth
process.env.JWT_SECRET = "test-secret";
process.env.NODE_ENV = "test";
