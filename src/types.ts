export type Protocol = "anthropic" | "openai";
export type Surface = "anthropic-messages" | "openai-chat" | "openai-responses";
export type Mode = "live" | "fixture";
export type Verdict = "PASS" | "REFUSED" | "DEGRADED" | "SILENTLY_REWRITTEN";
export type Status = Verdict | "UNSUPPORTED" | "INDETERMINATE" | "INDICATIVE" | "SKIPPED" | "ERROR";

export interface ProbeSpec {
  id: string;
  title: string;
  caseNumber: number;
  mode: Mode;
  surfaces: Surface[];
  maxTokens: number;
  request: (surface: Surface, model: string) => Record<string, unknown>;
  continuation?: (surface: Surface, model: string, first: WireResponse) => Record<string, unknown>;
  observe: (response: WireResponse, surface: Surface) => Observation;
  compare?: (baseline: Observation, gateway: Observation) => Comparison;
  advisory?: boolean;
}

export interface CaseSpec {
  number: number;
  slug: string;
  title: string;
  mode: Mode;
  rationale: string;
  probes: ProbeSpec[];
  exclusions?: Partial<Record<Surface, string>>;
}

export interface WireResponse {
  ok: boolean;
  status: number;
  headers: Record<string, string>;
  json?: unknown;
  stream?: StreamObservation;
  error?: { type: string; code?: string; param?: string };
  durationMs: number;
}

export interface StreamObservation {
  chunks: number;
  nonEmptyDeltas: number;
  terminal: boolean;
  finishReason?: string;
  usagePresent: boolean;
  typedError: boolean;
  toolArgumentFragments: number;
}

export interface Observation {
  supported: boolean;
  success: boolean;
  refused: boolean;
  feature: boolean;
  complete?: boolean;
  metadata?: boolean;
  signal?: string;
  httpStatus?: number;
  errorType?: string;
  errorCode?: string;
  errorParam?: string;
  detail: string;
}

export interface Comparison { status: Status; detail: string }

export interface ProbeResult {
  caseNumber: number;
  caseTitle: string;
  probeId: string;
  probeTitle: string;
  mode: Mode;
  surface: Surface;
  status: Status;
  detail: string;
  baseline: Observation;
  gateway?: Observation;
}

export interface RunReport {
  schemaVersion: 1;
  generatedAt: string;
  gateway: string;
  baselines: Partial<Record<Protocol, string>>;
  models: Partial<Record<Surface, string>>;
  limits: { requests: number; maxRequests: number; maxTokensPerRequest: number };
  results: ProbeResult[];
  summary: Record<Status, number>;
}
