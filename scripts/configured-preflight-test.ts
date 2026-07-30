import { spawn } from "node:child_process";
import { startMockEndpoint } from "../test/mock-endpoint.js";

const endpoints = await Promise.all([
  startMockEndpoint(),
  startMockEndpoint(),
  startMockEndpoint(),
]);

try {
  const [gateway, anthropic, openai] = endpoints;
  const child = spawn(
    process.execPath,
    ["--import", "tsx", "scripts/preflight.ts", "--real"],
    {
      env: {
        ...process.env,
        GATEWAY_FIDELITY_GATEWAY_URL: `${gateway.url}/v1`,
        GATEWAY_FIDELITY_KEY: "gateway-test-key",
        GATEWAY_FIDELITY_ANTHROPIC_BASELINE_URL: anthropic.url,
        GATEWAY_FIDELITY_ANTHROPIC_BASELINE_KEY: "anthropic-test-key",
        GATEWAY_FIDELITY_ANTHROPIC_MODEL: "mock-model",
        GATEWAY_FIDELITY_OPENAI_BASELINE_URL: openai.url,
        GATEWAY_FIDELITY_OPENAI_BASELINE_KEY: "openai-test-key",
        GATEWAY_FIDELITY_OPENAI_MODEL: "mock-model",
      },
      stdio: "inherit",
    },
  );
  const exitCode = await new Promise<number>((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (code) => resolve(code ?? 1));
  });
  if (exitCode !== 0) process.exitCode = exitCode;
} finally {
  await Promise.all(endpoints.map((endpoint) => endpoint.close()));
}
