/** Public catalog event as returned by GET /api/v1/events. */
export type CatalogCity = {
  id: string | null;
  name: string | null;
  country: string | null;
};

export type CatalogEvent = {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  start_at: string | null;
  end_at: string | null;
  venue_name: string | null;
  venue_address: string | null;
  price: number | null;
  currency: string | null;
  image_url: string | null;
  booking_url: string | null;
  organizer_name: string | null;
  is_featured: boolean;
  status: "approved";
  city: CatalogCity | null;
};

export type CatalogDestination = {
  id: string;
  name: string;
  country: string | null;
  slug: string;
  event_count: number;
};

export type CatalogExperienceCollection = {
  slug: string;
  name: string;
  description: string;
};

export type CatalogExperienceCategory = {
  name: string;
  count: number;
};

export type DateMode = "valid" | "upcoming" | "tonight" | "this-weekend" | "all";

export type EventListQuery = {
  page?: number;
  limit?: number;
  city?: string;
  category?: string;
  featured?: boolean;
  when?: DateMode;
};

/** Future Travel OS kinds. Catalog currently implements "event" only. */
export type InventoryKind =
  | "event"
  | "hotel"
  | "safari"
  | "experience"
  | "restaurant"
  | "attraction"
  | "transfer"
  | "driver"
  | "personal_service"
  | "adventure";
