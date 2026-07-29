import assert from "node:assert/strict";
import { test } from "node:test";
import { cases } from "../cases/index.js";
import { cellsWithGatewayDetail, plannedGatewayRequestsForCells, rerunGatewayCells } from "../src/delta.js";
import { redact } from "../src/redact.js";
import { markdown } from "../src/reporters.js";
import { plannedRequests, plannedRequestsByCase, runSuite } from "../src/runner.js";
import { isEventStream, requestHeaders } from "../src/transport.js";
import { compareObservations } from "../src/verdict.js";
import { startMockEndpoint, type InjectedDefect } from "./mock-endpoint.js";

function baselineConfig(url: string) { return { baselineUrls: { anthropic: url, openai: url }, baselineKeys: { anthropic: "baseline-test-key", openai: "baseline-test-key" } }; }

test("exports exactly 30 documented numbered cases", () => {
  assert.equal(cases.length, 30);
  assert.deepEqual(cases.map((item) => item.number), Array.from({ length: 30 }, (_, index) => index + 1));
  assert.equal(cases.filter((item) => item.mode === "fixture").map((item) => item.number).join(","), "20,22,23,25");
});

test("verdict ordering distinguishes honest refusal and baseline exclusion", () => {
  const supported = { supported: true, success: true, refused: false, feature: true, detail: "ok" };
  assert.equal(compareObservations(supported, supported).status, "PASS");
  assert.equal(compareObservations(supported, { ...supported, success: false, refused: true, feature: false }).status, "REFUSED");
  assert.equal(compareObservations(supported, { ...supported, feature: false }).status, "SILENTLY_REWRITTEN");
  assert.equal(compareObservations({ ...supported, feature: false }, supported).status, "INDETERMINATE");
  assert.equal(compareObservations({ ...supported, success: false, feature: false, refused: true, httpStatus: 400, errorType: "unsupported_feature" }, supported).status, "UNSUPPORTED");
  assert.equal(compareObservations({ ...supported, success: false, feature: false, httpStatus: 429, errorType: "insufficient_quota" }, supported).status, "INDETERMINATE");
  assert.equal(compareObservations(supported, { ...supported, success: false, feature: false, httpStatus: 401, errorType: "authentication_error", detail: "HTTP 401" }).status, "INDETERMINATE");
  assert.equal(compareObservations({ ...supported, signal: "baseline-model" }, { ...supported, success: false, httpStatus: 401, feature: true, detail: "HTTP 401 returned error." }, true).status, "INDETERMINATE");
  assert.equal(compareObservations({ ...supported, signal: "baseline-model" }, { ...supported, signal: "gateway-model" }, true).status, "INDICATIVE");
});

test("redaction removes nested secrets", () => {
  const value = redact({ authorization: "Bearer secret", nested: { apiKey: "sk-test-123456789", message: "token-abcdefghijk" } });
  assert.equal(JSON.stringify(value).includes("secret"), false);
  assert.equal(JSON.stringify(value).includes("abcdefghijk"), false);
});

test("uses gateway bearer auth and provider-native baseline auth", () => {
  assert.deepEqual(requestHeaders("anthropic-messages", "gateway-key", "gateway"), { "content-type": "application/json", authorization: "Bearer gateway-key" });
  assert.deepEqual(requestHeaders("anthropic-messages", "gateway-key", "gateway", "native"), { "content-type": "application/json", "x-api-key": "gateway-key", "anthropic-version": "2023-06-01" });
  assert.deepEqual(requestHeaders("anthropic-messages", "anthropic-key", "baseline"), { "content-type": "application/json", "x-api-key": "anthropic-key", "anthropic-version": "2023-06-01" });
  assert.deepEqual(requestHeaders("openai-chat", "openai-key", "baseline"), { "content-type": "application/json", authorization: "Bearer openai-key" });
});

test("parses rejected streaming requests as JSON unless the response is SSE", () => {
  assert.equal(isEventStream("application/json"), false);
  assert.equal(isEventStream("text/event-stream; charset=utf-8"), true);
  assert.equal(isEventStream(null), false);
});

test("uses separate direct baselines and rejects the gateway as a baseline", async () => {
  const anthropic = await startMockEndpoint(); const openai = await startMockEndpoint(); const gateway = await startMockEndpoint();
  try {
    const common = { key: "gateway-test-key", baselineKeys: { anthropic: "anthropic-test-key", openai: "openai-test-key" }, surfaces: ["anthropic-messages","openai-chat","openai-responses"] as const, models: { "anthropic-messages": "mock", "openai-chat": "mock", "openai-responses": "mock" } as const, modes: ["live" as const], caseNumbers: [1], maxRequests: 10, maxTokens: 64, timeoutMs: 2_000 };
    const report = await runSuite({ ...common, surfaces: [...common.surfaces], baseUrl: gateway.url, baselineUrls: { anthropic: anthropic.url, openai: openai.url } });
    assert.deepEqual(report.baselines, { anthropic: anthropic.url, openai: openai.url });
    await assert.rejects(() => runSuite({ ...common, surfaces: [...common.surfaces], baseUrl: gateway.url, baselineUrls: { anthropic: gateway.url, openai: openai.url } }), /baseline URL must not be the gateway URL/);
  } finally { await anthropic.close(); await openai.close(); await gateway.close(); }
});

