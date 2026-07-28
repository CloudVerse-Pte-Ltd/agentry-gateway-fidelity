import { createHash } from "node:crypto";
import { cases } from "../cases/index.js";
import { sendRequest, type GatewayAuth } from "./transport.js";
import type { ProbeResult, RunReport, Status, Surface } from "./types.js";
import { compareObservations } from "./verdict.js";

export interface DeltaCell {
  caseNumber: number;
  probeId: string;
  surface: Surface;
}

export interface GatewayDeltaOptions {
  report: RunReport;
  baseUrl: string;
  key: string;
  cells: DeltaCell[];
  gatewayAuth?: GatewayAuth;
  maxRequests: number;
  maxTokens: number;
  timeoutMs: number;
}

const statuses: Status[] = ["PASS","REFUSED","DEGRADED","SILENTLY_REWRITTEN","UNSUPPORTED","INDETERMINATE","INDICATIVE","SKIPPED","ERROR"];

function cellKey(cell: DeltaCell) {
  return `${cell.caseNumber}:${cell.probeId}:${cell.surface}`;
}

export function cellsWithGatewayDetail(report: RunReport, pattern: RegExp): DeltaCell[] {
  return report.results
    .filter((result) => result.gateway && pattern.test(result.detail))
    .map((result) => ({ caseNumber: result.caseNumber, probeId: result.probeId, surface: result.surface }));
}

export function plannedGatewayRequestsForCells(cells: DeltaCell[]): number {
  return cells.reduce((count, cell) => {
    const item = cases.find((candidate) => candidate.number === cell.caseNumber);
    const probe = item?.probes.find((candidate) => candidate.id === cell.probeId);
    if (!probe) throw new Error(`Unknown delta cell ${cellKey(cell)}`);
    return count + (probe.continuation ? 2 : 1);
  }, 0);
}

export async function rerunGatewayCells(options: GatewayDeltaOptions): Promise<RunReport> {
  const planned = plannedGatewayRequestsForCells(options.cells);
  if (planned > options.maxRequests) throw new Error(`Planned gateway request count ${planned} exceeds --max-requests ${options.maxRequests}.`);
  const replacements = new Map<string, ProbeResult>();
  let requests = 0;

  for (const cell of options.cells) {
    const original = options.report.results.find((result) => cellKey(result) === cellKey(cell));
    if (!original) throw new Error(`Original report does not contain delta cell ${cellKey(cell)}`);
    const item = cases.find((candidate) => candidate.number === cell.caseNumber);
    const probe = item?.probes.find((candidate) => candidate.id === cell.probeId);
    if (!item || !probe) throw new Error(`Unknown delta cell ${cellKey(cell)}`);
    if (!probe.surfaces.includes(cell.surface)) throw new Error(`Probe ${cell.probeId} does not support ${cell.surface}`);
    if (probe.maxTokens > options.maxTokens) throw new Error(`Case ${cell.caseNumber} requests ${probe.maxTokens} tokens, above --max-tokens ${options.maxTokens}.`);
    const model = options.report.models[cell.surface];
    if (!model) throw new Error(`Original report does not include a model for ${cell.surface}`);

    const body = probe.request(cell.surface, model);
    let gatewayWire = await sendRequest({ baseUrl: options.baseUrl, key: options.key, target: "gateway", gatewayAuth: options.gatewayAuth, surface: cell.surface, body, timeoutMs: options.timeoutMs });
    requests += 1;
    if (probe.continuation) {
      const gatewayNext = probe.continuation(cell.surface, model, gatewayWire);
      gatewayWire = await sendRequest({ baseUrl: options.baseUrl, key: options.key, target: "gateway", gatewayAuth: options.gatewayAuth, surface: cell.surface, body: gatewayNext, timeoutMs: options.timeoutMs });
      requests += 1;
    }

    const gateway = probe.observe(gatewayWire, cell.surface);
    if (item.number === 13 || item.number === 14) {
      gateway.signal = createHash("sha256").update(JSON.stringify(gatewayWire.json)).digest("hex").slice(0, 12);
    }
    const comparison = probe.compare?.(original.baseline, gateway) ?? compareObservations(original.baseline, gateway, probe.advisory);
    replacements.set(cellKey(cell), { ...original, status: comparison.status, detail: comparison.detail, gateway });
  }

  const results = options.report.results.map((result) => replacements.get(cellKey(result)) || result);
  const summary = Object.fromEntries(statuses.map((status) => [status, results.filter((result) => result.status === status).length])) as Record<Status, number>;
  return {
    ...options.report,
    generatedAt: new Date().toISOString(),
    gateway: options.report.gateway,
    limits: { requests, maxRequests: options.maxRequests, maxTokensPerRequest: options.maxTokens },
    results,
    summary,
  };
}
