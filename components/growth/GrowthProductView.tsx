"use client";

import { useEffect } from "react";
import { emitBrowserGrowthEvent } from "@/lib/growth/browser-events";

export default function GrowthProductView({
  productId,
  productType,
  category,
  destination,
}: {
  productId: string;
  productType: string;
  category?: string | null;
  destination?: string | null;
}) {
  useEffect(() => {
    void emitBrowserGrowthEvent({
      event_type: "PRODUCT_VIEW",
      product_id: productId,
      product_type: productType,
      category: category || null,
      destination: destination || null,
      event_id: `view-${productType}-${productId}-${Date.now()}`,
    });
  }, [productId, productType, category, destination]);

  return null;
}
