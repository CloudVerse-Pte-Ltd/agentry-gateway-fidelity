import { createHash } from "node:crypto";
import { cases } from "../cases/index.js";
import { safeUrl } from "./redact.js";
import { sendRequest } from "./transport.js";
import type { GatewayAuth } from "./transport.js";
import type { Mode, ProbeResult, Protocol, RunReport, Status, Surface } from "./types.js";
import { compareObservations } from "./verdict.js";

export interface RunOptions {
  baseUrl: string; baselineUrls: Partial<Record<Protocol, string>>; key: string; baselineKeys: Partial<Record<Protocol, string>>;
  surfaces: Surface[]; models: Partial<Record<Surface, string>>;
  modes: Mode[]; maxRequests: number; maxTokens: number; timeoutMs: number;
  gatewayAuth?: GatewayAuth;
  caseNumbers?: number[];
}

function selectedCases(options: Pick<RunOptions, "modes" | "caseNumbers">) { return cases.filter((item) => options.modes.includes(item.mode) && (!options.caseNumbers || options.caseNumbers.includes(item.number))); }

export function plannedRequests(options: Pick<RunOptions, "surfaces" | "modes" | "caseNumbers">): number {
  return selectedCases(options).flatMap((item) => item.probes).reduce((count, probe) => count + probe.surfaces.filter((surface) => options.surfaces.includes(surface)).length * (probe.continuation ? 4 : 2), 0);
}

export function plannedRequestsByCase(options: Pick<RunOptions, "surfaces" | "modes" | "caseNumbers">): Array<{ caseNumber: number; perSurfacePerTarget: Partial<Record<Surface, number>>; pairedTotal: number }> {
  return selectedCases(options).map((item) => {
    const perSurfacePerTarget = Object.fromEntries(options.surfaces.map((surface) => [surface, item.probes.reduce((count, probe) => count + (probe.surfaces.includes(surface) ? (probe.continuation ? 2 : 1) : 0), 0)])) as Partial<Record<Surface, number>>;
    return { caseNumber: item.number, perSurfacePerTarget, pairedTotal: Object.values(perSurfacePerTarget).reduce((sum, count) => sum + (count || 0), 0) * 2 };
  });
}

