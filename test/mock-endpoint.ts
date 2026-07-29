import http from "node:http";

export type InjectedDefect = "tool-choice-auto" | "cache-counters-dropped" | "buffered-stream" | "system-demoted" | "tool-input-truncated" | "model-substituted" | "namespace-forwarded" | "usage-displaces-content";

export async function startMockEndpoint(options: { defects?: InjectedDefect[]; defectCases?: number[] } = {}) {
  const defects = new Set(options.defects || []); const defectCases = new Set(options.defectCases || []); const sequence = new Map<string, number>();
  const server = http.createServer(async (req, res) => {
    if (req.method === "GET" && req.url === "/v1/models") {
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({ data: [{ id: "mock-model" }] }));
      return;
    }
    const chunks: Buffer[] = []; for await (const chunk of req) chunks.push(Buffer.from(chunk));
    let body: any = {}; try { body = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}"); } catch { /* empty */ }
    const path = req.url || ""; const caseNumber = Number(JSON.stringify(body).match(/GF_CASE_(\d{2})/)?.[1] || 0); const bad = defectCases.has(caseNumber);
    res.setHeader("content-type", "application/json");

    if (body.gateway_fidelity_fixture === "policy_refusal") { res.statusCode = bad ? 502 : 403; res.end(JSON.stringify({ error: { type: bad ? "provider_error" : "policy_refusal", code: bad ? "upstream_failed" : "fixture_policy" } })); return; }
    if (body.gateway_fidelity_fixture === "rate_limit") { res.statusCode = 429; if (!bad) res.setHeader("retry-after", "1"); res.end(JSON.stringify({ error: { type: "rate_limit_error", code: "fixture_limit" } })); return; }
    if (body.gateway_fidelity_fixture === "mid_stream_error") { res.setHeader("content-type", "text/event-stream"); res.end(bad ? 'data: {"type":"response.output_text.delta","delta":"truncated"}\n\n' : 'event: error\ndata: {"type":"error","error":{"type":"fixture_stream_error"}}\n\n'); return; }
    if (body.model === "gateway-fidelity-model-that-must-not-exist" && !bad) { res.statusCode = 404; res.end(JSON.stringify({ error: { type: "not_found_error", code: "model_not_found" } })); return; }
    if (body.gateway_fidelity_unknown_parameter && !bad) { res.statusCode = 400; res.end(JSON.stringify({ error: { type: "invalid_request_error", code: "unknown_parameter" } })); return; }
    if ((bad || defects.has("namespace-forwarded")) && caseNumber === 29) { res.statusCode = 400; res.end(JSON.stringify({ error: { type: "invalid_request_error", code: "unsupported_tool_type", param: "tools.0", message: "Input tag 'namespace' does not match the provider tool union." } })); return; }

    const rewriteChoice = defects.has("tool-choice-auto") && body.tool_choice != null;
    const requestedTools = Array.isArray(body.tools);
    const toolsAllowed = caseNumber === 1 ? bad : requestedTools && !rewriteChoice && !(bad && caseNumber === 2);
    if (body.stream) { await streamResponse(res, path, caseNumber, toolsAllowed, bad || (caseNumber === 17 && defects.has("buffered-stream")), rewriteChoice); return; }

    const substituted = (caseNumber === 26 && defects.has("model-substituted")) || (bad && [25,26].includes(caseNumber));
    const model = substituted ? "substituted-model" : body.model;
    const systemLost = (caseNumber === 15 && defects.has("system-demoted")) || (bad && caseNumber === 15);
    const systemEffective = !systemLost && (body.system || body.instructions || body.messages?.some((entry: any) => entry.role === "system"));
    let content = systemEffective ? "ORANGE_17" : JSON.stringify({ marker: "FIDELITY_OK" });
    if ((bad || defects.has("usage-displaces-content")) && caseNumber === 30) content = "";
    if (bad && caseNumber === 12) content = "BEFORE_STOP STOP_HERE AFTER_STOP";
    if (bad && caseNumber === 16) content = "{not valid json";
    if (bad && [5,7].includes(caseNumber) && !requestedTools) content = "continuation dropped";
    const truncated = (caseNumber === 4 && defects.has("tool-input-truncated")) || (bad && caseNumber === 4);
    const toolInput = truncated ? { mode: "exact" } : { mode: "exact", nested: { count: 1 } };
    const cacheLost = (caseNumber === 10 && defects.has("cache-counters-dropped")) || (bad && caseNumber === 10);
    const thinkingLost = bad && caseNumber === 8; const thinkingBudgetLost = bad && caseNumber === 9;
    const usageLost = bad && [19,27].includes(caseNumber);
    const anthropicUsage: any = { input_tokens: 4, output_tokens: 4, ...(!cacheLost ? { cache_creation_input_tokens: 1, cache_read_input_tokens: 1 } : {}), ...(body.thinking && !thinkingBudgetLost ? { thinking_tokens: 128 } : {}) };
    const openAiUsage: any = { prompt_tokens: 4, completion_tokens: 4, total_tokens: 8, ...(!cacheLost ? { prompt_tokens_details: { cached_tokens: 2 } } : {}), ...(body.reasoning && !thinkingBudgetLost ? { completion_tokens_details: { reasoning_tokens: 128 } } : {}) };
    const identity: any = bad && caseNumber === 28 ? {} : { model };
    const idKey = `${caseNumber}:${path}`; const next = (sequence.get(idKey) || 0) + 1; sequence.set(idKey, next);
    const id = bad && [13,14].includes(caseNumber) ? `variable_${next}` : "stable_mock";
    const selectedTools = (bad && caseNumber === 6 ? body.tools?.slice(0, 1) : body.tools)
      ?.flatMap((entry: any) => entry?.type === "namespace" && Array.isArray(entry.tools) ? entry.tools : [entry]);
    const named = bad && caseNumber === 3 ? "wrong_tool" : undefined;

    if (path.includes("/messages")) {
      const response: any = { id, ...identity, content: toolsAllowed ? selectedTools.map((entry: any, index: number) => ({ type: "tool_use", id: `tool_${index}`, name: named || entry.name, input: toolInput })) : [...(body.thinking && !thinkingLost ? [{ type: "thinking", thinking: "mock reasoning" }] : []), { type: "text", text: content }], stop_reason: toolsAllowed ? "tool_use" : body.max_tokens === 1 && !(bad && caseNumber === 11) ? "max_tokens" : "end_turn" };
      if (!usageLost) response.usage = anthropicUsage; res.end(JSON.stringify(response));
    } else if (path.includes("/chat/")) {
      const response: any = { id, ...identity, ...(body.reasoning && !thinkingLost ? { reasoning: { summary: "mock reasoning" } } : {}), choices: [{ message: toolsAllowed ? { role: "assistant", content: null, tool_calls: selectedTools.map((entry: any, index: number) => ({ id: `call_${index}`, type: "function", function: { name: named || entry.function.name, arguments: JSON.stringify(toolInput) } })) } : { role: "assistant", content }, finish_reason: toolsAllowed ? "tool_calls" : body.max_tokens === 1 && !(bad && caseNumber === 11) ? "length" : "stop" }] };
      if (!usageLost) response.usage = openAiUsage; res.end(JSON.stringify(response));
    } else {
      const response: any = { id, ...identity, status: body.max_output_tokens <= 16 && !(bad && caseNumber === 11) ? "incomplete" : "completed", ...(body.reasoning && !thinkingLost ? { reasoning: { summary: "mock reasoning" } } : {}), output_text: content, output: toolsAllowed ? selectedTools.map((entry: any, index: number) => ({ type: "function_call", call_id: `call_${index}`, name: named || entry.name, arguments: JSON.stringify(toolInput) })) : [{ type: "message", content: [{ type: "output_text", text: content }] }] };
      if (!usageLost) response.usage = { input_tokens: 4, output_tokens: 4, total_tokens: 8, ...(!cacheLost ? { input_tokens_details: { cached_tokens: 2 } } : {}), ...(body.reasoning && !thinkingBudgetLost ? { output_tokens_details: { reasoning_tokens: 128 } } : {}) }; res.end(JSON.stringify(response));
    }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address(); if (!address || typeof address === "string") throw new Error("mock bind failed");
  return { url: `http://127.0.0.1:${address.port}`, close: () => new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())) };
}

