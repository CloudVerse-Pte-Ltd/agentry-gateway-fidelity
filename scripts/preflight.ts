import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { startMockEndpoint } from "../test/mock-endpoint.js";

type Endpoint = { label: string; url: string; key: string; auth: "bearer" | "anthropic"; models: string[] };

function pass(message: string): void { console.log(`PASS  ${message}`); }
function fail(message: string): never { throw new Error(message); }

function requireNode(): void {
  const major = Number(process.versions.node.split(".")[0]);
  if (major < 20) fail(`Node ${process.versions.node} is too old. Install Node 20 or newer, then rerun npm ci.`);
  pass(`Node ${process.versions.node} satisfies >=20`);
}

function requireInstallAndBuild(): void {
  if (!existsSync("node_modules/typescript") || !existsSync("node_modules/tsx")) {
    fail("Dependencies are not installed. Run npm ci, then rerun preflight.");
  }
  pass("dependencies are installed");
  const build = spawnSync(process.platform === "win32" ? "npm.cmd" : "npm", ["run", "build"], { stdio: "pipe", encoding: "utf8" });
  if (build.status !== 0) fail(`Build failed. Run npm run build and fix the TypeScript errors before any paid run.\n${build.stderr || build.stdout}`);
  pass("TypeScript build succeeds");
}

function env(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) fail(`Missing ${name}. Copy .env.example, set the value in your shell, and rerun preflight.`);
  return value;
}

function httpsUrl(name: string): string {
  const value = env(name);
  let parsed: URL;
  try { parsed = new URL(value); } catch { fail(`${name} is not a valid absolute URL. Use a URL such as https://gateway.example.com.`); }
  if (parsed.protocol !== "https:" && parsed.hostname !== "127.0.0.1" && parsed.hostname !== "localhost") {
    fail(`${name} must use HTTPS for a real endpoint.`);
  }
  return value.replace(/\/$/, "");
}

function key(name: string): string {
  const value = env(name);
  if (value.length < 8 || /\s/.test(value)) fail(`${name} does not look like an API key. Remove whitespace and provide the complete credential.`);
  return value;
}

async function probe(endpoint: Endpoint): Promise<void> {
  let response: Response;
  try {
    response = await fetch(`${endpoint.url}/v1/models`, {
      headers: endpoint.auth === "anthropic"
        ? { "x-api-key": endpoint.key, "anthropic-version": "2023-06-01" }
        : { authorization: `Bearer ${endpoint.key}` },
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    fail(`${endpoint.label} is unreachable. Check the URL, DNS/network access, and firewall, then rerun preflight.`);
  }
  if (response.status === 401 || response.status === 403) {
    fail(`${endpoint.label} rejected its credential. Create or select a key entitled to list and invoke the chosen models.`);
  }
  if (!response.ok) {
    fail(`${endpoint.label} could not list models without billable inference. Confirm that its models-list endpoint is enabled and the base URL is correct.`);
  }
  const payload = await response.json() as any;
  const available = new Set((payload?.data || payload?.models || []).map((item: any) => String(item?.id || item?.name || item)));
  for (const model of endpoint.models) {
    if (!available.has(model)) fail(`${endpoint.label} does not list model "${model}". Choose a model available to this credential and rerun preflight.`);
  }
  pass(`${endpoint.label} is reachable, authenticated, and lists ${endpoint.models.join(", ")}`);
}

async function mockPreflight(): Promise<void> {
  const baseline = await startMockEndpoint();
  const gateway = await startMockEndpoint();
  try {
    await probe({ label: "local mock gateway", url: gateway.url, key: "mock-gateway", auth: "bearer", models: ["mock-model"] });
    await probe({ label: "local mock direct baseline", url: baseline.url, key: "mock-baseline", auth: "bearer", models: ["mock-model"] });
  } finally {
    await baseline.close();
    await gateway.close();
  }
  console.log("\nREADY — npm start will make 178 local mock requests, send no external traffic, and cost $0.");
  console.log("For paid traffic, configure .env.example values and run: npm run preflight -- --real");
}

async function realPreflight(): Promise<void> {
  const gatewayUrl = httpsUrl("GATEWAY_FIDELITY_GATEWAY_URL");
  const anthropicUrl = httpsUrl("GATEWAY_FIDELITY_ANTHROPIC_BASELINE_URL");
  const openaiUrl = httpsUrl("GATEWAY_FIDELITY_OPENAI_BASELINE_URL");
  if (new Set([gatewayUrl, anthropicUrl, openaiUrl]).size !== 3) fail("Gateway and direct-baseline URLs must be three distinct endpoints.");
  const gatewayKey = key("GATEWAY_FIDELITY_KEY");
  const anthropicKey = key("GATEWAY_FIDELITY_ANTHROPIC_BASELINE_KEY");
  const openaiKey = key("GATEWAY_FIDELITY_OPENAI_BASELINE_KEY");
  const anthropicModel = env("GATEWAY_FIDELITY_ANTHROPIC_MODEL");
  const openaiModel = env("GATEWAY_FIDELITY_OPENAI_MODEL");
  await probe({ label: "gateway", url: gatewayUrl, key: gatewayKey, auth: "bearer", models: [anthropicModel, openaiModel] });
  await probe({ label: "Anthropic direct baseline", url: anthropicUrl, key: anthropicKey, auth: "anthropic", models: [anthropicModel] });
  await probe({ label: "OpenAI direct baseline", url: openaiUrl, key: openaiKey, auth: "bearer", models: [openaiModel] });
  console.log("\nREADY — smoke will make 18 paid HTTP requests (9 paired observations), capped at 64 output tokens each; estimated cost with small models: about $0.01–$0.20.");
  console.log("Full will make 178 paid HTTP requests (89 paired observations), capped at 64 output tokens each; estimated cost with small models: about $0.05–$2.");
  console.log("Preflight itself made only free models-list requests. Run the smoke command printed in README before considering full.");
}

requireNode();
requireInstallAndBuild();
await (process.argv.includes("--real") ? realPreflight() : mockPreflight());