export async function runSuite(options: RunOptions): Promise<RunReport> {
  validateBaselines(options);
  const planned = plannedRequests(options);
  if (planned > options.maxRequests) throw new Error(`Planned request count ${planned} exceeds --max-requests ${options.maxRequests}.`);
  const results: ProbeResult[] = [];
  let requests = 0;
  for (const item of selectedCases(options)) {
    for (const surface of options.surfaces) {
      const reason = item.exclusions?.[surface];
      if (!reason) continue;
      const baseline = { supported: false, success: false, refused: false, feature: false, detail: reason };
      results.push({ caseNumber: item.number, caseTitle: item.title, probeId: `${String(item.number).padStart(2, "0")}.excluded`, probeTitle: item.title, mode: item.mode, surface, status: "INDETERMINATE", detail: `The case could not be evaluated: ${reason} No direct-provider response was recorded.`, baseline });
    }
    for (const probe of item.probes) {
      if (probe.maxTokens > options.maxTokens) throw new Error(`Case ${item.number} requests ${probe.maxTokens} tokens, above --max-tokens ${options.maxTokens}.`);
      for (const surface of probe.surfaces.filter((candidate) => options.surfaces.includes(candidate))) {
        const model = options.models[surface];
        if (!model) continue;
        const body = probe.request(surface, model);
        const baseline = baselineForSurface(options, surface);
        let baselineWire = await sendRequest({ baseUrl: baseline.url, key: baseline.key, target: "baseline", surface, body, timeoutMs: options.timeoutMs }); requests += 1;
        let gatewayWire = await sendRequest({ baseUrl: options.baseUrl, key: options.key, target: "gateway", gatewayAuth: options.gatewayAuth, surface, body, timeoutMs: options.timeoutMs }); requests += 1;
        if (probe.continuation) {
          const baselineNext = probe.continuation(surface, model, baselineWire);
          const gatewayNext = probe.continuation(surface, model, gatewayWire);
          baselineWire = await sendRequest({ baseUrl: baseline.url, key: baseline.key, target: "baseline", surface, body: baselineNext, timeoutMs: options.timeoutMs }); requests += 1;
          gatewayWire = await sendRequest({ baseUrl: options.baseUrl, key: options.key, target: "gateway", gatewayAuth: options.gatewayAuth, surface, body: gatewayNext, timeoutMs: options.timeoutMs }); requests += 1;
        }
        const baselineObservation = probe.observe(baselineWire, surface);
        const gateway = probe.observe(gatewayWire, surface);
        if (item.number === 13 || item.number === 14) {
          baselineObservation.signal = createHash("sha256").update(JSON.stringify(baselineWire.json)).digest("hex").slice(0, 12);
          gateway.signal = createHash("sha256").update(JSON.stringify(gatewayWire.json)).digest("hex").slice(0, 12);
        }
        const comparison = probe.compare?.(baselineObservation, gateway) ?? compareObservations(baselineObservation, gateway, probe.advisory);
        results.push({ caseNumber: item.number, caseTitle: item.title, probeId: probe.id, probeTitle: probe.title, mode: item.mode, surface, status: comparison.status, detail: comparison.detail, baseline: baselineObservation, gateway });
      }
    }
  }
  reconcileRepeats(results);
  const summary = Object.fromEntries((["PASS","REFUSED","DEGRADED","SILENTLY_REWRITTEN","UNSUPPORTED","INDETERMINATE","INDICATIVE","SKIPPED","ERROR"] as Status[]).map((status) => [status, results.filter((result) => result.status === status).length])) as Record<Status, number>;
  return { schemaVersion: 1, generatedAt: new Date().toISOString(), gateway: safeUrl(options.baseUrl), baselines: Object.fromEntries(Object.entries(options.baselineUrls).map(([protocol, url]) => [protocol, safeUrl(url)])), models: options.models, limits: { requests, maxRequests: options.maxRequests, maxTokensPerRequest: options.maxTokens }, results, summary };
}

function protocolForSurface(surface: Surface): Protocol { return surface === "anthropic-messages" ? "anthropic" : "openai"; }
function baselineForSurface(options: RunOptions, surface: Surface): { url: string; key: string } {
  const protocol = protocolForSurface(surface); const url = options.baselineUrls[protocol]; const key = options.baselineKeys[protocol];
  if (!url || !key) throw new Error(`Missing direct-provider ${protocol} baseline URL or key.`);
  return { url, key };
}
function validateBaselines(options: RunOptions): void {
  for (const surface of options.surfaces) {
    const baseline = baselineForSurface(options, surface);
    if (safeUrl(baseline.url) === safeUrl(options.baseUrl)) throw new Error(`${protocolForSurface(surface)} baseline URL must not be the gateway URL.`);
  }
}

function reconcileRepeats(results: ProbeResult[]): void {
  for (const caseNumber of [13, 14]) for (const surface of ["anthropic-messages","openai-chat","openai-responses"] as Surface[]) {
    const group = results.filter((result) => result.caseNumber === caseNumber && result.surface === surface);
    if (group.length !== 2 || group.some((result) => !result.baseline.feature)) continue;
    const baselineStable = group[0].baseline.signal === group[1].baseline.signal;
    const gatewayStable = group[0].gateway?.signal === group[1].gateway?.signal;
    for (const result of group) {
      result.status = !baselineStable ? "INDETERMINATE" : gatewayStable ? "PASS" : "SILENTLY_REWRITTEN";
      result.detail = !baselineStable ? "The case could not be evaluated: direct-provider repeats were not deterministic." : gatewayStable ? "Gateway repeats matched under the requested determinism control." : "Direct-provider repeats matched, but gateway repeats diverged.";
    }
  }
}
