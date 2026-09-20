import assert from "node:assert/strict";
import test from "node:test";
import { salesProspectQualityIssues } from "./sales-prospect-quality";

test("rejects generated discovery placeholders", () => {
  const issues = salesProspectQualityIssues({
    business_name: "Mombasa Beach Clubs Discovery",
    city: "Mombasa",
    category: "Beach Clubs",
    source_url: null,
    source_name: null,
  });
  assert.ok(issues.some((issue) => issue.includes("generated discovery placeholder")));
});

test("rejects placeholder domains", () => {
  const issues = salesProspectQualityIssues({
    business_name: "Zanzibar Beach Experience Partner",
    city: "Zanzibar",
    category: "Beach Clubs",
    website: "https://example.com",
    instagram: "https://instagram.com/example",
    source_url: "https://credible.example.org/listing",
    source_name: "Directory",
  });
  assert.ok(issues.some((issue) => issue.includes("placeholder domain")));
});

test("allows a sourced real prospect with a research path", () => {
  const issues = salesProspectQualityIssues({
    business_name: "Moonshine Beach Bar",
    city: "Mombasa",
    category: "Beach Clubs",
    facebook: "https://www.facebook.com/MoonshineMombasa/",
    source_url: "https://www.upkenya.com/place/moonshine-beach-bar/",
    source_name: "UpKenya",
  });
  assert.deepEqual(issues, []);
});
