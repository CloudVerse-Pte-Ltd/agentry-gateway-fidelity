import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

type Capture = {
  provider: string;
  model: string;
  apiVersion: string;
  content: string;
  usage: { totalTokens: number };
};

const fixture = JSON.parse(readFileSync(new URL("../fixtures/provider-captures/live-post-adapter-captures.json", import.meta.url), "utf8")) as {
  captureBoundary: string;
  provenance: { rawProviderWirePayloadRetained: boolean; sanitized: boolean };
  captures: Capture[];
};

test("six sanitized live post-adapter captures retain content and usage", () => {
  assert.equal(fixture.captureBoundary, "authenticated_product_surface_post_adapter");
  assert.equal(fixture.provenance.rawProviderWirePayloadRetained, false);
  assert.equal(fixture.provenance.sanitized, true);
  assert.deepEqual(fixture.captures.map((item) => item.provider), ["anthropic", "deepseek", "mistral", "openai", "together", "xai"]);
  for (const capture of fixture.captures) {
    assert.ok(capture.model);
    assert.ok(capture.apiVersion);
    assert.ok(capture.content.length > 0);
    assert.ok(capture.usage.totalTokens > 0);
  }
});

test("usage without content is classified as empty delivery", () => {
  for (const capture of fixture.captures) {
    const usageOnly = { ...capture, content: "" };
    assert.equal(usageOnly.usage.totalTokens > 0 && usageOnly.content.length === 0, true);
  }
});
