import { createPrivateKey, createPublicKey, X509Certificate } from "node:crypto";
import { NextResponse } from "next/server";
import { requireAdmin, AdminAuthError } from "@/lib/auth/require-admin";
import { HotelbedsHotelAdapter } from "@/lib/integrations/hotels/hotelbeds";
import {
  fetchHotelbedsHotelContentPage,
  hotelbedsContentConfigured,
  hotelbedsContentEnvironment,
} from "@/lib/integrations/hotels/hotelbeds-content";
import { syncOneHotelbedsContentPage } from "@/lib/integrations/hotels/hotelbeds-content-sync";
import { buildHotelbedsCertificationPlan } from "@/lib/integrations/hotels/hotelbeds-certification-plan";
import {
  buildHotelbedsCertificationStay,
  summarizeHotelbedsAvailabilityProbe,
} from "@/lib/integrations/hotels/hotelbeds-certification-probe";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";
export const maxDuration = 45;

function normalizedPem(primary: string, fallback: string) {
  const raw = process.env[primary]?.trim() || process.env[fallback]?.trim() || "";
  if (!raw) return "";
  const unquoted = (
    (raw.startsWith('"') && raw.endsWith('"'))
    || (raw.startsWith("'") && raw.endsWith("'"))
  ) ? raw.slice(1, -1).trim() : raw;
  return unquoted.replace(/\\n/g, "\n").replace(/\r\n/g, "\n").trim();
}

function certificatePem() {
  const encoded = process.env.SAFARIPLUG_HOTEL_HOTELBEDS_CERT_B64?.trim();
  if (encoded) {
    try {
      return Buffer.from(encoded, "base64").toString("utf8").replace(/\r\n/g, "\n").trim();
    } catch {
      return "";
    }
  }
  return normalizedPem("SAFARIPLUG_HOTEL_HOTELBEDS_CERT_PEM", "SAFARIPLUG_HOTEL_HOTELBEDS_CERT");
}

function prepareCertificateForAdapter() {
  const certificate = certificatePem();
  if (certificate) process.env.SAFARIPLUG_HOTEL_HOTELBEDS_CERT_PEM = certificate;
}

function pemDiagnostics() {
  const certificate = certificatePem();
  const privateKey = normalizedPem("SAFARIPLUG_HOTEL_HOTELBEDS_PRIVATE_KEY_PEM", "SAFARIPLUG_HOTEL_HOTELBEDS_PRIVATE_KEY");
  const ca = normalizedPem("SAFARIPLUG_HOTEL_HOTELBEDS_CA_PEM", "SAFARIPLUG_HOTEL_HOTELBEDS_CA");
  const certificateValid = certificate.startsWith("-----BEGIN CERTIFICATE-----") && certificate.endsWith("-----END CERTIFICATE-----");
  const privateKeyValid = /-----BEGIN (?:RSA )?PRIVATE KEY-----/.test(privateKey) && /-----END (?:RSA )?PRIVATE KEY-----$/.test(privateKey);
  const caValid = !ca || (ca.startsWith("-----BEGIN CERTIFICATE-----") && ca.endsWith("-----END CERTIFICATE-----"));

  let certificateParseValid = false;
  let privateKeyParseValid = false;
  let keyPairMatches = false;

  try {
    if (certificateValid) {
      const parsedCertificate = new X509Certificate(certificate);
      certificateParseValid = true;
      if (privateKeyValid) {
        try {
          const parsedPrivateKey = createPrivateKey(privateKey);
          privateKeyParseValid = true;
          const certificatePublicKey = parsedCertificate.publicKey.export({ type: "spki", format: "der" });
          const privatePublicKey = createPublicKey(parsedPrivateKey).export({ type: "spki", format: "der" });
          keyPairMatches = Buffer.from(certificatePublicKey).equals(Buffer.from(privatePublicKey));
        } catch {
          privateKeyParseValid = false;
        }
      }
    }
  } catch {
    certificateParseValid = false;
  }

  return {
    certificatePresent: Boolean(certificate),
    certificateSource: process.env.SAFARIPLUG_HOTEL_HOTELBEDS_CERT_B64?.trim() ? "base64" : "pem",
    certificateValid,
    certificateParseValid,
    privateKeyPresent: Boolean(privateKey),
    privateKeyValid,
    privateKeyParseValid,
    keyPairMatches,
    caPresent: Boolean(ca),
    caValid,
  };
}

