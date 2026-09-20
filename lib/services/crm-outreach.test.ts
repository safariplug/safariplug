import assert from "node:assert/strict";
import { test } from "node:test";
import { chooseOutreachContact } from "./crm-outreach";

test("prefers a usable primary CRM contact", () => {
  assert.deepEqual(
    chooseOutreachContact(
      { id: "primary", email: "Primary@Example.com", phone: "+254700000001" },
      { id: "fallback", email: "fallback@example.com" },
      "business@example.com",
    ),
    {
      contactId: "primary",
      contactEmail: "primary@example.com",
      whatsappPhone: "+254700000001",
      contactSource: "crm_contact",
    },
  );
});

test("skips an empty primary CRM contact for a usable fallback", () => {
  assert.equal(
    chooseOutreachContact(
      { id: "primary", email: "", phone: "" },
      { id: "fallback", email: "fallback@example.com", phone: null },
      "business@example.com",
    ).contactId,
    "fallback",
  );
});

test("uses discovered business email without inventing a CRM contact or WhatsApp channel", () => {
  assert.deepEqual(
    chooseOutreachContact(null, null, "Info@Business.example"),
    {
      contactId: null,
      contactEmail: "info@business.example",
      whatsappPhone: "",
      contactSource: "discovered_business_email",
    },
  );
});

test("rejects invalid discovered email", () => {
  assert.equal(chooseOutreachContact(null, null, "not-an-email").contactSource, "none");
});
