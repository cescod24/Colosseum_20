import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { decide, type RuleItem, type Rules } from "./rules";

const safeItem: RuleItem = { product_group: "Fasteners", hazardous: false };
const hazardousItem: RuleItem = { product_group: "Spray", hazardous: true };
const restrictedItem: RuleItem = { product_group: "Hazardous", hazardous: false };
const nullGroupItem: RuleItem = { product_group: null, hazardous: false };

const baseRules: Rules = {
  threshold: 200,
  restricted_groups: ["Hazardous"],
};

describe("decide()", () => {
  it("approves a small, safe, non-restricted order", () => {
    assert.equal(decide(40, [safeItem, safeItem], baseRules), "approved");
  });

  it("trips pending when total equals threshold (>= boundary)", () => {
    assert.equal(decide(200, [safeItem], baseRules), "pending");
  });

  it("approves when total is just below threshold", () => {
    assert.equal(decide(199.99, [safeItem], baseRules), "approved");
  });

  it("trips pending when any item is hazardous", () => {
    assert.equal(decide(40, [safeItem, hazardousItem], baseRules), "pending");
  });

  it("trips pending when an item's product_group is restricted", () => {
    assert.equal(decide(40, [safeItem, restrictedItem], baseRules), "pending");
  });

  it("never restricts items with a null product_group", () => {
    assert.equal(decide(40, [nullGroupItem], baseRules), "approved");
  });

  it("returns approved for an empty cart at total 0 (degenerate but defined)", () => {
    assert.equal(decide(0, [], baseRules), "approved");
  });

  it("returns pending when multiple rules trip at once", () => {
    assert.equal(
      decide(500, [hazardousItem, restrictedItem], baseRules),
      "pending",
    );
  });

  it("respects an empty restricted_groups list (only threshold + hazardous fire)", () => {
    const openRules: Rules = { threshold: 200, restricted_groups: [] };
    assert.equal(decide(40, [restrictedItem], openRules), "approved");
    assert.equal(decide(40, [hazardousItem], openRules), "pending");
  });
});
