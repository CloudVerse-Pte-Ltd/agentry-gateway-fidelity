import type { CaseSpec, Comparison, Observation, ProbeSpec, Surface, WireResponse } from "../src/types.js";

export type Feature =
  | "tool-auto" | "tool-required" | "tool-named" | "tool-schema" | "tool-loop" | "parallel-tools" | "tool-error"
  | "thinking" | "thinking-budget" | "cache" | "max-tokens" | "stop" | "determinism" | "seed" | "system" | "json"
  | "stream-deltas" | "finish-reason" | "terminal-usage" | "stream-error" | "stream-tools"
  | "refusal-shape" | "retry-after" | "unknown-parameter" | "model-not-found" | "model-identity" | "usage-origin" | "response-identity"
  | "tool-namespace";

const ALL = ["anthropic-messages", "openai-chat", "openai-responses"] as Surface[];

function tool(surface: Surface, name = "record_fidelity") {
  const schema = { type: "object", properties: { mode: { type: "string", enum: ["exact"] }, nested: { type: "object", properties: { count: { type: "integer" } }, required: ["count"], additionalProperties: false } }, required: ["mode", "nested"], additionalProperties: false };
  return surface === "anthropic-messages"
    ? { name, description: "Return exactly the requested observable values", input_schema: schema }
    : surface === "openai-chat"
      ? { type: "function", function: { name, description: "Return exactly the requested observable values", parameters: schema, strict: true } }
      : { type: "function", name, description: "Return exactly the requested observable values", parameters: schema, strict: true };
}

function base(surface: Surface, model: string, prompt: string, maxTokens: number): Record<string, unknown> {
  if (surface === "anthropic-messages") return { model, max_tokens: maxTokens, messages: [{ role: "user", content: prompt }] };
  if (surface === "openai-chat") return { model, max_tokens: maxTokens, messages: [{ role: "user", content: prompt }] };
  return { model, max_output_tokens: maxTokens, input: prompt };
}

