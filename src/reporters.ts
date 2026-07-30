import { writeFile } from "node:fs/promises";
import type { ProbeResult, RunReport, Surface } from "./types.js";

const surfaces: Surface[] = ["anthropic-messages", "openai-chat", "openai-responses"];
const label: Record<Surface,string> = { "anthropic-messages": "Anthropic Messages", "openai-chat": "OpenAI Chat", "openai-responses": "OpenAI Responses" };
function cell(result?: ProbeResult): string { return result ? `${result.status}${result.detail ? ` — ${result.detail}` : ""}` : "—"; }
function presentationMode(report: RunReport): string {
  return report.gateway.startsWith("mock://")
    ? "mock (controlled local endpoints, no provider calls made)"
    : "real (gateway and direct-provider baseline calls)";
}
function laneLabel(result: ProbeResult): string { return result.mode === "live" ? "gateway" : "fixture"; }

export function human(report: RunReport): string {
  const rows = report.results.map((result) => `${laneLabel(result).padEnd(7)} ${String(result.caseNumber).padStart(2,"0")} ${result.caseTitle.padEnd(31)} ${label[result.surface].padEnd(19)} ${result.status}`).join("\n");
  return [`Gateway fidelity delta`, `Mode: ${presentationMode(report)}`, `Gateway: ${report.gateway}`, `Anthropic direct baseline: ${report.baselines.anthropic || "not enabled"}`, `OpenAI direct baseline: ${report.baselines.openai || "not enabled"}`, `Requests: ${report.limits.requests}/${report.limits.maxRequests}; max tokens/request: ${report.limits.maxTokensPerRequest}`, "", rows, "", `Summary: ${Object.entries(report.summary).map(([key,value]) => `${key}=${value}`).join(" ")}`].join("\n");
}

export function markdown(report: RunReport): string {
  const sections = (["live","fixture"] as const).flatMap((mode) => {
    const modeResults = report.results.filter((result) => result.mode === mode);
    if (!modeResults.length) return [];
    const caseNumbers = [...new Set(modeResults.map((result) => result.caseNumber))];
    const rows = caseNumbers.map((number) => {
      const found = modeResults.filter((result) => result.caseNumber === number);
      return `| ${number}. ${found[0]?.caseTitle || ""} | ${surfaces.map((surface) => cell(found.find((result) => result.surface === surface))).join(" | ")} |`;
    });
    return [`## ${mode === "live" ? "Gateway comparison cases" : "Fixture cases (controlled endpoints only)"}`, "", "| Case | Anthropic Messages | OpenAI Chat Completions | OpenAI Responses |", "|---|---|---|---|", ...rows, ""];
  });
  return [`# Gateway fidelity report`, "", `Generated: ${report.generatedAt}`, `Mode: ${presentationMode(report)}`, `Gateway: ${report.gateway}`, `Anthropic direct baseline: ${report.baselines.anthropic || "not enabled"}`, `OpenAI direct baseline: ${report.baselines.openai || "not enabled"}`, "", "> UNSUPPORTED requires an explicit direct-provider refusal or lack-of-capability response recorded in the cell. INDETERMINATE means the case could not be evaluated and is never silently excluded.", "", ...sections, `Requests: ${report.limits.requests}; maximum tokens per request: ${report.limits.maxTokensPerRequest}.`, ""].join("\n");
}

export async function writeReports(report: RunReport, options: { json?: string; markdown?: string }): Promise<void> {
  if (options.json) await writeFile(options.json, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
  if (options.markdown) await writeFile(options.markdown, markdown(report), { mode: 0o600 });
}