function pemPreflightError() {
  const diagnostic = pemDiagnostics();
  if (!diagnostic.certificatePresent) return "Hotelbeds mTLS certificate is missing.";
  if (!diagnostic.certificateValid) return "Hotelbeds mTLS certificate is not valid PEM after decoding. Regenerate SAFARIPLUG_HOTEL_HOTELBEDS_CERT_B64 from the original issued PEM file.";
  if (!diagnostic.certificateParseValid) return "Hotelbeds mTLS certificate has valid PEM markers but its certificate body cannot be parsed. Regenerate SAFARIPLUG_HOTEL_HOTELBEDS_CERT_B64 from the original issued PEM file.";
  if (!diagnostic.privateKeyPresent) return "Hotelbeds mTLS private key is missing.";
  if (!diagnostic.privateKeyValid) return "Hotelbeds mTLS private key is not valid PEM. It must begin and end with a PRIVATE KEY PEM header/footer.";
  if (!diagnostic.privateKeyParseValid) return "Hotelbeds mTLS private key has valid PEM markers but its key body cannot be parsed. Replace the Hostinger private-key value from the unencrypted server key file.";
  if (!diagnostic.keyPairMatches) return "Hotelbeds mTLS certificate and private key are individually valid but do not match each other.";
  if (diagnostic.caPresent && !diagnostic.caValid) return "Hotelbeds custom CA value is present but is not valid certificate PEM. Remove the optional CA variable unless Hotelbeds explicitly supplied a CA bundle.";
  return null;
}

function readiness() {
  return {
    environment: hotelbedsContentEnvironment(),
    apiKey: Boolean(process.env.SAFARIPLUG_HOTEL_HOTELBEDS_API_KEY?.trim()),
    secret: Boolean(process.env.SAFARIPLUG_HOTEL_HOTELBEDS_SECRET?.trim()),
    certificate: Boolean(
      process.env.SAFARIPLUG_HOTEL_HOTELBEDS_CERT_B64?.trim()
      || process.env.SAFARIPLUG_HOTEL_HOTELBEDS_CERT_PEM?.trim()
      || process.env.SAFARIPLUG_HOTEL_HOTELBEDS_CERT?.trim()
    ),
    privateKey: Boolean(
      process.env.SAFARIPLUG_HOTEL_HOTELBEDS_PRIVATE_KEY_PEM?.trim()
      || process.env.SAFARIPLUG_HOTEL_HOTELBEDS_PRIVATE_KEY?.trim()
    ),
    contentConfigured: hotelbedsContentConfigured(),
    pem: pemDiagnostics(),
  };
}

async function cacheStatus() {
  const [{ count }, stateResult] = await Promise.all([
    supabaseAdmin.from("hotelbeds_hotel_content").select("hotel_code", { count: "exact", head: true }),
    supabaseAdmin
      .from("hotelbeds_content_sync_state")
      .select("sync_key,next_from,page_size,language,supplier_total,last_page_count,status,last_error,last_started_at,last_completed_at,updated_at")
      .eq("sync_key", "hotel-content")
      .maybeSingle(),
  ]);
  return { cachedHotels: count ?? 0, syncState: stateResult.data ?? null };
}

async function certificationPlan() {
  const ready = readiness();
  const cache = await cacheStatus();
  return {
    readiness: ready,
    cache,
    plan: buildHotelbedsCertificationPlan({
      apiKey: ready.apiKey,
      secret: ready.secret,
      certificate: ready.certificate,
      privateKey: ready.privateKey,
      contentConfigured: ready.contentConfigured,
      cachedHotels: cache.cachedHotels,
    }),
  };
}

