export type HotelbedsCertificationReadiness = {
  apiKey: boolean;
  secret: boolean;
  certificate: boolean;
  privateKey: boolean;
  contentConfigured: boolean;
  cachedHotels: number;
};

export type HotelbedsCertificationStep = {
  id: string;
  label: string;
  status: "ready" | "blocked" | "manual";
  destructive: boolean;
  reason: string;
};

export function buildHotelbedsCertificationPlan(input: HotelbedsCertificationReadiness) {
  const authReady = input.apiKey && input.secret;
  const mtlsReady = input.certificate && input.privateKey;
  const inventoryReady = input.cachedHotels > 0;

  const steps: HotelbedsCertificationStep[] = [
    {
      id: "health",
      label: "Hotel API authentication and health",
      status: authReady ? "ready" : "blocked",
      destructive: false,
      reason: authReady ? "API key and secret are present." : "Hotel API key and secret are required.",
    },
    {
      id: "content",
      label: "Content API sample and local hotel cache",
      status: input.contentConfigured && inventoryReady ? "ready" : "blocked",
      destructive: false,
      reason: !input.contentConfigured
        ? "Content API credentials are required."
        : inventoryReady
          ? `${input.cachedHotels} cached Hotelbeds hotel records are available.`
          : "Run an explicit content sample or one-page sync to seed the local cache.",
    },
    {
      id: "availability",
      label: "Availability search with Hotelbeds-only inventory",
      status: authReady && mtlsReady ? "ready" : "blocked",
      destructive: false,
      reason: authReady && mtlsReady ? "Hotel API credentials and mTLS material are present." : "Availability requires Hotel API credentials plus mTLS certificate/private key.",
    },
    {
      id: "checkrate",
      label: "RECHECK rate validation",
      status: authReady && mtlsReady ? "ready" : "blocked",
      destructive: false,
      reason: authReady && mtlsReady ? "RECHECK selections can be validated once during checkout preflight." : "CheckRate requires Hotel API credentials plus mTLS.",
    },
    {
      id: "traveler-preflight",
      label: "Traveler notices, rate comments, cancellation terms and acceptance",
      status: authReady && mtlsReady ? "ready" : "blocked",
      destructive: false,
      reason: authReady && mtlsReady ? "The governed preflight path is implemented before payment." : "Supplier-backed preflight cannot be exercised until Hotelbeds hotel access is available.",
    },
    {
      id: "payment",
      label: "M-Pesa payment gate",
      status: "manual",
      destructive: true,
      reason: "Requires an explicit test payment from an authorized operator/customer. The certification planner never initiates payment automatically.",
    },
    {
      id: "booking",
      label: "Hotelbeds booking confirmation and voucher",
      status: "manual",
      destructive: true,
      reason: "Requires a successfully paid certification transaction. SafariPlug must not create a supplier reservation automatically from this planner.",
    },
    {
      id: "cancellation",
      label: "Cancellation simulation, then explicit cancellation",
      status: "manual",
      destructive: true,
      reason: "Simulation can be exercised on a certification booking; actual cancellation remains an explicit operator action and does not automatically refund M-Pesa.",
    },
  ];

  return {
    ready: steps.filter((step) => step.status === "ready").length,
    blocked: steps.filter((step) => step.status === "blocked").length,
    manual: steps.filter((step) => step.status === "manual").length,
    safeToRunAutomatically: steps.filter((step) => !step.destructive && step.status === "ready").map((step) => step.id),
    steps,
  };
}
