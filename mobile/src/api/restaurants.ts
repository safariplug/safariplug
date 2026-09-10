import { API_BASE_URL } from "../config";
import { supabase } from "../auth";

export type RestaurantOrderItemInput = {
  menuItemId: string;
  quantity: number;
  notes?: string;
  options?: { optionId: string; valueId: string }[];
};

export type CreateRestaurantOrderInput = {
  businessId: string;
  fulfillmentMethod: "pickup" | "restaurant_delivery";
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  deliveryAddress?: string;
  customerNotes?: string;
  items: RestaurantOrderItemInput[];
};

async function authHeaders() {
  const { data } = await supabase.auth.getSession();
  if (!data.session?.access_token) throw new Error("Sign in with a confirmed SafariPlug account to place an order.");
  return {
    Accept: "application/json",
    "Content-Type": "application/json",
    Authorization: `Bearer ${data.session.access_token}`,
  };
}

async function request<T>(path: string, init: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, init);
  const body = await response.json().catch(() => null) as any;
  if (!response.ok) throw new Error(body?.error?.message || body?.error || `SafariPlug request failed (${response.status}).`);
  return body as T;
}

export async function createRestaurantOrder(input: CreateRestaurantOrderInput) {
  return request<{ order: { id: string; public_id?: string | null; customer_total: number; currency: string; payment_status: string }; deliveryFee: number; etaAt: string }>("/api/restaurants/orders", {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify(input),
  });
}

export async function startRestaurantMpesaPayment(orderId: string, phone: string) {
  const idempotencyKey = `mobile-food-${orderId}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  return request<{ intent: { id: string; providerReference?: string | null; status?: string } }>("/api/restaurants/orders/payment", {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify({ orderId, phone, provider: "mpesa", idempotencyKey }),
  });
}
