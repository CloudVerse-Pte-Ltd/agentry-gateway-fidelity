import type { StreamObservation, Surface, WireResponse } from "./types.js";

function endpoint(baseUrl: string, surface: Surface): string {
  const path = surface === "anthropic-messages" ? "/v1/messages" : surface === "openai-chat" ? "/v1/chat/completions" : "/v1/responses";
  return `${baseUrl.replace(/\/$/, "")}${path}`;
}

export type GatewayAuth = "bearer" | "native";

export function requestHeaders(surface: Surface, key: string, target: "gateway" | "baseline", gatewayAuth: GatewayAuth = "bearer"): Record<string, string> {
  if (target === "gateway" && gatewayAuth === "bearer") return { "content-type": "application/json", authorization: `Bearer ${key}` };
  return surface === "anthropic-messages"
    ? { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" }
    : { "content-type": "application/json", authorization: `Bearer ${key}` };
}

function errorShape(json: unknown): WireResponse["error"] {
  const root = json as any;
  const error = root?.error ?? (root?.type === "error" ? root : undefined);
  if (!error) return undefined;
  return { type: String(error.type || "error"), ...(error.code ? { code: String(error.code) } : {}), ...(error.param ? { param: String(error.param) } : {}) };
}

export function isEventStream(contentType: string | null): boolean {
  return /text\/event-stream/i.test(contentType || "");
}

function inspectStream(raw: string): StreamObservation {
  const frames = raw.split(/\r?\n\r?\n/).filter(Boolean);
  let nonEmptyDeltas = 0, terminal = false, usagePresent = false, typedError = false, toolArgumentFragments = 0;
  let finishReason: string | undefined;
  for (const frame of frames) {
    const dataLine = frame.split(/\r?\n/).find((line) => line.startsWith("data:"));
    if (!dataLine || dataLine.slice(5).trim() === "[DONE]") { if (dataLine) terminal = true; continue; }
    try {
      const value = JSON.parse(dataLine.slice(5).trim());
      const packed = JSON.stringify(value);
      if (/\.delta|content_block_delta|chat.completion.chunk/.test(String(value.type || value.object || "")) && /text|content|delta/.test(packed)) nonEmptyDeltas += 1;
      if (/completed|message_stop/.test(String(value.type || "")) || value.choices?.some?.((choice: any) => choice.finish_reason)) terminal = true;
      finishReason ||= value.choices?.[0]?.finish_reason || value.delta?.stop_reason || value.response?.status;
      if (value.usage || value.response?.usage) usagePresent = true;
      if (value.type === "error" || value.error) typedError = true;
      if (/input_json_delta|function_call_arguments\.delta|tool_calls/.test(packed)) toolArgumentFragments += 1;
    } catch { /* non-JSON frames are intentionally not retained */ }
  }
  return { chunks: frames.length, nonEmptyDeltas, terminal, finishReason, usagePresent, typedError, toolArgumentFragments };
}

export async function sendRequest(input: { baseUrl: string; key: string; target: "gateway" | "baseline"; gatewayAuth?: GatewayAuth; surface: Surface; body: Record<string, unknown>; timeoutMs: number }): Promise<WireResponse> {
  const started = performance.now();
  try {
    const response = await fetch(endpoint(input.baseUrl, input.surface), { method: "POST", headers: requestHeaders(input.surface, input.key, input.target, input.gatewayAuth), body: JSON.stringify(input.body), signal: AbortSignal.timeout(input.timeoutMs) });
    const responseHeaders = Object.fromEntries([...response.headers].map(([key, value]) => [key.toLowerCase(), value]));
    const isStream = isEventStream(response.headers.get("content-type"));
    let raw = "";
    let networkChunks = 0;
    if (isStream && response.body) {
      const reader = response.body.getReader(); const decoder = new TextDecoder();
      while (true) { const part = await reader.read(); if (part.done) break; networkChunks += 1; raw += decoder.decode(part.value, { stream: true }); }
      raw += decoder.decode();
    } else raw = await response.text();
    let json: unknown;
    if (!isStream) { try { json = JSON.parse(raw); } catch { json = undefined; } }
    const stream = isStream ? inspectStream(raw) : undefined;
    if (stream) stream.chunks = networkChunks;
    return { ok: response.ok, status: response.status, headers: responseHeaders, json, ...(stream ? { stream } : {}), error: errorShape(json), durationMs: Math.round(performance.now() - started) };
  } catch (error) {
    return { ok: false, status: 0, headers: {}, error: { type: error instanceof DOMException && error.name === "TimeoutError" ? "timeout" : "network_error" }, durationMs: Math.round(performance.now() - started) };
  }
}