function request(feature: Feature, surface: Surface, model: string, maxTokens: number, caseNumber: number): Record<string, unknown> {
  const body = base(surface, model, "Follow the request exactly. Return the marker FIDELITY_OK when appropriate.", maxTokens);
  const tools = [tool(surface)];
  if (feature.startsWith("tool-") || feature === "parallel-tools" || feature === "stream-tools") body.tools = feature === "parallel-tools" ? [tool(surface, "first_probe"), tool(surface, "second_probe")] : tools;
  if (feature === "tool-namespace" && surface === "openai-responses") {
    body.tools = [{
      type: "namespace",
      name: "codex_app",
      description: "[SANITIZED]",
      tools: [
        { type: "function", name: "navigate_to_codex_page", description: "[SANITIZED]", strict: false, defer_loading: true, parameters: { type: "object", properties: { threadId: { type: "string" } }, required: ["threadId"], additionalProperties: false } },
        { type: "function", name: "read_thread_terminal", description: "[SANITIZED]", strict: false, defer_loading: true, parameters: { type: "object", properties: {}, additionalProperties: false } },
      ],
    }];
    body.tool_choice = "required";
  }
  if (feature === "tool-required") body.tool_choice = surface === "anthropic-messages" ? { type: "any" } : "required";
  if (feature === "tool-named" || feature === "tool-schema" || feature === "stream-tools") body.tool_choice = surface === "anthropic-messages" ? { type: "tool", name: "record_fidelity" } : surface === "openai-chat" ? { type: "function", function: { name: "record_fidelity" } } : { type: "function", name: "record_fidelity" };
  if (feature === "parallel-tools") { if (surface !== "anthropic-messages") body.parallel_tool_calls = true; body.messages = surface === "anthropic-messages" ? [{ role: "user", content: "Call both tools in parallel." }] : body.messages; body.input = surface === "openai-responses" ? "Call both tools in parallel." : body.input; }
  if (feature === "thinking" || feature === "thinking-budget") Object.assign(body, surface === "anthropic-messages" ? { thinking: { type: "enabled", budget_tokens: feature === "thinking-budget" ? 256 : 128 } } : { reasoning: { effort: "low", summary: "auto" } });
  if (feature === "cache" && surface === "anthropic-messages") body.system = [{ type: "text", text: "Stable cache probe", cache_control: { type: "ephemeral" } }];
  if (feature === "max-tokens") Object.assign(body, surface === "openai-responses" ? { max_output_tokens: 16, input: "Write at least one hundred words." } : { max_tokens: 1, messages: [{ role: "user", content: "Write ten words." }] });
  if (feature === "stop") Object.assign(body, surface === "anthropic-messages" ? { stop_sequences: ["STOP_HERE"], messages: [{ role: "user", content: "Output BEFORE_STOP STOP_HERE AFTER_STOP exactly." }] } : surface === "openai-chat" ? { stop: ["STOP_HERE"], messages: [{ role: "user", content: "Output BEFORE_STOP STOP_HERE AFTER_STOP exactly." }] } : { input: "Output BEFORE_STOP STOP_HERE AFTER_STOP exactly." });
  if (feature === "determinism") body.temperature = 0;
  if (feature === "seed" && surface !== "anthropic-messages") body.seed = 424242;
  if (feature === "system") Object.assign(body, surface === "anthropic-messages" ? { system: "The private rule is ORANGE_17.", messages: [{ role: "user", content: "State the private rule." }] } : surface === "openai-chat" ? { messages: [{ role: "system", content: "The private rule is ORANGE_17." }, { role: "user", content: "State the private rule." }] } : { instructions: "The private rule is ORANGE_17.", input: "State the private rule." });
  if (feature === "json") Object.assign(body, surface === "anthropic-messages" ? { messages: [{ role: "user", content: "Return only valid JSON: {\"marker\":\"FIDELITY_OK\"}." }] } : surface === "openai-chat" ? { response_format: { type: "json_object" }, messages: [{ role: "user", content: "Return JSON with marker FIDELITY_OK." }] } : { text: { format: { type: "json_object" } }, input: "Return JSON with marker FIDELITY_OK." });
  if (["stream-deltas", "finish-reason", "terminal-usage", "stream-error", "stream-tools"].includes(feature)) body.stream = true;
  if (feature === "stream-error") body.gateway_fidelity_fixture = "mid_stream_error";
  if (feature === "refusal-shape") body.gateway_fidelity_fixture = "policy_refusal";
  if (feature === "retry-after") body.gateway_fidelity_fixture = "rate_limit";
  if (feature === "unknown-parameter") body.gateway_fidelity_unknown_parameter = true;
  if (feature === "model-not-found") body.model = "gateway-fidelity-model-that-must-not-exist";
  if (feature === "model-identity") Object.assign(body, surface === "anthropic-messages" ? { messages: [{ role: "user", content: "State the exact serving model identifier, then FIDELITY_OK." }] } : surface === "openai-chat" ? { messages: [{ role: "user", content: "State the exact serving model identifier, then FIDELITY_OK." }] } : { input: "State the exact serving model identifier, then FIDELITY_OK." });
  return tagBody(body, surface, caseNumber);
}

function tagBody(body: Record<string, any>, surface: Surface, caseNumber: number): Record<string, unknown> {
  const marker = ` GF_CASE_${String(caseNumber).padStart(2, "0")}`;
  if (surface === "openai-responses") {
    if (typeof body.input === "string") body.input += marker;
    else if (Array.isArray(body.input)) body.input.push({ type: "message", role: "user", content: [{ type: "input_text", text: marker.trim() }] });
    return body;
  }
  const messages = Array.isArray(body.messages) ? body.messages : [];
  const user = [...messages].reverse().find((entry: any) => entry.role === "user");
  if (!user) messages.push({ role: "user", content: marker.trim() });
  else if (typeof user.content === "string") user.content += marker;
  else if (Array.isArray(user.content)) user.content.push({ type: "text", text: marker.trim() });
  body.messages = messages;
  return body;
}

function text(json: unknown): string { return JSON.stringify(json ?? ""); }
function structuredError(response: WireResponse): boolean { return response.status >= 400 && Boolean(response.error?.type); }
function hasTool(value: string): boolean { return /tool_use|tool_calls|function_call|record_fidelity|first_probe|second_probe/.test(value); }

