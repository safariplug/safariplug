import { randomUUID } from "node:crypto";
import { sealHotelbedsTransferSelectionToken } from "./transfer-selection-token";

type AvailabilityContext = {
  fromType: string;
  fromCode: string;
  toType: string;
  toCode: string;
  outbound: string;
  inbound?: string | null;
  adults: number;
  children: number;
  infants: number;
};

type Selection = {
  token: string;
  rateKey: string;
  supplierAmount: number;
  supplierCurrency: string;
  cancellationPolicies: Array<Record<string, unknown>>;
  serviceSummary: Record<string, unknown>;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function scalar(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function finiteNumber(value: unknown) {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function summarizeService(service: Record<string, unknown>) {
  const vehicle = asRecord(service.vehicle);
  const category = asRecord(service.category);
  const transferType =
    scalar(service.transferType) ||
    scalar(service.type) ||
    scalar(category?.name) ||
    scalar(category?.code);
  const vehicleName =
    scalar(vehicle?.name) ||
    scalar(vehicle?.description) ||
    scalar(vehicle?.code);
  return {
    transferType: transferType || null,
    vehicleName: vehicleName || null,
    minPaxCapacity: finiteNumber(vehicle?.minPaxCapacity) ?? null,
    maxPaxCapacity: finiteNumber(vehicle?.maxPaxCapacity) ?? null,
  };
}

export function extractHotelbedsTransferSelections(
  payload: unknown,
  context: AvailabilityContext
): Selection[] {
  const root = asRecord(payload);
  const services = Array.isArray(root?.services) ? root?.services : [];
  const selections: Selection[] = [];

  for (const row of services) {
    const service = asRecord(row);
    if (!service) continue;
    const rateKey = scalar(service.rateKey);
    const price = asRecord(service.price);
    const supplierAmount = finiteNumber(price?.totalAmount);
    const supplierCurrency = scalar(price?.currencyId)?.toUpperCase();
    if (!rateKey || supplierAmount === undefined || !supplierCurrency) continue;

    const rawPolicies = Array.isArray(service.cancellationPolicies)
      ? service.cancellationPolicies
      : [];
    const cancellationPolicies = rawPolicies
      .map(asRecord)
      .filter((policy): policy is Record<string, unknown> => Boolean(policy))
      .map((policy) => ({
        amount: finiteNumber(policy.amount) ?? null,
        from: scalar(policy.from) || null,
        currencyId: scalar(policy.currencyId)?.toUpperCase() || null,
      }));

    const serviceSummary = summarizeService(service);
    const token = sealHotelbedsTransferSelectionToken({
      rateKey,
      supplierAmount,
      supplierCurrency,
      fromType: context.fromType,
      fromCode: context.fromCode,
      toType: context.toType,
      toCode: context.toCode,
      outbound: context.outbound,
      inbound: context.inbound || null,
      adults: context.adults,
      children: context.children,
      infants: context.infants,
      cancellationPolicies,
      serviceSummary,
    });

    selections.push({
      token,
      rateKey,
      supplierAmount,
      supplierCurrency,
      cancellationPolicies,
      serviceSummary,
    });
  }

  return selections;
}

export function normalizeHotelbedsTransferHolder(value: unknown) {
  const holder = asRecord(value) || {};
  const name = scalar(holder.name);
  const surname = scalar(holder.surname);
  const email = scalar(holder.email);
  const phone = scalar(holder.phone);
  if (!name || !surname || !email || !phone) {
    throw new Error("Lead passenger name, surname, email and phone are required.");
  }
  if (!/^\+[1-9]\d{7,14}$/.test(phone)) {
    throw new Error("Lead passenger phone must use international E.164 format.");
  }
  return { name, surname, email, phone };
}

export function buildHotelbedsTransferBookingRequest(input: {
  rateKey: string;
  holder: ReturnType<typeof normalizeHotelbedsTransferHolder>;
  language?: string;
  transferDetails?: unknown;
  welcomeMessage?: string;
  remark?: string;
  clientReference?: string;
}) {
  const clientReference =
    scalar(input.clientReference) || `SPT-${randomUUID().replaceAll("-", "").slice(0, 20)}`;
  const transfer: Record<string, unknown> = { rateKey: input.rateKey };

  if (Array.isArray(input.transferDetails) && input.transferDetails.length) {
    transfer.transferDetails = input.transferDetails;
  }

  return {
    language: scalar(input.language) || "en",
    holder: input.holder,
    transfers: [transfer],
    clientReference,
    ...(scalar(input.welcomeMessage) ? { welcomeMessage: scalar(input.welcomeMessage) } : {}),
    ...(scalar(input.remark) ? { remark: scalar(input.remark) } : {}),
  };
}

export function hotelbedsTransferBookingReference(payload: unknown) {
  const root = asRecord(payload);
  const bookings = Array.isArray(root?.bookings) ? root?.bookings : [];
  const booking = asRecord(bookings[0]);
  return scalar(booking?.reference);
}
