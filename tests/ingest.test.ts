import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { sniffMime, validateImage } from "../lib/ingest/images";
import { buildPlaceholderGlb, inspectGlb } from "../lib/generation/placeholder";
import { verifyDiscordRequest } from "../lib/discord/verify";

describe("ingest", () => {
  it("accepts PNG magic and rejects random bytes", () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 1, 2, 3]);
    assert.equal(sniffMime(png), "image/png");
    assert.equal(validateImage(png).ok, true);
    assert.equal(validateImage(Buffer.from("hello")).ok, false);
  });

  it("builds a valid placeholder GLB", () => {
    const glb = buildPlaceholderGlb();
    const check = inspectGlb(glb);
    assert.equal(check.valid, true);
    assert.ok(check.fileBytes > 100);
  });
});

describe("discord verify", () => {
  it("rejects missing or stale signatures", () => {
    assert.equal(verifyDiscordRequest("{}", null, "1").ok, false);
    assert.equal(verifyDiscordRequest("{}", "ab", "1").ok, false);
  });
});
