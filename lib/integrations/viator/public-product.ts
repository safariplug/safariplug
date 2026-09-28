function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : null;
}

function array(value: unknown) {
  return Array.isArray(value) ? value : [];
}

export type PublicViatorProduct = {
  productCode: string | null;
  status: string | null;
  title: string | null;
  description: string | null;
  productUrl: string | null;
  language: string | null;
  timeZone: string | null;
  destinations: Array<{ ref: string | null; primary: boolean }>;
  images: Array<{ variants: Array<{ url: string | null; width: number | null; height: number | null }> }>;
  productOptions: Array<{ productOptionCode: string | null; description: string | null }>;
  pricingInfo: Record<string, unknown> | null;
  cancellationPolicy: Record<string, unknown> | null;
};

export function publicViatorProduct(payload: unknown): PublicViatorProduct {
  const product = record(payload) || {};

  const destinations = array(product.destinations).map((value) => {
    const row = record(value) || {};
    return {
      ref: stringValue(row.ref),
      primary: row.primary === true,
    };
  });

  const images = array(product.images).map((value) => {
    const row = record(value) || {};
    return {
      variants: array(row.variants).map((variantValue) => {
        const variant = record(variantValue) || {};
        const width = Number(variant.width);
        const height = Number(variant.height);
        return {
          url: stringValue(variant.url),
          width: Number.isFinite(width) ? width : null,
          height: Number.isFinite(height) ? height : null,
        };
      }),
    };
  });

  const productOptions = array(product.productOptions).map((value) => {
    const row = record(value) || {};
    return {
      productOptionCode: stringValue(row.productOptionCode),
      description: stringValue(row.description),
    };
  });

  return {
    productCode: stringValue(product.productCode),
    status: stringValue(product.status),
    title: stringValue(product.title),
    description: stringValue(product.description),
    productUrl: stringValue(product.productUrl),
    language: stringValue(product.language),
    timeZone: stringValue(product.timeZone),
    destinations,
    images,
    productOptions,
    pricingInfo: record(product.pricingInfo),
    cancellationPolicy: record(product.cancellationPolicy),
  };
}