test("runs the live suite against controlled mock baseline and gateway", async () => {
  const baseline = await startMockEndpoint(); const gateway = await startMockEndpoint();
  try {
    const surfaces = ["anthropic-messages","openai-chat","openai-responses"] as const;
    assert.equal(plannedRequests({ surfaces: [...surfaces], modes: ["live"] }), 178);
    const report = await runSuite({ baseUrl: gateway.url, ...baselineConfig(baseline.url), key: "gateway-test-key", surfaces: [...surfaces], models: { "anthropic-messages": "mock", "openai-chat": "mock", "openai-responses": "mock" }, modes: ["live"], maxRequests: 200, maxTokens: 64, timeoutMs: 2_000 });
    assert.equal(report.results.length, 86);
    assert.equal(report.limits.requests, 178);
    assert.equal(report.results.every((result) => result.status === "PASS" || ([14,29].includes(result.caseNumber) && result.status === "INDETERMINATE") || (result.caseNumber === 24 && result.status === "REFUSED")), true, JSON.stringify(report.results.filter((result) => result.status !== "PASS")));
    const rendered = markdown(report);
    assert.match(rendered, /OpenAI Chat Completions/);
    assert.doesNotMatch(rendered, /gateway-test-key|baseline-test-key/);
  } finally { await baseline.close(); await gateway.close(); }
});

test("locks the per-case round-trip counts", () => {
  const surfaces = ["anthropic-messages","openai-chat","openai-responses"] as const;
  const counts = new Map(plannedRequestsByCase({ surfaces: [...surfaces], modes: ["live"] }).map((entry) => [entry.caseNumber, entry]));
  for (const caseNumber of [5, 7, 10, 13]) assert.deepEqual(counts.get(caseNumber)?.perSurfacePerTarget, { "anthropic-messages": 2, "openai-chat": 2, "openai-responses": 2 });
  assert.deepEqual(counts.get(14)?.perSurfacePerTarget, { "anthropic-messages": 0, "openai-chat": 2, "openai-responses": 2 });
  for (const caseNumber of [1,2,3,4,6,8,9,11,12,15,16,17,18,19,21,24,26,27,28,30]) assert.deepEqual(counts.get(caseNumber)?.perSurfacePerTarget, { "anthropic-messages": 1, "openai-chat": 1, "openai-responses": 1 });
  assert.deepEqual(counts.get(29)?.perSurfacePerTarget, { "anthropic-messages": 0, "openai-chat": 0, "openai-responses": 1 });
});

test("case 14 renders an explicit zero-request Anthropic exclusion", async () => {
  const baseline = await startMockEndpoint(); const gateway = await startMockEndpoint();
  try {
    const report = await runSuite({ baseUrl: gateway.url, ...baselineConfig(baseline.url), key: "gateway-test-key", surfaces: ["anthropic-messages","openai-chat","openai-responses"], models: { "anthropic-messages": "mock", "openai-chat": "mock", "openai-responses": "mock" }, modes: ["live"], caseNumbers: [14], maxRequests: 10, maxTokens: 64, timeoutMs: 2_000 });
    assert.equal(report.limits.requests, 8);
    const anthropic = report.results.filter((result) => result.surface === "anthropic-messages");
    assert.equal(anthropic.length, 1); assert.equal(anthropic[0].status, "INDETERMINATE");
    assert.match(markdown(report), /14\. Seed determinism \| INDETERMINATE/);
  } finally { await baseline.close(); await gateway.close(); }
});

test("gateway delta reruns and merges only selected cells", async () => {
  const baseline = await startMockEndpoint(); const gateway = await startMockEndpoint();
  try {
    const report = await runSuite({ baseUrl: gateway.url, ...baselineConfig(baseline.url), key: "gateway-test-key", surfaces: ["openai-chat"], models: { "openai-chat": "mock" }, modes: ["live"], caseNumbers: [2], maxRequests: 2, maxTokens: 64, timeoutMs: 2_000 });
    const candidate = structuredClone(report);
    candidate.results[0] = {
      ...candidate.results[0],
      status: "INDETERMINATE",
      detail: "The case could not be evaluated through the gateway (HTTP 401 returned error.).",
      gateway: { supported: true, success: false, refused: false, httpStatus: 401, errorType: "error", detail: "HTTP 401 returned error.", feature: false },
    };
    const cells = cellsWithGatewayDetail(candidate, /HTTP 401/);
    assert.equal(plannedGatewayRequestsForCells(cells), 1);
    const merged = await rerunGatewayCells({ report: candidate, baseUrl: gateway.url, key: "gateway-test-key", cells, maxRequests: 1, maxTokens: 64, timeoutMs: 2_000 });
    assert.equal(merged.results.length, candidate.results.length);
    assert.equal(merged.results[0].status, "PASS");
    assert.equal(merged.limits.requests, 1);
  } finally { await baseline.close(); await gateway.close(); }
});

