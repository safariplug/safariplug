import assert from "node:assert/strict";
import test from "node:test";
import { deterministicPartnerInvitationDraft } from "../email/partner-invitation-draft";

test("supplier invitation fallback tailors by category and city without inventing claims", () => {
  const draft = deterministicPartnerInvitationDraft({
    businessName: "Coastal Dive Co",
    partnerType: "Diving & Marine",
    city: "Diani",
    signupLink: "https://www.safariplug.com/partners/join/test-token",
  });

  assert.match(draft.subject, /Coastal Dive Co/);
  assert.match(draft.message, /Diving & Marine partner network in Diani/);
  assert.match(draft.message, /Coastal Dive Co/);
  assert.match(draft.message, /test-token/);
  assert.doesNotMatch(draft.message, /award|guarantee|best|top-rated/i);
});

test("supplier invitation fallback stays generic for provisional names", () => {
  const draft = deterministicPartnerInvitationDraft({
    businessName: "Invited supplier",
    partnerType: "Hotels",
    city: "Nairobi",
    signupLink: "https://www.safariplug.com/partners/join/test-token",
  });

  assert.doesNotMatch(draft.subject, /Invited supplier/i);
  assert.doesNotMatch(draft.message, /Invited supplier/i);
  assert.match(draft.message, /Hotels partner network in Nairobi/);
});
