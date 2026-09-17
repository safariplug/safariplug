import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

export type HotelbedsTransferSelectionTokenPayload = {
  rateKey: string;
  supplierAmount: number;
  supplierCurrency: string;
  fromType: string;
  fromCode: string;
  toType: string;
  toCode: string;
  outbound: string;
  inbound?: string | null;
  adults: number;
  children: number;
  infants: number;
  cancellationPolicies?: Array<{
    amount?: number | null;
    from?: string | null;
    currencyId?: string | null;
  }>;
  serviceSummary?: Record<string, unknown>;
  issuedAt: number;
  expiresAt: number;
};

function secret() {
  const value = process.env.SAFARIPLUG_HOTELBEDS_TRANSFERS_SECRET?.trim();
  if (!value) throw new Error("Hotelbeds Transfers secret is not configured.");
  return createHash("sha256")
    .update(`safariplug:hotelbeds:transfers:selection-token:${value}`)
    .digest();
}

export function sealHotelbedsTransferSelectionToken(
  input: Omit<HotelbedsTransferSelectionTokenPayload, "issuedAt" | "expiresAt">,
  nowSeconds = Math.floor(Date.now() / 1000),
  ttlSeconds = 30 * 60
) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", secret(), iv);
  const payload: HotelbedsTransferSelectionTokenPayload = {
    ...input,
    issuedAt: nowSeconds,
    expiresAt: nowSeconds + ttlSeconds,
  };
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(payload), "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return [iv, tag, ciphertext]
    .map((part) => part.toString("base64url"))
    .join(".");
}

export function openHotelbedsTransferSelectionToken(
  token: string,
  nowSeconds = Math.floor(Date.now() / 1000)
) {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Invalid Hotelbeds transfer selection token.");
  const [ivPart, tagPart, dataPart] = parts;
  const decipher = createDecipheriv(
    "aes-256-gcm",
    secret(),
    Buffer.from(ivPart, "base64url")
  );
  decipher.setAuthTag(Buffer.from(tagPart, "base64url"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(dataPart, "base64url")),
    decipher.final(),
  ]).toString("utf8");
  const payload = JSON.parse(plaintext) as HotelbedsTransferSelectionTokenPayload;

  if (
    !payload.rateKey ||
    !payload.supplierCurrency ||
    !Number.isFinite(payload.supplierAmount) ||
    payload.supplierAmount < 0 ||
    !payload.fromType ||
    !payload.fromCode ||
    !payload.toType ||
    !payload.toCode ||
    !payload.outbound ||
    !Number.isInteger(payload.adults) ||
    payload.adults < 1
  ) {
    throw new Error("Invalid Hotelbeds transfer selection token payload.");
  }
  if (payload.expiresAt <= nowSeconds) {
    throw new Error("Hotelbeds transfer selection has expired. Please search again.");
  }
  return payload;
}
