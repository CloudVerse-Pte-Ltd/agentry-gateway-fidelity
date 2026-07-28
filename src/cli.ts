#!/usr/bin/env node
import { human, writeReports } from "./reporters.js";
import { plannedRequests, runSuite } from "./runner.js";
import type { Mode, Surface } from "./types.js";

interface Args { [key: string]: string | boolean | undefined }
function parse(argv: string[]): Args {
  const out: Args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (!item.startsWith("--")) throw new Error(`Unexpected argument: ${item}`);
    const key = item.slice(2);
    if (["fixtures","help"].includes(key)) out[key] = true;
    else if (["json","markdown"].includes(key)) out[key] = argv[index + 1]?.startsWith("--") || !argv[index + 1] ? true : argv[++index];
    else { const value = argv[++index]; if (!value || value.startsWith("--")) throw new Error(`--${key} requires a value`); out[key] = value; }
  }
  return out;
}
function required(args: Args, name: string, env?: string): string { const value = args[name] || (env ? process.env[env] : undefined); if (!value || value === true) throw new Error(`Missing --${name}`); return String(value); }
function output(value: string | boolean | undefined, extension: string): string | undefined { if (!value) return undefined; return value === true ? `gateway-fidelity-${new Date().toISOString().slice(0,10)}.${extension}` : String(value); }

const HELP = `Usage:
  gateway-fidelity --base-url <gateway> --key <gateway-key> --protocol anthropic|openai|both
    [--anthropic-baseline-url <url>] [--openai-baseline-url <url>] [--model <id>]
    [--anthropic-model <id>] [--openai-model <id>]
    [--openai-chat-model <id>] [--openai-responses-model <id>] [--fixtures]
    [--gateway-auth bearer|native]
    [--max-requests <n>] [--max-tokens <n>] [--json [file]] [--markdown [file]]

Each enabled protocol requires its own direct-provider baseline. Fixture cases are excluded unless --fixtures is set.
Keys may be supplied through GATEWAY_FIDELITY_KEY, GATEWAY_FIDELITY_ANTHROPIC_BASELINE_KEY,
and GATEWAY_FIDELITY_OPENAI_BASELINE_KEY. A gateway or proxy is not a valid baseline.`;

async function main() {
  const args = parse(process.argv.slice(2));
  if (args.help) { console.log(HELP); return; }
  if (args["baseline-url"] || args["baseline-key"]) throw new Error("Shared --baseline-url/--baseline-key are not accepted; configure direct Anthropic and OpenAI baselines separately.");
  const protocol = String(args.protocol || "both");
  if (!['anthropic','openai','both'].includes(protocol)) throw new Error("--protocol must be anthropic, openai, or both");
  const surfaces: Surface[] = protocol === "anthropic" ? ["anthropic-messages"] : protocol === "openai" ? ["openai-chat","openai-responses"] : ["anthropic-messages","openai-chat","openai-responses"];
  const defaultModel = args.model && args.model !== true ? String(args.model) : undefined;
  const anthropicModel = args["anthropic-model"] || defaultModel;
  const openAiFallback = args["openai-model"] || defaultModel;
  const openAiChatModel = args["openai-chat-model"] || openAiFallback;
  const openAiResponsesModel = args["openai-responses-model"] || openAiFallback;
  if (surfaces.includes("anthropic-messages") && !anthropicModel) throw new Error("Missing --anthropic-model or --model");
  if (surfaces.includes("openai-chat") && !openAiChatModel) throw new Error("Missing --openai-chat-model, --openai-model, or --model");
  if (surfaces.includes("openai-responses") && !openAiResponsesModel) throw new Error("Missing --openai-responses-model, --openai-model, or --model");
  const models: Partial<Record<Surface,string>> = {
    ...(surfaces.includes("anthropic-messages") ? { "anthropic-messages": String(anthropicModel) } : {}),
    ...(surfaces.includes("openai-chat") ? { "openai-chat": String(openAiChatModel), "openai-responses": String(openAiResponsesModel) } : {}),
  };
  const baselineUrls = {
    ...(surfaces.includes("anthropic-messages") ? { anthropic: required(args, "anthropic-baseline-url") } : {}),
    ...(surfaces.some((surface) => surface.startsWith("openai-")) ? { openai: required(args, "openai-baseline-url") } : {}),
  };
  const baselineKeys = {
    ...(surfaces.includes("anthropic-messages") ? { anthropic: required(args, "anthropic-baseline-key", "GATEWAY_FIDELITY_ANTHROPIC_BASELINE_KEY") } : {}),
    ...(surfaces.some((surface) => surface.startsWith("openai-")) ? { openai: required(args, "openai-baseline-key", "GATEWAY_FIDELITY_OPENAI_BASELINE_KEY") } : {}),
  };
  const modes: Mode[] = args.fixtures ? ["live","fixture"] : ["live"];
  const gatewayAuth = String(args["gateway-auth"] || "bearer");
  if (!['bearer','native'].includes(gatewayAuth)) throw new Error("--gateway-auth must be bearer or native");
  const maxRequests = Number(args["max-requests"] || 200);
  const maxTokens = Number(args["max-tokens"] || 64);
  const preview = plannedRequests({ surfaces, modes });
  console.error(`Planned requests: ${preview}; maximum tokens per request: ${maxTokens}; request cap: ${maxRequests}.`);
  if (preview > maxRequests) throw new Error(`Planned request count ${preview} exceeds --max-requests ${maxRequests}.`);
  const report = await runSuite({
    baseUrl: required(args, "base-url"), baselineUrls,
    key: required(args, "key", "GATEWAY_FIDELITY_KEY"), baselineKeys,
    surfaces, models, modes, gatewayAuth: gatewayAuth as "bearer" | "native", maxRequests, maxTokens, timeoutMs: Number(args["timeout-ms"] || 30_000),
  });
  console.log(human(report));
  await writeReports(report, { json: output(args.json, "json"), markdown: output(args.markdown, "md") });
  if (report.summary.SILENTLY_REWRITTEN || report.summary.ERROR) process.exitCode = 2;
}

main().catch((error) => { console.error(`gateway-fidelity: ${error instanceof Error ? error.message : String(error)}`); process.exitCode = 1; });
