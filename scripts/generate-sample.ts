import { mkdir } from "node:fs/promises";
import { startMockEndpoint } from "../test/mock-endpoint.js";
import { runSuite } from "../src/runner.js";
import { writeReports } from "../src/reporters.js";

const baseline = await startMockEndpoint();
const gateway = await startMockEndpoint();
try {
  const report = await runSuite({
    baseUrl: gateway.url,
    baselineUrls: { anthropic: baseline.url, openai: baseline.url },
    key: "mock-gateway-key",
    baselineKeys: { anthropic: "mock-baseline-key", openai: "mock-baseline-key" },
    surfaces: ["anthropic-messages", "openai-chat", "openai-responses"],
    models: { "anthropic-messages": "mock-model", "openai-chat": "mock-model", "openai-responses": "mock-model" },
    modes: ["live"],
    maxRequests: 200,
    maxTokens: 64,
    timeoutMs: 2_000,
  });
  report.generatedAt = "2026-07-29T00:00:00.000Z";
  report.gateway = "mock://gateway";
  report.baselines = { anthropic: "mock://anthropic-direct", openai: "mock://openai-direct" };
  await mkdir("examples", { recursive: true });
  await writeReports(report, { json: "examples/mock-report.json", markdown: "examples/mock-report.md" });
} finally {
  await baseline.close();
  await gateway.close();
}
