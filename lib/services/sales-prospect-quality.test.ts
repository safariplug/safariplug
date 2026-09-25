import assert from "node:assert/strict";
import test from "node:test";
import { salesProspectQualityIssues } from "./sales-prospect-quality";

test("rejects generated discovery placeholders", () => {
  const issues = salesProspectQualityIssues({
    business_name: "Mombasa Beach Clubs Discovery",
    city: "Mombasa",
    category: "Beach Clubs",
    contact_email: "hello@coastalclub.co.ke",
    source_url: "https://directory.co.ke/coastal-club",
    source_name: "Kenya Directory",
  });
  assert.ok(issues.some((issue) => issue.includes("generated discovery placeholder")));
});

test("rejects placeholder domains and placeholder email", () => {
  const issues = salesProspectQualityIssues({
    business_name: "Coastal Adventures",
    city: "Mombasa",
    category: "Experiences",
    website: "https://example.com",
    contact_email: "info@example.com",
    source_url: "https://example.org/listing",
    source_name: "Directory",
  });
  assert.ok(issues.some((issue) => issue.includes("placeholder domain")));
  assert.ok(issues.some((issue) => issue.includes("email is invalid")));
});

test("rejects a research-only lead with no direct business contact", () => {
  const issues = salesProspectQualityIssues({
    business_name: "Coastal Adventures",
    city: "Mombasa",
    category: "Experiences",
    website: "https://coastal-adventures.co.ke",
    facebook: "https://facebook.com/coastaladventures",
    source_url: "https://directory.co.ke/coastal-adventures",
    source_name: "Kenya Directory",
  });
  assert.ok(issues.some((issue) => issue.includes("No direct public business email or phone")));
});

test("requires external source evidence", () => {
  const issues = salesProspectQualityIssues({
    business_name: "Coastal Adventures",
    city: "Mombasa",
    category: "Experiences",
    contact_email: "hello@coastal-adventures.co.ke",
    source_url: "https://www.safariplug.com/admin/ai-sales",
    source_name: "SafariPlug",
  });
  assert.ok(issues.some((issue) => issue.includes("credible external")));
});

test("allows sourced email-ready prospect", () => {
  const issues = salesProspectQualityIssues({
    business_name: "Coastal Adventures",
    city: "Mombasa",
    category: "Experiences",
    contact_email: "hello@coastal-adventures.co.ke",
    source_url: "https://directory.co.ke/coastal-adventures",
    source_name: "Kenya Directory",
  });
  assert.deepEqual(issues, []);
});

test("allows sourced phone-only prospect for human contact review", () => {
  const issues = salesProspectQualityIssues({
    business_name: "Coastal Adventures",
    city: "Mombasa",
    category: "Experiences",
    phone: "+254 700 123 456",
    source_url: "https://directory.co.ke/coastal-adventures",
    source_name: "Kenya Directory",
  });
  assert.deepEqual(issues, []);
});
