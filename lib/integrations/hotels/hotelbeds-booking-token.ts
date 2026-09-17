import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

export type HotelbedsBookingTokenPayload = {
  rateKey: string;
  rateType: string;
  supplierNet: number;
  supplierCurrency: string;
  propertyId: string;
  propertyName: string;
  hotelAddress?: string | null;
  hotelCategory?: string | null;
  hotelDestination?: string | null;
  roomId?: string | null;
  roomName?: string | null;
  boardCode?: string | null;
  boardName?: string | null;
  cancellation?: string | null;
  checkIn: string;
  checkOut: string;
  issuedAt: number;
  expiresAt: number;
};

function secret() {
  const value = process.env.SAFARIPLUG_HOTEL_HOTELBEDS_SECRET?.trim();
  if (!value) throw new Error("Hotelbeds secret is not configured.");
  return createHash("sha256").update(`safariplug:hotelbeds:booking-token:${value}`).digest();
}

export function sealHotelbedsBookingToken(
  input: Omit<HotelbedsBookingTokenPayload, "issuedAt" | "expiresAt">,
  nowSeconds = Math.floor(Date.now() / 1000),
  ttlSeconds = 30 * 60
) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", secret(), iv);
  const payload: HotelbedsBookingTokenPayload = {
    ...input,
    issuedAt: nowSeconds,
    expiresAt: nowSeconds + ttlSeconds,
  };
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(payload), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, ciphertext].map((part) => part.toString("base64url")).join(".");
}

export function openHotelbedsBookingToken(token: string, nowSeconds = Math.floor(Date.now() / 1000)) {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Invalid Hotelbeds booking token.");
  const [ivPart, tagPart, dataPart] = parts;
  const decipher = createDecipheriv("aes-256-gcm", secret(), Buffer.from(ivPart, "base64url"));
  decipher.setAuthTag(Buffer.from(tagPart, "base64url"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(dataPart, "base64url")),
    decipher.final(),
  ]).toString("utf8");
  const payload = JSON.parse(plaintext) as HotelbedsBookingTokenPayload;
  if (!payload.rateKey || !payload.propertyId || !Number.isFinite(payload.supplierNet)) {
    throw new Error("Invalid Hotelbeds booking token payload.");
  }
  if (payload.expiresAt <= nowSeconds) throw new Error("Hotelbeds booking token has expired. Please search again.");
  return payload;
}
