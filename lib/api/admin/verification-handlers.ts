import { NextResponse } from "next/server";
import { AdminAuthError, requireAdmin } from "@/lib/auth/require-admin";
import { supabaseAdmin } from "@/lib/supabase-admin";
import {
  approveCase,
  createVerificationCase,
  rejectCase,
  requestReview,
  revokeCase,
  submitEvidence,
  toSafeEvidence,
  type MemoryVerificationStore,
} from "@/lib/services/verification";
import {
  hydrateVerificationStore,
  persistVerificationMutation,
} from "@/lib/services/verification-db";
import type {
  EvidenceType,
  VerificationLevel,
  VerificationSubjectType,
} from "@/lib/integrations/verification/types";

async function adminActor() {
  const user = await requireAdmin();
  return { role: "admin" as const, id: user.id };
}

function fail(status: number, code: string, message: string) {
  return NextResponse.json(
    { success: false, error: { code, message } },
    { status }
  );
}

async function withStore() {
  const hydrated = await hydrateVerificationStore(supabaseAdmin);
  if (!hydrated.ok) {
    return {
      ok: false as const,
      response: fail(
        503,
        "verification_not_configured",
        hydrated.reason === "missing"
          ? "Verification tables are not applied yet."
          : "Unable to load verification cases."
      ),
    };
  }
  return { ok: true as const, store: hydrated.store };
}

export async function handleListVerification() {
  try {
    await requireAdmin();
  } catch (error: unknown) {
    if (error instanceof AdminAuthError) {
      return fail(error.status, "unauthorized", error.message);
    }
    return fail(500, "internal_error", "Request failed");
  }
  const ready = await withStore();
  if (!ready.ok) return ready.response;
  const cases = ready.store.listCases().map((row) => ({
    ...row,
    evidence: ready.store.listEvidence(row.id).map(toSafeEvidence),
  }));
  return NextResponse.json({ success: true, data: cases });
}

export async function handleCreateVerification(request: Request) {
  let actor;
  try {
    actor = await adminActor();
  } catch (error: unknown) {
    if (error instanceof AdminAuthError) {
      return fail(error.status, "unauthorized", error.message);
    }
    return fail(500, "internal_error", "Request failed");
  }
  const ready = await withStore();
  if (!ready.ok) return ready.response;
  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    body = {};
  }
  const result = createVerificationCase(
    {
      subject_type: (body.subject_type as VerificationSubjectType) || "driver",
      subject_id: String(body.subject_id || ""),
      verification_level: body.verification_level as VerificationLevel | undefined,
    },
    actor,
    ready.store
  );
  if (!result.ok) {
    return fail(
      result.error.code === "unauthorized" ? 403 : 400,
      result.error.code,
      result.error.message
    );
  }
  const persisted = await persistVerificationMutation(
    supabaseAdmin,
    ready.store,
    result.data.id
  );
  if (!persisted.ok) return fail(500, "internal_error", "Unable to save case.");
  return NextResponse.json({ success: true, data: result.data }, { status: 201 });
}

export async function handleGetVerification(id: string) {
  try {
    await requireAdmin();
  } catch (error: unknown) {
    if (error instanceof AdminAuthError) {
      return fail(error.status, "unauthorized", error.message);
    }
    return fail(500, "internal_error", "Request failed");
  }
  const ready = await withStore();
  if (!ready.ok) return ready.response;
  const current = ready.store.getCase(id);
  if (!current) return fail(404, "not_found", "Verification case not found.");
  return NextResponse.json({
    success: true,
    data: {
      ...current,
      evidence: ready.store.listEvidence(id).map(toSafeEvidence),
      events: ready.store.listEvents(id),
    },
  });
}

async function mutate(
  request: Request,
  id: string,
  run: (
    actor: { role: "admin"; id: string },
    store: MemoryVerificationStore,
    body: Record<string, unknown>
  ) => ReturnType<typeof approveCase>
) {
  let actor;
  try {
    actor = await adminActor();
  } catch (error: unknown) {
    if (error instanceof AdminAuthError) {
      return fail(error.status, "unauthorized", error.message);
    }
    return fail(500, "internal_error", "Request failed");
  }
  const ready = await withStore();
  if (!ready.ok) return ready.response;
  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    body = {};
  }
  const result = run(actor, ready.store, body);
  if (!result.ok) {
    const status =
      result.error.code === "unauthorized"
        ? 403
        : result.error.code === "not_found"
          ? 404
          : result.error.code === "evidence_required"
            ? 409
            : 400;
    return fail(status, result.error.code, result.error.message);
  }
  const persisted = await persistVerificationMutation(
    supabaseAdmin,
    ready.store,
    result.data.id
  );
  if (!persisted.ok) return fail(500, "internal_error", "Unable to save case.");
  return NextResponse.json({ success: true, data: result.data });
}

export async function handleReviewVerification(request: Request, id: string) {
  return mutate(request, id, (actor, store) => requestReview(id, actor, store));
}

export async function handleApproveVerification(request: Request, id: string) {
  return mutate(request, id, (actor, store) => approveCase(id, actor, store));
}

export async function handleRejectVerification(request: Request, id: string) {
  return mutate(request, id, (actor, store, body) =>
    rejectCase(id, String(body.reason || ""), actor, store)
  );
}

export async function handleRevokeVerification(request: Request, id: string) {
  return mutate(request, id, (actor, store, body) =>
    revokeCase(id, String(body.reason || ""), actor, store)
  );
}

export async function handleSubmitEvidence(request: Request, id: string) {
  let actor;
  try {
    actor = await adminActor();
  } catch (error: unknown) {
    if (error instanceof AdminAuthError) {
      return fail(error.status, "unauthorized", error.message);
    }
    return fail(500, "internal_error", "Request failed");
  }
  const ready = await withStore();
  if (!ready.ok) return ready.response;
  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    body = {};
  }
  const result = submitEvidence(
    {
      case_id: id,
      evidence_type:
        (body.evidence_type as EvidenceType) || "provider_attestation",
      storage_ref: body.storage_ref ? String(body.storage_ref) : undefined,
      external_ref: body.external_ref ? String(body.external_ref) : undefined,
    },
    actor,
    ready.store
  );
  if (!result.ok) {
    return fail(
      result.error.code === "unauthorized" ? 403 : 400,
      result.error.code,
      result.error.message
    );
  }
  const persisted = await persistVerificationMutation(
    supabaseAdmin,
    ready.store,
    id
  );
  if (!persisted.ok) {
    return fail(500, "internal_error", "Unable to save evidence.");
  }
  return NextResponse.json({ success: true, data: result.data }, { status: 201 });
}
