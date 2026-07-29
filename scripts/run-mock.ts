import { startMockEndpoint } from "../test/mock-endpoint.js";
import { human } from "../src/reporters.js";
import { runSuite } from "../src/runner.js";

console.log("Gateway Fidelity local mock — zero external traffic, zero provider cost.");
const baseline = await startMockEndpoint();
const gateway = await startMockEndpoint();
try {
  const report = await runSuite({
    baseUrl: gateway.url,
    baselineUrls: { anthropic: baseline.url, openai: baseline.url },
    key: "local-mock-gateway",
    baselineKeys: { anthropic: "local-mock-anthropic", openai: "local-mock-openai" },
    surfaces: ["anthropic-messages", "openai-chat", "openai-responses"],
    models: { "anthropic-messages": "mock-model", "openai-chat": "mock-model", "openai-responses": "mock-model" },
    modes: ["live"],
    maxRequests: 200,
    maxTokens: 64,
    timeoutMs: 2_000,
  });
  report.gateway = "mock://gateway";
  report.baselines = { anthropic: "mock://anthropic-direct", openai: "mock://openai-direct" };
  console.log(human(report));
} finally {
  await baseline.close();
  await gateway.close();
}
