import assert from "node:assert/strict";
import test from "node:test";
import { publicViatorProduct } from "./public-product";

test("public Viator product strips protected unique content and reviews", () => {
  const source = {
    status: "ACTIVE",
    productCode: "5010SYDNEY",
    title: "Sydney tour",
    description: "Public supplier description",
    productUrl: "https://www.viator.com/test?pid=partner&campaign=abc",
    reviews: { sources: [{ reviewCount: 50 }] },
    viatorUniqueContent: { description: "must not reach browser" },
    images: [{ variants: [{ url: "https://example.com/image.jpg", width: 720, height: 480 }] }],
    destinations: [{ ref: "357", primary: true }],
    productOptions: [{ productOptionCode: "48HOUR", description: "48 hour pass" }],
  };

  const result = publicViatorProduct(source);
  assert.equal(result.productCode, "5010SYDNEY");
  assert.equal(result.title, "Sydney tour");
  assert.equal(result.productUrl, source.productUrl);
  assert.equal("reviews" in result, false);
  assert.equal("viatorUniqueContent" in result, false);
});

test("public Viator product preserves affiliate URL exactly", () => {
  const url = "https://www.viator.com/tours/Test/d1-P1?mcid=1&pid=P001234&medium=api&campaign=safariplug";
  assert.equal(publicViatorProduct({ productUrl: url }).productUrl, url);
});