function observe(feature: Feature, response: WireResponse): Observation {
  const value = text(response.json);
  const refusalEvidence = [response.error?.type, response.error?.code, response.error?.param].filter(Boolean).join(" ");
  const refused = structuredError(response) && response.status !== 401 && /refus|unsupported|not_supported|capabil|policy/i.test(refusalEvidence);
  const errorEvidence = [response.error?.type, response.error?.code, response.error?.param].filter(Boolean).join("/") || "untyped";
  const common = { supported: response.status !== 404, success: response.ok, refused, httpStatus: response.status, errorType: response.error?.type, errorCode: response.error?.code, errorParam: response.error?.param, detail: response.ok ? "Observable response matched the requested behavior." : `HTTP ${response.status} returned ${errorEvidence}.` };
  let featurePresent = response.ok;
  let metadata: boolean | undefined;
  let complete: boolean | undefined;
  let signal: string | undefined;
  switch (feature) {
    case "tool-auto": featurePresent = response.ok && !hasTool(value); break;
    case "tool-required": featurePresent = hasTool(value); break;
    case "tool-named": featurePresent = /record_fidelity/.test(value); break;
    case "tool-schema": featurePresent = hasTool(value) && /exact/.test(value) && /count/.test(value); break;
    case "tool-loop": case "tool-error": featurePresent = response.ok && /FIDELITY_OK/.test(value); break;
    case "parallel-tools": featurePresent = (value.match(/first_probe|second_probe/g) || []).length >= 2; break;
    case "thinking": featurePresent = /"type":"thinking"|"reasoning":/.test(value); break;
    case "thinking-budget": featurePresent = /"type":"thinking"|"reasoning":/.test(value); metadata = /thinking_tokens|reasoning_tokens/.test(value); break;
    case "cache": metadata = /cache_creation|cache_read|cached_tokens/.test(value); featurePresent = response.ok && metadata; break;
    case "max-tokens": featurePresent = /max_tokens|length|incomplete/.test(value); break;
    case "stop": featurePresent = !value.includes("AFTER_STOP"); break;
    case "determinism": case "seed": featurePresent = response.ok; break;
    case "system": featurePresent = value.includes("ORANGE_17"); break;
    case "json": try { const candidate = extractText(response.json); JSON.parse(candidate); featurePresent = true; } catch { featurePresent = false; } break;
    case "stream-deltas": featurePresent = (response.stream?.chunks || 0) >= 2 && (response.stream?.nonEmptyDeltas || 0) >= 2; break;
    case "finish-reason": featurePresent = /^(stop|end_turn|completed)$/.test(response.stream?.finishReason || ""); break;
    case "terminal-usage": featurePresent = Boolean(response.stream?.usagePresent); metadata = featurePresent; break;
    case "stream-error": featurePresent = Boolean(response.stream?.typedError); break;
    case "stream-tools": featurePresent = (response.stream?.toolArgumentFragments || 0) >= 1; complete = Boolean(response.stream?.terminal); break;
    case "refusal-shape": featurePresent = structuredError(response) && /policy_refusal|refusal/.test(value); break;
    case "retry-after": featurePresent = Boolean(response.headers["retry-after"]); metadata = featurePresent; break;
    case "unknown-parameter": featurePresent = response.status >= 400; break;
    case "model-not-found": common.supported = true; featurePresent = response.status === 404 && structuredError(response); break;
    case "model-identity": signal = modelSignal(response.json); featurePresent = true; break;
    case "usage-origin": featurePresent = /usage/.test(value); metadata = /input|prompt/.test(value) && /output|completion/.test(value); break;
    case "response-identity": featurePresent = /model|provider|owned_by/.test(value); metadata = featurePresent; break;
    case "tool-namespace": featurePresent = /navigate_to_codex_page|read_thread_terminal/.test(value); break;
  }
  return { ...common, feature: featurePresent, metadata, complete, signal };
}

function extractText(json: unknown): string {
  const root = json as any;
  return root?.choices?.[0]?.message?.content ?? root?.content?.find?.((item: any) => item.type === "text")?.text ?? root?.output_text ?? root?.output?.[0]?.content?.[0]?.text ?? "";
}

