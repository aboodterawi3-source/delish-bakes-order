/**
 * Mock Service Worker (MSW) Request Handlers for Delish Cake & Bake
 *
 * Intercepts Supabase API requests and third-party gateways for offline testing.
 */

export interface MockOrder {
  id: string;
  order_number: string;
  customer_name: string;
  total_amount: number;
  status: string;
  version: number;
}

export const mockOrdersDatabase: MockOrder[] = [
  {
    id: "4726231d-a2cd-4e56-be6f-ebea8c9e78f6",
    order_number: "DL-1001",
    customer_name: "Ahmad Test",
    total_amount: 25.0,
    status: "in_production",
    version: 1,
  },
  {
    id: "550e8400-e29b-41d4-a716-446655440000",
    order_number: "DL-1002",
    customer_name: "Sarah Amman",
    total_amount: 45.0,
    status: "ready",
    version: 2,
  },
];

export function handleMockSupabaseRequest(url: string, method: string, body?: any) {
  const parsedUrl = new URL(url);

  // 1. Mock Supabase Auth
  if (parsedUrl.pathname.includes("/auth/v1/token")) {
    if (body?.email === "admin@delish.local" && body?.password === "Admin@Delish2026") {
      return {
        status: 200,
        data: {
          access_token: "mock-jwt-token-admin",
          token_type: "bearer",
          expires_in: 3600,
          user: {
            id: "a94d497c-8104-4431-89b1-64a72a9fdf34",
            email: "admin@delish.local",
            role: "authenticated",
          },
        },
      };
    }
    return {
      status: 400,
      data: { error: "invalid_grant", error_description: "Invalid credentials" },
    };
  }

  // 2. Mock Orders query
  if (parsedUrl.pathname.includes("/rest/v1/orders")) {
    if (method === "GET") {
      return { status: 200, data: mockOrdersDatabase };
    }
    if (method === "POST") {
      const newOrder: MockOrder = {
        id: `mock-${Date.now()}`,
        order_number: `DL-${1000 + mockOrdersDatabase.length + 1}`,
        customer_name: body.customer_name || "Guest Customer",
        total_amount: body.total_amount || 0,
        status: body.status || "draft",
        version: 1,
      };
      mockOrdersDatabase.push(newOrder);
      return { status: 201, data: newOrder };
    }
  }

  return { status: 404, data: { message: "Mock endpoint not found" } };
}