async function runAvailabilityProbe() {
  const ready = readiness();
  if (!ready.apiKey || !ready.secret || !ready.certificate || !ready.privateKey) {
    return NextResponse.json({ error: "Hotelbeds availability probe requires API credentials and mTLS material." }, { status: 409 });
  }
  const preflightError = pemPreflightError();
  if (preflightError) {
    return NextResponse.json({ error: preflightError, pem: pemDiagnostics(), supplierRequestCount: 0 }, { status: 409 });
  }

  const { data: cachedHotels, error } = await supabaseAdmin
    .from("hotelbeds_hotel_content")
    .select("hotel_code,name,destination_name")
    .order("hotel_code", { ascending: true })
    .limit(20);

  if (error) {
    return NextResponse.json({ error: `Unable to load cached Hotelbeds hotels: ${error.message}` }, { status: 500 });
  }
  if (!cachedHotels?.length) {
    return NextResponse.json({ error: "No cached Hotelbeds hotels are available for the certification probe." }, { status: 409 });
  }

  const codes = cachedHotels.map((hotel) => Number(hotel.hotel_code)).filter((code) => Number.isInteger(code) && code > 0);
  if (!codes.length) {
    return NextResponse.json({ error: "Cached Hotelbeds hotel codes are invalid." }, { status: 409 });
  }

  prepareCertificateForAdapter();
  const stay = buildHotelbedsCertificationStay();
  const adapter = new HotelbedsHotelAdapter();
  const result = await adapter.search({
    destination: codes.join(","),
    check_in: stay.checkIn,
    check_out: stay.checkOut,
    guests: 2,
    adults: 2,
    rooms: 1,
    currency: "KES",
    provider: "hotelbeds",
  });

  if (!result.ok) {
    return NextResponse.json({
      ok: false,
      error: result.error.message,
      supplierRequestCount: 1,
      testedHotels: codes.length,
      request: { checkIn: stay.checkIn, checkOut: stay.checkOut, guests: 2, rooms: 1, currency: "KES" },
      supplierError: result.error,
    }, { status: 502 });
  }

  const summary = summarizeHotelbedsAvailabilityProbe(result.data.results);
  return NextResponse.json({
    ok: true,
    supplierRequestCount: 1,
    testedHotels: codes.length,
    request: { checkIn: stay.checkIn, checkOut: stay.checkOut, guests: 2, rooms: 1, currency: "KES" },
    ...summary,
  });
}

export async function GET() {
  try {
    await requireAdmin();
    return NextResponse.json(await certificationPlan());
  } catch (error) {
    const status = error instanceof AdminAuthError ? error.status : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to inspect Hotelbeds." }, { status });
  }
}

export async function POST(request: Request) {
  try {
    await requireAdmin();
    const body = await request.json().catch(() => ({})) as { action?: string };
    const action = String(body.action || "health");

    if (action === "certification_plan") {
      return NextResponse.json(await certificationPlan());
    }

    if (action === "availability_probe") {
      return runAvailabilityProbe();
    }

    if (action === "health") {
      const preflightError = pemPreflightError();
      if (preflightError) {
        return NextResponse.json({ error: preflightError, readiness: readiness(), pem: pemDiagnostics(), cache: await cacheStatus() }, { status: 409 });
      }
      prepareCertificateForAdapter();
      const adapter = new HotelbedsHotelAdapter();
      const health = await adapter.health();
      return NextResponse.json({ readiness: readiness(), health, cache: await cacheStatus() });
    }

    if (action === "content_sample") {
      if (!hotelbedsContentConfigured()) {
        return NextResponse.json({ error: "Hotelbeds Content API credentials are not configured." }, { status: 409 });
      }
      const payload = await fetchHotelbedsHotelContentPage({ from: 1, to: 1, language: "ENG" });
      const candidate = payload as { hotels?: unknown; total?: unknown; from?: unknown; to?: unknown };
      const hotels = Array.isArray(candidate.hotels)
        ? candidate.hotels
        : candidate.hotels && typeof candidate.hotels === "object" && "hotels" in candidate.hotels
          ? (candidate.hotels as { hotels?: unknown }).hotels
          : [];
      return NextResponse.json({
        ok: true,
        environment: hotelbedsContentEnvironment(),
        sampleCount: Array.isArray(hotels) ? hotels.length : 0,
        total: candidate.total ?? null,
        from: candidate.from ?? 1,
        to: candidate.to ?? 1,
      });
    }

    if (action === "sync_one_page") {
      const result = await syncOneHotelbedsContentPage();
      return NextResponse.json({ result, cache: await cacheStatus() });
    }

    return NextResponse.json({ error: "Unsupported Hotelbeds verification action." }, { status: 400 });
  } catch (error) {
    const status = error instanceof AdminAuthError ? error.status : 502;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Hotelbeds verification failed." }, { status });
  }
}