test("every numbered case has a planted defect that changes its expected result", async () => {
  const expectedStatus = new Map<number, string>([
    [1,"SILENTLY_REWRITTEN"],[2,"SILENTLY_REWRITTEN"],[3,"SILENTLY_REWRITTEN"],[4,"SILENTLY_REWRITTEN"],[5,"SILENTLY_REWRITTEN"],[6,"SILENTLY_REWRITTEN"],[7,"SILENTLY_REWRITTEN"],[8,"SILENTLY_REWRITTEN"],[9,"DEGRADED"],[10,"DEGRADED"],[11,"SILENTLY_REWRITTEN"],[12,"SILENTLY_REWRITTEN"],[13,"SILENTLY_REWRITTEN"],[14,"SILENTLY_REWRITTEN"],[15,"SILENTLY_REWRITTEN"],[16,"SILENTLY_REWRITTEN"],[17,"SILENTLY_REWRITTEN"],[18,"SILENTLY_REWRITTEN"],[19,"DEGRADED"],[20,"SILENTLY_REWRITTEN"],[21,"SILENTLY_REWRITTEN"],[22,"DEGRADED"],[23,"DEGRADED"],[24,"SILENTLY_REWRITTEN"],[25,"SILENTLY_REWRITTEN"],[26,"INDICATIVE"],[27,"DEGRADED"],[28,"DEGRADED"],[29,"REFUSED"],[30,"SILENTLY_REWRITTEN"],
  ]);
  for (let caseNumber = 1; caseNumber <= 30; caseNumber += 1) {
    const modes = [20,22,23,25].includes(caseNumber) ? ["fixture" as const] : ["live" as const];
    const baseline = await startMockEndpoint(); const good = await startMockEndpoint(); const bad = await startMockEndpoint({ defectCases: [caseNumber] });
    try {
      const common = { ...baselineConfig(baseline.url), key: "gateway-test-key", surfaces: ["anthropic-messages","openai-chat","openai-responses"] as const, models: { "anthropic-messages": "mock", "openai-chat": "mock", "openai-responses": "mock" } as const, modes: [...modes], caseNumbers: [caseNumber], maxRequests: 20, maxTokens: 64, timeoutMs: 2_000 };
      const reference = await runSuite({ ...common, surfaces: [...common.surfaces], baseUrl: good.url });
      const planted = await runSuite({ ...common, surfaces: [...common.surfaces], baseUrl: bad.url });
      const referenceStatus = new Map(reference.results.map((result) => [`${result.probeId}:${result.surface}`, result.status]));
      const changes = planted.results.filter((result) => result.status !== referenceStatus.get(`${result.probeId}:${result.surface}`));
      assert.equal(changes.length > 0, true, `case ${caseNumber} did not detect its planted defect`);
      assert.equal(changes.every((result) => result.status === expectedStatus.get(caseNumber)), true, `case ${caseNumber}: ${JSON.stringify(changes)}`);
    } finally { await baseline.close(); await good.close(); await bad.close(); }
  }
});

test("case 29 alone fails when the namespace-forwarding defect is planted and passes with the fix", async () => {
  const baseline = await startMockEndpoint();
  const fixedGateway = await startMockEndpoint();
  const defectiveGateway = await startMockEndpoint({ defects: ["namespace-forwarded"] });
  const common = {
    ...baselineConfig(baseline.url),
    key: "gateway-test-key",
    surfaces: ["openai-responses"] as const,
    models: { "openai-responses": "mock" } as const,
    modes: ["live" as const],
    caseNumbers: [29],
    maxRequests: 2,
    maxTokens: 64,
    timeoutMs: 2_000,
  };
  try {
    const fixed = await runSuite({ ...common, surfaces: [...common.surfaces], baseUrl: fixedGateway.url });
    const planted = await runSuite({ ...common, surfaces: [...common.surfaces], baseUrl: defectiveGateway.url });
    assert.deepEqual(fixed.results.map((result) => [result.caseNumber, result.status]), [[29, "PASS"]]);
    assert.deepEqual(planted.results.map((result) => [result.caseNumber, result.status]), [[29, "REFUSED"]]);
  } finally {
    await baseline.close();
    await fixedGateway.close();
    await defectiveGateway.close();
  }
});

