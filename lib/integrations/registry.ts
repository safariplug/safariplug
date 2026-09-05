import { getAurelianConfig, INBOUND_EVENTS_PATH } from "./aurelian/config";

export type IntegrationCapability =
  | "inventory_pull"
  | "inventory_push"
  | "availability"
  | "pricing"
  | "booking"
  | "cancellation"
  | "webhooks"
  | "health";

export type IntegrationDescriptor = {
  id: string;
  inbound_path: string | null;
  inbound_configured: boolean;
  outbound_available: boolean;
  outbound_reason: string | null;
  capabilities: IntegrationCapability[];
};

export function listIntegrations(): IntegrationDescriptor[] {
  const aurelian = getAurelianConfig();
  return [
    {
      id: "aurelian",
      inbound_path: INBOUND_EVENTS_PATH,
      inbound_configured: aurelian.inboundKeyConfigured,
      outbound_available: aurelian.outboundContractAvailable,
      outbound_reason: aurelian.outboundBlockedReason,
      capabilities: ["inventory_pull"],
    },
  ];
}