function modelSignal(json: unknown): string | undefined {
  const root = json as any;
  const value = root?.model || root?.provider;
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export function defineCase(number: number, slug: string, title: string, feature: Feature, rationale: string, options: { mode?: "live" | "fixture"; surfaces?: Surface[]; advisory?: boolean; probes?: number; exclusions?: Partial<Record<Surface, string>> } = {}): CaseSpec {
  const mode = options.mode || "live";
  const probes: ProbeSpec[] = Array.from({ length: options.probes || (feature === "determinism" || feature === "seed" ? 2 : 1) }, (_, index) => ({
    id: `${String(number).padStart(2, "0")}.${index + 1}`,
    title: index ? `${title} repeat ${index + 1}` : title,
    caseNumber: number,
    mode,
    surfaces: options.surfaces || ALL,
    maxTokens: 64,
    advisory: options.advisory,
    request: (surface, model) => request(feature, surface, model, 64, number),
    observe: (response) => observe(feature, response),
    ...(["refusal-shape","retry-after","unknown-parameter","model-not-found","stream-error"].includes(feature) ? { compare: negativeComparison } : {}),
    ...(["tool-loop","tool-error"].includes(feature) ? { continuation: (surface: Surface, model: string, first: WireResponse) => continuation(feature, surface, model, first, number) } : {}),
  }));
  return { number, slug, title, mode, rationale, probes, ...(options.exclusions ? { exclusions: options.exclusions } : {}) };
}

function negativeComparison(baseline: Observation, gateway: Observation): Comparison {
  if (!baseline.feature) return { status: "INDETERMINATE", detail: `The case could not be evaluated: the controlled baseline did not exhibit the expected failure behavior (${baseline.detail}).` };
  if (gateway.feature) return { status: "PASS", detail: "Gateway preserved the controlled failure behavior and its observable metadata." };
  if (gateway.success) return { status: "SILENTLY_REWRITTEN", detail: "The controlled baseline failed explicitly, but the gateway returned success." };
  return { status: "DEGRADED", detail: "The gateway failed, but lost the expected structured failure shape or metadata." };
}

function continuation(feature: Feature, surface: Surface, model: string, first: WireResponse, caseNumber: number): Record<string, unknown> {
  const root = first.json as any;
  const isError = feature === "tool-error";
  const result = isError ? '{"error":{"type":"fixture_tool_error","message":"controlled"}}' : '{"ok":true}';
  if (surface === "anthropic-messages") {
    const use = root?.content?.find?.((item: any) => item.type === "tool_use") || { type: "tool_use", id: "tool_1", name: "record_fidelity", input: { mode: "exact", nested: { count: 1 } } };
    return tagBody({ model, max_tokens: 64, messages: [{ role: "user", content: "Use the tool." }, { role: "assistant", content: [use] }, { role: "user", content: [{ type: "tool_result", tool_use_id: use.id, content: result, ...(isError ? { is_error: true } : {}) }, { type: "text", text: "Finish with FIDELITY_OK." }] }] }, surface, caseNumber);
  }
  if (surface === "openai-chat") {
    const call = root?.choices?.[0]?.message?.tool_calls?.[0] || { id: "call_1", type: "function", function: { name: "record_fidelity", arguments: '{}' } };
    return tagBody({ model, max_tokens: 64, messages: [{ role: "user", content: "Use the tool." }, { role: "assistant", content: null, tool_calls: [call] }, { role: "tool", tool_call_id: call.id, content: result }, { role: "user", content: "Finish with FIDELITY_OK." }] }, surface, caseNumber);
  }
  const call = root?.output?.find?.((item: any) => item.type === "function_call") || { type: "function_call", call_id: "call_1", name: "record_fidelity", arguments: '{}' };
  return tagBody({ model, max_output_tokens: 64, input: [call, { type: "function_call_output", call_id: call.call_id, output: result }, { type: "message", role: "user", content: [{ type: "input_text", text: "Finish with FIDELITY_OK." }] }] }, surface, caseNumber);
}
