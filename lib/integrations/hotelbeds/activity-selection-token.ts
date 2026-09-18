import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

export type HotelbedsActivitySelectionTokenPayload = {
  activityCode: string;
  activityName: string;
  modalityCode: string;
  modalityName: string;
  rateKey: string;
  from: string;
  to: string;
  paxes: Array<{ age: number }>;
  supplierAmount: number;
  supplierCurrency: string;
  rateClass?: string | null;
  freeCancellation?: boolean | null;
  cancellationPolicies?: Array<{ amount?: number | null; dateFrom?: string | null; dateTo?: string | null }>;
  sessionCode?: string | null;
  sessionName?: string | null;
  languageCode?: string | null;
  languageName?: string | null;
  questions?: Array<{ code: string; text: string; required: boolean }>;
  comments?: string[];
  issuedAt: number;
  expiresAt: number;
};

function secret() {
  const value = process.env.SAFARIPLUG_HOTELBEDS_ACTIVITIES_SECRET?.trim();
  if (!value) throw new Error("Hotelbeds Activities secret is not configured.");
  return createHash("sha256")
    .update(`safariplug:hotelbeds:activities:selection-token:${value}`)
    .digest();
}

export function sealHotelbedsActivitySelectionToken(
  input: Omit<HotelbedsActivitySelectionTokenPayload, "issuedAt" | "expiresAt">,
  nowSeconds = Math.floor(Date.now() / 1000),
  ttlSeconds = 25 * 60
) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", secret(), iv);
  const payload: HotelbedsActivitySelectionTokenPayload = {
    ...input,
    issuedAt: nowSeconds,
    expiresAt: nowSeconds + ttlSeconds,
  };
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(payload), "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return [iv, tag, ciphertext].map((part) => part.toString("base64url")).join(".");
}

export function openHotelbedsActivitySelectionToken(
  token: string,
  nowSeconds = Math.floor(Date.now() / 1000)
) {
  const [ivPart, tagPart, dataPart, ...rest] = token.split(".");
  if (!ivPart || !tagPart || !dataPart || rest.length) {
    throw new Error("Invalid Hotelbeds activity selection token.");
  }
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
  const payload = JSON.parse(plaintext) as HotelbedsActivitySelectionTokenPayload;

  if (
    !payload.activityCode ||
    !payload.modalityCode ||
    !payload.rateKey ||
    !payload.from ||
    !payload.to ||
    !payload.supplierCurrency ||
    !Number.isFinite(payload.supplierAmount) ||
    payload.supplierAmount < 0 ||
    !Array.isArray(payload.paxes) ||
    payload.paxes.length < 1
  ) {
    throw new Error("Invalid Hotelbeds activity selection token payload.");
  }
  if (payload.expiresAt <= nowSeconds) {
    throw new Error("Hotelbeds activity selection has expired. Please refresh availability.");
  }
  return payload;
}
