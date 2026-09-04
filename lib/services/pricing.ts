export type PriceSource = "unconfirmed_listed" | "safariplug_calc" | "supplier";

export type PriceInput = {
  supplierAmount: number;
  supplierCurrency: string;
  markupAmount?: number;
  commissionAmount?: number;
  discountAmount?: number;
  taxAmount?: number;
  feeAmount?: number;
  customerCurrency?: string;
  source?: PriceSource;
};

export type PriceQuote = {
  supplier_amount: number;
  supplier_currency: string;
  markup_amount: number;
  commission_amount: number;
  discount_amount: number;
  tax_amount: number;
  fee_amount: number;
  customer_total: number;
  customer_currency: string;
  source: PriceSource;
};

export function prepareQuote(input: PriceInput): PriceQuote {
  if (!Number.isFinite(input.supplierAmount) || input.supplierAmount < 0) {
    throw new Error("supplierAmount must be a non-negative number.");
  }
  const supplierCurrency = input.supplierCurrency.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(supplierCurrency)) {
    throw new Error("supplierCurrency must be a 3-letter code.");
  }
  const customerCurrency = (input.customerCurrency || supplierCurrency)
    .trim()
    .toUpperCase();
  if (customerCurrency !== supplierCurrency) {
    throw new Error(
      "Live exchange rates are not configured. Customer currency must match supplier currency."
    );
  }

  const markup = input.markupAmount ?? 0;
  const commission = input.commissionAmount ?? 0;
  const discount = input.discountAmount ?? 0;
  const tax = input.taxAmount ?? 0;
  const fee = input.feeAmount ?? 0;
  for (const [name, value] of Object.entries({ markup, commission, discount, tax, fee })) {
    if (!Number.isFinite(value) || value < 0) {
      throw new Error(`${name} must be a non-negative number.`);
    }
  }

  const customerTotal =
    input.supplierAmount + markup + tax + fee - discount;

  return {
    supplier_amount: input.supplierAmount,
    supplier_currency: supplierCurrency,
    markup_amount: markup,
    commission_amount: commission,
    discount_amount: discount,
    tax_amount: tax,
    fee_amount: fee,
    customer_total: customerTotal < 0 ? 0 : customerTotal,
    customer_currency: customerCurrency,
    source: input.source ?? "safariplug_calc",
  };
}

/** Copy a public event listed price. Not a supplier-confirmed rate. */
export function listedEventQuote(
  price: number | null,
  currency: string | null
): PriceQuote | null {
  if (price == null || !Number.isFinite(price) || price < 0) return null;
  if (!currency || !currency.trim()) return null;
  return prepareQuote({
    supplierAmount: price,
    supplierCurrency: currency,
    source: "unconfirmed_listed",
  });
}