test("known-bad gateway defects are caught without collateral findings", async () => {
  const expectations: Array<{ defect: InjectedDefect; cases: number[]; status: "SILENTLY_REWRITTEN" | "DEGRADED" | "INDICATIVE" | "REFUSED" }> = [
    { defect: "tool-choice-auto", cases: [2,3,4,21,29], status: "SILENTLY_REWRITTEN" },
    { defect: "cache-counters-dropped", cases: [10], status: "DEGRADED" },
    { defect: "buffered-stream", cases: [17], status: "SILENTLY_REWRITTEN" },
    { defect: "system-demoted", cases: [15], status: "SILENTLY_REWRITTEN" },
    { defect: "tool-input-truncated", cases: [4], status: "SILENTLY_REWRITTEN" },
    { defect: "model-substituted", cases: [26], status: "INDICATIVE" },
    { defect: "namespace-forwarded", cases: [29], status: "REFUSED" },
    { defect: "usage-displaces-content", cases: [30], status: "SILENTLY_REWRITTEN" },
  ];
  const referenceBaseline = await startMockEndpoint(); const referenceGateway = await startMockEndpoint();
  let reference;
  try {
    reference = await runSuite({ baseUrl: referenceGateway.url, ...baselineConfig(referenceBaseline.url), key: "gateway-test-key", surfaces: ["anthropic-messages","openai-chat","openai-responses"], models: { "anthropic-messages": "mock", "openai-chat": "mock", "openai-responses": "mock" }, modes: ["live"], maxRequests: 200, maxTokens: 64, timeoutMs: 2_000 });
  } finally { await referenceBaseline.close(); await referenceGateway.close(); }
  const referenceStatus = new Map(reference.results.map((result) => [`${result.probeId}:${result.surface}`, result.status]));
  for (const expected of expectations) {
    const baseline = await startMockEndpoint(); const gateway = await startMockEndpoint({ defects: [expected.defect] });
    try {
      const report = await runSuite({ baseUrl: gateway.url, ...baselineConfig(baseline.url), key: "gateway-test-key", surfaces: ["anthropic-messages","openai-chat","openai-responses"], models: { "anthropic-messages": "mock", "openai-chat": "mock", "openai-responses": "mock" }, modes: ["live"], maxRequests: 200, maxTokens: 64, timeoutMs: 2_000 });
      const findings = report.results.filter((result) => result.status !== referenceStatus.get(`${result.probeId}:${result.surface}`));
      assert.deepEqual([...new Set(findings.map((result) => result.caseNumber))], expected.cases, `${expected.defect}: ${JSON.stringify(findings)}`);
      assert.equal(findings.every((result) => result.status === expected.status), true, `${expected.defect}: ${JSON.stringify(findings)}`);
    } finally { await baseline.close(); await gateway.close(); }
  }
  const combinedBaseline = await startMockEndpoint(); const combinedGateway = await startMockEndpoint({ defects: expectations.map((entry) => entry.defect) });
  try {
    const report = await runSuite({ baseUrl: combinedGateway.url, ...baselineConfig(combinedBaseline.url), key: "gateway-test-key", surfaces: ["anthropic-messages","openai-chat","openai-responses"], models: { "anthropic-messages": "mock", "openai-chat": "mock", "openai-responses": "mock" }, modes: ["live"], maxRequests: 200, maxTokens: 64, timeoutMs: 2_000 });
    const changed = report.results.filter((result) => result.status !== referenceStatus.get(`${result.probeId}:${result.surface}`));
    assert.deepEqual([...new Set(changed.map((result) => result.caseNumber))], [2,3,4,10,15,17,21,26,29,30]);
    assert.equal(changed.every((result) => result.status === (result.caseNumber === 10 ? "DEGRADED" : result.caseNumber === 26 ? "INDICATIVE" : result.caseNumber === 29 ? "REFUSED" : "SILENTLY_REWRITTEN")), true, JSON.stringify(changed));
  } finally { await combinedBaseline.close(); await combinedGateway.close(); }
});

test("reports controlled fixture cases separately", async () => {
  const baseline = await startMockEndpoint(); const gateway = await startMockEndpoint();
  try {
    const report = await runSuite({ baseUrl: gateway.url, ...baselineConfig(baseline.url), key: "gateway-test-key", surfaces: ["anthropic-messages","openai-chat","openai-responses"], models: { "anthropic-messages": "mock", "openai-chat": "mock", "openai-responses": "mock" }, modes: ["fixture"], maxRequests: 30, maxTokens: 64, timeoutMs: 2_000 });
    assert.equal(report.results.length, 12);
    assert.equal(report.results.every((result) => result.mode === "fixture"), true);
  } finally { await baseline.close(); await gateway.close(); }
});
