export type { VerificationAdapter } from "./adapter";
export { VERIFICATION_PROVIDER_NAMES } from "./adapter";
export { UnavailableVerificationAdapter } from "./not-configured";
export {
  describeVerificationProviders,
  getVerificationAdapter,
  liveVerificationAdapters,
  registerVerificationAdapter,
  unregisterVerificationAdapter,
} from "./registry";
export * from "./types";