async function streamResponse(res: http.ServerResponse, path: string, caseNumber: number, toolsAllowed: boolean, bad: boolean, rewriteChoice: boolean) {
  res.setHeader("content-type", "text/event-stream"); const toolStreamBroken = (bad && caseNumber === 21) || (rewriteChoice && caseNumber === 21);
  let frames: string[];
  if (path.includes("/messages")) frames = toolsAllowed && !toolStreamBroken
    ? ['event: content_block_start\ndata: {"type":"content_block_start","content_block":{"type":"tool_use","id":"tool_1","name":"record_fidelity","input":{}}}', 'event: content_block_delta\ndata: {"type":"content_block_delta","delta":{"type":"input_json_delta","partial_json":"{\\"mode\\":\\"exact\\"}"}}', `event: message_delta\ndata: {"type":"message_delta","delta":{"stop_reason":"${bad && caseNumber === 18 ? "max_tokens" : "tool_use"}"}${bad && caseNumber === 19 ? "" : ',"usage":{"output_tokens":2}'}}`, 'event: message_stop\ndata: {"type":"message_stop"}']
    : ['event: content_block_delta\ndata: {"type":"content_block_delta","delta":{"type":"text_delta","text":"FIDELITY"}}', 'event: content_block_delta\ndata: {"type":"content_block_delta","delta":{"type":"text_delta","text":"_OK"}}', `event: message_delta\ndata: {"type":"message_delta","delta":{"stop_reason":"${bad && caseNumber === 18 ? "max_tokens" : "end_turn"}"}${bad && caseNumber === 19 ? "" : ',"usage":{"output_tokens":2}'}}`, 'event: message_stop\ndata: {"type":"message_stop"}'];
  else frames = toolsAllowed && !toolStreamBroken
    ? ['data: {"type":"response.function_call_arguments.delta","delta":"{\\"mode\\":"}', 'data: {"type":"response.function_call_arguments.delta","delta":"\\"exact\\"}"}', `data: {"type":"response.completed","response":{"status":"${bad && caseNumber === 18 ? "incomplete" : "completed"}"${bad && caseNumber === 19 ? "" : ',"usage":{"input_tokens":2,"output_tokens":2}'}}}`, 'data: [DONE]']
    : ['data: {"object":"chat.completion.chunk","choices":[{"delta":{"content":"FIDELITY"},"finish_reason":null}]}', 'data: {"object":"chat.completion.chunk","choices":[{"delta":{"content":"_OK"},"finish_reason":null}]}', `data: {"object":"chat.completion.chunk","choices":[{"delta":{},"finish_reason":"${bad && caseNumber === 18 ? "length" : "stop"}"}]${bad && caseNumber === 19 ? "" : ',"usage":{"prompt_tokens":2,"completion_tokens":2}'}}`, 'data: [DONE]'];
  const payloads = frames.map((frame) => `${frame}\n\n`); if (bad && caseNumber === 17) { res.end(payloads.join("")); return; }
  for (const payload of payloads) { res.write(payload); await new Promise<void>((resolve) => setTimeout(resolve, 2)); } res.end();
}
