import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { canTransition } from "../lib/state";

describe("submission transitions", () => {
  it("follows the creator pipeline", () => {
    assert.equal(canTransition("DRAFT", "SOURCE_RECEIVED"), true);
    assert.equal(canTransition("SOURCE_RECEIVED", "RIGHTS_ATTESTED"), true);
    assert.equal(canTransition("RIGHTS_ATTESTED", "GENERATION_QUEUED"), true);
    assert.equal(canTransition("PREVIEW_READY", "CREATOR_CONFIRMED"), true);
    assert.equal(canTransition("UNDER_REVIEW", "APPROVED_FOR_COMMITMENT"), true);
    assert.equal(canTransition("QUOTE_ISSUED", "COMMITMENT_PENDING"), true);
    assert.equal(canTransition("ACTIVE", "OPTED_OUT"), true);
  });

  it("blocks skipping review or minting eligibility from Discord alone", () => {
    assert.equal(canTransition("PREVIEW_READY", "ACTIVE"), false);
    assert.equal(canTransition("CREATOR_CONFIRMED", "ACTIVE"), false);
    assert.equal(canTransition("UNDER_REVIEW", "ACTIVE"), false);
    assert.equal(canTransition("OPTED_OUT", "ACTIVE"), false);
  });
});
